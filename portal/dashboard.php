<?php
session_start();
if (!isset($_SESSION['user_id'])) {
    header("Location: ../login.html");
    exit;
}
$name = $_SESSION['name'] ?? 'Usuario';
$role = $_SESSION['role'] ?? 'Cliente VIP';
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Cliente | Arcano Solutions</title>
    <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Space+Grotesk:wght@300;400;500;700&display=swap"
        rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="portal.css">
</head>

<body>

    <!-- Sidebar -->
    <aside class="sidebar">
        <a href="../index.html" class="logo">ARCANO<span class="dot">.</span></a>

        <nav class="nav-links">
            <a href="#" class="nav-item active"><i class="fas fa-chart-line"></i> Dashboard</a>
            <a href="#" class="nav-item"><i class="fas fa-boxes"></i> Proyectos</a>
            <a href="#" class="nav-item"><i class="fas fa-file-invoice-dollar"></i> Facturación</a>
            <a href="#" class="nav-item"><i class="fas fa-ticket-alt"></i> Soporte</a>
            <a href="#" class="nav-item"><i class="fas fa-cog"></i> Configuración</a>
        </nav>

        <div class="user-profile">
            <div class="avatar"><i class="fas fa-user"></i></div>
            <div>
                <div style="font-weight: bold;">
                    <?php echo htmlspecialchars($name); ?>
                </div>
                <div style="font-size: 0.8rem; color: #888;">
                    <?php echo htmlspecialchars(ucfirst($role)); ?>
                </div>
            </div>
            <a href="../api/logout.php" style="margin-left: auto; color: #aaa;" title="Cerrar Sesión"><i
                    class="fas fa-sign-out-alt"></i></a>
        </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
        <header>
            <div>
                <h1>Vista General</h1>
                <p style="color: grey;">Bienvenido de nuevo,
                    <?php echo htmlspecialchars($name); ?>. Estado de operaciones:
                </p>
            </div>
            <button
                style="padding: 10px 20px; background: var(--primary); border:none; border-radius:5px; font-weight:bold; cursor:pointer;">
                <i class="fas fa-plus"></i> Nueva Solicitud
            </button>
        </header>

        <!-- KPI Grid -->
        <div class="grid">
            <div class="card">
                <h3>Vulnerabilidades Bloqueadas</h3>
                <div class="big-number">1,240</div>
                <div class="text-success"><i class="fas fa-arrow-up"></i> +12% este mes</div>
            </div>
            <div class="card">
                <h3>Ahorro por Automatización</h3>
                <div class="big-number">$4,500</div>
                <div class="text-success">USD / Mes Estimado</div>
            </div>
            <div class="card">
                <h3>Servidores Activos</h3>
                <div class="big-number">12</div>
                <div style="color: #00f3ff; font-size: 0.9rem;">100% Uptime</div>
            </div>
            <div class="card">
                <h3>Tickets Abiertos</h3>
                <div class="big-number">0</div>
                <div style="color: #888; font-size: 0.9rem;">Todo en orden</div>
            </div>
        </div>

        <!-- Active Projects -->
        <div class="card" style="width: 100%;">
            <h3 style="font-size: 1.1rem; margin-bottom: 1rem; color: #fff;">Proyectos en Curso</h3>
            <table class="project-table">
                <thead>
                    <tr>
                        <th>Proyecto</th>
                        <th>Estado</th>
                        <th>Fase Actual</th>
                        <th>Entrega Est.</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Implementación ERP (Odoo)</td>
                        <td><span class="status-badge">En Progreso</span></td>
                        <td>Migración de Datos</td>
                        <td>15 Feb 2026</td>
                    </tr>
                    <tr>
                        <td>Auditoría Ciberseguridad</td>
                        <td><span class="status-badge done">Completado</span></td>
                        <td>Entrega de Reporte</td>
                        <td>08 Ene 2026</td>
                    </tr>
                </tbody>
            </table>
        </div>

    </main>

</body>

</html>