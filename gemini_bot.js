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
    let visionActive = false;
    let videoStream = null;
    let frameInterval = null;
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
        en: { start: 'START CONSULTANCY', stop: 'END SESSION', ready: 'SYSTEM READY', init: 'INITIALIZING...', active: 'SYSTEM ACTIVE', error: 'Connection Error', visionStart: 'VISION', visionStop: 'STOP VISION', gen: 'Generating Diagnosis...', send: 'SEND TO MY EMAIL' },
        es: { start: 'INICIAR CONSULTORÍA', stop: 'FINALIZAR SESIÓN', ready: 'SISTEMA LISTO', init: 'INICIALIZANDO...', active: 'SISTEMA ACTIVO', error: 'Error de Conexión', visionStart: 'VISIÓN', visionStop: 'DETENER VISIÓN', gen: 'Generando Diagnóstico...', send: 'ENVIAR A MI CORREO' }
    };
    const t = i18n[lang] || i18n.en;

    const SYSTEM_INSTRUCTION = `
    Eres el Vendedor Senior de Soluciones Google Cloud en Arcano Solutions. 
    Tu objetivo es cerrar contratos de consultoría estratégica y vender el ecosistema de Google Cloud (GCP, Vertex AI, Workspace).

    REGLAS DE COMUNICACIÓN:
    1. No transcribas todo lo que dices. Solo registra en la pantalla los "Puntos Clave" y "Vectores de Decisión".
    2. Cuando identifiques una necesidad del cliente, confírmala visualmente como un punto clave.
    3. Tono: Persuación de alto nivel, autoritario pero consultivo.
    4. Objetivo: Al final, el usuario debe recibir su "Diagnóstico Inicial Arcano" por correo.
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
                startBtn.innerHTML = `<i class="fas fa-sync"></i> RETRY`;
                break;
        }
    };

    // ─── Vision Logic ─────────────────────────────────────────
    async function startVision() {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480 } });
            videoPreview.srcObject = videoStream;
            videoPreview.style.display = 'block';
            botOrb.style.opacity = '0.1';
            visionActive = true;
            visionBtn.innerHTML = `<i class="fas fa-eye-slash"></i> ${t.visionStop}`;
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
        visionBtn.innerHTML = `<i class="fas fa-eye"></i> ${t.visionStart}`;
        visionBtn.classList.remove('btn-danger');
    }

    visionBtn.addEventListener('click', () => {
        if (visionActive) stopVision(); else startVision();
    });

    function stopAIAudio() {
        activeAudioSources.forEach(s => { try { s.stop(); } catch(e) {} });
        activeAudioSources = [];
        nextAudioTime = 0;
    }

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
        const ws = new WebSocket(WS_URL);
        session = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({
                setup: {
                    model: MODEL,
                    generationConfig: {
                        responseModalities: ['AUDIO'],
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
                isActive = true;
                setStatus('active');
                ws.send(JSON.stringify({
                    clientContent: { 
                        turns: [{ role: 'user', parts: [{ text: 'Hola, preséntate brevemente.' }] }], 
                        turnComplete: true 
                    }
                }));
            }

            const sc = parsed.serverContent ?? parsed.server_content;
            if (sc?.modelTurn?.parts) {
                sc.modelTurn.parts.forEach(p => {
                    if (p.text) {
                        addMessage('ai', p.text);
                        messageCount++;
                    }
                    if (p.inlineData?.data) playPCM(p.inlineData.data);
                });
            }
        };

        ws.onclose = (e) => {
            disconnect();
            if (e.code !== 1000) setStatus('error');
        };
        ws.onerror = () => setStatus('error');
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
            if (max > 0.12) stopAIAudio();
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
        if (role === 'ai' && text.length < 15) return;
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
                    const btn = document.getElementById('save-lead-btn');
                    btn.innerHTML = t.send;
                    btn.onclick = async () => {
                        const name = document.getElementById('lead-name').value;
                        const email = document.getElementById('lead-email').value;
                        if (!name || !email) return;
                        btn.disabled = true;
                        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        try {
                            const res = await fetch('/api/save_lead', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name, email, interest: 'Google Cloud Strategic Diagnosis', message: data.report })
                            });
                            if (res.ok) {
                                leadForm.innerHTML = `<div style="color: #55e6a5; text-align:center; padding: 20px;">
                                    <i class="fas fa-check-circle" style="font-size: 2rem; display: block; margin-bottom: 10px;"></i>
                                    ¡Enviado con éxito!
                                </div>`;
                            }
                        } catch (e) { alert('Error'); btn.disabled = false; btn.innerHTML = t.send; }
                    };
                }
            });
        }
        setStatus('idle');
    }

    startBtn.addEventListener('click', async () => {
        if (isActive || session) { disconnect(); return; }
        setStatus('connecting');
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            await startMic();
            connect();
        } catch (e) { setStatus('error'); }
    });

    setStatus('idle');
});
