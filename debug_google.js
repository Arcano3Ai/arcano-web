require('dotenv').config();
const { WebSocket } = require('ws');

const apiKey = process.env.GEMINI_API_KEY;
// Probamos la URL directa sin v1beta si es necesario, o verificamos la actual
const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

console.log('Intentando conexión con Google Gemini...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ Conexión TCP abierta.');
    ws.send(JSON.stringify({
        setup: { model: 'models/gemini-2.0-flash-exp' }
    }));
});

ws.on('message', (data) => {
    console.log('📩 Respuesta:', data.toString());
});

ws.on('error', (err) => {
    console.error('❌ Error de red:', err.message);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 CERRADO. Código: ${code}`);
    console.log(`🔌 Motivo real de Google: ${reason}`);
    
    if (code === 1008) {
        console.log('--- ANÁLISIS ---');
        console.log('Google rechazó la conexión. Esto suele ser por:');
        console.log('1. La API Key no tiene permisos para el modelo Flash 2.0.');
        console.log('2. Tu cuenta de Google Cloud no tiene un proyecto activo con facturación (incluso para el free tier).');
        console.log('3. Estás en una ubicación geográfica donde el servicio Live no está habilitado.');
    }
});

setTimeout(() => process.exit(0), 4000);
