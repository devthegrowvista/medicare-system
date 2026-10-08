<?php
/**
 * Medicare System - Patient Registration API
 */

require_once __DIR__ . '/../../config/db.php';

$database = new Database();
$db = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ["success" => false, "message" => "Method Not Allowed. Use POST."]);
}

$input = get_json_input();
$name        = trim($input['name'] ?? '');
$email       = trim($input['email'] ?? '');
$password    = trim($input['password'] ?? '');
$phone       = trim($input['phone'] ?? '');
$gender      = trim($input['gender'] ?? 'Male');
$dob         = trim($input['dob'] ?? '1990-01-01');
$blood_group = trim($input['bloodGroup'] ?? $input['blood_group'] ?? 'O+');
$address     = trim($input['address'] ?? '');

// Validation
if (empty($name) || empty($email) || empty($password) || empty($phone)) {
    json_response(400, ["success" => false, "message" => "Name, email, password, and phone number are required."]);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(400, ["success" => false, "message" => "Please provide a valid email address."]);
}

if (strlen($password) < 6) {
    json_response(400, ["success" => false, "message" => "Password must be at least 6 characters long."]);
}

try {
    $db->beginTransaction();

    // Check if email already exists
    $chk = $db->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
    $chk->execute([':email' => $email]);
    if ($chk->fetch()) {
        $db->rollBack();
        json_response(409, ["success" => false, "message" => "An account with this email already exists."]);
    }

    // 1. Create users table record
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $u_stmt = $db->prepare("INSERT INTO users (email, password_hash, role) VALUES (:email, :hash, 'Patient')");
    $u_stmt->execute([':email' => $email, ':hash' => $hash]);
    $user_id = $db->lastInsertId();

    // 2. Generate unique patient ID
    $pat_id = generate_unique_id($db, 'patients', 'PAT', 1000, 9999);

    // 3. Create patient record
    $p_stmt = $db->prepare("INSERT INTO patients (id, user_id, name, phone, gender, dob, blood_group, address, status)
                            VALUES (:id, :user_id, :name, :phone, :gender, :dob, :blood_group, :address, 'Active')");
    $p_stmt->execute([
        ':id'          => $pat_id,
        ':user_id'     => $user_id,
        ':name'        => $name,
        ':phone'       => $phone,
        ':gender'      => $gender,
        ':dob'         => $dob,
        ':blood_group' => $blood_group,
        ':address'     => $address
    ]);

    $db->commit();

    // Automatically set active session
    session_regenerate_id(true);
    $_SESSION['user_id']       = $user_id;
    $_SESSION['email']         = $email;
    $_SESSION['role']          = 'Patient';
    $_SESSION['name']          = $name;
    $_SESSION['profile_id']    = $pat_id;
    $_SESSION['last_activity'] = time();

    json_response(201, [
        "success" => true,
        "message" => "Patient registered successfully.",
        "user" => [
            "id"    => $pat_id,
            "name"  => $name,
            "role"  => "Patient",
            "email" => $email
        ]
    ]);

} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    error_log("Registration error: " . $e->getMessage());
    json_response(500, ["success" => false, "message" => "Registration failed due to a server error."]);
}
