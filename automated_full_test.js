const WebSocket = require('ws');

// Configuracion local (simulando al navegador)
const LOCAL_WS_URL = 'ws://127.0.0.1:8080';

console.log("=== INICIANDO TEST FULL ARCANO SOLUTIONS ===");
console.log(`Conectando al proxy local: ${LOCAL_WS_URL}`);

const ws = new WebSocket(LOCAL_WS_URL);

let setupRecibido = false;
let respuestaRecibida = false;

ws.on('open', () => {
    console.log("✅ Conexión establecida con el Proxy.");

    const setupMsg = {
        setup: {
            model: 'models/gemini-2.0-flash',
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Aoede' }
                    }
                }
            },
            systemInstruction: {
                parts: [{ text: 'Eres el asistente de Arcano Solutions. Responde de forma muy breve.' }]
            }
        }
    };

    console.log("📤 Enviando mensaje de configuracion (Setup)...");
    ws.send(JSON.stringify(setupMsg));
});

ws.on('message', (data) => {
    const raw = data.toString();
    console.log("📥 Mensaje recibido del Proxy:", raw.substring(0, 100));
    let msg;
    try {
        msg = JSON.parse(raw);
    } catch (e) {
        console.log("⚠️ Mensaje no-JSON recibido.");
        return;
    }

    // Caso 1: Setup Complete
    if (msg.setupComplete || (typeof msg === 'object' && Object.keys(msg).length === 0)) {
        if (!setupRecibido) {
            console.log("✅ Gemini respondió: SETUP COMPLETE.");
            setupRecibido = true;

            console.log("📤 Enviando saludo inicial: 'Hola, ¿puedes oirme?'");
            ws.send(JSON.stringify({
                clientContent: {
                    turns: [{ role: 'user', parts: [{ text: 'Hola, ¿puedes oirme?' }] }],
                    turnComplete: true
                }
            }));
        }
    }

    // Caso 2: Server Content (Respuesta de voz)
    if (msg.serverContent || msg.server_content) {
        console.log("✅ Respuesta de voz (Audio) recibida desde Gemini.");
        respuestaRecibida = true;

        const sc = msg.serverContent || msg.server_content;
        if (sc.modelTurn) {
            console.log("🤖 Gemini está hablando (transfiriendo paquetes de audio)...");
        }

        if (sc.turnComplete || (sc.modelTurn && sc.modelTurn.parts)) {
            // Si llegamos aqui, el bot está funcionando perfectamente.
            console.log("\n=========================================");
            console.log("✨ TEST EXITOSO: EL SISTEMA ESTÁ VIVO ✨");
            console.log("=========================================");
            ws.close();
            process.exit(0);
        }
    }
});

ws.on('error', (err) => {
    console.error("❌ Error de WebSocket:", err.message);
    process.exit(1);
});

ws.on('close', (code, reason) => {
    if (!respuestaRecibida) {
        console.log(`❌ Conexión cerrada prematuramente. Código: ${code}, Razón: ${reason}`);
        process.exit(1);
    }
});

// Timeout de seguridad tras 15 segundos
setTimeout(() => {
    console.log("⏱️ Timeout: El test tardó demasiado.");
    process.exit(1);
}, 15000);
