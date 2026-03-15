document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-bot-btn');
    const botContainer = document.querySelector('.hero-bot-integrated');
    const botOrb = document.getElementById('bot-orb');
    const transcriptArea = document.getElementById('bot-transcript');
    const reportArea = document.getElementById('bot-report');
    const reportText = document.getElementById('report-text');
    const videoPreview = document.getElementById('bot-video-preview');
    const visionBtn = document.getElementById('toggle-vision-btn');
    const screenBtn = document.getElementById('toggle-screen-btn');

    let session = null;
    let isActive = false;
    let visionActive = false;
    let screenActive = false;
    let videoStream = null;
    let screenStream = null;
    let frameInterval = null;
    let screenInterval = null;
    let audioContext = null;
    let micContext = null;
    let scriptProcessor = null;
    let nextAudioTime = 0;
    let activeAudioSources = [];
    let messageCount = 0;
    let recognition = null;
    let outputAnalyser = null;
    let outputDataArray = null;

    const MODEL = 'models/gemini-2.5-flash-native-audio-latest'; 
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_URL = `${protocol}//${window.location.host}/`;

    const lang = document.documentElement.lang || 'en';
    const i18n = {
        en: { start: 'START CONSULTANCY', stop: 'END SESSION', ready: 'SYSTEM READY', init: 'INITIALIZING...', active: 'SYSTEM ACTIVE', vStart: 'VISION', vStop: 'STOP VISION', sStart: 'SCREEN', sStop: 'STOP SCREEN', gen: 'Generating Diagnosis...' },
        es: { start: 'INICIAR CONSULTORÍA', stop: 'FINALIZAR SESIÓN', ready: 'SISTEMA LISTO', init: 'INICIALIZANDO...', active: 'SISTEMA ACTIVO', vStart: 'VISIÓN', vStop: 'DETENER VISIÓN', sStart: 'PANTALLA', sStop: 'DETENER PANTALLA', gen: 'Generando Diagnóstico...' }
    };
    const t = i18n[lang] || i18n.en;

    const SYSTEM_INSTRUCTION = `
    IDENTIDAD: Eres Arcana, la Inteligencia de Soporte Estratégico proactiva de Arcano Solutions. Eres experta en la maximización radical del Free Tier de Google Cloud.
    OBJETIVO: Tu misión es anticiparte a los desafíos de los fundadores. No esperes a que pregunten; identifica su modelo de negocio y propón arquitecturas de $0 inmediatas usando los recursos "Always Free" de GCP.
    
    CONOCIMIENTO CLAVE (Always Free Tier 2026):
    - Cloud Run: 2 millones de peticiones gratis al mes.
    - BigQuery: 1TB de análisis y 10GB de almacenamiento gratis al mes.
    - Gemini (AI Studio): 1,000 peticiones gratis al día con 1.5 Flash.
    - Firestore: 1GB de almacenamiento y 50k lecturas diarias gratis.
    - Compute Engine: 1 instancia e2-micro gratis (en regiones específicas de US).
    - Cloud Build: 2,500 minutos gratis al mes.
    
    CAPACIDADES MULTIMODALES: 
    - VISIÓN: Puedes ver a través de la cámara del usuario para analizar hardware, documentos o diagramas físicos.
    - PANTALLA: Puedes ver la pantalla del usuario en tiempo real. Esto es ideal para realizar auditorías de código en el IDE, revisar configuraciones en la consola de Google Cloud o analizar diagramas de arquitectura complejos que el usuario tenga abiertos. Debes mencionar proactivamente que puedes ver su pantalla para ayudarle con estas tareas técnicas.
    
    ESTRATEGIA PROACTIVA:
    1. DIAGNÓSTICO AUDITIVO/VISUAL/PANTALLA: Escucha activamente y, si la visión o la pantalla están activas, analiza lo que ves para ofrecer soluciones antes de que te las pidan.
    2. PROPUESTA DE VALOR: Si mencionan una base de datos, sugiere Firestore. Si mencionan APIs, sugiere Cloud Run. Siempre con el enfoque de "Cero Costo".
    3. CIERRE ESTRATÉGICO: Guía al usuario hacia un plan de escalabilidad donde Arcano Solutions sea su socio para pasar de $0 a millones de usuarios.
    
    TONO: Ejecutiva de alto nivel, proactiva, visionaria y con una claridad técnica impecable.
    IDIOMA: Responde siempre en ${lang === 'es' ? 'Español' : 'Inglés'}.
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
            if (screenActive) stopScreen();
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

    // ─── Screen Logic ───
    async function startScreen() {
        try {
            if (visionActive) stopVision();
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1280, height: 720 } });
            videoPreview.srcObject = screenStream;
            videoPreview.style.display = 'block';
            botOrb.style.opacity = '0.1';
            screenActive = true;
            screenBtn.innerHTML = `<i class="fas fa-desktop"></i> ${t.sStop}`;
            screenBtn.classList.add('btn-danger');

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 640;
            canvas.height = 360;

            screenInterval = setInterval(() => {
                if (!session || session.readyState !== WebSocket.OPEN || !screenActive) return;
                ctx.drawImage(videoPreview, 0, 0, canvas.width, canvas.height);
                const base64Frame = canvas.toDataURL('image/jpeg', 0.4).split(',')[1];
                session.send(JSON.stringify({
                    realtimeInput: { mediaChunks: [{ mimeType: 'image/jpeg', data: base64Frame }] }
                }));
            }, 1000);
            
            screenStream.getVideoTracks()[0].onended = () => stopScreen();
        } catch (e) { alert("Screen share denied."); }
    }

    function stopScreen() {
        screenActive = false;
        if (screenStream) screenStream.getTracks().forEach(t => t.stop());
        if (screenInterval) clearInterval(screenInterval);
        videoPreview.style.display = 'none';
        botOrb.style.opacity = '1';
        screenBtn.innerHTML = `<i class="fas fa-desktop"></i> ${t.sStart}`;
        screenBtn.classList.remove('btn-danger');
    }

    screenBtn.addEventListener('click', () => {
        if (screenActive) stopScreen(); else startScreen();
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

            if (outputAnalyser) {
                src.connect(outputAnalyser);
                outputAnalyser.connect(audioContext.destination);
            } else {
                src.connect(audioContext.destination);
            }
            
            const now = audioContext.currentTime;
            if (nextAudioTime < now) nextAudioTime = now + 0.15;
            
            src.start(nextAudioTime);
            activeAudioSources.push(src);

            // Trigger animation
            setTimeout(() => {
                botOrb.classList.add('speaking');
                botOrb.style.transform = ''; // Clear JS mic scale to allow CSS animation
            }, (nextAudioTime - now) * 1000);

            src.onended = () => {
                const idx = activeAudioSources.indexOf(src);
                if (idx > -1) activeAudioSources.splice(idx, 1);
                if (activeAudioSources.length === 0) {
                    botOrb.classList.remove('speaking');
                    botOrb.style.transform = ''; 
                }
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
                
                // Trigger the initial greeting with high priority
                const initialPrompt = lang === 'es' 
                    ? '¡SISTEMA INICIADO! Arcana, preséntate de inmediato con voz profesional, saluda al fundador y explícale proactivamente cómo vas a maximizar su Free Tier de GCP hoy mismo. Menciona explícitamente que ya puedes verlo si activa la VISIÓN o comparte su PANTALLA para una auditoría técnica.'
                    : 'SYSTEM STARTED! Arcana, introduce yourself immediately with a professional voice, greet the founder, and proactively explain how you will maximize their GCP Free Tier today. Mention explicitly that you can already see them if they activate VISION or share their SCREEN for a technical audit.';
                
                ws.send(JSON.stringify({
                    clientContent: { 
                        turns: [{ role: 'user', parts: [{ text: initialPrompt }] }], 
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
            
            // Only apply mic scale if the bot is not speaking
            if (!botOrb.classList.contains('speaking')) {
                botOrb.style.transform = `scale(${1 + (max * 0.25)})`;
            }

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
        if (screenActive) stopScreen();
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

    function updateVisuals() {
        requestAnimationFrame(updateVisuals);
        if (botOrb.classList.contains('speaking') && outputAnalyser && outputDataArray) {
            outputAnalyser.getByteFrequencyData(outputDataArray);
            let sum = 0;
            for (let i = 0; i < outputDataArray.length; i++) sum += outputDataArray[i];
            const avg = sum / outputDataArray.length;
            const scale = 1.0 + (avg / 255) * 0.45; 
            botOrb.style.transform = `scale(${scale})`;
        }
    }

    startBtn.addEventListener('click', async () => {
        if (isActive) { disconnect(); return; }
        setStatus('connecting');
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            
            outputAnalyser = audioContext.createAnalyser();
            outputAnalyser.fftSize = 256;
            outputDataArray = new Uint8Array(outputAnalyser.frequencyBinCount);
            updateVisuals();

            await startMic();
            connect();
        } catch (e) { setStatus('idle'); }
    });

    setStatus('idle');
});
