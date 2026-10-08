<?php
/**
 * Medicare System - Session Login API
 */

require_once __DIR__ . '/../../config/db.php';

$database = new Database();
$db = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ["success" => false, "message" => "Method Not Allowed. Use POST."]);
}

$input = get_json_input();
$email = trim($input['email'] ?? '');
$password = trim($input['password'] ?? '');
$role = trim($input['role'] ?? '');

if (empty($email) || empty($password) || empty($role)) {
    json_response(400, ["success" => false, "message" => "Email, password, and role are required."]);
}

if (!in_array($role, ['Admin', 'Doctor', 'Patient'])) {
    json_response(400, ["success" => false, "message" => "Invalid user role specified."]);
}

try {
    // Query users table
    $stmt = $db->prepare("SELECT id, email, password_hash, role FROM users WHERE email = :email AND role = :role LIMIT 1");
    $stmt->execute([':email' => $email, ':role' => $role]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        json_response(401, ["success" => false, "message" => "Invalid email or password for selected role."]);
    }

    // Determine user profile ID and display name
    $profile_id = null;
    $name = '';

    if ($role === 'Admin') {
        $adm_stmt = $db->prepare("SELECT id, name FROM admins WHERE user_id = :uid LIMIT 1");
        $adm_stmt->execute([':uid' => $user['id']]);
        $adm = $adm_stmt->fetch();
        $profile_id = $adm['id'] ?? 'ADM-001';
        $name = $adm['name'] ?? 'Admin Director';
    } elseif ($role === 'Doctor') {
        $doc_stmt = $db->prepare("SELECT id, name, status FROM doctors WHERE user_id = :uid LIMIT 1");
        $doc_stmt->execute([':uid' => $user['id']]);
        $doc = $doc_stmt->fetch();
        if (!$doc) {
            json_response(404, ["success" => false, "message" => "Doctor profile not found for this account."]);
        }
        if ($doc['status'] === 'Inactive') {
            json_response(403, ["success" => false, "message" => "Your doctor account is currently inactive. Please contact the administrator."]);
        }
        $profile_id = $doc['id'];
        $name = $doc['name'];
    } elseif ($role === 'Patient') {
        $pat_stmt = $db->prepare("SELECT id, name, status FROM patients WHERE user_id = :uid LIMIT 1");
        $pat_stmt->execute([':uid' => $user['id']]);
        $pat = $pat_stmt->fetch();
        if (!$pat) {
            json_response(404, ["success" => false, "message" => "Patient profile not found for this account."]);
        }
        if ($pat['status'] === 'Suspended') {
            json_response(403, ["success" => false, "message" => "Your patient account is suspended. Please contact clinic administration."]);
        }
        $profile_id = $pat['id'];
        $name = $pat['name'];
    }

    // Regenerate session ID to prevent session fixation attacks
    session_regenerate_id(true);

    $_SESSION['user_id']       = $user['id'];
    $_SESSION['email']         = $user['email'];
    $_SESSION['role']          = $user['role'];
    $_SESSION['name']          = $name;
    $_SESSION['profile_id']    = $profile_id;
    $_SESSION['last_activity'] = time();

    json_response(200, [
        "success" => true,
        "message" => "Logged in successfully as " . $role,
        "user" => [
            "id"    => $profile_id,
            "name"  => $name,
            "role"  => $role,
            "email" => $user['email']
        ]
    ]);

} catch (PDOException $e) {
    error_log("Login error: " . $e->getMessage());
    json_response(500, ["success" => false, "message" => "Login failed due to a server error."]);
}
