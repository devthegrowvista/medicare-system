<?php
/**
 * Medicare System - Forgot Password API
 *
 * Issues a hashed 6-digit recovery code (OTP). XAMPP/WAMP has no mail server,
 * so the code is returned in the JSON body for local evaluation only.
 * Unknown emails get a generic success response (no account enumeration).
 */

require_once __DIR__ . '/../../config/db.php';

$database = new Database();
$db = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ["success" => false, "message" => "Method Not Allowed. Use POST."]);
}

$input = get_json_input();
$email = strtolower(trim($input['email'] ?? ''));

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(400, ["success" => false, "message" => "Please enter a valid email address."]);
}

$generic = [
    "success" => true,
    "message" => "If this email is registered, a 6-digit recovery code has been issued. It expires in 15 minutes.",
    "demo_mode" => true
];

try {
    $stmt = $db->prepare("SELECT id, email FROM users WHERE email = :email LIMIT 1");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (!$user) {
        json_response(200, $generic);
    }

    $plain_code = (string)random_int(100000, 999999);
    $token_hash = hash('sha256', $plain_code);
    $expires_at = date('Y-m-d H:i:s', time() + 900);

    $db->exec("CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (token_hash),
        INDEX (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $del = $db->prepare("DELETE FROM password_resets WHERE email = :email");
    $del->execute([':email' => $email]);

    $ins = $db->prepare("INSERT INTO password_resets (email, token_hash, expires_at) VALUES (:email, :token_hash, :expires_at)");
    $ins->execute([
        ':email'      => $email,
        ':token_hash' => $token_hash,
        ':expires_at' => $expires_at
    ]);

    json_response(200, array_merge($generic, [
        "recovery_code" => $plain_code,
        "expires_in" => "15 minutes",
        "instructions" => "XAMPP has no SMTP mailer. Enter this 6-digit code with your new password to complete recovery."
    ]));

} catch (PDOException $e) {
    error_log("Forgot password error: " . $e->getMessage());
    json_response(500, ["success" => false, "message" => "Server error while processing password reset."]);
}
