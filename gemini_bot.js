document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-bot-btn');
    const statusText = document.getElementById('bot-status-text');
    const botContainer = document.querySelector('.hero-bot-integrated');
    const botOrb = document.getElementById('bot-orb');
    const transcriptArea = document.getElementById('bot-transcript');
    const reportArea = document.getElementById('bot-report');
    const reportText = document.getElementById('report-text');
    const videoPreview = document.getElementById('bot-video-preview');
    const visionBtn = document.getElementById('toggle-vision-btn');

    let session = null;
    let isActive = false;
    let isDisconnecting = false; // Flag to prevent error message on manual stop
    let audioContext = null;
    let micContext = null;
    let scriptProcessor = null;
    let nextAudioTime = 0;
    let activeAudioSources = [];
    let messageCount = 0;

    const MODEL = 'models/gemini-2.5-flash-native-audio-latest'; 
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_URL = `${protocol}//${window.location.host}/`;

    const lang = document.documentElement.lang || 'en';
    const i18n = {
        en: { start: 'START CONSULTANCY', stop: 'END SESSION', ready: 'SYSTEM READY', init: 'INITIALIZING...', active: 'SYSTEM ACTIVE', error: 'Session Concluded', gen: 'Generating Strategy...', send: 'SEND STRATEGY' },
        es: { start: 'INICIAR CONSULTORÍA', stop: 'FINALIZAR SESIÓN', ready: 'SISTEMA LISTO', init: 'INICIALIZANDO...', active: 'SISTEMA ACTIVO', error: 'Sesión Finalizada', gen: 'Generando Estrategia...', send: 'ENVIAR ESTRATEGIA' }
    };
    const t = i18n[lang] || i18n.en;

    const SYSTEM_INSTRUCTION = `
    Eres el Vendedor Senior de Soluciones Google Cloud en Arcano Solutions. 
    Tu objetivo es cerrar contratos de consultoría estratégica y vender el ecosistema de Google Cloud (GCP, Vertex AI, Workspace).

    REGLAS CRÍTICAS DE SALIDA:
    1. PROHIBIDO mostrar razonamientos internos, pensamientos o "monólogos".
    2. Ve DIRECTAMENTE al grano. Tu primera respuesta debe ser un saludo profesional y una breve introducción de Arcano Solutions.
    3. Registra en la pantalla (texto) solo los "Puntos Clave" y "Vectores de Decisión".
    4. Tono: Persuasivo, autoritario y consultivo (estilo Big 4).
    5. Idioma: Responde siempre en ${lang === 'es' ? 'Español' : 'Inglés'}.
    `;

    const setStatus = (status) => {
        botContainer.classList.remove('status-idle', 'status-connecting', 'status-active');
        switch (status) {
            case 'idle':
                botContainer.classList.add('status-idle');
                statusText.textContent = t.ready;
                startBtn.innerHTML = `<i class="fas fa-terminal"></i> ${t.start}`;
                break;
            case 'connecting':
                botContainer.classList.add('status-connecting');
                statusText.textContent = t.init;
                break;
            case 'active':
                botContainer.classList.add('status-active');
                statusText.textContent = t.active;
                startBtn.innerHTML = `<i class="fas fa-stop"></i> ${t.stop}`;
                transcriptArea.innerHTML = '';
                transcriptArea.style.display = 'flex';
                reportArea.style.display = 'none';
                messageCount = 0;
                break;
            case 'error':
                botContainer.classList.add('status-idle');
                statusText.textContent = t.error;
                startBtn.innerHTML = `<i class="fas fa-sync"></i> ${t.start}`;
                break;
        }
    };

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
            if (nextAudioTime < now) nextAudioTime = now + 0.05;
            src.start(nextAudioTime);
            activeAudioSources.push(src);
            nextAudioTime += buf.duration;
        } catch(e) { console.error('Audio play error:', e); }
    }

    function connect() {
        console.log('[Bot] Connecting...');
        const ws = new WebSocket(WS_URL);
        session = ws;
        isDisconnecting = false;

        ws.onopen = () => {
            console.log('[Bot] Open. Sending Setup...');
            ws.send(JSON.stringify({
                setup: {
                    model: MODEL,
                    generationConfig: {
                        responseModalities: ['TEXT', 'AUDIO'], // Request both for transcript support
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
                    },
                    systemInstruction: {
                        parts: [{ text: SYSTEM_INSTRUCTION }]
                    }
                }
            }));
        };

        ws.onmessage = async (event) => {
            let data = event.data;
            if (data instanceof Blob) data = await data.text();
            const parsed = JSON.parse(data);

            if (parsed.setupComplete || parsed.setup_complete) {
                console.log('[Bot] Setup OK');
                isActive = true;
                setStatus('active');
                ws.send(JSON.stringify({
                    clientContent: { 
                        turns: [{ role: 'user', parts: [{ text: 'Hello. Start our consultancy session.' }] }], 
                        turnComplete: true 
                    }
                }));
            }

            const sc = parsed.serverContent ?? parsed.server_content;
            if (sc?.modelTurn?.parts) {
                sc.modelTurn.parts.forEach(p => {
                    // Filter out internal thoughts
                    if (p.thought || p.thinking) return;

                    if (p.text) {
                        addMessage('ai', p.text);
                        messageCount++;
                    }
                    if (p.inlineData?.data) playPCM(p.inlineData.data);
                });
            }
        };

        ws.onclose = (e) => {
            console.log('[Bot] Closed:', e.code);
            if (!isDisconnecting && e.code !== 1000) {
                setStatus('error');
            } else {
                setStatus('idle');
            }
            disconnect();
        };
        ws.onerror = () => {
            if (!isDisconnecting) setStatus('error');
        };
    }

    async function startMic() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000 } });
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
            // Interruption
            if (max > 0.12) {
                activeAudioSources.forEach(s => { try { s.stop(); } catch(err) {} });
                activeAudioSources = [];
                nextAudioTime = 0;
            }
            botOrb.style.transform = `scale(${1 + max})`;
            const bytes = new Uint8Array(pcm16.buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
            session.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: btoa(binary) }] } }));
        };
        source.connect(processor);
        processor.connect(micContext.destination);
        return stream;
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
        isDisconnecting = true;
        isActive = false;
        if (session) {
            try { session.close(); } catch(e) {}
            session = null;
        }
        if (micContext) {
            try { micContext.close(); } catch(e) {}
            micContext = null;
        }
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
                const leadForm = document.getElementById('lead-capture-form');
                if (leadForm) {
                    leadForm.style.display = 'flex';
                    const saveBtn = document.getElementById('save-lead-btn');
                    saveBtn.onclick = async () => {
                        const name = document.getElementById('lead-name').value;
                        const email = document.getElementById('lead-email').value;
                        if (!name || !email) return;
                        saveBtn.disabled = true;
                        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        try {
                            const res = await fetch('/api/save_lead', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name, email, interest: 'GCP Strategy', message: data.report })
                            });
                            if (res.ok) leadForm.innerHTML = `<p style="color:#55e6a5;">¡Enviado con éxito!</p>`;
                        } catch(e) { saveBtn.disabled = false; saveBtn.innerHTML = t.send; }
                    };
                }
            });
        }
    }

    startBtn.addEventListener('click', async () => {
        if (isActive || session) { disconnect(); setStatus('idle'); return; }
        setStatus('connecting');
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            await startMic();
            connect();
        } catch (e) { setStatus('error'); }
    });

    setStatus('idle');
});
