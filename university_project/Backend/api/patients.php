<?php
/**
 * Medicare System - Patients RESTful API
 *
 * Handles Patient CRUD, profile management, and role-based data isolation.
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/auth.php';

$database = new Database();
$db = $database->getConnection();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet($db);
        break;
    case 'POST':
        handlePost($db);
        break;
    case 'PUT':
        handlePut($db);
        break;
    case 'DELETE':
        handleDelete($db);
        break;
    default:
        json_response(405, ["success" => false, "message" => "Method Not Allowed"]);
        break;
}

function handleGet($db) {
    $user = require_login();

    try {
        if ($user['role'] === 'Patient') {
            // Patient can only fetch their own record
            $pat_id = get_current_patient_id($db);
            $stmt = $db->prepare("SELECT p.*, u.email FROM patients p INNER JOIN users u ON p.user_id = u.id WHERE p.id = :id LIMIT 1");
            $stmt->execute([':id' => $pat_id]);
            $pat = $stmt->fetch();
            if (!$pat) {
                json_response(404, ["success" => false, "message" => "Patient record not found."]);
            }
            json_response(200, !empty($_GET['id']) ? $pat : [$pat]);
        } elseif (!empty($_GET['id'])) {
            // Admin or Doctor querying specific patient
            $stmt = $db->prepare("SELECT p.*, u.email FROM patients p INNER JOIN users u ON p.user_id = u.id WHERE p.id = :id LIMIT 1");
            $stmt->execute([':id' => $_GET['id']]);
            $pat = $stmt->fetch();
            if (!$pat) {
                json_response(404, ["success" => false, "message" => "Patient not found."]);
            }
            json_response(200, $pat);
        } else {
            // Admin or Doctor querying all patients
            $stmt = $db->query("SELECT p.*, u.email FROM patients p INNER JOIN users u ON p.user_id = u.id ORDER BY p.name ASC");
            $patients = $stmt->fetchAll();
            json_response(200, $patients);
        }
    } catch (PDOException $e) {
        error_log("Patients GET error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to load patient records."]);
    }
}

function handlePost($db) {
    // Only Admin can add patients through this API (regular patients use auth/register.php)
    require_role(['Admin']);

    $input = get_json_input();
    $name        = trim($input['name'] ?? '');
    $email       = trim($input['email'] ?? '');
    $phone       = trim($input['phone'] ?? '');
    $gender      = trim($input['gender'] ?? 'Male');
    $dob         = trim($input['dob'] ?? '1990-01-01');
    $bloodGroup  = trim($input['bloodGroup'] ?? $input['blood_group'] ?? 'O+');
    $address     = trim($input['address'] ?? '');

    if (empty($name) || empty($email) || empty($phone)) {
        json_response(400, ["success" => false, "message" => "Name, email, and phone are required."]);
    }

    try {
        $db->beginTransaction();

        $chk = $db->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
        $chk->execute([':email' => $email]);
        if ($chk->fetch()) {
            $db->rollBack();
            json_response(409, ["success" => false, "message" => "Email address already in use."]);
        }

        $pw_hash = password_hash("patient123", PASSWORD_BCRYPT);
        $u_stmt = $db->prepare("INSERT INTO users (email, password_hash, role) VALUES (:email, :hash, 'Patient')");
        $u_stmt->execute([':email' => $email, ':hash' => $pw_hash]);
        $user_id = $db->lastInsertId();

        $pat_id = generate_unique_id($db, 'patients', 'PAT', 1000, 9999);

        $p_stmt = $db->prepare("INSERT INTO patients (id, user_id, name, phone, gender, dob, blood_group, address, status)
                                VALUES (:id, :uid, :name, :phone, :gender, :dob, :bg, :addr, 'Active')");
        $p_stmt->execute([
            ':id'     => $pat_id,
            ':uid'    => $user_id,
            ':name'   => $name,
            ':phone'  => $phone,
            ':gender' => $gender,
            ':dob'    => $dob,
            ':bg'     => $bloodGroup,
            ':addr'   => $address
        ]);

        $db->commit();

        json_response(201, [
            "success" => true,
            "message" => "Patient registered successfully.",
            "id" => $pat_id,
            "patient" => [
                "id"         => $pat_id,
                "name"       => $name,
                "email"      => $email,
                "phone"      => $phone,
                "gender"     => $gender,
                "dob"        => $dob,
                "bloodGroup" => $bloodGroup,
                "address"    => $address,
                "status"     => "Active"
            ]
        ]);

    } catch (PDOException $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log("Create patient error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Database error while adding patient."]);
    }
}

function handlePut($db) {
    $user = require_login();
    $input = get_json_input();
    $id = trim($input['id'] ?? '');

    if (empty($id)) {
        json_response(400, ["success" => false, "message" => "Patient ID is required."]);
    }

    // Role check: Patient can only update their own profile; Admin can update any
    if ($user['role'] === 'Patient') {
        $my_id = get_current_patient_id($db);
        if ($my_id !== $id) {
            json_response(403, ["success" => false, "message" => "Forbidden: You may only update your own profile."]);
        }
    } elseif ($user['role'] !== 'Admin') {
        json_response(403, ["success" => false, "message" => "Forbidden: Insufficient permissions."]);
    }

    try {
        $stmt = $db->prepare("SELECT * FROM patients WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            json_response(404, ["success" => false, "message" => "Patient not found."]);
        }

        $name       = $input['name'] ?? $existing['name'];
        $phone      = $input['phone'] ?? $existing['phone'];
        $gender     = $input['gender'] ?? $existing['gender'];
        $dob        = $input['dob'] ?? $existing['dob'];
        $bloodGroup = $input['bloodGroup'] ?? $input['blood_group'] ?? $existing['blood_group'];
        $address    = $input['address'] ?? $existing['address'];
        $status     = ($user['role'] === 'Admin' && isset($input['status'])) ? $input['status'] : $existing['status'];

        $upd = $db->prepare("UPDATE patients SET 
            name = :name,
            phone = :phone,
            gender = :gender,
            dob = :dob,
            blood_group = :bg,
            address = :addr,
            status = :status
            WHERE id = :id");

        $upd->execute([
            ':id'     => $id,
            ':name'   => $name,
            ':phone'  => $phone,
            ':gender' => $gender,
            ':dob'    => $dob,
            ':bg'     => $bloodGroup,
            ':addr'   => $address,
            ':status' => $status
        ]);

        json_response(200, [
            "success" => true,
            "message" => "Patient profile updated successfully."
        ]);

    } catch (PDOException $e) {
        error_log("Update patient error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to update patient profile."]);
    }
}

function handleDelete($db) {
    require_role(['Admin']);
    $input = get_json_input();
    $id = trim($input['id'] ?? $_GET['id'] ?? '');

    if (empty($id)) {
        json_response(400, ["success" => false, "message" => "Patient ID is required."]);
    }

    try {
        $stmt = $db->prepare("UPDATE patients SET status = 'Suspended' WHERE id = :id");
        $stmt->execute([':id' => $id]);

        json_response(200, [
            "success" => true,
            "message" => "Patient status set to Suspended."
        ]);
    } catch (PDOException $e) {
        error_log("Delete patient error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to suspend patient."]);
    }
}
