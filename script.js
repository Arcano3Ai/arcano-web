// Enable Animations only if JS loads
document.body.classList.add('js-active');

document.addEventListener('DOMContentLoaded', () => {
    // --- Mobile Menu ---
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }

    // --- THREE.JS 3D SCENE ---
    const canvasContainer = document.querySelector('.hero-visual');
    const oldCanvas = document.getElementById('particle-canvas');
    if (oldCanvas) oldCanvas.remove();

    if (canvasContainer && typeof THREE !== 'undefined') {
        const scene = new THREE.Scene();
        // Fog for depth
        scene.fog = new THREE.FogExp2(0x0a0a0c, 0.002);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 30;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        canvasContainer.appendChild(renderer.domElement);

        // Create Neural Sphere (Particles)
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 700;
        const posArray = new Float32Array(particlesCount * 3);

        for (let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 40; // Spread
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const material = new THREE.PointsMaterial({
            size: 0.12, // Slightly smaller
            color: 0x60a5fa, // Tailwind Blue 400
            transparent: true,
            opacity: 0.6,
        });

        const particlesMesh = new THREE.Points(particlesGeometry, material);
        scene.add(particlesMesh);

        // Create Connections (Lines)
        const geometrySphere = new THREE.IcosahedronGeometry(15, 1);
        const wireframe = new THREE.WireframeGeometry(geometrySphere);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x8b5cf6, // Tailwind Violet 500
            transparent: true,
            opacity: 0.1
        });
        const sphereLines = new THREE.LineSegments(wireframe, lineMaterial);
        scene.add(sphereLines);

        // Animation Loop
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;

        const windowHalfX = window.innerWidth / 2;
        const windowHalfY = window.innerHeight / 2;

        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX - windowHalfX);
            mouseY = (event.clientY - windowHalfY);
        });

        const clock = new THREE.Clock();

        const tick = () => {
            targetX = mouseX * 0.001;
            targetY = mouseY * 0.001;

            const elapsedTime = clock.getElapsedTime();

            // Rotate objects - Slower, steady corporate flow
            particlesMesh.rotation.y = .05 * elapsedTime; // Reduced speed by half
            particlesMesh.rotation.x += .01 * (targetY - particlesMesh.rotation.x); // Smoother mouse follow
            particlesMesh.rotation.y += .01 * (targetX - particlesMesh.rotation.y);

            sphereLines.rotation.y = .05 * elapsedTime;
            sphereLines.rotation.x += .01 * (targetY - sphereLines.rotation.x);

            renderer.render(scene, camera);
            requestAnimationFrame(tick);
        }

        tick();

        // Handle Resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // --- MAGNETIC BUTTONS ---
    const buttons = document.querySelectorAll('.btn-primary, .btn-secondary, .btn-nav, .btn-outline');

    buttons.forEach(btn => {
        btn.classList.add('btn-blob'); // For CSS transition

        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0px, 0px)';
        });
    });

    // --- DECODER & SCROLL ---
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const heroTitle = document.querySelector('.hero h1');
    if (heroTitle) {
        const gradientSpan = heroTitle.querySelector('.gradient-text');
        if (gradientSpan) {
            const originalText = gradientSpan.innerText;
            gradientSpan.dataset.value = originalText;

            let iteration = 0;
            let interval = setInterval(() => {
                gradientSpan.innerText = originalText
                    .split("")
                    .map((letter, index) => {
                        if (index < iteration) {
                            return originalText[index];
                        }
                        return letters[Math.floor(Math.random() * 36)];
                    })
                    .join("");

                if (iteration >= originalText.length) {
                    clearInterval(interval);
                }

                iteration += 1 / 2;
            }, 30);
        }
    }

    // Parallax Effect
    window.addEventListener('scroll', () => {
        const scrollY = window.pageYOffset;
        document.querySelectorAll('.parallax-layer').forEach(layer => {
            const speed = layer.getAttribute('data-speed') || 0.5;
            const yPos = -(scrollY * speed);
            layer.style.transform = `translateY(${yPos}px)`;
        });
    });

    // Scroll Reveal
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal-up').forEach(el => {
        observer.observe(el);
    });

    // --- TILT EFFECT REMOVED FOR CLEANER CORPORATE UI ---
    // CSS hover states in styles.css handle this now.

    // --- CONTACT FORM AJAX ---
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = contactForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = 'Procesando...';
            btn.disabled = true;

            const formData = {
                name: contactForm.querySelector('input[type="text"]').value,
                email: contactForm.querySelector('input[type="email"]').value,
                interest: contactForm.querySelector('select').value,
            };

            const isServicePage = window.location.pathname.includes('/services/');
            const apiPath = isServicePage ? '../api/nominate.php' : 'api/nominate.php';
            const csrfPath = isServicePage ? '../api/csrf.php' : 'api/csrf.php';

            try {
                const csrfRes = await fetch(csrfPath);
                const csrfData = await csrfRes.json();

                const response = await fetch(apiPath, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfData.csrf_token
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();

                if (result.status === 'success') {
                    btn.innerText = '¡Enviado!';
                    btn.style.background = '#00ff00';
                    contactForm.reset();
                    setTimeout(() => {
                        btn.innerText = originalText;
                        btn.style.background = '';
                        btn.disabled = false;
                    }, 3000);
                } else {
                    alert('Error: ' + result.message);
                    btn.innerText = originalText;
                    btn.disabled = false;
                }
            } catch (error) {
                console.error(error);
                // Fallback for static demo if API is missing
                btn.innerText = '¡Enviado (Demo)!';
                btn.style.background = '#00ff88';
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 3000);
            }
        });
    }


});
