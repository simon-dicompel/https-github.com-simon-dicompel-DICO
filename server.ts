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

async function startServer() {
    const PORT = process.env.PORT || 3000;

    app.use(express.json());

    // FaviIcon bypass
    app.get("/favicon.ico", (req, res) => res.status(204).end());

    // --- LOGS DE INICIALIZAÇÃO PARA DIAGNÓSTICO ---
    console.log(`>> [INFO] Iniciando servidor...`);
    console.log(`>> [INFO] Porta: ${PORT}`);
    console.log(`>> [INFO] Node Env: ${process.env.NODE_ENV}`);
    console.log(`>> [INFO] DB Server: ${dbConfig.server}`);

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
            
            // Verificação básica de tabelas (apenas se necessário no primeiro connect)
            try {
                await pool.request().query("IF COL_LENGTH('Orders', 'Notes') IS NULL ALTER TABLE Orders ADD Notes NVARCHAR(MAX)");
            } catch (err: any) {
                console.error("Setup error:", err.message);
            }
            return pool;
        } catch (err: any) {
            dbError = err.message;
            console.error('>> ERRO AO CONECTAR AO AZURE SQL SERVER:', err.message);
            pool = null;
            throw err;
        }
    };

    // Inicia conexão em background (quente), mas as rotas devem usar getPool()
    getPool().catch(err => console.error("Initial connection failed, will retry on request."));

    // --- HELPER MAPPERS ---
    
    const mapProduct = (p: any) => {
        const product = {
            id: p.ProductID || p.id,
            code: p.ProductCode || p.codigo,
            description: p.ProductName || p.nome || p.description, // Fallback if column happens to be named description
            reference: p.ProductCode || p.codigo,
            colors: [],
            imageUrl: p.ImageData || '',
            category: p.Category || p.tipo || 'Geral',
            subcategory: '',
            line: p.Line || '',
            details: p.TechnicalSpecs || '',
            amperage: ''
        };
        return product;
    };

    const mapUser = (u: any) => {
        let role = (u.perfil || u.role || 'REPRESENTATIVE').toUpperCase();
        if (role === 'VENDEDOR') role = 'REPRESENTATIVE';
        if (role === 'ADMIN') role = 'ADMIN';
        return {
            id: u.id.toString(),
            email: u.email,
            name: u.nome || u.name,
            role: role
        };
    };

    // Mapeia Role do Frontend para Perfil do Banco
    const mapRoleToProfile = (role: string) => {
        const r = role.toUpperCase();
        if (r === 'REPRESENTATIVE') return 'vendedor';
        if (r === 'ADMIN') return 'admin';
        return 'vendedor'; // default
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
            console.error("DB Error:", err.message);
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
                .query(`INSERT INTO Products (ProductID, ProductCode, ProductName, Category, Line, TechnicalSpecs, ImageData, CreatedAt) 
                        OUTPUT INSERTED.* 
                        VALUES (NEWID(), @code, @name, @category, @line, @specs, @image, SYSDATETIMEOFFSET())`);
            res.json(mapProduct(result.recordset[0]));
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    app.put("/api/products/:id", async (req, res) => {
        try {
            const currentPool = await getPool();
            const { code, description, category, line, details, imageUrl } = req.body;
            const result = await currentPool.request()
                .input('id', sql.UniqueIdentifier, req.params.id)
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
            res.json(mapProduct(result.recordset[0]));
        } catch (err: any) {
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
            const { name, email, role } = req.body;
            const profile = mapRoleToProfile(role);
            const result = await currentPool.request()
                .input('id', sql.Int, parseInt(req.params.id))
                .input('nome', sql.NVarChar, name)
                .input('email', sql.NVarChar, email)
                .input('perfil', sql.NVarChar, profile)
                .query('UPDATE usuarios SET nome = @nome, email = @email, perfil = @perfil OUTPUT INSERTED.* WHERE id = @id');
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
            const itemsRes = await currentPool.request()
                .input('orderId', sql.UniqueIdentifier, order.OrderID)
                .query('SELECT ProductID as id, ProductCode as code, ProductName as pName, Quantity as quantity FROM OrderItems WHERE OrderID = @orderId');
            order.items = itemsRes.recordset.map((it: any) => ({
                ...it,
                description: it.pName
            }));
            order.id = order.OrderID;
            order.createdAt = order.CreatedAt;
            order.status = order.Status;
            order.representativeId = order.RepresentativeID;
            order.customerName = order.CustomerName;
            order.customerEmail = order.CustomerEmail;
            order.customerContact = order.CustomerPhone;
        }
        return orders;
    };

    app.get("/api/orders", async (req, res) => {
        try {
            const orders = await fetchOrdersWithItems('SELECT * FROM Orders ORDER BY CreatedAt DESC');
            res.json(orders);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get("/api/orders/rep/:repId", async (req, res) => {
        try {
            const orders = await fetchOrdersWithItems(
                'SELECT * FROM Orders WHERE RepresentativeID = @repId ORDER BY CreatedAt DESC',
                [{ name: 'repId', type: sql.NVarChar, value: req.params.repId }]
            );
            res.json(orders);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post("/api/orders", async (req, res) => {
        const currentPool = await getPool();
        const { customerName, customerEmail, customerContact, representativeId, items, status, notes } = req.body;
        
        const transaction = new sql.Transaction(currentPool);
        try {
            await transaction.begin();
            const orderRequest = new sql.Request(transaction);
            
            const orderResult = await orderRequest
                .input('name', sql.NVarChar, customerName || '')
                .input('email', sql.NVarChar, customerEmail || '')
                .input('phone', sql.NVarChar, customerContact || '')
                .input('repId', sql.NVarChar, representativeId)
                .input('status', sql.NVarChar, status || 'Novo')
                .input('notes', sql.NVarChar, notes || '')
                .query(`INSERT INTO Orders (OrderID, CustomerName, CustomerEmail, CustomerPhone, RepresentativeID, Status, CreatedAt, OrderNumber, Notes) 
                        OUTPUT INSERTED.* 
                        VALUES (NEWID(), @name, @email, @phone, @repId, @status, SYSDATETIMEOFFSET(), LEFT(REPLACE(CAST(NEWID() as nvarchar(max)), '-', ''), 8), @notes)`);
            
            const newOrder = orderResult.recordset[0];
            
            for (const item of items) {
                const itemRequest = new sql.Request(transaction);
                await itemRequest
                    .input('orderId', sql.UniqueIdentifier, newOrder.OrderID)
                    .input('prodId', sql.UniqueIdentifier, item.id)
                    .input('code', sql.NVarChar, item.code)
                    .input('name', sql.NVarChar, item.description)
                    .input('qty', sql.Int, item.quantity)
                    .query('INSERT INTO OrderItems (OrderItemID, OrderID, ProductID, ProductCode, ProductName, Quantity) VALUES (NEWID(), @orderId, @prodId, @code, @name, @qty)');
            }
            
            await transaction.commit();
            res.json({ ...newOrder, id: newOrder.OrderID, items });
        } catch (err: any) {
            await transaction.rollback();
            console.error("Order Error:", err.message);
            res.status(500).json({ error: err.message });
        }
    });

    app.patch("/api/orders/:id/status", async (req, res) => {
        try {
            const currentPool = await getPool();
            await currentPool.request()
                .input('id', sql.UniqueIdentifier, req.params.id)
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
            // Delete items first
            await currentPool.request().input('id', sql.UniqueIdentifier, req.params.id).query('DELETE FROM OrderItems WHERE OrderID = @id');
            await currentPool.request().input('id', sql.UniqueIdentifier, req.params.id).query('DELETE FROM Orders WHERE OrderID = @id');
            res.status(204).end();
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });


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

    if (process.env.NODE_ENV !== "production") {
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Servidor rodando em porta ${PORT}`);
        });
    }
}

startServer();

export default app;
