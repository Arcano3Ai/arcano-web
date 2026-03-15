/**
 * ARCANO OS - Versión Estable v1.8 + Visión & Pantalla
 * Voz intacta, añadiendo capacidades visuales.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias a la UI ---
    const startBtn = document.getElementById('start-bot-btn');
    const botContainer = document.querySelector('.hero-bot-integrated');
    const botOrb = document.getElementById('bot-orb');
    const transcriptArea = document.getElementById('bot-transcript');
    const videoPreview = document.getElementById('bot-video-preview');
    const visionBtn = document.getElementById('toggle-vision-btn');
    const screenBtn = document.getElementById('toggle-screen-btn');
    const muteBtn = document.getElementById('toggle-mute-btn');

    // --- Estado Global ---
    let session = null;
    let isActive = false;
    let isMuted = false;
    let audioContext = null;
    let micContext = null;
    let aiAnalyser = null; 
    let nextAudioTime = 0;
    let activeAudioSources = [];

    // Estado Visual
    let visionActive = false;
    let screenActive = false;
    let videoStream = null;
    let screenStream = null;
    let mediaInterval = null;

    const MODEL = 'models/gemini-2.5-flash-native-audio-latest'; 
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_URL = `${protocol}//${window.location.host}/`;
    const lang = document.documentElement.lang || 'es';

    const SYSTEM_INSTRUCTION = `
    IDENTITY: You are Arcana, the elite Screen Intelligence Agent.
    VISUAL SYNC: You speak THROUGH THE ORB. Your voice is synchronized with its pulse.
    MISSION: Help founders build for $0 using Google's Free Tier.
    LANGUAGE: Always respond in ${lang === 'es' ? 'Español' : 'English'}.
    `;

    const setStatus = (status) => {
        if (!botContainer) return;
        if (status === 'active') {
            botContainer.classList.add('status-active');
            if (startBtn) startBtn.innerHTML = `<i class="fas fa-stop"></i> ${lang === 'es' ? 'FINALIZAR' : 'STOP'}`;
        } else {
            botContainer.classList.remove('status-active');
            if (startBtn) startBtn.innerHTML = `<i class="fas fa-terminal"></i> ${lang === 'es' ? 'INICIAR CONSULTORÍA' : 'START CONSULTANCY'}`;
        }
    };

    // --- FUNCIONES DE VISIÓN Y PANTALLA ---
    async function startVision() {
        try {
            if (screenActive) stopScreen();
            videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480 } });
            videoPreview.srcObject = videoStream;
            videoPreview.style.display = 'block';
            botOrb.style.opacity = '0.2';
            visionActive = true;
            visionBtn.classList.add('btn-danger');

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 320; canvas.height = 320;

            mediaInterval = setInterval(() => {
                if (!isActive || !session || session.readyState !== WebSocket.OPEN) return;
                ctx.drawImage(videoPreview, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                session.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: 'image/jpeg', data: base64 }] } }));
            }, 1000);
        } catch (e) { console.error("Vision Error:", e); }
    }

    function stopVision() {
        visionActive = false;
        if (videoStream) videoStream.getTracks().forEach(t => t.stop());
        if (mediaInterval) clearInterval(mediaInterval);
        videoPreview.style.display = 'none';
        botOrb.style.opacity = '1';
        visionBtn.classList.remove('btn-danger');
    }

    async function startScreen() {
        try {
            if (visionActive) stopVision();
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1280, height: 720 } });
            videoPreview.srcObject = screenStream;
            videoPreview.style.display = 'block';
            botOrb.style.opacity = '0.2';
            screenActive = true;
            if (screenBtn) screenBtn.classList.add('btn-danger');

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 640; canvas.height = 360;

            mediaInterval = setInterval(() => {
                if (!isActive || !session || session.readyState !== WebSocket.OPEN) return;
                ctx.drawImage(videoPreview, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/jpeg', 0.4).split(',')[1];
                session.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: 'image/jpeg', data: base64 }] } }));
            }, 1000);
            screenStream.getVideoTracks()[0].onended = () => stopScreen();
        } catch (e) { console.error("Screen Error:", e); }
    }

    function stopScreen() {
        screenActive = false;
        if (screenStream) screenStream.getTracks().forEach(t => t.stop());
        if (mediaInterval) clearInterval(mediaInterval);
        videoPreview.style.display = 'none';
        botOrb.style.opacity = '1';
        if (screenBtn) screenBtn.classList.remove('btn-danger');
    }

    // --- VOZ (INTACTA) ---
    function animateOrbFromAI() {
        if (!aiAnalyser || !isActive || !botOrb) return;
        const dataArray = new Uint8Array(aiAnalyser.frequencyBinCount);
        aiAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        const scale = 1 + (average / 128); 
        botOrb.style.transform = `scale(${scale})`;
        botOrb.style.boxShadow = `0 0 ${40 + average}px rgba(59, 130, 246, 0.6)`;
        requestAnimationFrame(animateOrbFromAI);
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
            for (let i = 0; i < pcm16.length; i++) ch[i] = pcm16[i] / 32768;
            const src = audioContext.createBufferSource();
            src.buffer = buf;
            src.connect(aiAnalyser);
            aiAnalyser.connect(audioContext.destination);
            const now = audioContext.currentTime;
            if (nextAudioTime < now) nextAudioTime = now + 0.15;
            src.start(nextAudioTime);
            activeAudioSources.push(src);
            nextAudioTime += buf.duration;
        } catch(e) {}
    }

    function stopAIAudio() {
        activeAudioSources.forEach(s => { try { s.stop(); } catch(e) {} });
        activeAudioSources = [];
        nextAudioTime = 0;
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
                    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }
                }
            }));
        };

        ws.onmessage = async (event) => {
            let data = event.data;
            if (data instanceof Blob) data = await data.text();
            let parsed; try { parsed = JSON.parse(data); } catch(e) { return; }

            if (parsed.setupComplete || parsed.setup_complete) {
                isActive = true; 
                setStatus('active');
                animateOrbFromAI();
                ws.send(JSON.stringify({
                    clientContent: { turns: [{ role: 'user', parts: [{ text: `System Online. Greet me.` }] }], turnComplete: true }
                }));
            }

            const sc = parsed.serverContent ?? parsed.server_content;
            if (sc?.modelTurn?.parts) {
                sc.modelTurn.parts.forEach(p => {
                    if (p.inlineData?.data) playPCM(p.inlineData.data);
                    if (p.text && transcriptArea) {
                        const m = document.createElement('p');
                        m.className = 'ai-msg';
                        m.textContent = "🔹 " + p.text;
                        transcriptArea.appendChild(m);
                        transcriptArea.scrollTop = transcriptArea.scrollHeight;
                    }
                });
            }
            if (parsed.interrupted) stopAIAudio();
        };
        ws.onclose = () => { stopAll(); };
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
            if (max > 0.15) { stopAIAudio(); }
            if (max > 0.05 && botOrb && !botOrb.classList.contains('speaking')) botOrb.style.transform = `scale(${1 + (max * 1.2)})`;
            
            if (!isMuted) {
                const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
                session.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64 }] } }));
            }
        };
        source.connect(processor);
        processor.connect(micContext.destination);
    }

    function stopAll() {
        isActive = false;
        isMuted = false;
        if (muteBtn) {
            muteBtn.innerHTML = `<i class="fas fa-microphone"></i> ${lang === 'es' ? 'MUTE' : 'MUTE'}`;
            muteBtn.classList.remove('btn-danger');
        }
        if (session) session.close();
        if (micContext) micContext.close();
        if (audioContext) audioContext.close();
        if (visionActive) stopVision();
        if (screenActive) stopScreen();
        setStatus('idle');
    }

    // --- EVENT LISTENERS ---
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            if (isActive) { stopAll(); return; }
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            if (audioContext.state === 'suspended') await audioContext.resume();
            aiAnalyser = audioContext.createAnalyser();
            aiAnalyser.fftSize = 256;
            await startMic(); 
            connect();
        });
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            if (isMuted) {
                muteBtn.innerHTML = `<i class="fas fa-microphone-slash"></i> ${lang === 'es' ? 'UNMUTE' : 'UNMUTE'}`;
                muteBtn.classList.add('btn-danger');
            } else {
                muteBtn.innerHTML = `<i class="fas fa-microphone"></i> ${lang === 'es' ? 'MUTE' : 'MUTE'}`;
                muteBtn.classList.remove('btn-danger');
            }
        });
    }

    if (visionBtn) visionBtn.addEventListener('click', () => visionActive ? stopVision() : startVision());
    if (screenBtn) screenBtn.addEventListener('click', () => screenActive ? stopScreen() : startScreen());
});
