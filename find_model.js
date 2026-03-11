const WebSocket = require('ws');

// Lista de candidatos a probar
const modelsToTest = [
    "models/gemini-2.5-flash-native-audio-preview-12-2025",
    "models/gemini-2.0-flash-exp",
    "models/gemini-2.0-flash-live-001",
    "models/gemini-live-2.5-flash-native-audio",
];

const apiKey = process.argv[2];
if (!apiKey) {
    console.error("Usage: node find_model.js YOUR_API_KEY");
    process.exit(1);
}

let modelIndex = 0;

function testModel(model) {
    if (modelIndex >= modelsToTest.length) {
        console.log("\nAll models tested.");
        return;
    }
    console.log(`\n--- Testing: ${model} ---`);
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const ws = new WebSocket(url);

    const timeout = setTimeout(() => {
        console.log(`  ${model} -> TIMEOUT (no response in 5 seconds)`);
        ws.terminate();
        modelIndex++;
        if (modelIndex < modelsToTest.length) testModel(modelsToTest[modelIndex]);
    }, 5000);

    ws.on('open', () => {
        ws.send(JSON.stringify({
            setup: { model, generationConfig: { responseModalities: ["AUDIO"] } }
        }));
    });

    ws.on('message', (data) => {
        clearTimeout(timeout);
        const msg = JSON.parse(data.toString());
        if (msg.setupComplete) {
            console.log(`  ✅ ${model} -> WORKS! (received setupComplete)`);
        } else {
            console.log(`  ${model} -> Response:`, JSON.stringify(msg).slice(0, 200));
        }
        ws.close();
        modelIndex++;
        if (modelIndex < modelsToTest.length) testModel(modelsToTest[modelIndex]);
    });

    ws.on('close', (code, reason) => {
        clearTimeout(timeout);
        const r = reason.toString();
        if (code !== 1000) {
            console.log(`  ❌ ${model} -> REJECTED (Code ${code}, Reason: ${r})`);
        }
        modelIndex++;
        if (modelIndex < modelsToTest.length) testModel(modelsToTest[modelIndex]);
    });

    ws.on('error', (err) => {
        clearTimeout(timeout);
        console.log(`  ⚡ ${model} -> ERROR: ${err.message}`);
    });
}

console.log("Testing Gemini Live API models with your API key...\n");
testModel(modelsToTest[0]);
