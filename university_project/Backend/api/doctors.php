<?php
/**
 * Medicare System - Doctors RESTful API
 *
 * Handles Doctor CRUD operations, profile management, and scheduling.
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
    // Require active login
    require_login();

    try {
        if (!empty($_GET['id'])) {
            $stmt = $db->prepare("SELECT d.*, u.email, dept.name as department_name 
                                  FROM doctors d 
                                  INNER JOIN users u ON d.user_id = u.id 
                                  LEFT JOIN departments dept ON d.department_id = dept.id 
                                  WHERE d.id = :id LIMIT 1");
            $stmt->execute([':id' => $_GET['id']]);
            $doc = $stmt->fetch();

            if (!$doc) {
                json_response(404, ["success" => false, "message" => "Doctor not found."]);
            }

            $doc['availability'] = json_decode($doc['availability'], true) ?: [];
            $doc['timeSlots']    = json_decode($doc['time_slots'], true) ?: [];
            unset($doc['time_slots']);

            json_response(200, $doc);
        } else {
            $stmt = $db->query("SELECT d.*, u.email, dept.name as department 
                                FROM doctors d 
                                INNER JOIN users u ON d.user_id = u.id 
                                LEFT JOIN departments dept ON d.department_id = dept.id
                                ORDER BY d.name ASC");
            $doctors = [];
            while ($row = $stmt->fetch()) {
                $row['availability'] = json_decode($row['availability'], true) ?: [];
                $row['timeSlots']    = json_decode($row['time_slots'], true) ?: [];
                unset($row['time_slots']);
                $doctors[] = $row;
            }

            json_response(200, $doctors);
        }
    } catch (PDOException $e) {
        error_log("Doctors GET error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to load doctors list."]);
    }
}

function handlePost($db) {
    // Only Admin can add doctors
    require_role(['Admin']);

    $input = get_json_input();
    $name           = trim($input['name'] ?? '');
    $email          = trim($input['email'] ?? '');
    $phone          = trim($input['phone'] ?? '');
    $specialization = trim($input['specialization'] ?? '');
    $department     = trim($input['department'] ?? '');
    $roomNo         = trim($input['roomNo'] ?? $input['room_no'] ?? 'Room 101');
    $bio            = trim($input['bio'] ?? '');
    $availability   = $input['availability'] ?? ["Mon", "Wed", "Fri"];
    $timeSlots      = $input['timeSlots'] ?? ["09:00 AM", "11:00 AM", "02:00 PM"];

    if (empty($name) || empty($email) || empty($phone) || empty($specialization)) {
        json_response(400, ["success" => false, "message" => "Name, email, phone, and specialization are required."]);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(400, ["success" => false, "message" => "Valid email address is required."]);
    }

    try {
        $db->beginTransaction();

        // Check if email already registered
        $chk = $db->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
        $chk->execute([':email' => $email]);
        if ($chk->fetch()) {
            $db->rollBack();
            json_response(409, ["success" => false, "message" => "A user with this email already exists."]);
        }

        // 1. Create user account
        $temp_password = $input['password'] ?? 'doctor123';
        $pw_hash = password_hash($temp_password, PASSWORD_BCRYPT);
        $u_stmt = $db->prepare("INSERT INTO users (email, password_hash, role) VALUES (:email, :hash, 'Doctor')");
        $u_stmt->execute([':email' => $email, ':hash' => $pw_hash]);
        $user_id = $db->lastInsertId();

        // 2. Resolve department_id
        $dept_id = null;
        if (!empty($department)) {
            $d_stmt = $db->prepare("SELECT id FROM departments WHERE id = :d OR name = :d LIMIT 1");
            $d_stmt->execute([':d' => $department]);
            $d_row = $d_stmt->fetch();
            $dept_id = $d_row['id'] ?? null;
        }

        // 3. Generate unique DOC-xxx ID
        $doc_id = generate_unique_id($db, 'doctors', 'DOC', 100, 999);

        // 4. Insert doctor profile
        $doc_stmt = $db->prepare("INSERT INTO doctors 
            (id, user_id, name, phone, specialization, department_id, availability, time_slots, room_no, status, bio, rating)
            VALUES (:id, :uid, :name, :phone, :spec, :dept_id, :avail, :slots, :room, 'Active', :bio, 4.8)");

        $doc_stmt->execute([
            ':id'      => $doc_id,
            ':uid'     => $user_id,
            ':name'    => $name,
            ':phone'   => $phone,
            ':spec'    => $specialization,
            ':dept_id' => $dept_id,
            ':avail'   => json_encode(is_array($availability) ? $availability : ["Mon", "Wed", "Fri"]),
            ':slots'   => json_encode(is_array($timeSlots) ? $timeSlots : ["09:00 AM", "11:00 AM", "02:00 PM"]),
            ':room'    => $roomNo,
            ':bio'     => $bio
        ]);

        $db->commit();

        json_response(201, [
            "success" => true,
            "message" => "Doctor created successfully.",
            "id" => $doc_id,
            "doctor" => [
                "id"             => $doc_id,
                "name"           => $name,
                "email"          => $email,
                "phone"          => $phone,
                "specialization" => $specialization,
                "department"     => $department,
                "availability"   => $availability,
                "timeSlots"      => $timeSlots,
                "roomNo"         => $roomNo,
                "status"         => 'Active',
                "bio"            => $bio,
                "rating"         => 4.8
            ]
        ]);

    } catch (PDOException $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log("Create doctor error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Database error while creating doctor."]);
    }
}

function handlePut($db) {
    $user = require_login();
    $input = get_json_input();
    $id = trim($input['id'] ?? '');

    if (empty($id)) {
        json_response(400, ["success" => false, "message" => "Doctor ID is required."]);
    }

    // Role check: Only Admin or the Doctor themself
    if ($user['role'] !== 'Admin') {
        $my_doc_id = get_current_doctor_id($db);
        if ($my_doc_id !== $id) {
            json_response(403, ["success" => false, "message" => "Forbidden: You may only update your own doctor profile."]);
        }
    }

    try {
        $stmt = $db->prepare("SELECT * FROM doctors WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            json_response(404, ["success" => false, "message" => "Doctor not found."]);
        }

        $name           = $input['name'] ?? $existing['name'];
        $phone          = $input['phone'] ?? $existing['phone'];
        $specialization = $input['specialization'] ?? $existing['specialization'];
        $roomNo         = $input['roomNo'] ?? $input['room_no'] ?? $existing['room_no'];
        $status         = $input['status'] ?? $existing['status'];
        $bio            = $input['bio'] ?? $existing['bio'];
        $availability   = isset($input['availability']) ? json_encode($input['availability']) : $existing['availability'];
        $timeSlots      = isset($input['timeSlots']) ? json_encode($input['timeSlots']) : $existing['time_slots'];

        // Department handling
        $dept_id = $existing['department_id'];
        if (isset($input['department'])) {
            $d_stmt = $db->prepare("SELECT id FROM departments WHERE id = :d OR name = :d LIMIT 1");
            $d_stmt->execute([':d' => $input['department']]);
            $d_row = $d_stmt->fetch();
            if ($d_row) {
                $dept_id = $d_row['id'];
            }
        }

        $upd = $db->prepare("UPDATE doctors SET 
            name = :name,
            phone = :phone,
            specialization = :spec,
            department_id = :dept_id,
            availability = :avail,
            time_slots = :slots,
            room_no = :room,
            status = :status,
            bio = :bio
            WHERE id = :id");

        $upd->execute([
            ':id'      => $id,
            ':name'    => $name,
            ':phone'   => $phone,
            ':spec'    => $specialization,
            ':dept_id' => $dept_id,
            ':avail'   => $availability,
            ':slots'   => $timeSlots,
            ':room'    => $roomNo,
            ':status'  => $status,
            ':bio'     => $bio
        ]);

        json_response(200, [
            "success" => true,
            "message" => "Doctor updated successfully."
        ]);

    } catch (PDOException $e) {
        error_log("Update doctor error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to update doctor profile."]);
    }
}

function handleDelete($db) {
    require_role(['Admin']);
    $input = get_json_input();
    $id = trim($input['id'] ?? $_GET['id'] ?? '');

    if (empty($id)) {
        json_response(400, ["success" => false, "message" => "Doctor ID is required."]);
    }

    try {
        // Set doctor status to Inactive to preserve appointment and medical records history
        $stmt = $db->prepare("UPDATE doctors SET status = 'Inactive' WHERE id = :id");
        $stmt->execute([':id' => $id]);

        json_response(200, [
            "success" => true,
            "message" => "Doctor status set to Inactive."
        ]);
    } catch (PDOException $e) {
        error_log("Delete doctor error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to delete/deactivate doctor."]);
    }
}
