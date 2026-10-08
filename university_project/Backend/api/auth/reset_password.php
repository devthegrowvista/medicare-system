<?php
/**
 * Medicare System - Reset Password API
 *
 * Verifies reset token hash against password_resets and updates users.password_hash.
 */

require_once __DIR__ . '/../../config/db.php';

$database = new Database();
$db = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ["success" => false, "message" => "Method Not Allowed. Use POST."]);
}

$input = get_json_input();
$token        = trim($input['token'] ?? '');
$new_password = trim($input['new_password'] ?? $input['password'] ?? '');

if (empty($token) || empty($new_password)) {
    json_response(400, ["success" => false, "message" => "Recovery code and new password are required."]);
}

if (strlen($new_password) < 6) {
    json_response(400, ["success" => false, "message" => "New password must be at least 6 characters long."]);
}

try {
    $token_hash = hash('sha256', $token);

    $stmt = $db->prepare("SELECT email, expires_at FROM password_resets WHERE token_hash = :hash LIMIT 1");
    $stmt->execute([':hash' => $token_hash]);
    $reset = $stmt->fetch();

    if (!$reset) {
        json_response(400, ["success" => false, "message" => "Invalid or expired recovery code."]);
    }

    if (strtotime($reset['expires_at']) < time()) {
        json_response(400, ["success" => false, "message" => "Recovery code has expired. Please request a new one."]);
    }

    // Hash the new password with BCRYPT
    $new_hash = password_hash($new_password, PASSWORD_BCRYPT);

    $db->beginTransaction();

    // Update user password
    $u_stmt = $db->prepare("UPDATE users SET password_hash = :hash WHERE email = :email");
    $u_stmt->execute([':hash' => $new_hash, ':email' => $reset['email']]);

    // Clear reset tokens for this email
    $del = $db->prepare("DELETE FROM password_resets WHERE email = :email");
    $del->execute([':email' => $reset['email']]);

    $db->commit();

    json_response(200, [
        "success" => true,
        "message" => "Password updated successfully. You can now login with your new password."
    ]);

} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    error_log("Reset password error: " . $e->getMessage());
    json_response(500, ["success" => false, "message" => "Server error while resetting password."]);
}
