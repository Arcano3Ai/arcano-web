require('dotenv').config();
const express = require('express');
const { WebSocket, WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- MIDDLEWARE DE SEGURIDAD ---
app.use((req, res, next) => {
    const url = req.url.toLowerCase();
    const isSensitiveFile = url.endsWith('.php') ||
        url.endsWith('.env') ||
        url.endsWith('.sql') ||
        url.endsWith('.bat') ||
        url.endsWith('.json') ||
        url.endsWith('.md');
    
    if (isSensitiveFile && !url.includes('/api/')) {
        return res.status(403).send('403 Forbidden - Access Denied');
    }
    next();
});

// --- API ENDPOINTS ---
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (email && password) {
            return res.json({ 
                status: 'success', 
                user: { name: 'Cliente Estratégico', role: 'Administrador VIP' },
                redirect: '/portal/dashboard.html'
            });
        }
        res.status(401).json({ status: 'error', message: 'Credenciales inválidas' });
    } catch (err) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

app.get('/api/dashboard_data', (req, res) => {
    res.json({
        ai_usage: [12, 19, 3, 5, 2, 3, 10],
        cloud_credits: 240.50,
        neural_efficiency: 98.4,
        active_bots: 4
    });
});

app.post('/api/generate_report', async (req, res) => {
    try {
        const { transcript } = req.body;
        if (!transcript || transcript.length < 10) {
            return res.status(400).json({ error: 'Transcripción insuficiente.' });
        }

        const prompt = `Actúa como el Analista Principal de Arcano Solutions. 
        Analiza la siguiente conversación entre un cliente y nuestro agente de IA. 
        Genera un "Reporte de Estrategia Digital" altamente profesional y estructurado usando Markdown. 
        
        Debes incluir:
        ### 1. Diagnóstico Operativo
        (Breve resumen de los dolores o necesidades detectadas)
        ### 2. Arquitectura Propuesta
        (Recomendación técnica específica, ej. Google Workspace, GCP, Vertex AI, RPA, con una justificación clara de negocio)
        ### 3. Siguiente Paso de Acción
        (Call to action claro para nuestro equipo de ventas/ingeniería)
        
        Mantén un tono consultivo, de alto valor ("Big 4" consulting style). Sé conciso.
        
        CONVERSACIÓN:
        ${transcript}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
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
