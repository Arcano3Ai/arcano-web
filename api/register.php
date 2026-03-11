<?php
require_once 'config.php';
session_start(); // Important for CSRF

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // CSRF Check
    $headers = apache_request_headers();
    $csrfToken = $headers['X-CSRF-Token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($csrfToken) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrfToken)) {
        echo json_encode(["status" => "error", "message" => "Token CSRF inválido."]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    $fullName = htmlspecialchars(trim($input['full_name'] ?? ''), ENT_QUOTES, 'UTF-8');
    $company = htmlspecialchars(trim($input['company'] ?? ''), ENT_QUOTES, 'UTF-8');
    $email = filter_var($input['email'] ?? '', FILTER_SANITIZE_EMAIL);
    $email = filter_var($email, FILTER_VALIDATE_EMAIL);
    $password = $input['password'] ?? '';

    if (empty($fullName) || empty($company) || !$email || strlen($password) < 8) {
        echo json_encode(["status" => "error", "message" => "Datos inválidos o contraseña menor a 8 caracteres."]);
        exit;
    }

    // Hash password
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    try {
        $stmt = $pdo->prepare("INSERT INTO users (full_name, company, email, password_hash) VALUES (?, ?, ?, ?)");
        $stmt->execute([$fullName, $company, $email, $passwordHash]);

        echo json_encode(["status" => "success", "message" => "Cuenta creada exitosamente."]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) { // Duplicate entry
            echo json_encode(["status" => "error", "message" => "El correo ya está registrado."]);
        } else {
            echo json_encode(["status" => "error", "message" => "Error en el servidor."]);
        }
    }
} else {
    echo json_encode(["status" => "error", "message" => "Método no permitido."]);
}
?>