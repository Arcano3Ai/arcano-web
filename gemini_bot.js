/**
 * ARCANO OS - Integración v3.1 (Granular Status)
 */

console.log("[Arcana] Cargando Integración v3.1...");

document.addEventListener('DOMContentLoaded', () => {
    const getEl = (id) => document.getElementById(id);
    const startBtn = getEl('start-bot-btn');
    const botOrb = getEl('bot-orb');
    const transcriptArea = getEl('bot-transcript');
    
    if (!startBtn) return;

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

    function updateBtn(text, icon = 'fa-spinner fa-spin', color = '') {
        startBtn.innerHTML = `<i class="fas ${icon}"></i> ${text}`;
        if (color) startBtn.style.background = color;
    }

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

    function connect() {
        console.log("[Arcana] WebSocket: Conectando...");
        updateBtn("CONECTANDO...");
        socket = new WebSocket(WS_URL);

        socket.onopen = () => {
            console.log("[Arcana] WebSocket: Abierto.");
            socket.send(JSON.stringify({
                setup: { model: MODEL, generationConfig: { responseModalities: ['AUDIO', 'TEXT'] } }
            }));
        };

        socket.onmessage = async (e) => {
            let data = e.data;
            if (data instanceof Blob) data = await data.text();
            const parsed = JSON.parse(data);

            if (parsed.setupComplete || parsed.setup_complete) {
                console.log("[Arcana] Bot: Listo para hablar.");
                isActive = true;
                updateBtn("FINALIZAR SESIÓN", "fa-stop", "red");
                socket.send(JSON.stringify({
                    clientContent: { turns: [{ role: 'user', parts: [{ text: 'Hola Arcana, inicia la sesión.' }] }], turnComplete: true }
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
        socket.onerror = () => stop();
    }

    async function startMic() {
        console.log("[Arcana] Mic: Pidiendo permiso...");
        updateBtn("MICRÓFONO...");
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        console.log("[Arcana] Mic: Configurando procesador...");
        const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        
        // Carga robusta del procesador
        const processorUrl = 'audio-processor.js?v=' + Date.now();
        await ctx.audioWorklet.addModule(processorUrl);
        
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
        console.log("[Arcana] Mic: OK.");
    }

    function stop() {
        isActive = false;
        if (socket) socket.close();
        if (micNode) {
            micNode.ctx.close();
            micNode.stream.getTracks().forEach(t => t.stop());
        }
        socket = null; micNode = null;
        updateBtn("INICIAR CONSULTORÍA", "fa-terminal", "");
        startBtn.style.background = "";
        console.log("[Arcana] Sesión cerrada.");
    }

    startBtn.addEventListener('click', async () => {
        if (isActive || socket) { stop(); return; }

        try {
            console.log("[Arcana] Inicio: Activando audio ctx...");
            updateBtn("INICIANDO AUDIO...");
            audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            await audioCtx.resume();

            await startMic();
            connect();
        } catch (err) {
            console.error("[Arcana] Error Crítico:", err);
            alert("Error al iniciar: " + err.message);
            stop();
        }
    });

    updateBtn("INICIAR CONSULTORÍA", "fa-terminal", "");
    console.log("[Arcana] Botón listo.");
});
