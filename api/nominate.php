<?php
require_once 'config.php';
session_start();

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // CSRF Check
    $headers = apache_request_headers();
    $csrfToken = $headers['X-CSRF-Token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '';
    if (empty($csrfToken) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrfToken)) {
        echo json_encode(["status" => "error", "message" => "Token CSRF inválido."]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    $name = htmlspecialchars(trim($input['name'] ?? $_POST['name'] ?? ''), ENT_QUOTES, 'UTF-8');
    $email = filter_var($input['email'] ?? $_POST['email'] ?? '', FILTER_SANITIZE_EMAIL);
    $email = filter_var($email, FILTER_VALIDATE_EMAIL);
    $interest = htmlspecialchars(trim($input['interest'] ?? $_POST['interest'] ?? 'General'), ENT_QUOTES, 'UTF-8');
    $message = htmlspecialchars(trim($input['message'] ?? $_POST['message'] ?? ''), ENT_QUOTES, 'UTF-8');

    // Validación básica
    if (empty($name) || empty($email)) {
        echo json_encode(["status" => "error", "message" => "Nombre y Correo requeridos."]);
        exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO leads (name, email, interest, message, created_at) VALUES (?, ?, ?, ?, NOW())");
        $stmt->execute([$name, $email, $interest, $message]);

        echo json_encode(["status" => "success", "message" => "Solicitud recibida. Te contactaremos pronto."]);
    } catch (Exception $e) {
        echo json_encode(["status" => "error", "message" => "Error al guardar."]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Método no permitido."]);
}
?>