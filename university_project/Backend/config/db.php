<?php
/**
 * Medicare System - Database Connection & Environment Config
 *
 * Configured for XAMPP / WAMP local development environments.
 * Uses PDO with prepared statements for SQL injection security.
 */

// Production error settings: log errors, don't echo raw database internals to client
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// Session configuration - must allow cookie across credentials
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_samesite', 'Lax');
    // Session lifetime: 2 hours (7200 seconds)
    ini_set('session.gc_maxlifetime', '7200');
    session_start();
}

// ----------------------------------------------------
// CORS Configuration with Credentials Support
// Note: When credentials are included, wildcard (*) is forbidden by browsers.
// ----------------------------------------------------
$allowed_origins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
];

$http_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($http_origin, $allowed_origins) || empty($http_origin)) {
    header("Access-Control-Allow-Origin: " . ($http_origin ?: 'http://localhost:3000'));
} else {
    // Fallback to requested origin if running on local IP or custom port
    header("Access-Control-Allow-Origin: " . $http_origin);
}

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

/**
 * Database Connection Provider
 */
class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    private $conn = null;

    public function __construct() {
        $this->host = getenv('DB_HOST') ?: 'localhost';
        $this->db_name = getenv('DB_NAME') ?: 'medicare_db';
        $this->username = getenv('DB_USER') ?: 'root';
        $this->password = getenv('DB_PASS') ?: '';
    }

    public function getConnection() {
        if ($this->conn !== null) {
            return $this->conn;
        }

        try {
            $dsn = "mysql:host={$this->host};dbname={$this->db_name};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
            return $this->conn;
        } catch (PDOException $e) {
            error_log("Database connection error: " . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                "success" => false,
                "message" => "Database connection failed. Please ensure MySQL is running in XAMPP and 'medicare_db' is imported."
            ]);
            exit();
        }
    }
}

/**
 * Send JSON response and exit
 */
function json_response($status_code, $data) {
    http_response_code($status_code);
    echo json_encode($data);
    exit();
}

/**
 * Parse JSON input from request body
 */
function get_json_input() {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Safe ID Generator with conflict retry
 */
function generate_unique_id($db, $table, $prefix, $min = 1000, $max = 99999) {
    $attempts = 0;
    while ($attempts < 10) {
        $candidate = $prefix . "-" . random_int($min, $max);
        $stmt = $db->prepare("SELECT id FROM `$table` WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $candidate]);
        if (!$stmt->fetch()) {
            return $candidate;
        }
        $attempts++;
    }
    // Fallback if random clashes repeatedly
    return $prefix . "-" . time();
}
