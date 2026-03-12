require('dotenv').config();
const { WebSocket } = require('ws');

const apiKey = process.env.GEMINI_API_KEY;
const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

console.log('Testing with Gemini 2.0 Flash Stable...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ Connection Open.');
    ws.send(JSON.stringify({
        setup: { 
            model: 'models/gemini-2.0-flash',
            generationConfig: { responseModalities: ['AUDIO'] }
        }
    }));
});

ws.on('message', (data) => {
    const resp = JSON.parse(data.toString());
    console.log('📩 Response:', JSON.stringify(resp).substring(0, 100));
    if (resp.setupComplete || resp.setup_complete) {
        console.log('✅ SETUP SUCCESS WITH 2.0 FLASH');
        ws.close();
    }
});

ws.on('close', (code, reason) => {
    console.log(`🔌 CLOSED. Code: ${code}, Reason: ${reason}`);
});

ws.on('error', (err) => console.error('❌ ERROR:', err.message));

setTimeout(() => process.exit(0), 5000);
