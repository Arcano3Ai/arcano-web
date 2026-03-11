const mysql = require('mysql2/promise');
require('dotenv').config();

// Create an connection pool (AI-grade architecture for better concurrency)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'arcano',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection
pool.getConnection()
    .then(connection => {
        console.log('[Database] Conexión establecida con éxito (Pool Ready).');
        connection.release();
    })
    .catch(err => {
        console.error('[Database] Advertencia: No se pudo conectar a la base de datos.', err.message);
        console.log('Asegúrate de configurar tus credenciales en el archivo .env');
    });

module.exports = pool;
