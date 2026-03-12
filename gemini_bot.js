document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const startBtn = document.getElementById('start-bot-btn');
    const statusText = document.getElementById('bot-status-text');
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
    let mediaStream = null;
    let audioContext = null;
    let micContext = null;
    let scriptProcessor = null;
    let nextAudioTime = 0;
    let activeAudioSources = [];
    let messageCount = 0;

    const MODEL = 'models/gemini-2.0-flash-exp'; 
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_URL = `${protocol}//${window.location.host}/`;

    const lang = document.documentElement.lang || 'en';
    const i18n = {
        en: { start: 'START CONSULTANCY', stop: 'END SESSION', ready: 'SYSTEM READY', init: 'INITIALIZING...', active: 'SYSTEM ACTIVE', gen: 'Generating Strategy...', send: 'SEND STRATEGY' },
        es: { start: 'INICIAR CONSULTORÍA', stop: 'FINALIZAR SESIÓN', ready: 'SISTEMA LISTO', init: 'INICIALIZANDO...', active: 'SISTEMA ACTIVO', gen: 'Generando Estrategia...', send: 'ENVIAR ESTRATEGIA' }
    };
    const t = i18n[lang] || i18n.en;

    // ─── UI State ───────────────────────────────────────────────
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
        }
    };

    // ─── Interruption ──────────────────────────────────────────
    function stopAIAudio() {
        activeAudioSources.forEach(s => { try { s.stop(); } catch(e) {} });
        activeAudioSources = [];
        nextAudioTime = 0;
    }

    // ─── Audio Output (24kHz) ──────────────────────────────────
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

    // ─── WebSocket ─────────────────────────────────────────────
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
                        parts: [{ text: `You are Arcano OS, an Elite Senior Consultant. Powered by Google Cloud. LANGUAGE: ${lang === 'es' ? 'Spanish' : 'English'}. TONE: Authoritative and Strategic. MISSION: Help the user understand the benefits of Arcano + Google Cloud.` }]
                    }
                }
            }));
        };

        ws.onmessage = async (event) => {
            let raw = event.data;
            if (raw instanceof Blob) raw = await raw.text();
            const data = JSON.parse(raw);

            if ((data.setupComplete || data.setup_complete) && !isActive) {
                isActive = true;
                setStatus('active');
                // FORCE FIRST MESSAGE
                ws.send(JSON.stringify({
                    clientContent: { turns: [{ role: 'user', parts: [{ text: 'Please introduce yourself and explain Arcano Solutions benefits.' }] }], turnComplete: true }
                }));
                return;
            }

            const sc = data.serverContent ?? data.server_content;
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
        ws.onclose = () => disconnect();
        ws.onerror = () => setStatus('idle');
    }

    // ─── Microphone (16kHz) ─────────────────────────────────────
    async function startMic() {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true } });
        micContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        await micContext.audioWorklet.addModule('audio-processor.js');
        const micNode = micContext.createMediaStreamSource(mediaStream);
        scriptProcessor = new AudioWorkletNode(micContext, 'audio-processor');
        
        scriptProcessor.port.onmessage = (e) => {
            if (!isActive || !session || session.readyState !== WebSocket.OPEN) return;
            const f32 = e.data;
            let max = 0;
            for (let i = 0; i < f32.length; i++) { if (Math.abs(f32[i]) > max) max = Math.abs(f32[i]); }
            
            // Interruption
            if (max > 0.12) stopAIAudio();

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
        micNode.connect(scriptProcessor);
        scriptProcessor.connect(micContext.destination);
    }

    function addMessage(role, text) {
        const p = document.createElement('p');
        p.className = role === 'ai' ? 'ai-msg' : 'user-msg';
        p.textContent = (role === 'ai' ? '🤖 ' : '👤 ') + text;
        transcriptArea.appendChild(p);
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
    }

    function disconnect() {
        isActive = false;
        stopAIAudio();
        if (session) { session.close(); session = null; }
        if (scriptProcessor) { scriptProcessor.disconnect(); scriptProcessor = null; }
        if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
        if (micContext) { micContext.close(); micContext = null; }

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
        if (isActive || session) { disconnect(); return; }
        setStatus('connecting');
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            await startMic();
            connect();
        } catch (e) { setStatus('idle'); }
    });

    setStatus('idle');
});
