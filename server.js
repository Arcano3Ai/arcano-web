require('dotenv').config();
const express = require('express');
const { WebSocket, WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- API ENDPOINTS ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', version: 'Arcano OS Stable v2.0' });
});

// --- WebSocket Proxy for Gemini Live API ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('[Proxy] Nueva sesión establecida.');
    
    const apiKey = process.env.GEMINI_API_KEY;
    const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    
    const googleWs = new WebSocket(WS_URL);

    googleWs.on('open', () => {
        console.log('[Proxy] Conectado a Google Generative Service.');
    });

    ws.on('message', (message) => {
        if (googleWs.readyState === WebSocket.OPEN) {
            googleWs.send(message);
        }
    });

    googleWs.on('message', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });

    ws.on('close', () => {
        if (googleWs.readyState === WebSocket.OPEN) googleWs.close();
        console.log('[Proxy] Cliente desconectado.');
    });

    googleWs.on('error', (err) => {
        console.error('[Proxy-Critical] Google WebSocket Error:', err);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🚀 Arcano OS Running on http://localhost:${PORT}`);
});
