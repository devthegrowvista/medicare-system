<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../lib/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../lib/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../lib/PHPMailer/src/SMTP.php';

define('APP_DEBUG',    true);                      // production mein false
define('APP_URL',      'http://localhost:5173');   // aapke React app ka URL
define('MAIL_ENABLED', true);                      // false = link sirf logs/mail.log mein
define('SMTP_HOST',    'smtp.gmail.com');
define('SMTP_PORT',    587);
define('SMTP_USER',    'yourgmail@gmail.com');
define('SMTP_PASS',    'xxxx xxxx xxxx xxxx');     // Gmail App Password
define('MAIL_FROM',    'yourgmail@gmail.com');
define('MAIL_FROM_NAME', 'Medicare Hospital');

function send_mail(string $to, string $subject, string $html): bool {
    if (!MAIL_ENABLED) {
        @mkdir(__DIR__ . '/../logs', 0777, true);
        file_put_contents(__DIR__ . '/../logs/mail.log',
            "[" . date('c') . "] TO: $to | $subject\n" . strip_tags($html, '<a>') . "\n\n", FILE_APPEND);
        return true;
    }
    try {
        $m = new PHPMailer(true);
        $m->isSMTP();
        $m->Host = SMTP_HOST;
        $m->SMTPAuth = true;
        $m->Username = SMTP_USER;
        $m->Password = SMTP_PASS;
        $m->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $m->Port = SMTP_PORT;
        $m->CharSet = 'UTF-8';
        $m->setFrom(MAIL_FROM, MAIL_FROM_NAME);
        $m->addAddress($to);
        $m->isHTML(true);
        $m->Subject = $subject;
        $m->Body = $html;
        $m->AltBody = strip_tags($html);
        $m->send();
        return true;
    } catch (Exception $e) {
        error_log('Mail error: ' . $e->getMessage());
        return false;
    }
}

/** Token banata hai, hash DB mein save karta hai, plain link return karta hai */
function issue_reset_link(PDO $db, string $email): string {
    $db->exec("CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (token_hash), INDEX (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->prepare("DELETE FROM password_resets WHERE email = :e")->execute([':e' => $email]);

    $token = bin2hex(random_bytes(32));
    $db->prepare("INSERT INTO password_resets (email, token_hash, expires_at) VALUES (:e, :h, :x)")
       ->execute([':e' => $email, ':h' => hash('sha256', $token), ':x' => date('Y-m-d H:i:s', time() + 1800)]);

    return APP_URL . '/?reset_token=' . $token;
}