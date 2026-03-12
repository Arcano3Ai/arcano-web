document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-bot-btn');
    const statusText = document.getElementById('bot-status-text');
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

    const MODEL = 'models/gemini-2.5-flash-native-audio-latest'; 
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_URL = `${protocol}//${window.location.host}/`;

    const setStatus = (status) => {
        botContainer.classList.remove('status-idle', 'status-connecting', 'status-active');
        if (status === 'idle') {
            botContainer.classList.add('status-idle');
            statusText.textContent = 'SYSTEM READY';
        } else if (status === 'connecting') {
            botContainer.classList.add('status-connecting');
            statusText.textContent = 'CONNECTING...';
        } else if (status === 'active') {
            botContainer.classList.add('status-active');
            statusText.textContent = 'SYSTEM ACTIVE';
        }
    };

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
        nextAudioTime += buf.duration;
    }

    function connect() {
        const ws = new WebSocket(WS_URL);
        session = ws;
        ws.onopen = () => {
            ws.send(JSON.stringify({
                setup: {
                    model: MODEL,
                    generationConfig: { responseModalities: ['AUDIO'] }
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
                    clientContent: { turns: [{ role: 'user', parts: [{ text: 'Hello' }] }], turnComplete: true }
                }));
            }
            const sc = parsed.serverContent ?? parsed.server_content;
            if (sc?.modelTurn?.parts) {
                sc.modelTurn.parts.forEach(p => {
                    if (p.text) {
                        const msg = document.createElement('p');
                        msg.className = 'ai-msg';
                        msg.textContent = p.text;
                        transcriptArea.appendChild(msg);
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
            for (let i = 0; i < f32.length; i++) pcm16[i] = f32[i] < 0 ? f32[i] * 0x8000 : f32[i] * 0x7FFF;
            const bytes = new Uint8Array(pcm16.buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
            session.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: btoa(binary) }] } }));
        };
        source.connect(processor);
        processor.connect(micContext.destination);
    }

    startBtn.addEventListener('click', async () => {
        if (isActive) { session.close(); return; }
        setStatus('connecting');
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        await startMic();
        connect();
    });
});
