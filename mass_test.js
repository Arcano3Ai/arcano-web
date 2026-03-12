require('dotenv').config();
const { WebSocket } = require('ws');

const apiKey = process.env.GEMINI_API_KEY;
const modelsToTest = [
    'models/gemini-2.5-flash-native-audio-latest',
    'models/gemini-2.5-flash-native-audio-preview-12-2025',
    'models/gemini-2.0-flash-exp'
];

async function testModel(modelName) {
    return new Promise((resolve) => {
        console.log(`\nProbandon modelo: ${modelName}...`);
        const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
        const ws = new WebSocket(WS_URL);

        ws.on('open', () => {
            console.log(`  TCP OK. Enviando Setup...`);
            ws.send(JSON.stringify({
                setup: { model: modelName }
            }));
        });

        ws.on('message', (data) => {
            const resp = JSON.parse(data.toString());
            if (resp.setupComplete || resp.setup_complete) {
                console.log(`  ✅ ¡ÉXITO! El modelo ${modelName} es COMPATIBLE.`);
                ws.close();
                resolve(true);
            }
        });

        ws.on('close', (code, reason) => {
            console.log(`  ❌ FALLÓ. Código: ${code}, Razón: ${reason}`);
            resolve(false);
        });

        ws.on('error', (err) => {
            console.log(`  ❌ ERROR DE RED: ${err.message}`);
            resolve(false);
        });

        setTimeout(() => { ws.terminate(); resolve(false); }, 3000);
    });
}

async function runAllTests() {
    for (const model of modelsToTest) {
        const success = await testModel(model);
        if (success) {
            console.log(`\n>>> EL MODELO DEFINITIVO ES: ${model} <<<`);
            break;
        }
    }
    process.exit(0);
}

runAllTests();
