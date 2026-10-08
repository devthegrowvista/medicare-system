<?php
/**
 * Medicare System - Session Logout API
 */

require_once __DIR__ . '/../../config/db.php';

if (session_status() === PHP_SESSION_ACTIVE) {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params["path"],
            $params["domain"],
            $params["secure"],
            $params["httponly"]
        );
    }
    session_destroy();
}

json_response(200, [
    "success" => true,
    "message" => "Logged out successfully."
]);
