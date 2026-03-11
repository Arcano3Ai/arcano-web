<?php
// Configuración de la Base de Datos
$envPath = __DIR__ . '/../.env';
if (!file_exists($envPath)) {
    die(json_encode(["status" => "error", "message" => "Falta el archivo de configuración (.env)."]));
}

$env = parse_ini_file($envPath);
$host = $env['DB_HOST'] ?? '';
$dbname = $env['DB_NAME'] ?? '';
$username = $env['DB_USER'] ?? '';
$password = $env['DB_PASS'] ?? '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    // En producción, no mostrar el error real al usuario
    die(json_encode(["status" => "error", "message" => "Error de conexión a BD."]));
}
?>