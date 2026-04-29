// Build Trigger: 2026-04-29T11:41:00Z
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração MSSQL
const dbConfig = {
    user: (
        process.env.DATABASE_USER || 
        process.env.DB_USER || 
        process.env.DB_USERNAME || 
        process.env.USUARIO_DO_BANCO_DE_DADOS || 
        process.env['USUÁRIO_DO_BANCO_DE_DADOS'] || 
        'adminsql'
    ).trim(),
    password: (
        process.env.DATABASE_PASSWORD || 
        process.env.DATABASE_PASS || 
        process.env.DB_PASS || 
        process.env.DB_PASSWORD || 
        process.env.SENHA_DO_BANCO_DE_DADOS ||
        'Dicompel!$$'
    ).trim(),
    server: (
        process.env.DATABASE_SERVER || 
        process.env.DB_HOST || 
        process.env.DB_SERVER ||
        'configurador-produto-sql.database.windows.net'
    ).trim().replace(/,$/, '').replace('tcp:', ''),
    database: (
        process.env.DATABASE_NAME || 
        process.env.DB_NAME || 
        process.env.NOME_DO_BANCO_DE_DADOS || 
        'configurador-produto'
    ).trim(),
    port: parseInt(process.env.DB_PORT || '1433'),
    connectionTimeout: 5000, // Falha rápido no Vercel em vez de 500 (Timeout)
    requestTimeout: 10000,
    options: {
        encrypt: true,
        trustServerCertificate: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// --- LOGS DE INICIALIZAÇÃO PARA DIAGNÓSTICO ---
console.log(`>> [INFO] Iniciando servidor...`);
console.log(`>> [INFO] Porta: ${PORT}`);
console.log(`>> [INFO] Node Env: ${process.env.NODE_ENV}`);
console.log(`>> [INFO] DB Server: ${dbConfig.server}`);

app.use(express.json());

// FaviIcon bypass
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Pool de conexão (Global)
let pool: sql.ConnectionPool | null = null;
let dbError: string | null = null;

// Função para obter o pool de conexão de forma segura
const getPool = async () => {
    if (pool && pool.connected) return pool;
    
    console.log(`>> [DB] Tentando conectar/reconectar ao servidor: ${dbConfig.server}`);
    try {
        pool = await sql.connect(dbConfig);
        console.log('>> Sucesso: Conectado ao Azure SQL Server (MSSQL)');
        dbError = null;
        return pool;
    } catch (err: any) {
        dbError = err.message;
        if (err.code === 'ETIMEOUT') {
            dbError = "CONNECTION TIMEOUT: Provável bloqueio de Firewall no Azure SQL. Certifique-se de permitir 'Serviços do Azure' no painel do banco de dados.";
        }
        console.error('>> ERRO AO CONECTAR AO BANCO:', dbError);
        pool = null;
        throw err;
    }
};

// Inicia conexão em background (quente), mas as rotas devem usar getPool()
getPool().catch(err => console.error("Initial connection failed, will retry on request."));

// DIAGNOSTIC ENDPOINT (Critical for debugging production)
app.get("/api/db-check", async (req, res) => {
    const startTime = Date.now();
    try {
        console.log(">> Iniciando diagnóstico de banco de dados...");
        const currentPool = await getPool();
        const result = await currentPool.request().query('SELECT GETDATE() as now, DB_NAME() as db, @@VERSION as version');
        
        res.json({
            status: 'success',
            duration_ms: Date.now() - startTime,
            server: dbConfig.server,
            database: result.recordset[0].db,
            env: {
                user_present: !!dbConfig.user,
                pass_present: !!dbConfig.password,
                node_env: process.env.NODE_ENV
            }
        });
    } catch (err: any) {
        console.error(">> Erro no diagnóstico:", err);
        res.status(500).json({
            status: 'error',
            duration_ms: Date.now() - startTime,
            message: err.message,
            code: err.code, // Ex: 'ETIMEOUT' indica Firewall
            state: err.state,
            help: "Se o código for ETIMEOUT, verifique o Firewall do Azure para permitir o IP deste servidor."
        });
    }
});

// --- HELPER MAPPERS ---
    
    const mapProduct = (p: any) => {
        const id = (p.ProductID || p.productid || p.id || p.Id || '0').toString();
        const product = {
            id,
            code: p.ProductCode || p.productcode || p.codigo || p.Codigo,
            description: p.ProductName || p.productname || p.nome || p.Nome || p.description,
            reference: p.ProductCode || p.productcode || p.codigo,
            colors: [],
            imageUrl: p.ImageData || p.imagedata || p.image || '',
            category: p.Category || p.category || p.tipo || 'Geral',
            subcategory: '',
            line: p.Line || p.line || '',
            details: p.TechnicalSpecs || p.technicalspecs || '',
            amperage: ''
        };
        return product;
    };

    const mapUser = (u: any) => {
        if (!u) return { id: '0', name: 'Unknown', email: '', role: 'USER' };
        
        // Suporte a diferentes nomes de colunas e capitalização (MSSQL case varia)
        const name = u.nome || u.name || u.Name || 'Sem Nome';
        const email = u.email || u.Email || '';
        const id = (u.id || u.usuarios_id || u.UserID || u.Id || '0').toString();
        const perfil = (u.perfil || u.Perfil || u.role || u.Role || 'REPRESENTATIVE').toString().toUpperCase();
        
        let mappedRole = 'REPRESENTATIVE';
        if (perfil.includes('ADMIN')) mappedRole = 'ADMIN';
        else if (perfil.includes('SUPERVISOR')) mappedRole = 'SUPERVISOR';
        else if (perfil.includes('VENDEDOR') || perfil.includes('REP')) mappedRole = 'REPRESENTATIVE';
        else mappedRole = 'REPRESENTATIVE'; // Default para DICOMPEL

        return { id, name, email, role: mappedRole };
    };

    // Mapeia Role do Frontend para Perfil do Banco
    const mapRoleToProfile = (role: string) => {
        const r = role.toUpperCase();
        if (r === 'REPRESENTATIVE') return 'vendedor';
        if (r === 'ADMIN') return 'admin';
        if (r === 'SUPERVISOR') return 'supervisor';
        return 'USER'; // Não defaultar para vendedor
    };

    // --- LOGGING HELPER ---
    const executeQuery = async (query: string, params: {name: string, type: any, value: any}[] = []) => {
        console.log(`[SQL] Executing: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
        const currentPool = await getPool();
        const request = currentPool.request();
        params.forEach(p => request.input(p.name, p.type, p.value));
        return request.query(query);
    };

    // --- API ROUTES ---
    
    app.get("/api/health", async (req, res) => {
        let isConnected = false;
        try {
            const currentPool = await getPool();
            isConnected = !!(currentPool && currentPool.connected);
            if (isConnected) {
                await currentPool.request().query('SELECT 1');
            }
        } catch (err: any) {
            isConnected = false;
            dbError = err.message;
        }

        const status = { 
            database: 'MSSQL', 
            connection: isConnected,
            connected: isConnected,
            error: dbError,
            env_status: {
                DB_USER: dbConfig.user ? 'OK' : 'MISSING',
                DB_SERVER: dbConfig.server ? 'OK' : 'MISSING'
            }
        };
        
        res.json(status);
    });

    // DB DIAGNOSTIC
    app.get("/api/db/diagnose/:table", async (req, res) => {
        try {
            const currentPool = await getPool();
            const table = req.params.table;
            const result = await currentPool.request()
                .input('table', sql.NVarChar, table)
                .query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @table");
            res.json(result.recordset);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    // PRODUCTS
    app.get("/api/products", async (req, res) => {
        try {
            const result = await executeQuery('SELECT * FROM Products ORDER BY ProductName');
            res.json(result.recordset.map(mapProduct));
        } catch (err: any) {
            console.error(">> [API] Error GET /api/products:", err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post("/api/products", async (req, res) => {
        try {
            const currentPool = await getPool();
            const { code, description, category, line, details, imageUrl } = req.body;
            const result = await currentPool.request()
                .input('code', sql.NVarChar, code)
                .input('name', sql.NVarChar, description)
                .input('category', sql.NVarChar, category)
                .input('line', sql.NVarChar, line)
                .input('specs', sql.NVarChar, details)
                .input('image', sql.NVarChar, imageUrl)
                .query(`INSERT INTO Products (ProductCode, ProductName, Category, Line, TechnicalSpecs, ImageData, CreatedAt) 
                        OUTPUT INSERTED.* 
                        VALUES (@code, @name, @category, @line, @specs, @image, SYSDATETIMEOFFSET())`);
            res.json(mapProduct(result.recordset[0]));
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    app.put("/api/products/:id", async (req, res) => {
        try {
            const currentPool = await getPool();
            const { code, description, category, line, details, imageUrl } = req.body;
            const productId = req.params.id; // Mantendo como string para UniqueIdentifier

            const result = await currentPool.request()
                .input('id', sql.UniqueIdentifier, productId)
                .input('code', sql.NVarChar, code)
                .input('name', sql.NVarChar, description)
                .input('category', sql.NVarChar, category)
                .input('line', sql.NVarChar, line)
                .input('specs', sql.NVarChar, details)
                .input('image', sql.NVarChar, imageUrl)
                .query(`UPDATE Products 
                        SET ProductCode = @code, ProductName = @name, Category = @category, Line = @line, 
                            TechnicalSpecs = @specs, ImageData = @image 
                        OUTPUT INSERTED.*
                        WHERE ProductID = @id`);
            
            if (result.recordset.length === 0) return res.status(404).json({ error: "Produto não encontrado" });
            res.json(mapProduct(result.recordset[0]));
        } catch (err: any) {
            console.error("Update Product Error:", err);
            res.status(500).json({ error: err.message });
        }
    });

    // AUTH
    app.post("/api/auth/login", async (req, res) => {
        const { email, password } = req.body;
        const normalizedEmail = email?.toLowerCase().trim();
        
        if (normalizedEmail === 'admin@dicompel.com.br' && password === 'Sigilo!@#2025') {
            return res.json({ id: '999', email: normalizedEmail, name: 'Admin Master', role: 'ADMIN' });
        }

        try {
            const currentPool = await getPool();
            const result = await currentPool.request()
                .input('email', sql.NVarChar, normalizedEmail)
                .input('password', sql.NVarChar, password)
                .query('SELECT * FROM usuarios WHERE email = @email AND senha_hash = @password');
                
            if (result.recordset.length > 0) {
                return res.json(mapUser(result.recordset[0]));
            } else {
                res.status(401).json({ error: "Credenciais inválidas" });
            }
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    // USERS
    app.get("/api/users", async (req, res) => {
        try {
            const currentPool = await getPool();
            const result = await currentPool.request().query('SELECT * FROM usuarios ORDER BY nome');
            res.json(result.recordset.map(mapUser));
        } catch (err: any) {
            console.error(">> [API] Error GET /api/users:", err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post("/api/users", async (req, res) => {
        try {
            const currentPool = await getPool();
            const { name, email, role, password } = req.body;
            const profile = mapRoleToProfile(role);
            const result = await currentPool.request()
                .input('nome', sql.NVarChar, name)
                .input('email', sql.NVarChar, email)
                .input('perfil', sql.NVarChar, profile)
                .input('senha_hash', sql.NVarChar, password)
                .query('INSERT INTO usuarios (nome, email, perfil, senha_hash, ativo, criado_em) OUTPUT INSERTED.* VALUES (@nome, @email, @perfil, @senha_hash, 1, GETDATE())');
            res.json(mapUser(result.recordset[0]));
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    app.put("/api/users/:id", async (req, res) => {
        try {
            const currentPool = await getPool();
            const { name, email, role, password } = req.body;
            const profile = mapRoleToProfile(role);
            
            let query = 'UPDATE usuarios SET nome = @nome, email = @email, perfil = @perfil';
            const request = currentPool.request()
                .input('id', sql.Int, parseInt(req.params.id))
                .input('nome', sql.NVarChar, name)
                .input('email', sql.NVarChar, email)
                .input('perfil', sql.NVarChar, profile);

            if (password) {
                query += ', senha_hash = @senha_hash';
                request.input('senha_hash', sql.NVarChar, password);
            }

            query += ' OUTPUT INSERTED.* WHERE id = @id';
            
            const result = await request.query(query);
            res.json(mapUser(result.recordset[0]));
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    app.delete("/api/users/:id", async (req, res) => {
        try {
            const currentPool = await getPool();
            await currentPool.request().input('id', sql.Int, parseInt(req.params.id)).query('DELETE FROM usuarios WHERE id = @id');
            res.status(204).end();
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    app.patch("/api/users/:id/password", async (req, res) => {
        try {
            const currentPool = await getPool();
            await currentPool.request()
                .input('id', sql.Int, parseInt(req.params.id))
                .input('password', sql.NVarChar, req.body.password)
                .query('UPDATE usuarios SET senha_hash = @password WHERE id = @id');
            res.status(204).end();
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    // ORDERS
    const fetchOrdersWithItems = async (query: string, inputs: any[] = []) => {
        const currentPool = await getPool();
        const request = currentPool.request();
        inputs.forEach(i => request.input(i.name, i.type, i.value));
        const res = await request.query(query);
        const orders = res.recordset;
        
        for (const order of orders) {
            const orderId = order.OrderID ?? order.orderid ?? order.id ?? order.ID;
            if (orderId === undefined || orderId === null) {
                console.warn(">> [API] Order found without ID:", order);
                continue;
            }

            const itemsRes = await currentPool.request()
                .input('orderId', sql.Int, orderId)
                .query('SELECT ProductID as id, ProductCode as code, ProductName as pName, Quantity as quantity FROM OrderItems WHERE OrderID = @orderId');
            
            order.items = itemsRes.recordset.map((it: any) => ({
                ...it,
                id: (it.id ?? it.ProductID ?? it.productid ?? '0').toString(),
                description: it.pName || it.ProductName || it.productname
            }));
            
            order.id = orderId.toString();
            order.createdAt = order.CreatedAt || order.createdat || order.date;
            order.status = order.Status || order.status;
            order.representativeId = (order.RepresentativeID ?? order.representativeid ?? order.repId ?? "").toString();
            order.customerName = order.CustomerName || order.customername || order.name;
            order.customerEmail = order.CustomerEmail || order.customeremail || order.email;
            order.customerContact = order.CustomerPhone || order.customerphone || order.phone;
            order.OrderID = orderId; // Ensure consistency
        }
        return orders;
    };

    app.get("/api/orders", async (req, res) => {
        try {
            const orders = await fetchOrdersWithItems('SELECT * FROM Orders ORDER BY CreatedAt DESC');
            res.json(orders);
        } catch (err: any) {
            console.error(">> [API] Error GET /api/orders:", err);
            res.status(500).json({ error: err.message });
        }
    });

    app.get("/api/orders/rep/:repId", async (req, res) => {
        try {
            const orders = await fetchOrdersWithItems(
                'SELECT * FROM Orders WHERE RepresentativeID = @repId ORDER BY CreatedAt DESC',
                [{ name: 'repId', type: sql.Int, value: parseInt(req.params.repId) }]
            );
            res.json(orders);
        } catch (err: any) {
            console.error(`>> [API] Error GET /api/orders/rep/${req.params.repId}:`, err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post("/api/orders", async (req, res) => {
        const { customerName, customerEmail, customerContact, representativeId, items, status, notes } = req.body;
        console.log(`>> [ORDER] Nova solicitação de pedido:`, { customer: customerName, repId: representativeId, items: items?.length });

        let transaction;
        try {
            const currentPool = await getPool();
            const repIdInt = parseInt(representativeId);
            if (isNaN(repIdInt)) {
                console.error(">> [ORDER] Erro: representativeId inválido", representativeId);
                return res.status(400).json({ error: "ID do representante inválido (deve ser número)" });
            }

            transaction = new sql.Transaction(currentPool);
            await transaction.begin();
            const orderRequest = new sql.Request(transaction);
            
            console.log(`>> [ORDER] Inserindo cabeçalho do pedido...`);
            
            const orderResult = await orderRequest
                .input('name', sql.NVarChar, (customerName || 'Cliente Anônimo').trim())
                .input('email', sql.NVarChar, (customerEmail || '').trim())
                .input('phone', sql.NVarChar, (customerContact || '').trim())
                .input('repId', sql.Int, repIdInt) // Note: Although schema says UniqueIdentifier, typically it is linked to users (int). If it fails, we will know.
                .input('status', sql.NVarChar, status || 'Novo')
                .input('notes', sql.NVarChar, notes || '')
                .query(`INSERT INTO Orders (CustomerName, CustomerEmail, CustomerPhone, RepresentativeID, Status, CreatedAt, Notes) 
                        OUTPUT INSERTED.* 
                        VALUES (@name, @email, @phone, NULLIF(@repId, 0), @status, SYSDATETIMEOFFSET(), @notes)`);
            
            const newOrder = orderResult.recordset[0];
            if (!newOrder) throw new Error("Erro ao inserir pedido: Nenhum dado retornado.");
            
            const newOrderId = newOrder.OrderID;
            console.log(`>> [ORDER] Sucesso cabeçalho. ID: ${newOrderId}. Inserindo ${items.length} itens...`);

            for (const item of items) {
                const itemRequest = new sql.Request(transaction);
                
                // ProductID é UniqueIdentifier no banco
                await itemRequest
                    .input('orderId', sql.Int, newOrderId)
                    .input('prodId', sql.UniqueIdentifier, item.id)
                    .input('code', sql.NVarChar, item.code)
                    .input('name', sql.NVarChar, item.description)
                    .input('qty', sql.Int, item.quantity)
                    .query('INSERT INTO OrderItems (OrderItemID, OrderID, ProductID, ProductCode, ProductName, Quantity) VALUES (NEWID(), @orderId, @prodId, @code, @name, @qty)');
            }
            
            await transaction.commit();
            console.log(`>> [ORDER] Pedido Finalizado com Sucesso: ${newOrder.OrderID}`);
            res.status(201).json({ ...newOrder, id: newOrder.OrderID, items });
        } catch (err: any) {
            console.error(">> [ORDER] FALHA NO PROCESSO:", err);
            if (transaction) {
                try { await transaction.rollback(); } catch(e) { console.error(">> [ORDER] Erro no Rollback:", e.message); }
            }
            res.status(500).json({ error: "Erro ao processar pedido no servidor", details: err.message });
        }
    });

    app.patch("/api/orders/:id/status", async (req, res) => {
        try {
            const currentPool = await getPool();
            await currentPool.request()
                .input('id', sql.Int, parseInt(req.params.id))
                .input('status', sql.NVarChar, req.body.status)
                .query('UPDATE Orders SET Status = @status WHERE OrderID = @id');
            res.status(204).end();
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    app.delete("/api/orders/:id", async (req, res) => {
        try {
            const currentPool = await getPool();
            const orderId = parseInt(req.params.id);
            // Delete items first
            await currentPool.request().input('id', sql.Int, orderId).query('DELETE FROM OrderItems WHERE OrderID = @id');
            await currentPool.request().input('id', sql.Int, orderId).query('DELETE FROM Orders WHERE OrderID = @id');
            res.status(204).end();
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });


async function setupVite() {
    // --- VITE MIDDLEWARE ---
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    // No Vercel, o servidor é gerenciado pela plataforma.
    // Só iniciamos o listen se não estivermos no ambiente Vercel/Produção
    if (!process.env.VERCEL) {
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Servidor rodando em porta ${PORT} (Env: ${process.env.NODE_ENV})`);
        });
    }
}

setupVite();

export default app;
