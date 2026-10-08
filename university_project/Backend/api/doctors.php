<?php
/**
 * Medicare System - Doctors RESTful API
 *
 * Handles Doctor CRUD operations, profile management, and scheduling.
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/mail.php';

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
    require_login();

    try {
        if (!empty($_GET['id'])) {
            $stmt = $db->prepare("SELECT d.*, u.email, dept.name as department
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
    $email          = strtolower(trim($input['email'] ?? ''));
    $phone          = trim($input['phone'] ?? '');
    $specialization = trim($input['specialization'] ?? '');
    $department     = trim($input['department'] ?? '');
    $roomNo         = trim($input['roomNo'] ?? $input['room_no'] ?? 'Room 101');
    $bio            = trim($input['bio'] ?? '');
    $availability   = $input['availability'] ?? ["Mon", "Wed", "Fri"];
    $timeSlots      = $input['timeSlots'] ?? ["09:00 AM", "11:00 AM", "02:00 PM"];
    $adminPassword  = (string)($input['password'] ?? '');

    if ($name === '' || $email === '' || $phone === '' || $specialization === '') {
        json_response(400, ["success" => false, "message" => "Name, email, phone, and specialization are required."]);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(400, ["success" => false, "message" => "Valid email address is required."]);
    }
    if ($adminPassword !== '' && strlen($adminPassword) < 8) {
        json_response(400, ["success" => false, "message" => "Password must be at least 8 characters."]);
    }
    if (!is_array($availability)) $availability = ["Mon", "Wed", "Fri"];
    if (!is_array($timeSlots))    $timeSlots    = ["09:00 AM", "11:00 AM", "02:00 PM"];

    try {
        // Validate department before starting the transaction
        $dept_id = null;
        if ($department !== '') {
            $d = $db->prepare("SELECT id FROM departments WHERE name = :d1 OR CAST(id AS CHAR) = :d2 LIMIT 1");
            $d->execute([':d1' => $department, ':d2' => $department]);
            $row = $d->fetch();
            if (!$row) {
                json_response(422, ["success" => false, "message" => "Selected department does not exist."]);
            }
            $dept_id = $row['id'];
        }

        $chk = $db->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
        $chk->execute([':email' => $email]);
        if ($chk->fetch()) {
            json_response(409, ["success" => false, "message" => "A user with this email already exists."]);
        }

        $db->beginTransaction();

        // If admin gave no password, create a random one; doctor sets own via email link
        $generated = ($adminPassword === '');
        $plain     = $generated ? bin2hex(random_bytes(16)) : $adminPassword;
        $pw_hash   = password_hash($plain, PASSWORD_BCRYPT);

        $u = $db->prepare("INSERT INTO users (email, password_hash, role) VALUES (:email, :hash, 'Doctor')");
        $u->execute([':email' => $email, ':hash' => $pw_hash]);
        $user_id = $db->lastInsertId();

        $doc_id = generate_unique_id($db, 'doctors', 'DOC', 100, 999);

        $ins = $db->prepare("INSERT INTO doctors
            (id, user_id, name, phone, specialization, department_id, availability, time_slots, room_no, status, bio, rating)
            VALUES (:id, :uid, :name, :phone, :spec, :dept_id, :avail, :slots, :room, 'Active', :bio, 4.8)");
        $ins->execute([
            ':id'      => $doc_id,
            ':uid'     => $user_id,
            ':name'    => $name,
            ':phone'   => $phone,
            ':spec'    => $specialization,
            ':dept_id' => $dept_id,
            ':avail'   => json_encode($availability),
            ':slots'   => json_encode($timeSlots),
            ':room'    => $roomNo,
            ':bio'     => $bio
        ]);

        $db->commit();

        // After commit: invite email (doctor remains created even if mail fails)
        $inviteSent = false;
        if ($generated) {
            $link = issue_reset_link($db, $email);
            $safeName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
            $inviteSent = send_mail($email, 'Your Medicare doctor account',
                "<p>Hello $safeName,</p>
                 <p>An account has been created for you on Medicare Hospital System.</p>
                 <p><a href=\"$link\">Click here to set your password</a> (valid for 30 minutes).</p>");
        }

        json_response(201, [
            "success" => true,
            "message" => "Doctor created successfully." .
                ($generated && !$inviteSent ? " Invite email could not be sent; use 'Forgot password' for this doctor." : ""),
            "id" => $doc_id,
            "inviteSent" => $inviteSent,
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
        error_log("Create doctor error: " . $e->getMessage() . " | line " . $e->getLine() . " | " . $e->getFile());
        $msg = (defined('APP_DEBUG') && APP_DEBUG)
            ? "DB error: " . $e->getMessage()
            : "Database error while creating doctor.";
        json_response(500, ["success" => false, "message" => $msg]);
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
            $d_stmt = $db->prepare("SELECT id FROM departments WHERE name = :d1 OR CAST(id AS CHAR) = :d2 LIMIT 1");
            $d_stmt->execute([':d1' => $input['department'], ':d2' => $input['department']]);
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
