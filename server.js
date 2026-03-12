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
app.post('/api/generate_report', async (req, res) => {
    try {
        const { transcript } = req.body;
        if (!transcript || transcript.length < 10) {
            return res.status(400).json({ error: 'Transcripción insuficiente.' });
        }

        const prompt = `Analiza la siguiente conversación entre un cliente y un experto de Arcano Solutions. 
        Genera un informe ejecutivo conciso (máximo 3 párrafos) con:
        1. Resumen de necesidades detectadas.
        2. Recomendación técnica específica (Google Workspace, GCP, Vertex AI, etc.).
        3. Próximo paso sugerido.
        Usa un tono profesional y persuasivo. Usa formato Markdown para negritas.
        
        CONVERSACIÓN:
        ${transcript}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    topP: 0.95,
                }
            })
        });

        const data = await response.json();
        const report = data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar el informe profundo.";
        
        res.json({ report });
    } catch (err) {
        console.error('[API Error] Error al generar reporte:', err.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

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
        console.log('[Proxy] Connected to Gemini API (Live Bidi). Routing traffic...');
        // Flush queue
        while (messageQueue.length > 0) {
            const { data, isBinary } = messageQueue.shift();
            geminiWs.send(data, { binary: isBinary });
        }
    });

    geminiWs.on('message', (data, isBinary) => {
        try {
            const str = data.toString();
            const parsed = JSON.parse(str);
            if (parsed.setupComplete || parsed.setup_complete) {
                console.log('[Proxy] Gemini -> Client: SETUP_COMPLETE');
            } else if (parsed.serverContent || parsed.server_content) {
                // Audio or text response
                const sc = parsed.serverContent || parsed.server_content;
                if (sc.modelTurn?.parts?.some(p => p.text)) {
                    const text = sc.modelTurn.parts.find(p => p.text).text;
                    console.log('[Proxy] Gemini -> Client (Text):', text.substring(0, 50) + '...');
                }
            } else {
                console.log('[Proxy] Gemini -> Client (JSON):', Object.keys(parsed));
            }
        } catch (e) {
            // Probably binary audio, no log to avoid spam
        }
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data, { binary: isBinary });
        }
    });

    geminiWs.on('close', (code, reason) => {
        console.log(`[Proxy] Gemini connection closed by Google. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
        if (code === 1008) console.error('  -> Error 1008 usually means an invalid model name or unsupported region/API key.');
        if (code === 1007) console.error('  -> Error 1007 usually means an invalid API key.');
        
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
