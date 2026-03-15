const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8080/';
const socket = new WebSocket(WS_URL);

console.log("Connecting to:", WS_URL);

socket.on('open', () => {
    console.log("Client connected to proxy.");
    console.log("Sending setup message...");
    socket.send(JSON.stringify({
        setup: {
            model: 'models/gemini-2.5-flash-native-audio-latest',
            generationConfig: { 
                responseModalities: ['AUDIO']
            }
        }
    }));
});

socket.on('message', (data) => {
    const msg = data.toString();
    console.log("Message from proxy:", msg);
    if (msg.includes('setupComplete') || msg.includes('setup_complete')) {
        console.log("SUCCESS: Setup complete received from Gemini!");
        process.exit(0);
    }
});

socket.on('error', (err) => {
    console.error("WebSocket Error:", err.message);
    process.exit(1);
});

socket.on('close', (code, reason) => {
    console.log(`Connection closed: ${code} ${reason}`);
    process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
    console.error("TIMEOUT: Did not receive setupComplete within 10 seconds.");
    process.exit(1);
}, 10000);
