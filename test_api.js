require('dotenv').config();
const { WebSocket } = require('ws');

const apiKey = process.env.GEMINI_API_KEY;
const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

console.log('--- DIAGNÓSTICO DE API ARCANO ---');
console.log('API Key cargada:', apiKey ? (apiKey.substring(0, 5) + '...') : 'NO CARGADA');

if (!apiKey) {
    console.error('ERROR: No se encontró la API Key en el archivo .env');
    process.exit(1);
}

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ CONEXIÓN EXITOSA: El servidor puede alcanzar a Google Gemini.');
    ws.send(JSON.stringify({
        setup: {
            model: 'models/gemini-2.0-flash-exp'
        }
    }));
});

ws.on('message', (data) => {
    console.log('📩 MENSAJE RECIBIDO DE GEMINI:', data.toString());
    ws.close();
});

ws.on('error', (err) => {
    console.error('❌ ERROR DE CONEXIÓN:', err.message);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 CONEXIÓN CERRADA. Código: ${code}, Razón: ${reason}`);
    if (code === 1008) console.log('Sugerencia: El modelo o la región podrían no ser compatibles.');
});

setTimeout(() => {
    console.log('⏱️ TIEMPO DE ESPERA AGOTADO (Timeout)');
    ws.terminate();
    process.exit(0);
}, 5000);
