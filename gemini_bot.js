document.addEventListener('DOMContentLoaded', () => {
    // Detect if running on file:// protocol
    if (window.location.protocol === 'file:') {
        alert("⚠️ ATENCIÓN: Estás abriendo el archivo localmente (file://). Abre http://localhost:8080 para que el micrófono funcione.");
    }

    const startBtn = document.getElementById('start-bot-btn');
    const statusText = document.getElementById('bot-status-text');
    const statusContainer = document.querySelector('.bot-status-container');
    const botContainer = document.querySelector('.ai-bot-container');
    const botOrb = document.getElementById('bot-orb');
    const transcriptArea = document.getElementById('bot-transcript');
    const reportArea = document.getElementById('bot-report');
    const reportText = document.getElementById('report-text');
    const heroTitle = document.querySelector('.hero-content h1');
    const visualWrapper = document.querySelector('.bot-visual-wrapper');
    const minimizeBtn = document.getElementById('bot-minimize-btn');

    const launcher = document.getElementById('bot-launcher');

    // ─── Minimize/Maximize Logic ───────────────────────────────
    minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        botContainer.classList.add('hidden');
        launcher.style.display = 'flex';
    });

    launcher.addEventListener('click', () => {
        botContainer.classList.remove('hidden');
        launcher.style.display = 'none';
    });

    let session = null;
    let isActive = false;
    let mediaStream = null;
    let audioContext = null;
    let nextAudioTime = 0;
    let scriptProcessor = null;
    let microphoneNode = null;
    let micContext = null;
    let recognition = null; // Local STT for user experience

    // ─── STT Initialization ─────────────────────────────────────
    function initRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech Recognition not supported in this browser.');
            return;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-ES';

        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    addMessage('user', event.results[i][0].transcript);
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            // Optional: update a temporary interim bubble if desired
        };
    }

    initRecognition();

    const MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';

    // Determinar la URL correcta del WebSocket (Local vs Producción)
    const isLocal = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    let WS_URL;
    if (isLocal) {
        WS_URL = `ws://localhost:8080/`;
    } else {
        WS_URL = window.location.protocol === 'https:' ?
            `wss://${window.location.host}/` :
            `ws://${window.location.host}/`;
    }

    // ─── UI State ───────────────────────────────────────────────
    const setStatus = (status) => {
        statusContainer.className = 'bot-status-container';
        botContainer.classList.remove('status-idle', 'status-connecting', 'status-active');
        switch (status) {
            case 'idle':
                botContainer.classList.add('status-idle');
                statusText.textContent = 'LISTO';
                startBtn.innerHTML = '<i class="fas fa-terminal"></i> Iniciar Neural Core';
                if (recognition) recognition.stop();
                break;
            case 'connecting':
                botContainer.classList.add('status-connecting');
                statusText.textContent = 'INICIALIZANDO...';
                break;
            case 'active':
                botContainer.classList.add('status-active');
                statusText.textContent = 'SISTEMA ACTIVO';
                transcriptArea.innerHTML = '';
                if (recognition) recognition.start();
                startBtn.innerHTML = '<i class="fas fa-stop"></i> Finalizar Sesión';
                break;
        }
    };

    setStatus('idle');

    // ─── Button Click ────────────────────────────────────────────
    startBtn.addEventListener('click', async () => {
        if (isActive || session) {
            disconnect();
            return;
        }

        setStatus('connecting');

        try {
            // 1. Init audio contexts
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            if (audioContext.state === 'suspended') await audioContext.resume();

            // 2. PEDIR PERMISOS Y ACTIVAR MICRÓFONO PRIMERO
            await startMic();

            // 3. Conectar a Gemini después de que el audio ya está fluyendo
            connect();
        } catch (e) {
            console.error("No se pudo iniciar el microfono:", e);
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

    function connect() {
        const ws = new WebSocket(WS_URL);
        session = ws;

        ws.onopen = () => {
            console.log('[Bot] WebSocket opened');
            const setupMsg = {
                setup: {
                    model: MODEL,
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        temperature: 0.4, // Más determinista y profesional
                        top_p: 0.95,
                        thinkingConfig: { includeThoughts: true },
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: 'Aoede' }
                            }
                        }
                    },
                    systemInstruction: {
                        parts: [{ text: "Eres el Consultor Senior de Estrategia Tecnológica en Arcano Solutions. Tu nivel es experto, ejecutivo y profesional. Tu misión es diagnosticar necesidades empresariales y proponer soluciones de IA aplicada, Ciberseguridad y Arquitectura Cloud de alto impacto. REGLAS CRÍTICAS: 1. Habla ÚNICAMENTE en español de forma profesional. 2. No uses saludos informales; usa 'Buen día' o 'Un gusto saludarle'. 3. Actúa como un asesor estratégico (no solo un vendedor). 4. Tu primera frase debe ser: 'Núcleo Neural de Arcano Solutions activo. Buen día, soy su asesor estratégico. ¿En qué área técnica o de negocio desea profundizar hoy?'." }]
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

            // setupComplete
            const isReady = data.setupComplete !== undefined || data.setup_complete !== undefined;
            if (isReady && !isActive) {
                isActive = true;
                setStatus('active');
                ws.send(JSON.stringify({
                    clientContent: { turns: [{ role: 'user', parts: [{ text: 'Hola, inicia el diagnóstico profesional.' }] }], turnComplete: true }
                }));
                return;
            }

            // Server Content (AI Response and User Transcript)
            const sc = data.serverContent ?? data.server_content;
            if (sc) {
                const mt = sc.modelTurn ?? sc.model_turn;
                if (mt?.parts) {
                    for (const p of mt.parts) {
                        if (p.text) addMessage('ai', p.text);
                        if (p.inlineData?.data) playPCM(p.inlineData.data);
                    }
                }
                
                // Real-time transcript for user speech
                if (sc.userContent?.parts) {
                    for (const p of sc.userContent.parts) {
                        if (p.text) addMessage('user', p.text);
                    }
                }
            }
        };

        ws.onerror = (e) => {
            console.error('[Bot] WS Error:', e);
        };

        ws.onclose = (event) => {
            console.log(`[Bot] WS Closed — Code: ${event.code}, Reason: ${event.reason}`);
            if (event.code !== 1000 && event.code !== 1005 && event.code) {
                const reasons = {
                    1007: '❌ Clave API inválida o región bloqueada.',
                    1008: `❌ Modelo no soportado: ${MODEL}`,
                    1011: '❌ Error interno del servidor de Google.'
                };
                alert(reasons[event.code] || `Conexión cerrada.\nCódigo: ${event.code}\nRazón: ${event.reason}`);
                localStorage.removeItem('gemini_api_key');
                apiKey = null;
            }
            disconnect();
        };
    }

    const updateOrbReactivity = (volume) => {
        if (!isActive) return;
        // Scale from 1.0 to 1.5 based on volume
        const scale = 1 + (volume * 1.5);
        botOrb.style.transform = `scale(${scale})`;
        botOrb.style.boxShadow = `0 0 ${20 + (volume * 60)}px rgba(85, 230, 165, ${0.2 + (volume * 0.8)})`;
        
        const icon = botOrb.querySelector('#bot-icon');
        if (icon) {
            icon.style.filter = `drop-shadow(0 0 ${5 + (volume * 20)}px rgba(255, 255, 255, ${0.4 + volume}))`;
        }
    };

    // ─── Microphone ──────────────────────────────────────────────
    async function startMic() {
        if (!navigator.mediaDevices?.getUserMedia) {
            alert('Tu navegador no soporta acceso al micrófono en este contexto. Usa localhost con HTTPS.');
            throw new Error('No mic access');
        }

        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
        });

        micContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        if (micContext.state === 'suspended') await micContext.resume();

        microphoneNode = micContext.createMediaStreamSource(mediaStream);

        try {
            await micContext.audioWorklet.addModule('audio-processor.js');
        } catch (e) {
            console.error('Error cargando el worklet de audio:', e);
            alert('Fallo al cargar el motor de audio avanzado. Asegúrate de estar ejecutando en un servidor (localhost o dominio real).');
            throw e;
        }

        scriptProcessor = new AudioWorkletNode(micContext, 'audio-processor');

        scriptProcessor.port.onmessage = (e) => {
            if (!isActive || !session || session.readyState !== WebSocket.OPEN) return;

            const f32 = e.data; // Recibimos el buffer completo de 4096 muestras

            // Medir volumen para reactividad visual
            let max = 0;
            for (let i = 0; i < f32.length; i++) {
                const abs = Math.abs(f32[i]);
                if (abs > max) max = abs;
            }
            
            // Actualizar orbe (smooth scaling)
            requestAnimationFrame(() => updateOrbReactivity(max));

            // Convertir de Float32 a Int16 (PCM)
            const pcm16 = new Int16Array(f32.length);
            for (let i = 0; i < f32.length; i++) {
                const s = Math.max(-1, Math.min(1, f32[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Convertir a base64 por chunks
            const bytes = new Uint8Array(pcm16.buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i += 8192) {
                binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
            }

            // Enviar chunk de audio a Gemini
            session.send(JSON.stringify({
                realtimeInput: {
                    mediaChunks: [{
                        mimeType: 'audio/pcm;rate=16000',
                        data: btoa(binary)
                    }]
                }
            }));
        };

        microphoneNode.connect(scriptProcessor);
        scriptProcessor.connect(micContext.destination);
        console.log('[Bot] Mic streaming started via AudioWorklet (AI Grade)');
    }

    // ─── Audio Playback ──────────────────────────────────────────
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
            nextAudioTime += buf.duration;
        } catch (e) {
            console.error('[Bot] Playback error:', e);
        }
    }

    // ─── Disconnect ──────────────────────────────────────────────
    function disconnect() {
        isActive = false;

        if (session) {
            session.onclose = null;
            session.close();
            session = null;
        }
        if (scriptProcessor) { scriptProcessor.disconnect(); scriptProcessor = null; }
        if (microphoneNode) { microphoneNode.disconnect(); microphoneNode = null; }
        if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
        if (micContext) { micContext.close(); micContext = null; }

        // Generar Informe Real con IA
        if (transcriptArea.textContent.length > 10) {
            visualWrapper.style.display = 'none';
            transcriptArea.style.display = 'none';
            reportArea.style.display = 'block';
            reportText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ejecutando Arcano Deep Analysis...';

            const fullTranscript = Array.from(transcriptArea.querySelectorAll('p'))
                .map(p => p.textContent)
                .join('\n');

            fetch('/api/generate_report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: fullTranscript })
            })
            .then(res => res.json())
            .then(data => {
                const recommendation = data.report || "No se pudo generar el informe profundo.";
                
                // Usar Marked.js para renderizar el Markdown a HTML estructurado
                if (typeof marked !== 'undefined') {
                    reportText.innerHTML = marked.parse(recommendation);
                } else {
                    reportText.innerHTML = recommendation.replace(/\n/g, '<br>');
                }
                
                // Mostrar el formulario de captura
                const leadForm = document.getElementById('lead-capture-form');
                if (leadForm) {
                    leadForm.style.display = 'block';
                    const saveBtn = document.getElementById('save-lead-btn');
                    saveBtn.onclick = async () => {
                        const name = document.getElementById('lead-name').value;
                        const email = document.getElementById('lead-email').value;
                        
                        if (!name || !email) {
                            alert('Por favor, ingresa tu nombre y correo.');
                            return;
                        }
                        
                        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
                        
                        try {
                            const response = await fetch('/api/save_lead', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    name: name,
                                    email: email,
                                    interest: 'Consulta Arcano Live AI',
                                    message: recommendation
                                })
                            });
                            
                            if (response.ok) {
                                leadForm.innerHTML = '<p style="color: #55e6a5; font-weight: 600; text-align: center;"><i class="fas fa-check-circle"></i> ¡Guardado con éxito! Un especialista analizará el reporte y te contactará.</p>';
                            } else {
                                throw new Error('Error en el servidor');
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            alert('Hubo un problema de conexión al guardar.');
                            saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar y Enviar';
                        }
                    };
                }
            })
            .catch(err => {
                console.error('Error generating deep report:', err);
                reportText.innerHTML = "Error al conectar con el motor de análisis profundo. Se usará recomendación estándar.";
            });

            statusText.textContent = 'INFORME GENERADO';
        }

        // Actualizar el Hero
        if (heroTitle && transcriptArea.textContent.length > 10) {
            heroTitle.style.fontSize = '2.5rem';
            heroTitle.innerHTML = "¡Analizamos tus necesidades!<br><span style='font-size: 1.2rem; color: #55e6a5; font-weight: 300;'>Arcano Solutions te contactará con una propuesta personalizada basada en nuestra charla.</span>";
        }

        nextAudioTime = 0;
        setStatus('idle');
        transcriptArea.style.display = 'none';
        botOrb.style.transform = '';
    }
});
