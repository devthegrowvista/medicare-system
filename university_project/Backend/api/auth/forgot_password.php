<?php
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/mail.php';

$database = new Database();
$db = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ["success" => false, "message" => "Method Not Allowed. Use POST."]);
}

$input = get_json_input();
$email = strtolower(trim($input['email'] ?? ''));

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(400, ["success" => false, "message" => "Please enter a valid email address."]);
}

// Hamesha same response: account enumeration se bachao
$generic = [
    "success" => true,
    "message" => "If an account exists for this email, a password reset link has been sent. The link expires in 30 minutes."
];

try {
    $stmt = $db->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
    $stmt->execute([':email' => $email]);
    if (!$stmt->fetch()) {
        json_response(200, $generic);
    }

    // Rate limit: ek email par 60 sec mein 1, aur ghantay mein max 3 requests
    $db->exec("CREATE TABLE IF NOT EXISTS password_reset_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        ip VARCHAR(45) NOT NULL,
        created_at DATETIME NOT NULL,
        INDEX (email), INDEX (ip)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $c = $db->prepare("SELECT
            SUM(created_at > :t1) AS last_minute,
            COUNT(*) AS last_hour
        FROM password_reset_log
        WHERE (email = :e OR ip = :ip) AND created_at > :t2");
    $c->execute([
        ':t1' => date('Y-m-d H:i:s', time() - 60),
        ':t2' => date('Y-m-d H:i:s', time() - 3600),
        ':e' => $email, ':ip' => $ip
    ]);
    $r = $c->fetch();
    if ((int)$r['last_minute'] >= 1 || (int)$r['last_hour'] >= 5) {
        json_response(429, ["success" => false, "message" => "Too many requests. Please wait a minute and try again."]);
    }

    $db->prepare("INSERT INTO password_reset_log (email, ip, created_at) VALUES (:e, :ip, :t)")
       ->execute([':e' => $email, ':ip' => $ip, ':t' => date('Y-m-d H:i:s')]);

    $link = issue_reset_link($db, $email);

    send_mail($email, 'Reset your Medicare password',
        "<div style='font-family:Arial,sans-serif;max-width:480px'>
           <h2>Reset your password</h2>
           <p>We received a request to reset your Medicare account password.</p>
           <p><a href=\"$link\" style='display:inline-block;background:#2563eb;color:#fff;
              padding:10px 18px;border-radius:8px;text-decoration:none'>Reset Password</a></p>
           <p style='color:#64748b;font-size:12px'>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>
         </div>");

    json_response(200, $generic);

} catch (PDOException $e) {
    error_log("Forgot password error: " . $e->getMessage());
    json_response(500, ["success" => false, "message" => "Server error while processing password reset."]);
}