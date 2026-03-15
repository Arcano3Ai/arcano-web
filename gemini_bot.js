/**
 * ARCANO OS - Integración Blindada v3.0
 * Esta versión ignora errores de UI y se enfoca en que el botón de charla funcione sí o sí.
 */

console.log("[Arcana] Cargando Integración Blindada...");

document.addEventListener('DOMContentLoaded', () => {
    console.log("[Arcana] DOM Listo. Iniciando mapeo de seguridad...");

    // --- Referencias con Validación ---
    const getEl = (id) => document.getElementById(id);
    const startBtn = getEl('start-bot-btn');
    const botOrb = getEl('bot-orb');
    const transcriptArea = getEl('bot-transcript');
    const videoPreview = getEl('bot-video-preview');
    const visionBtn = getEl('toggle-vision-btn');
    const screenBtn = getEl('toggle-screen-btn');
    const botContainer = document.querySelector('.hero-bot-integrated') || document.body;

    if (!startBtn) {
        console.error("[Arcana] ERROR CRÍTICO: No se encontró 'start-bot-btn' en el HTML.");
        return;
    }

    // --- Estado ---
    let socket = null;
    let isActive = false;
    let audioCtx = null;
    let micStream = null;
    let micNode = null;
    let audioStack = [];
    let nextPlayTime = 0;

    const MODEL = 'models/gemini-2.5-flash-native-audio-latest';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_URL = `${protocol}//${window.location.host}/`;

    // --- Lógica de Audio ---
    function playAudio(base64) {
        if (!audioCtx) return;
        try {
            const binary = atob(base64);
            const buffer = new Int16Array(new Uint8Array(Array.from(binary, c => c.charCodeAt(0))).buffer);
            const audioBuffer = audioCtx.createBuffer(1, buffer.length, 24000);
            const channelData = audioBuffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) channelData[i] = buffer[i] / 32768;

            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtx.destination);

            const now = audioCtx.currentTime;
            if (nextPlayTime < now) nextPlayTime = now + 0.1;
            source.start(nextPlayTime);
            
            if (botOrb) botOrb.classList.add('speaking');
            source.onended = () => {
                audioStack = audioStack.filter(s => s !== source);
                if (audioStack.length === 0 && botOrb) botOrb.classList.remove('speaking');
            };
            audioStack.push(source);
            nextPlayTime += audioBuffer.duration;
        } catch (e) { console.error("Error Audio:", e); }
    }

    // --- Conexión ---
    function connect() {
        console.log("[Arcana] Conectando proxy en:", WS_URL);
        socket = new WebSocket(WS_URL);

        socket.onopen = () => {
            console.log("[Arcana] WebSocket Abierto.");
            socket.send(JSON.stringify({
                setup: { model: MODEL, generationConfig: { responseModalities: ['AUDIO', 'TEXT'] } }
            }));
        };

        socket.onmessage = async (e) => {
            let data = e.data;
            if (data instanceof Blob) data = await data.text();
            const parsed = JSON.parse(data);

            if (parsed.setupComplete || parsed.setup_complete) {
                console.log("[Arcana] Bot Listo.");
                isActive = true;
                startBtn.innerHTML = '<i class="fas fa-stop"></i> FINALIZAR SESIÓN';
                startBtn.style.background = "red";
                socket.send(JSON.stringify({
                    clientContent: { turns: [{ role: 'user', parts: [{ text: 'Inicia la sesión saludando.' }] }], turnComplete: true }
                }));
            }

            const sc = parsed.serverContent || parsed.server_content;
            if (sc?.modelTurn?.parts) {
                sc.modelTurn.parts.forEach(p => {
                    if (p.inlineData?.data) playAudio(p.inlineData.data);
                    if (p.text && transcriptArea) {
                        const m = document.createElement('p');
                        m.textContent = "🔹 " + p.text;
                        transcriptArea.appendChild(m);
                        transcriptArea.scrollTop = transcriptArea.scrollHeight;
                    }
                });
            }
        };

        socket.onclose = () => stop();
    }

    async function startMic() {
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            await ctx.audioWorklet.addModule('audio-processor.js');
            const source = ctx.createMediaStreamSource(micStream);
            const node = new AudioWorkletNode(ctx, 'audio-processor');

            node.port.onmessage = (e) => {
                if (isActive && socket?.readyState === WebSocket.OPEN) {
                    const f32 = e.data;
                    const pcm16 = new Int16Array(f32.length);
                    let max = 0;
                    for (let i = 0; i < f32.length; i++) {
                        const s = Math.max(-1, Math.min(1, f32[i]));
                        if (Math.abs(s) > max) max = Math.abs(s);
                        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
                    if (botOrb && !botOrb.classList.contains('speaking')) {
                        botOrb.style.transform = `scale(${1 + (max * 0.8)})`;
                    }
                    const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
                    socket.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64 }] } }));
                }
            };
            source.connect(node);
            node.connect(ctx.destination);
            micNode = { ctx, stream: micStream };
        } catch (e) { alert("Permiso de micrófono denegado."); stop(); }
    }

    function stop() {
        isActive = false;
        if (socket) socket.close();
        if (micNode) {
            micNode.ctx.close();
            micNode.stream.getTracks().forEach(t => t.stop());
        }
        socket = null; micNode = null;
        startBtn.innerHTML = '<i class="fas fa-terminal"></i> INICIAR CONSULTORÍA';
        startBtn.style.background = "";
        console.log("[Arcana] Sesión terminada.");
    }

    // --- EL ACTIVADOR ---
    startBtn.addEventListener('click', async () => {
        console.log("[Arcana] ¡CLICK DETECTADO!");
        if (isActive || socket) { stop(); return; }

        try {
            startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> CONECTANDO...';
            audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            await audioCtx.resume();
            await startMic();
            connect();
        } catch (err) {
            console.error("[Arcana] Error al iniciar:", err);
            stop();
        }
    });

    console.log("[Arcana] Integración finalizada. Botón listo.");
});
