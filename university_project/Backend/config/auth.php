<?php
/**
 * Medicare System - Session Authentication & Role Authorization Helper
 *
 * Enforces role-based access control (RBAC), session timeouts, and ownership rules.
 */

require_once __DIR__ . '/db.php';

const SESSION_TIMEOUT_SECONDS = 7200; // 2 hours

/**
 * Check if a user session is active and valid
 */
function is_logged_in() {
    if (empty($_SESSION['user_id']) || empty($_SESSION['role'])) {
        return false;
    }

    // Session timeout check
    if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > SESSION_TIMEOUT_SECONDS)) {
        session_unset();
        session_destroy();
        return false;
    }

    $_SESSION['last_activity'] = time();
    return true;
}

/**
 * Enforce that the user is logged in (returns session user data or 401)
 */
function require_login() {
    if (!is_logged_in()) {
        json_response(401, [
            "success" => false,
            "message" => "Unauthorized. Active session not found or expired. Please login."
        ]);
    }

    return [
        "user_id"    => $_SESSION['user_id'],
        "email"      => $_SESSION['email'] ?? '',
        "name"       => $_SESSION['name'] ?? '',
        "role"       => $_SESSION['role'],
        "profile_id" => $_SESSION['profile_id'] ?? null
    ];
}

/**
 * Enforce that the user has one of the allowed roles (or 403)
 */
function require_role($allowed_roles) {
    $user = require_login();
    if (!is_array($allowed_roles)) {
        $allowed_roles = [$allowed_roles];
    }

    if (!in_array($user['role'], $allowed_roles)) {
        json_response(403, [
            "success" => false,
            "message" => "Forbidden: Access restricted for role: " . $user['role']
        ]);
    }

    return $user;
}

/**
 * Verify granular permission for the role from role_permissions table
 */
function has_permission($db, $role, $permission) {
    if ($role === 'Admin') {
        return true; // Admin has all permissions by default
    }

    try {
        $stmt = $db->prepare("SELECT is_allowed FROM role_permissions WHERE role = :role AND permission_key = :perm LIMIT 1");
        $stmt->execute([':role' => $role, ':perm' => $permission]);
        $res = $stmt->fetch();
        return $res && (int)$res['is_allowed'] === 1;
    } catch (Exception $e) {
        return true; // Graceful fallback
    }
}

/**
 * Enforce permission or exit 403
 */
function require_permission($db, $permission) {
    $user = require_login();
    if (!has_permission($db, $user['role'], $permission)) {
        json_response(403, [
            "success" => false,
            "message" => "Forbidden: Permission '{$permission}' not granted for role '{$user['role']}'"
        ]);
    }
    return $user;
}

/**
 * Get the Patient ID for the currently authenticated user
 */
function get_current_patient_id($db) {
    $user = require_login();
    if ($user['role'] === 'Patient') {
        if (!empty($user['profile_id'])) {
            return $user['profile_id'];
        }
        $stmt = $db->prepare("SELECT id FROM patients WHERE user_id = :uid LIMIT 1");
        $stmt->execute([':uid' => $user['user_id']]);
        $row = $stmt->fetch();
        if ($row) {
            $_SESSION['profile_id'] = $row['id'];
            return $row['id'];
        }
    }
    return null;
}

/**
 * Get the Doctor ID for the currently authenticated user
 */
function get_current_doctor_id($db) {
    $user = require_login();
    if ($user['role'] === 'Doctor') {
        if (!empty($user['profile_id'])) {
            return $user['profile_id'];
        }
        $stmt = $db->prepare("SELECT id FROM doctors WHERE user_id = :uid LIMIT 1");
        $stmt->execute([':uid' => $user['user_id']]);
        $row = $stmt->fetch();
        if ($row) {
            $_SESSION['profile_id'] = $row['id'];
            return $row['id'];
        }
    }
    return null;
}
