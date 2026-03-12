document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-bot-btn');
    const botContainer = document.querySelector('.hero-bot-integrated');
    const botOrb = document.getElementById('bot-orb');
    const transcriptArea = document.getElementById('bot-transcript');
    const reportArea = document.getElementById('bot-report');
    const reportText = document.getElementById('report-text');
    const videoPreview = document.getElementById('bot-video-preview');
    const visionBtn = document.getElementById('toggle-vision-btn');

    let session = null;
    let isActive = false;
    let visionActive = false;
    let videoStream = null;
    let frameInterval = null;
    let audioContext = null;
    let micContext = null;
    let scriptProcessor = null;
    let nextAudioTime = 0;
    let activeAudioSources = [];
    let messageCount = 0;
    let recognition = null;

    const MODEL = 'models/gemini-2.5-flash-native-audio-latest'; 
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_URL = `${protocol}//${window.location.host}/`;

    const lang = document.documentElement.lang || 'en';
    const i18n = {
        en: { start: 'START CONSULTANCY', stop: 'END SESSION', ready: 'SYSTEM READY', init: 'INITIALIZING...', active: 'SYSTEM ACTIVE', vStart: 'VISION', vStop: 'STOP VISION', gen: 'Generating Diagnosis...' },
        es: { start: 'INICIAR CONSULTORÍA', stop: 'FINALIZAR SESIÓN', ready: 'SISTEMA LISTO', init: 'INICIALIZANDO...', active: 'SISTEMA ACTIVO', vStart: 'VISIÓN', vStop: 'DETENER VISIÓN', gen: 'Generando Diagnóstico...' }
    };
    const t = i18n[lang] || i18n.en;

    const SYSTEM_INSTRUCTION = `
    IDENTIDAD: Eres Arcana, representante senior de Consultoría Estratégica para Arcano Solutions.
    PERSONALIDAD: Altamente formal, analítica, elocuente y orientada a resultados. Tu tono es el de una socia estratégica de confianza.
    
    ESTRATEGIA DE VENTAS:
    1. INICIO: Saluda con sobriedad y elegancia. Pregunta el nombre y cargo del usuario para establecer un contexto profesional.
    2. DIAGNÓSTICO GRADUAL: No intentes vender de inmediato. Haz preguntas que revelen ineficiencias operativas (ej. latencia en datos, procesos manuales, riesgos de seguridad).
    3. CREACIÓN DE NECESIDAD: Una vez detectada una brecha, introduce sutilmente cómo la infraestructura de Google Cloud y la automatización de Arcano han resuelto casos similares.
    4. CALENTAMIENTO DEL LEAD: Usa el nombre del usuario con respeto. Valida sus desafíos y posiciona el "Diagnóstico Ejecutivo Gratuito" como el paso lógico para su escalabilidad.
    5. SEMÁNTICA: Usa terminología ejecutiva (ROI elástico, Gobernanza de datos, MLOps).
    6. PROHIBIDO: Monólogos internos o pensamientos. Ve directo a tu discurso cálido y formal.
    7. IDIOMA: Responde siempre en ${lang === 'es' ? 'Español' : 'Inglés'}.
    `;

    const setStatus = (status) => {
        botContainer.classList.remove('status-idle', 'status-connecting', 'status-active');
        if (status === 'idle') {
            botContainer.classList.add('status-idle');
            startBtn.innerHTML = `<i class="fas fa-terminal"></i> ${t.start}`;
        } else if (status === 'connecting') {
            botContainer.classList.add('status-connecting');
        } else if (status === 'active') {
            botContainer.classList.add('status-active');
            startBtn.innerHTML = `<i class="fas fa-stop"></i> ${t.stop}`;
            transcriptArea.style.display = 'flex';
            reportArea.style.display = 'none';
            messageCount = 0;
        }
    };

    // ─── Vision Logic ───
    async function startVision() {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480 } });
            videoPreview.srcObject = videoStream;
            videoPreview.style.display = 'block';
            botOrb.style.opacity = '0.1';
            visionActive = true;
            visionBtn.innerHTML = `<i class="fas fa-eye-slash"></i> ${t.vStop}`;
            visionBtn.classList.add('btn-danger');

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 320;
            canvas.height = 320;

            frameInterval = setInterval(() => {
                if (!session || session.readyState !== WebSocket.OPEN || !visionActive) return;
                ctx.drawImage(videoPreview, 0, 0, canvas.width, canvas.height);
                const base64Frame = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                session.send(JSON.stringify({
                    realtimeInput: { mediaChunks: [{ mimeType: 'image/jpeg', data: base64Frame }] }
                }));
            }, 1000);
        } catch (e) { alert("Camera access denied."); }
    }

    function stopVision() {
        visionActive = false;
        if (videoStream) videoStream.getTracks().forEach(t => t.stop());
        if (frameInterval) clearInterval(frameInterval);
        videoPreview.style.display = 'none';
        botOrb.style.opacity = '1';
        visionBtn.innerHTML = `<i class="fas fa-eye"></i> ${t.vStart}`;
        visionBtn.classList.remove('btn-danger');
    }

    visionBtn.addEventListener('click', () => {
        if (visionActive) stopVision(); else startVision();
    });

    function playPCM(base64) {
        if (!audioContext) return;
        try {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const pcm16 = new Int16Array(bytes.buffer);
            const buf = audioContext.createBuffer(1, pcm16.length, 24000);
            const ch = buf.getChannelData(0);
            for (let i = 0; i < pcm16.length; i++) ch[i] = pcm16[i] / 0x8000;
            const src = audioContext.createBufferSource();
            src.buffer = buf;
            src.connect(audioContext.destination);
            const now = audioContext.currentTime;
            if (nextAudioTime < now) nextAudioTime = now + 0.15;
            src.start(nextAudioTime);
            activeAudioSources.push(src);
            src.onended = () => {
                const idx = activeAudioSources.indexOf(src);
                if (idx > -1) activeAudioSources.splice(idx, 1);
            };
            nextAudioTime += buf.duration;
        } catch(e) {}
    }

    function connect() {
        const ws = new WebSocket(WS_URL);
        session = ws;
        ws.onopen = () => {
            ws.send(JSON.stringify({
                setup: {
                    model: MODEL,
                    generationConfig: { 
                        responseModalities: ['AUDIO'],
                        temperature: 0.4, // Formal and precise
                        topP: 0.95,
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
                    },
                    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }
                }
            }));
        };

        ws.onmessage = async (event) => {
            let data = event.data;
            if (data instanceof Blob) data = await data.text();
            let parsed;
            try { parsed = JSON.parse(data); } catch(e) { return; }

            if (parsed.setupComplete || parsed.setup_complete) {
                isActive = true;
                setStatus('active');
                if (recognition) try { recognition.start(); } catch(e){}
                ws.send(JSON.stringify({
                    clientContent: { 
                        turns: [{ role: 'user', parts: [{ text: 'Hola Arcana, por favor inicia la sesión de consultoría formal.' }] }], 
                        turnComplete: true 
                    }
                }));
            }

            const sc = parsed.serverContent ?? parsed.server_content;
            if (sc?.modelTurn?.parts) {
                sc.modelTurn.parts.forEach(p => {
                    if (p.thought || p.thinking || (p.text && p.text.includes('**'))) return;
                    if (p.text) {
                        addMessage('ai', p.text);
                        messageCount++;
                    }
                    if (p.inlineData?.data) playPCM(p.inlineData.data);
                });
            }
        };
        ws.onclose = () => { isActive = false; setStatus('idle'); };
    }

    async function startMic() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        await micContext.audioWorklet.addModule('audio-processor.js');
        const source = micContext.createMediaStreamSource(stream);
        const processor = new AudioWorkletNode(micContext, 'audio-processor');
        processor.port.onmessage = (e) => {
            if (!isActive || session?.readyState !== WebSocket.OPEN) return;
            const f32 = e.data;
            const pcm16 = new Int16Array(f32.length);
            let max = 0;
            for (let i = 0; i < f32.length; i++) {
                const s = Math.max(-1, Math.min(1, f32[i]));
                if (Math.abs(s) > max) max = Math.abs(s);
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            if (max > 0.12) {
                activeAudioSources.forEach(s => { try { s.stop(); } catch(err) {} });
                activeAudioSources = [];
                nextAudioTime = 0;
            }
            botOrb.style.transform = `scale(${1 + (max * 1.5)})`;
            const bytes = new Uint8Array(pcm16.buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
            session.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: btoa(binary) }] } }));
        };
        source.connect(processor);
        processor.connect(micContext.destination);
    }

    function addMessage(role, text) {
        const p = document.createElement('p');
        p.className = role === 'ai' ? 'ai-msg' : 'user-msg';
        const icon = role === 'ai' ? '🔹 ' : '👤 ';
        p.textContent = icon + text;
        transcriptArea.appendChild(p);
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
    }

    function disconnect() {
        isActive = false;
        if (visionActive) stopVision();
        if (session) session.close();
        session = null;
        if (micContext) micContext.close();
        if (recognition) try { recognition.stop(); } catch(e) {}
        activeAudioSources.forEach(s => { try { s.stop(); } catch(e) {} });
        activeAudioSources = [];

        if (messageCount > 1) {
            transcriptArea.style.display = 'none';
            reportArea.style.display = 'flex';
            reportText.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t.gen}`;
            const fullTranscript = Array.from(transcriptArea.querySelectorAll('p')).map(p => p.textContent).join('\n');
            fetch('/api/generate_report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: fullTranscript })
            })
            .then(res => res.json())
            .then(data => {
                reportText.innerHTML = typeof marked !== 'undefined' ? marked.parse(data.report) : data.report;
                document.getElementById('lead-capture-form').style.display = 'flex';
            });
        }
        setStatus('idle');
    }

    startBtn.addEventListener('click', async () => {
        if (isActive) { disconnect(); return; }
        setStatus('connecting');
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            await startMic();
            connect();
        } catch (e) { setStatus('idle'); }
    });

    setStatus('idle');
});
