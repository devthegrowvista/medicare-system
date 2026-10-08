<?php
require_once __DIR__ . '/../../config/db.php';

$database = new Database();
$db = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ["success" => false, "message" => "Method Not Allowed. Use POST."]);
}

$input    = get_json_input();
$token    = trim($input['token'] ?? '');
$password = (string)($input['new_password'] ?? '');

if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
    json_response(400, ["success" => false, "message" => "This reset link is invalid or has expired."]);
}
if (strlen($password) < 8) {
    json_response(400, ["success" => false, "message" => "Password must be at least 8 characters."]);
}

try {
    $stmt = $db->prepare("SELECT email, expires_at FROM password_resets WHERE token_hash = :h LIMIT 1");
    $stmt->execute([':h' => hash('sha256', $token)]);
    $row = $stmt->fetch();

    if (!$row || strtotime($row['expires_at']) < time()) {
        json_response(400, ["success" => false, "message" => "This reset link is invalid or has expired. Please request a new one."]);
    }

    $db->beginTransaction();
    $db->prepare("UPDATE users SET password_hash = :p WHERE email = :e")
       ->execute([':p' => password_hash($password, PASSWORD_BCRYPT), ':e' => $row['email']]);
    $db->prepare("DELETE FROM password_resets WHERE email = :e")->execute([':e' => $row['email']]);
    $db->commit();

    json_response(200, ["success" => true, "message" => "Password updated successfully. You can now sign in."]);

} catch (PDOException $e) {
    if ($db->inTransaction()) $db->rollBack();
    error_log("Reset password error: " . $e->getMessage());
    json_response(500, ["success" => false, "message" => "Server error while resetting password."]);
}