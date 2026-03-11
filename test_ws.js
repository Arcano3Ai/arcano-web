require('dotenv').config();
const WebSocket = require('ws');

const apiKey = process.env.GEMINI_API_KEY;

const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
const ws = new WebSocket(url);

ws.on('open', () => {
    const setupMessage = {
        setup: {
            model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } }
            },
            systemInstruction: { parts: [{ text: "test" }] }
        }
    };
    ws.send(JSON.stringify(setupMessage));
});

ws.on('message', (data) => {
    const msg = data.toString();
    console.log("Received a message");

    if (msg.includes('setupComplete') || msg.includes('{}')) {
        console.log("Sending Hola");
        ws.send(JSON.stringify({
            clientContent: {
                turns: [{ role: 'user', parts: [{ text: 'Hola.' }] }],
                turnComplete: true
            }
        }));
    }
});

ws.on('close', (code, reason) => {
    console.log(`Connection closed. Code: ${code}, Reason: ${reason.toString()}`);
});

process.on('uncaughtException', (err) => {
    console.error("FATAL ERROR:", err);
});
