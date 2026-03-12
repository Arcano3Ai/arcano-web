document.addEventListener('DOMContentLoaded', () => {
    // Detect if running on file:// protocol
    if (window.location.protocol === 'file:') {
        alert("⚠️ ATENCIÓN: Estás abriendo el archivo localmente. Usa un servidor para el micrófono.");
    }

    // --- DOM Elements ---
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

    // ─── Session Variables ────────────────────────────────────
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
    const SESSION_LIMIT = 180000; // 3 minutes

    // Interruption Logic
    let activeAudioSources = [];

    // ─── Network Config ────────────────────────────────────────
    const MODEL = 'models/gemini-2.0-flash-exp'; // Using standard stable or latest flash
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_URL = `${protocol}//${window.location.host}/`;

    // ─── Language Support ─────────────────────────────────────
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
            micError: 'Microphone access denied.',
            generating: 'Generating Strategic Strategy...',
            sendReport: 'Send Report to my Email',
            name: 'Full Name',
            email: 'Corporate Email',
            sendBtn: 'SEND STRATEGY NOW',
            success: 'Strategy sent successfully!',
            error: 'Error saving lead'
        },
        es: {
            ready: 'SISTEMA LISTO',
            initializing: 'INICIALIZANDO...',
            active: 'SISTEMA ACTIVO',
            start: 'INICIAR CONSULTORÍA',
            stop: 'FINALIZAR SESIÓN',
            vision: 'VISIÓN',
            limit: 'El tiempo de diagnóstico inicial ha concluido. Generando propuesta de valor...',
            micError: 'Acceso al micrófono denegado.',
            generating: 'Generando Estrategia Estratégica...',
            sendReport: 'Enviar Reporte a mi Correo',
            name: 'Nombre Completo',
            email: 'Correo Corporativo',
            sendBtn: 'ENVIAR ESTRATEGIA AHORA',
            success: '¡Estrategia enviada con éxito!',
            error: 'Error al guardar el prospecto'
        }
    };
    const t = i18n[lang] || i18n.en;

    // ─── Vision Logic ─────────────────────────────────────────
    async function startVision() {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480 } });
            videoPreview.srcObject = videoStream;
            videoPreview.style.display = 'block';
            botOrb.style.opacity = '0.1';
            visionActive = true;
            visionBtn.innerHTML = '<i class="fas fa-eye-slash"></i> ' + (lang==='es'?'DESACTIVAR':'STOP');
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
        visionBtn.innerHTML = '<i class="fas fa-eye"></i> ' + t.vision;
        visionBtn.classList.remove('btn-danger');
    }

    visionBtn.addEventListener('click', () => {
        if (visionActive) stopVision(); else startVision();
    });

    // ─── STT Logic (Fallback) ──────────────────────────────────
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

    // ─── Stop AI Audio (Interruption) ──────────────────────────
    function stopAIAudio() {
        activeAudioSources.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        activeAudioSources = [];
        nextAudioTime = 0;
    }

    // ─── UI State ───────────────────────────────────────────────
    const setStatus = (status) => {
        botContainer.classList.remove('status-idle', 'status-connecting', 'status-active');
        if (sessionTimer) { clearTimeout(sessionTimer); sessionTimer = null; }

        switch (status) {
            case 'idle':
                botContainer.classList.add('status-idle');
                statusText.textContent = t.ready;
                startBtn.innerHTML = `<i class="fas fa-terminal"></i> ${t.start}`;
                break;
            case 'connecting':
                botContainer.classList.add('status-connecting');
                statusText.textContent = t.initializing;
                break;
            case 'active':
                botContainer.classList.add('status-active');
                statusText.textContent = t.active;
                transcriptArea.innerHTML = '';
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
        } catch (e) { 
            console.error(e);
            setStatus('idle'); 
        }
    });

    function addMessage(role, text) {
        const p = document.createElement('p');
        p.className = role === 'ai' ? 'ai-msg' : 'user-msg';
        p.textContent = (role === 'ai' ? '🤖 ' : '👤 ') + text;
        transcriptArea.appendChild(p);
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
    }

    // ─── WebSocket Connection ───────────────────────────────────
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
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
                    },
                    systemInstruction: {
                        parts: [{ text: `You are Arcano OS, an Elite Senior Consultant. Powered by Google Cloud. TONE: Strategic, highly professional, authoritative yet accessible. MISSION: Convince the user that Arcano + GCP is the ultimate operational move. LANGUAGE: Speak in ${lang==='es'?'Spanish':'English'}. OPENING: Brief greeting about Google Cloud advantages.` }]
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
                // Auto-start talk
                ws.send(JSON.stringify({
                    clientContent: { turns: [{ role: 'user', parts: [{ text: 'Introduce yourself briefly.' }] }], turnComplete: true }
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
                // Check if turn is complete to reset nextAudioTime if needed
                if (sc.turnComplete || sc.turn_complete) {
                    // Turn finished
                }
            }
        };
        ws.onclose = () => { disconnect(); };
        ws.onerror = (e) => { console.error(e); setStatus('idle'); };
    }

    // ─── Microphone & Audio Worklet ────────────────────────────
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
            
            // Interruption Check: If user is loud, stop AI
            if (max > 0.1) {
                stopAIAudio();
            }

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
        activeAudioSources.push(src);
        src.onended = () => {
            const idx = activeAudioSources.indexOf(src);
            if (idx > -1) activeAudioSources.splice(idx, 1);
        };
        nextAudioTime += buf.duration;
    }

    function disconnect() {
        if (visionActive) stopVision();
        isActive = false;
        stopAIAudio();
        if (session) { session.close(); session = null; }
        if (scriptProcessor) { scriptProcessor.disconnect(); scriptProcessor = null; }
        if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
        if (micContext) { micContext.close(); micContext = null; }

        if (transcriptArea.textContent.length > 50) {
            transcriptArea.style.display = 'none';
            visionBtn.parentElement.style.display = 'none';
            reportArea.style.display = 'flex';
            reportText.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t.generating}`;
            
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
                    leadForm.innerHTML = `
                        <h3 style="margin-bottom: 10px; font-size: 1rem; color: #fff;">${t.sendReport}</h3>
                        <input type="text" id="lead-name" placeholder="${t.name}" class="bot-input-hero">
                        <input type="email" id="lead-email" placeholder="${t.email}" class="bot-input-hero">
                        <button id="save-lead-btn" class="btn-antigravity" style="width: 100%;">${t.sendBtn}</button>
                    `;
                    leadForm.style.display = 'flex';
                    document.getElementById('save-lead-btn').onclick = async () => {
                        const name = document.getElementById('lead-name').value;
                        const email = document.getElementById('lead-email').value;
                        if (!name || !email) return;
                        try {
                            const res = await fetch('/api/save_lead', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name, email, interest: 'Strategic AI Consulting', message: data.report })
                            });
                            if (res.ok) leadForm.innerHTML = `<p style="color: #55e6a5; text-align:center;">${t.success}</p>`;
                        } catch (e) { alert(t.error); }
                    };
                }
            });
        }
        setStatus('idle');
    }
});
