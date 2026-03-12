document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-bot-btn');
    const botContainer = document.querySelector('.hero-bot-integrated');
    const botOrb = document.getElementById('bot-orb');
    const transcriptArea = document.getElementById('bot-transcript');
    const reportArea = document.getElementById('bot-report');
    const reportText = document.getElementById('report-text');
    const visionBtn = document.getElementById('toggle-vision-btn');

    let session = null;
    let isActive = false;
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
        en: { start: 'START CONSULTANCY', stop: 'END SESSION', ready: 'SYSTEM READY', init: 'INITIALIZING...', active: 'SYSTEM ACTIVE' },
        es: { start: 'INICIAR CONSULTORÍA', stop: 'FINALIZAR SESIÓN', ready: 'SISTEMA LISTO', init: 'INICIALIZANDO...', active: 'SISTEMA ACTIVO' }
    };
    const t = i18n[lang] || i18n.en;

    const SYSTEM_INSTRUCTION = `
    IDENTIDAD: Eres Arcana, representante de Arcano Solutions.
    PERSONALIDAD: Majestuosa, estratégica y altamente profesional.
    REGLA CRÍTICA DE TEXTO: Debes enviar SIEMPRE una transcripción en texto de lo que dices. 
    Escribe tus respuestas palabra por palabra o en fragmentos cortos para que aparezcan en la pantalla en tiempo real.
    FLUJO: Saluda, pregunta el nombre y asesora sobre Google Cloud.
    Idioma: ${lang === 'es' ? 'Español' : 'Inglés'}.
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
                        temperature: 0.75,
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
                ws.send(JSON.stringify({
                    clientContent: { 
                        turns: [{ role: 'user', parts: [{ text: 'Hola Arcana, preséntate y pregúntame mi nombre.' }] }], 
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

    startBtn.addEventListener('click', async () => {
        if (isActive) { session.close(); return; }
        setStatus('connecting');
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            await startMic();
            connect();
        } catch (e) { setStatus('idle'); }
    });

    setStatus('idle');
});
