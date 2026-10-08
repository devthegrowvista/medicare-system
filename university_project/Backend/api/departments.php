<?php
/**
 * Medicare System - Departments RESTful API
 *
 * Handles Hospital Clinical Departments CRUD operations.
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
    require_login();

    try {
        if (!empty($_GET['id'])) {
            $stmt = $db->prepare("SELECT * FROM departments WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $_GET['id']]);
            $dept = $stmt->fetch();
            if (!$dept) {
                json_response(404, ["success" => false, "message" => "Department not found."]);
            }
            json_response(200, $dept);
        } else {
            $stmt = $db->query("SELECT * FROM departments ORDER BY name ASC");
            $depts = [];
            while ($row = $stmt->fetch()) {
                // Normalize field names for frontend compatibility
                $row['headOfDepartment'] = $row['head_of_department'];
                $row['roomNo']           = $row['room_no'];
                $depts[] = $row;
            }
            json_response(200, $depts);
        }
    } catch (PDOException $e) {
        error_log("Departments GET error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to load departments."]);
    }
}

function handlePost($db) {
    require_role(['Admin']);

    $input = get_json_input();
    $name             = trim($input['name'] ?? '');
    $description      = trim($input['description'] ?? '');
    $headOfDepartment = trim($input['headOfDepartment'] ?? $input['head_of_department'] ?? '');
    $roomNo           = trim($input['roomNo'] ?? $input['room_no'] ?? '');

    if (empty($name) || empty($headOfDepartment) || empty($roomNo)) {
        json_response(400, ["success" => false, "message" => "Name, Head of Department, and Room No are required."]);
    }

    try {
        $dept_id = generate_unique_id($db, 'departments', 'DEP', 10, 99);

        $stmt = $db->prepare("INSERT INTO departments (id, name, description, head_of_department, room_no, status)
                              VALUES (:id, :name, :desc, :head, :room, 'Active')");
        $stmt->execute([
            ':id'   => $dept_id,
            ':name' => $name,
            ':desc' => $description,
            ':head' => $headOfDepartment,
            ':room' => $roomNo
        ]);

        json_response(201, [
            "success" => true,
            "message" => "Department created successfully.",
            "id" => $dept_id,
            "department" => [
                "id"               => $dept_id,
                "name"             => $name,
                "description"      => $description,
                "headOfDepartment" => $headOfDepartment,
                "roomNo"           => $roomNo,
                "status"           => "Active"
            ]
        ]);
    } catch (PDOException $e) {
        error_log("Create department error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to create department."]);
    }
}

function handlePut($db) {
    require_role(['Admin']);

    $input = get_json_input();
    $id = trim($input['id'] ?? '');

    if (empty($id)) {
        json_response(400, ["success" => false, "message" => "Department ID is required."]);
    }

    try {
        $stmt = $db->prepare("SELECT * FROM departments WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            json_response(404, ["success" => false, "message" => "Department not found."]);
        }

        $name   = $input['name'] ?? $existing['name'];
        $desc   = $input['description'] ?? $existing['description'];
        $head   = $input['headOfDepartment'] ?? $input['head_of_department'] ?? $existing['head_of_department'];
        $room   = $input['roomNo'] ?? $input['room_no'] ?? $existing['room_no'];
        $status = $input['status'] ?? $existing['status'];

        $upd = $db->prepare("UPDATE departments SET
            name = :name,
            description = :desc,
            head_of_department = :head,
            room_no = :room,
            status = :status
            WHERE id = :id");

        $upd->execute([
            ':id'     => $id,
            ':name'   => $name,
            ':desc'   => $desc,
            ':head'   => $head,
            ':room'   => $room,
            ':status' => $status
        ]);

        json_response(200, [
            "success" => true,
            "message" => "Department updated successfully."
        ]);
    } catch (PDOException $e) {
        error_log("Update department error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to update department."]);
    }
}

function handleDelete($db) {
    require_role(['Admin']);

    $input = get_json_input();
    $id = trim($input['id'] ?? $_GET['id'] ?? '');

    if (empty($id)) {
        json_response(400, ["success" => false, "message" => "Department ID is required."]);
    }

    try {
        $stmt = $db->prepare("DELETE FROM departments WHERE id = :id");
        $stmt->execute([':id' => $id]);

        json_response(200, [
            "success" => true,
            "message" => "Department deleted successfully."
        ]);
    } catch (PDOException $e) {
        error_log("Delete department error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Cannot delete department: associated records may exist."]);
    }
}
