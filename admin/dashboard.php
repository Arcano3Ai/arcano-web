<?php
// PANEL DE ADMINISTRACIÓN SIMPLE PARA VER LEADS
session_start();

// Configuración de Acceso (Usuario único)
$ADMIN_USER = "admin";
$ADMIN_PASS = "arcano2026"; // ¡CÁMBIALO!

if (isset($_GET['logout'])) {
    session_destroy();
    header("Location: dashboard.php");
    exit;
}

if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['password'])) {
    if ($_POST['username'] === $ADMIN_USER && $_POST['password'] === $ADMIN_PASS) {
        $_SESSION['logged_in'] = true;
    } else {
        $error = "Credenciales incorrectas.";
    }
}

if (!isset($_SESSION['logged_in'])) {
    ?>
    <!DOCTYPE html>
    <html lang="es">

    <head>
        <meta charset="UTF-8">
        <title>Arcano Admin Login</title>
        <style>
            body {
                background: #0a0a0c;
                color: #fff;
                font-family: sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }

            .login-box {
                background: #141419;
                padding: 2rem;
                border-radius: 10px;
                border: 1px solid #00f3ff;
                width: 300px;
                text-align: center;
            }

            input {
                width: 100%;
                padding: 10px;
                margin: 10px 0;
                background: #000;
                border: 1px solid #333;
                color: #fff;
                box-sizing: border-box;
            }

            button {
                background: #00f3ff;
                color: #000;
                padding: 10px;
                width: 100%;
                border: none;
                font-weight: bold;
                cursor: pointer;
            }

            h2 {
                margin-top: 0;
                color: #00f3ff;
            }
        </style>
    </head>

    <body>
        <div class="login-box">
            <h2>ARCANO ADMIN</h2>
            <?php if (isset($error))
                echo "<p style='color:red'>$error</p>"; ?>
            <form method="POST">
                <input type="text" name="username" placeholder="Usuario" required>
                <input type="password" name="password" placeholder="Contraseña" required>
                <button type="submit">ENTRAR</button>
            </form>
        </div>
    </body>

    </html>
    <?php
    exit;
}

// SI ESTÁ LOGUEADO, MOSTRAR DASHBOARD
require_once '../api/config.php';

// Obtener leads
$stmt = $pdo->query("SELECT * FROM leads ORDER BY created_at DESC");
$leads = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <title>Arcano Leads Dashboard</title>
    <style>
        body {
            background: #0a0a0c;
            color: #e0e0e0;
            font-family: 'Segoe UI', sans-serif;
            padding: 20px;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #333;
            padding-bottom: 20px;
            margin-bottom: 20px;
        }

        h1 {
            margin: 0;
            color: #00f3ff;
        }

        .btn-logout {
            background: transparent;
            border: 1px solid #ff0055;
            color: #ff0055;
            padding: 5px 15px;
            text-decoration: none;
            border-radius: 4px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            background: #141419;
        }

        th,
        td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #222;
        }

        th {
            background: #1f1f25;
            color: #00f3ff;
        }

        tr:hover {
            background: #1a1a20;
        }

        .tag {
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.8rem;
            background: #333;
        }

        .tag.ai {
            background: rgba(0, 243, 255, 0.2);
            color: #00f3ff;
        }

        .tag.erp {
            background: rgba(189, 0, 255, 0.2);
            color: #bd00ff;
        }
    </style>
</head>

<body>
    <div class="container">
        <header>
            <h1>Leads Recibidos</h1>
            <a href="?logout" class="btn-logout">Cerrar Sesión</a>
        </header>

        <table>
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Interés</th>
                    <th>Mensaje</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($leads as $lead): ?>
                    <tr>
                        <td>
                            <?= htmlspecialchars($lead['created_at']) ?>
                        </td>
                        <td>
                            <?= htmlspecialchars($lead['name']) ?>
                        </td>
                        <td>
                            <?= htmlspecialchars($lead['email']) ?>
                        </td>
                        <td>
                            <span class="tag">
                                <?= htmlspecialchars($lead['interest']) ?>
                            </span>
                        </td>
                        <td>
                            <?= htmlspecialchars($lead['message']) ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</body>

</html>