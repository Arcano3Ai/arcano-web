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

    // ... (STT Initialization and UI State remain same) ...

    function disconnect() {
        if (visionActive) stopVision();
        isActive = false;
        if (session) { session.close(); session = null; }
        if (scriptProcessor) { scriptProcessor.disconnect(); scriptProcessor = null; }
        if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
        if (micContext) { micContext.close(); micContext = null; }

        // Transition to Report inside the same terminal structure
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
                
                // Set translated texts for the lead form
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
