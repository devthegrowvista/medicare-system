<?php
/**
 * Medicare System - Session Profile / Current User API
 */

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/auth.php';

if (!is_logged_in()) {
    json_response(401, [
        "success" => false,
        "message" => "No active session."
    ]);
}

$user = [
    "id"    => $_SESSION['profile_id'] ?? '',
    "name"  => $_SESSION['name'] ?? '',
    "role"  => $_SESSION['role'],
    "email" => $_SESSION['email'] ?? ''
];

json_response(200, [
    "success" => true,
    "user" => $user
]);
