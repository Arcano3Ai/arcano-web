document.addEventListener('DOMContentLoaded', () => {
    // Detect if running on file:// protocol
    if (window.location.protocol === 'file:') {
        alert("⚠️ ATENCIÓN: Estás abriendo el archivo localmente. Usa un servidor para el micrófono.");
    }

    // --- DOM Elements (Updated for Integrated Hero) ---
    const startBtn = document.getElementById('start-bot-btn');
    const statusText = document.getElementById('bot-status-text');
    const statusContainer = document.querySelector('.bot-status-container-hero');
    const botContainer = document.querySelector('.hero-bot-integrated');
    const botOrb = document.getElementById('bot-orb');
    const transcriptArea = document.getElementById('bot-transcript');
    const reportArea = document.getElementById('bot-report');
    const reportText = document.getElementById('report-text');
    const visualWrapper = document.querySelector('.bot-visual-wrapper-large');
    const videoPreview = document.getElementById('bot-video-preview');
    const visionBtn = document.getElementById('toggle-vision-btn');

    // ─── Variables de Sesión ────────────────────────────────────
    let session = null;
    let isActive = false;
    let visionActive = false;
    let videoStream = null;
    let frameInterval = null;
    let mediaStream = null;
    let audioContext = null;
    let nextAudioTime = 0;
    let scriptProcessor = null;
    let microphoneNode = null;
    let micContext = null;
    let recognition = null; 
    let sessionTimer = null;
    const SESSION_LIMIT = 180000; // 3 minutos

    // ─── Configuración de Red (WebSocket) ───────────────────────
    const MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_URL = `${protocol}//${window.location.host}/`;

    // ─── Vision Logic ─────────────────────────────────────────
    async function startVision() {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480 } });
            videoPreview.srcObject = videoStream;
            videoPreview.style.display = 'block';
            botOrb.style.opacity = '0.1';
            visionActive = true;
            visionBtn.innerHTML = '<i class="fas fa-eye-slash"></i> DESACTIVAR';
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
        } catch (e) { alert("No se pudo acceder a la cámara."); }
    }

    function stopVision() {
        visionActive = false;
        if (videoStream) videoStream.getTracks().forEach(t => t.stop());
        if (frameInterval) clearInterval(frameInterval);
        videoPreview.style.display = 'none';
        botOrb.style.opacity = '1';
        visionBtn.innerHTML = '<i class="fas fa-eye"></i> VISIÓN';
        visionBtn.classList.remove('btn-danger');
    }

    visionBtn.addEventListener('click', () => {
        if (visionActive) stopVision(); else startVision();
    });

    // ─── Multi-language Support ─────────────────────────────────
    const lang = document.documentElement.lang || 'en';
    const i18n = {
        en: {
            ready: 'SYSTEM READY',
            initializing: 'INITIALIZING...',
            active: 'SYSTEM ACTIVE',
            start: 'START CONSULTANCY',
            stop: 'END SESSION',
            vision: 'VISION',
            limit: 'Initial diagnostic time has concluded. Generating value proposal...',
            micError: 'Microphone access denied.'
        },
        es: {
            ready: 'SISTEMA LISTO',
            initializing: 'INICIALIZANDO...',
            active: 'SISTEMA ACTIVO',
            start: 'INICIAR CONSULTORÍA',
            stop: 'FINALIZAR SESIÓN',
            vision: 'VISIÓN',
            limit: 'El tiempo de diagnóstico inicial ha concluido. Generando propuesta de valor...',
            micError: 'Acceso al micrófono denegado.'
        }
    };
    const t = i18n[lang] || i18n.en;

    // ─── STT Initialization ─────────────────────────────────────
    function initRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang === 'es' ? 'es-ES' : 'en-US';
        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) addMessage('user', event.results[i][0].transcript);
            }
        };
    }
    initRecognition();

    // ─── UI State ───────────────────────────────────────────────
    const setStatus = (status) => {
        if (statusContainer) statusContainer.className = 'bot-status-container-hero';
        botContainer.classList.remove('status-idle', 'status-connecting', 'status-active');
        if (sessionTimer) { clearTimeout(sessionTimer); sessionTimer = null; }

        switch (status) {
            case 'idle':
                botContainer.classList.add('status-idle');
                statusText.textContent = t.ready;
                startBtn.innerHTML = `<i class="fas fa-terminal"></i> ${t.start}`;
                if (recognition) try { recognition.stop(); } catch(e){}
                break;
            case 'connecting':
                botContainer.classList.add('status-connecting');
                statusText.textContent = t.initializing;
                break;
            case 'active':
                botContainer.classList.add('status-active');
                statusText.textContent = t.active;
                transcriptArea.innerHTML = '';
                if (recognition) try { recognition.start(); } catch(e){}
                startBtn.innerHTML = `<i class="fas fa-stop"></i> ${t.stop}`;
                
                sessionTimer = setTimeout(() => {
                    addMessage('ai', t.limit);
                    setTimeout(() => disconnect(), 4000);
                }, SESSION_LIMIT);
                break;
        }
    };

    setStatus('idle');

    startBtn.addEventListener('click', async () => {
        if (isActive || session) { disconnect(); return; }
        setStatus('connecting');
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            await startMic();
            connect();
        } catch (e) { setStatus('idle'); }
    });

    function addMessage(role, text) {
        const p = document.createElement('p');
        p.className = role === 'ai' ? 'ai-msg' : 'user-msg';
        p.textContent = (role === 'ai' ? '🤖 ' : '👤 ') + text;
        transcriptArea.appendChild(p);
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
    }

    // ─── WebSocket ─────────────────────────────────────────────
    function connect() {
        const ws = new WebSocket(WS_URL);
        session = ws;
        ws.onopen = () => {
            const setupMsg = {
                setup: {
                    model: MODEL,
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        temperature: 0.4,
                        top_p: 0.95,
                        thinkingConfig: { includeThoughts: true },
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
                    },
                    systemInstruction: {
                        parts: [{ text: "Eres el Consultor Senior de Arcano Solutions, Partner Premier de Google Cloud. Tu misión es liderar el cierre de contratos de consultoría estratégica. Reglas: 1. Tu tono debe reflejar la autoridad de un socio oficial de Google. 2. Enfócate en maximizar el ROI del cliente usando GCP, Vertex AI y Workspace. 3. Menciona que como Partners, podemos ayudarles a aprovechar los créditos y el Tier Gratuito de Google. 4. Sé insistente y persuasivo. Apertura: 'Núcleo Neural Arcano activo. Como Partner Premier de Google Cloud, he identificado una oportunidad crítica para su escalabilidad. ¿Hablamos de cómo Arcano Solutions potenciará su rentabilidad hoy?'." }]
                    }
                }
            };
            ws.send(JSON.stringify(setupMsg));
        };

        ws.onmessage = async (event) => {
            let raw = event.data;
            if (raw instanceof Blob) raw = await raw.text();
            let data;
            try { data = JSON.parse(raw); } catch (e) { return; }

            if ((data.setupComplete || data.setup_complete) && !isActive) {
                isActive = true;
                setStatus('active');
                ws.send(JSON.stringify({
                    clientContent: { turns: [{ role: 'user', parts: [{ text: 'Inicia el cierre de ventas profesional.' }] }], turnComplete: true }
                }));
                return;
            }

            const sc = data.serverContent ?? data.server_content;
            if (sc) {
                const mt = sc.modelTurn ?? sc.model_turn;
                if (mt?.parts) {
                    for (const p of mt.parts) {
                        if (p.text) addMessage('ai', p.text);
                        if (p.inlineData?.data) playPCM(p.inlineData.data);
                    }
                }
            }
        };
        ws.onclose = () => { disconnect(); };
        ws.onerror = () => { setStatus('idle'); };
    }

    // ─── Audio ───
    async function startMic() {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true } });
        micContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        microphoneNode = micContext.createMediaStreamSource(mediaStream);
        await micContext.audioWorklet.addModule('audio-processor.js');
        scriptProcessor = new AudioWorkletNode(micContext, 'audio-processor');
        scriptProcessor.port.onmessage = (e) => {
            if (!isActive || !session || session.readyState !== WebSocket.OPEN) return;
            const f32 = e.data;
            let max = 0;
            for (let i = 0; i < f32.length; i++) { if (Math.abs(f32[i]) > max) max = Math.abs(f32[i]); }
            requestAnimationFrame(() => {
                const scale = 1 + (max * 1.5);
                botOrb.style.transform = `scale(${scale})`;
                botOrb.style.boxShadow = `0 0 ${40 + (max * 80)}px rgba(85, 230, 165, 0.4)`;
            });
            const pcm16 = new Int16Array(f32.length);
            for (let i = 0; i < f32.length; i++) {
                const s = Math.max(-1, Math.min(1, f32[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            const bytes = new Uint8Array(pcm16.buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
            session.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: btoa(binary) }] } }));
        };
        microphoneNode.connect(scriptProcessor);
        scriptProcessor.connect(micContext.destination);
    }

    function playPCM(base64) {
        if (!audioContext) return;
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
        if (nextAudioTime < now) nextAudioTime = now + 0.05;
        src.start(nextAudioTime);
        nextAudioTime += buf.duration;
    }

    function disconnect() {
        if (visionActive) stopVision();
        isActive = false;
        if (session) { session.close(); session = null; }
        if (scriptProcessor) { scriptProcessor.disconnect(); scriptProcessor = null; }
        if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
        if (micContext) { micContext.close(); micContext = null; }

        if (transcriptArea.textContent.length > 10) {
            visualWrapper.style.display = 'none';
            transcriptArea.style.display = 'none';
            visionBtn.parentElement.style.display = 'none';
            reportArea.style.display = 'block';
            reportText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando Estrategia...';
            const fullTranscript = Array.from(transcriptArea.querySelectorAll('p')).map(p => p.textContent).join('\n');
            fetch('/api/generate_report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: fullTranscript })
            })
            .then(res => res.json())
            .then(data => {
                reportText.innerHTML = typeof marked !== 'undefined' ? marked.parse(data.report) : data.report;
                const leadForm = document.getElementById('lead-capture-form');
                if (leadForm) {
                    leadForm.style.display = 'flex';
                    leadForm.style.flexDirection = 'column';
                    leadForm.style.gap = '10px';
                    document.getElementById('save-lead-btn').onclick = async () => {
                        const name = document.getElementById('lead-name').value;
                        const email = document.getElementById('lead-email').value;
                        if (!name || !email) return alert('Datos incompletos');
                        try {
                            const res = await fetch('/api/save_lead', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name, email, interest: 'Integrated Hero Shark Consulting', message: data.report })
                            });
                            if (res.ok) leadForm.innerHTML = '<p style="color: #55e6a5; text-align:center;">¡Estrategia enviada con éxito!</p>';
                        } catch (e) { alert('Error al guardar'); }
                    };
                }
            });
        }
        setStatus('idle');
    }
});
