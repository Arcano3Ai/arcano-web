require('dotenv').config();
const express = require('express');
const { WebSocket, WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); // Permitir recibir JSON del frontend

// --- BASE DE DATOS ---
const db = require('./db');

// --- MIDDLEWARE DE SEGURIDAD ---
// Evita que Node.js exponga archivos sensibles de backend (.php, .env, .sql, etc.)
app.use((req, res, next) => {
    const url = req.url.toLowerCase();
    const isSensitive = url.includes('.php') ||
        url.includes('.env') ||
        url.includes('.sql') ||
        url.includes('.bat') ||
        url.includes('.json') ||
        url.includes('.md') ||
        url.includes('/api/');
    if (isSensitive) {
        return res.status(403).send('403 Forbidden - Access Denied');
    }
    next();
});

// --- API ENDPOINTS ---
app.post('/api/save_lead', async (req, res) => {
    try {
        const { name, email, interest, message } = req.body;
        if (!name || !email) {
            return res.status(400).json({ error: 'Nombre y email son requeridos.' });
        }
        
        const [result] = await db.execute(
            'INSERT INTO leads (name, email, interest, message) VALUES (?, ?, ?, ?)',
            [name, email, interest, message]
        );
        res.status(201).json({ success: true, leadId: result.insertId });
    } catch (err) {
        console.error('[API Error] Error al guardar lead:', err.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Serve static files from the public_html directory
app.use(express.static(__dirname));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY is missing in .env file.");
}

const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`;

wss.on('connection', (clientWs) => {
    console.log('[Proxy] Client connected');
    let geminiWs = null;

    if (!apiKey) {
        clientWs.close(1011, "API Key missing on server");
        return;
    }

    const messageQueue = [];

    // Connect to actual Gemini API
    geminiWs = new WebSocket(`${WS_URL}?key=${apiKey}`);

    geminiWs.on('open', () => {
        console.log('[Proxy] Connected to Gemini. Routing traffic...');
        // Flush queue
        while (messageQueue.length > 0) {
            const { data, isBinary } = messageQueue.shift();
            geminiWs.send(data, { binary: isBinary });
        }
    });

    geminiWs.on('message', (data, isBinary) => {
        try {
            const parsed = JSON.parse(data.toString());
            console.log('[Proxy] Gemini -> Client:', Object.keys(parsed));
        } catch (e) {
            // Probably binary audio
        }
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data, { binary: isBinary });
        }
    });

    geminiWs.on('close', (code, reason) => {
        console.log(`[Proxy] Gemini connection closed: ${code}`);
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(code, reason);
        }
    });

    geminiWs.on('error', (err) => {
        console.error('[Proxy] Gemini WS Error:', err);
    });

    clientWs.on('message', (data, isBinary) => {
        if (!isBinary) {
            const str = data.toString();
            if (str.includes('realtimeInput')) {
                // Log only occasionally or just once to confirm it's working
                if (Math.random() < 0.05) console.log('[Proxy] Client -> Gemini: Audio chunk (realtimeInput)');
            } else {
                console.log('[Proxy] Client -> Gemini:', str.substring(0, 100));
            }
        }

        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(data, { binary: isBinary });
        } else {
            console.log('[Proxy] Buffering client message...');
            messageQueue.push({ data, isBinary });
        }
    });

    clientWs.on('close', () => {
        console.log('[Proxy] Client disconnected');
        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.close();
        }
    });

    clientWs.on('error', (err) => {
        console.error('[Proxy] Client WS Error:', err);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`[Proxy Server] Running on http://localhost:${PORT}`);
    console.log(`[WebSocket Server] Running on ws://localhost:${PORT}`);
});
