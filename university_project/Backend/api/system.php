<?php
/**
 * Medicare System - Database Backup & Restore API
 *
 * Provides JSON-based snapshot backup and atomic restoration.
 * Restricted strictly to Administrators.
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/auth.php';

$database = new Database();
$db = $database->getConnection();

// Restricted to Admin
require_role(['Admin']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    handleBackup($db);
} elseif ($method === 'POST') {
    handleRestore($db);
} else {
    json_response(405, ["success" => false, "message" => "Method Not Allowed."]);
}

function handleBackup($db) {
    try {
        $tables = [
            'users',
            'departments',
            'admins',
            'doctors',
            'patients',
            'appointments',
            'medical_records',
            'invoices',
            'uploaded_reports',
            'role_permissions'
        ];

        $backup = [
            "system"    => "Medicare Hospital Management System",
            "version"   => "1.0.0",
            "timestamp" => date("Y-m-d H:i:s"),
            "data"      => []
        ];

        foreach ($tables as $table) {
            // Check if table exists before querying
            try {
                $stmt = $db->query("SELECT * FROM `$table`");
                $backup["data"][$table] = $stmt->fetchAll();
            } catch (Exception $e) {
                $backup["data"][$table] = [];
            }
        }

        json_response(200, [
            "success"     => true,
            "message"     => "Database backup snapshot generated successfully.",
            "backup_json" => json_encode($backup, JSON_PRETTY_PRINT)
        ]);

    } catch (PDOException $e) {
        error_log("Database backup error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Database backup failed: " . $e->getMessage()]);
    }
}

function handleRestore($db) {
    $input = get_json_input();
    $raw_backup = $input['backup_data'] ?? $input;

    if (is_string($raw_backup)) {
        $backup = json_decode($raw_backup, true);
    } else {
        $backup = $raw_backup;
    }

    if (!$backup || !isset($backup['data']) || !is_array($backup['data'])) {
        json_response(400, ["success" => false, "message" => "Invalid JSON backup package format."]);
    }

    try {
        $db->beginTransaction();

        // 1. Temporarily disable foreign keys for clean restoration
        $db->exec("SET FOREIGN_KEY_CHECKS = 0");

        $restore_order = [
            'uploaded_reports',
            'invoices',
            'medical_records',
            'appointments',
            'patients',
            'doctors',
            'admins',
            'departments',
            'role_permissions',
            'users'
        ];

        // 2. Truncate tables in reverse order
        foreach ($restore_order as $table) {
            try {
                $db->exec("TRUNCATE TABLE `$table`");
            } catch (Exception $e) {
                // Table might not exist yet, continue
            }
        }

        // 3. Insert records in dependency order
        $insert_order = [
            'users',
            'departments',
            'admins',
            'doctors',
            'patients',
            'appointments',
            'medical_records',
            'invoices',
            'uploaded_reports',
            'role_permissions'
        ];

        foreach ($insert_order as $table) {
            if (empty($backup['data'][$table]) || !is_array($backup['data'][$table])) {
                continue;
            }

            $rows = $backup['data'][$table];
            if (empty($rows[0])) {
                continue;
            }

            $columns = array_keys($rows[0]);
            $col_list = "`" . implode("`, `", $columns) . "`";
            $placeholder_list = ":" . implode(", :", $columns);

            $ins_sql = "INSERT INTO `$table` ($col_list) VALUES ($placeholder_list)";
            $stmt = $db->prepare($ins_sql);

            foreach ($rows as $row) {
                $stmt->execute($row);
            }
        }

        // 4. Re-enable foreign key constraints
        $db->exec("SET FOREIGN_KEY_CHECKS = 1");

        $db->commit();

        json_response(200, [
            "success" => true,
            "message" => "Database successfully restored from backup dated " . ($backup['timestamp'] ?? 'snapshot') . "."
        ]);

    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        $db->exec("SET FOREIGN_KEY_CHECKS = 1");
        error_log("Database restore error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Restore failed: " . $e->getMessage()]);
    }
}
