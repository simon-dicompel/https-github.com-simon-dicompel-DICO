import sql from 'mssql';

const config: any = {
  user: (process.env.DB_USER || process.env.MSSQL_USER || 'adminsql').trim(),
  password: (process.env.DB_PASS || process.env.MSSQL_PASSWORD || 'Dicompel!$$').trim(),
  database: (process.env.DB_NAME || process.env.MSSQL_DATABASE || 'configurador-produto').trim(),
  server: (process.env.DB_HOST || process.env.MSSQL_SERVER || 'configurador-produto-sql.database.windows.net').trim().replace(/,$/, ''),
  port: parseInt(process.env.DB_PORT || '1433'),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: true, // For Azure
    trustServerCertificate: false // For Azure
  }
};

export const query = async (text: string, params?: any[]) => {
  if (!config.server) {
    throw new Error('Configuração de servidor MSSQL_SERVER ausente nos Secrets!');
  }
  
  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    
    if (params) {
      params.forEach((val, idx) => {
        request.input(`param${idx}`, val);
      });
    }

    return await request.query(text);
  } catch (err) {
    console.error('Erro de conexão SQL no servidor:', config.server);
    throw err;
  }
};

export default sql;
