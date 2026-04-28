import sql from 'mssql';

const config: any = {
  user: (
    process.env.DATABASE_USER || 
    process.env.DB_USER || 
    process.env.DB_USERNAME || 
    process.env.USUARIO_DO_BANCO_DE_DADOS || 
    process.env['USUÁRIO_DO_BANCO_DE_DADOS'] || 
    process.env.USUARIO_SQL ||
    'adminsql'
  ).trim(),
  password: (
    process.env.DATABASE_PASSWORD || 
    process.env.DATABASE_PASS || 
    process.env.DB_PASS || 
    process.env.DB_PASSWORD || 
    process.env.SENHA_DO_BANCO_DE_DADOS ||
    process.env.SENHA_DO_SISTEMA ||
    process.env.DB_PASSWORD_SQL ||
    'Dicompel!$$'
  ).trim(),
  database: (
    process.env.DATABASE_NAME || 
    process.env.DB_NAME || 
    process.env.NOME_DO_BANCO_DE_DADOS || 
    process.env.NOME_BANCO_DADOS ||
    process.env.DB_DATABASE ||
    'configurador-produto'
  ).trim(),
  server: (
    process.env.DATABASE_SERVER || 
    process.env.DB_HOST || 
    process.env.DB_SERVER ||
    process.env.DB_HOSTNAME ||
    'configurador-produto-sql.database.windows.net'
  ).trim().replace(/,$/, ''),
  port: parseInt(process.env.DB_PORT || '1433'),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: true, // For Azure
    trustServerCertificate: true // For Azure
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
