<?php
/**
 * Medicare System - Role Permissions API
 *
 * Allows Administrators to manage role-based permissions matrix.
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/auth.php';

$database = new Database();
$db = $database->getConnection();

$method = $_SERVER['REQUEST_METHOD'];

// Ensure role_permissions table exists
$db->exec("CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role ENUM('Admin', 'Doctor', 'Patient') NOT NULL,
    permission_key VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    is_allowed TINYINT(1) DEFAULT 1,
    UNIQUE KEY (role, permission_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Seed default permissions if empty
$chk = $db->query("SELECT COUNT(*) FROM role_permissions")->fetchColumn();
if ($chk == 0) {
    $defaults = [
        ['Admin', 'manage_users', 'Add, update, or remove doctors and patients', 1],
        ['Admin', 'manage_departments', 'Create and modify hospital departments', 1],
        ['Admin', 'view_reports', 'Access analytics, financials and reports', 1],
        ['Admin', 'backup_restore', 'Perform database backups and restorations', 1],
        ['Doctor', 'view_schedule', 'Access daily appointment queue', 1],
        ['Doctor', 'create_diagnosis', 'Publish diagnosis and prescriptions', 1],
        ['Doctor', 'upload_reports', 'Upload diagnostic scans and PDF lab reports', 1],
        ['Patient', 'book_appointments', 'Schedule doctor consultations and time slots', 1],
        ['Patient', 'view_medical_records', 'Review treatment history and prescriptions', 1],
        ['Patient', 'pay_invoices', 'Settle billing balances online or via card', 1],
    ];
    $ins = $db->prepare("INSERT IGNORE INTO role_permissions (role, permission_key, description, is_allowed) VALUES (?, ?, ?, ?)");
    foreach ($defaults as $d) {
        $ins->execute($d);
    }
}

switch ($method) {
    case 'GET':
        handleGet($db);
        break;
    case 'POST':
    case 'PUT':
        handlePut($db);
        break;
    default:
        json_response(405, ["success" => false, "message" => "Method Not Allowed"]);
        break;
}

function handleGet($db) {
    require_role(['Admin']);
    try {
        $stmt = $db->query("SELECT * FROM role_permissions ORDER BY role ASC, permission_key ASC");
        $perms = $stmt->fetchAll();
        json_response(200, $perms);
    } catch (PDOException $e) {
        error_log("Get permissions error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to load permissions matrix."]);
    }
}

function handlePut($db) {
    require_role(['Admin']);
    $input = get_json_input();
    $id = $input['id'] ?? null;
    $is_allowed = isset($input['is_allowed']) ? (int)$input['is_allowed'] : (isset($input['isAllowed']) ? (int)$input['isAllowed'] : 1);

    if (!$id) {
        json_response(400, ["success" => false, "message" => "Permission ID is required."]);
    }

    try {
        $stmt = $db->prepare("UPDATE role_permissions SET is_allowed = :allowed WHERE id = :id");
        $stmt->execute([':allowed' => $is_allowed, ':id' => $id]);

        json_response(200, [
            "success" => true,
            "message" => "Permission rule updated successfully."
        ]);
    } catch (PDOException $e) {
        error_log("Update permission error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to update permission."]);
    }
}
