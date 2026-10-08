<?php
/**
 * Medicare System - Invoices & Billing API
 *
 * Handles patient invoices, payments (Cash, Card, Online Transfer),
 * and admin billing administration.
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
    default:
        json_response(405, ["success" => false, "message" => "Method Not Allowed"]);
        break;
}

function handleGet($db) {
    $user = require_login();

    try {
        $query = "SELECT i.id, i.patient_id as patientId, i.appointment_id as appointmentId,
                         i.amount, i.tax, i.discount, i.total, i.date, i.due_date as dueDate,
                         i.status, i.payment_method as paymentMethod, i.paid_at as paidAt,
                         p.name as patientName
                  FROM invoices i
                  INNER JOIN patients p ON i.patient_id = p.id";

        $conditions = [];
        $params = [];

        // Ownership enforcement
        if ($user['role'] === 'Patient') {
            $my_pat = get_current_patient_id($db);
            $conditions[] = "i.patient_id = :my_pat";
            $params[':my_pat'] = $my_pat;
        } elseif (!empty($_GET['patientId'])) {
            $conditions[] = "i.patient_id = :pid";
            $params[':pid'] = $_GET['patientId'];
        }

        if (!empty($conditions)) {
            $query .= " WHERE " . implode(" AND ", $conditions);
        }

        $query .= " ORDER BY i.date DESC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $invoices = $stmt->fetchAll();

        foreach ($invoices as &$inv) {
            $inv['amount']   = (float)$inv['amount'];
            $inv['tax']      = (float)$inv['tax'];
            $inv['discount'] = (float)$inv['discount'];
            $inv['total']    = (float)$inv['total'];
        }

        json_response(200, $invoices);

    } catch (PDOException $e) {
        error_log("Invoices GET error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to load invoices."]);
    }
}

function handlePost($db) {
    $user = require_login();
    $input = get_json_input();

    // ------------------------------------------------------------------------
    // Action 1: Pay Invoice (Cash, Card, Online Transfer)
    // ------------------------------------------------------------------------
    if (isset($input['action']) && $input['action'] === 'pay') {
        $id = trim($input['id'] ?? '');
        $method = trim($input['paymentMethod'] ?? $input['payment_method'] ?? 'Card');

        if (empty($id)) {
            json_response(400, ["success" => false, "message" => "Invoice ID is required for payment."]);
        }

        $allowed_methods = ['Cash', 'Card', 'Online Transfer'];
        if (!in_array($method, $allowed_methods)) {
            json_response(400, ["success" => false, "message" => "Invalid payment method. Allowed: Cash, Card, Online Transfer."]);
        }

        if ($user['role'] !== 'Admin') {
            if ($method === 'Card') {
                $card_number = preg_replace('/\D/', '', (string)($input['cardNumber'] ?? ''));
                $card_holder = trim((string)($input['cardHolder'] ?? ''));
                $card_expiry = trim((string)($input['cardExpiry'] ?? ''));
                $card_cvv    = trim((string)($input['cardCvv'] ?? ''));

                if ($card_holder === '' || strlen($card_number) < 13 || strlen($card_number) > 19) {
                    json_response(400, ["success" => false, "message" => "Enter a valid cardholder name and card number."]);
                }
                if (!preg_match('/^(0[1-9]|1[0-2])\/\d{2}$/', $card_expiry)) {
                    json_response(400, ["success" => false, "message" => "Card expiry must be in MM/YY format."]);
                }
                $exp_parts = explode('/', $card_expiry);
                $exp_month = (int)$exp_parts[0];
                $exp_year  = 2000 + (int)$exp_parts[1];
                $exp_ts    = mktime(0, 0, 0, $exp_month + 1, 0, $exp_year);
                if ($exp_ts < time()) {
                    json_response(400, ["success" => false, "message" => "This card has expired. Please use another card."]);
                }
                if (!preg_match('/^\d{3,4}$/', $card_cvv)) {
                    json_response(400, ["success" => false, "message" => "Enter a valid 3 or 4 digit CVV."]);
                }
            }

            if ($method === 'Online Transfer') {
                $transfer_ref = trim((string)($input['transferRef'] ?? ''));
                if (strlen($transfer_ref) < 6) {
                    json_response(400, ["success" => false, "message" => "Enter the bank transaction reference (at least 6 characters)."]);
                }
            }
        }

        try {
            $stmt = $db->prepare("SELECT * FROM invoices WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $id]);
            $inv = $stmt->fetch();

            if (!$inv) {
                json_response(404, ["success" => false, "message" => "Invoice not found."]);
            }

            // Ownership check
            if ($user['role'] === 'Patient') {
                $my_pat = get_current_patient_id($db);
                if ($inv['patient_id'] !== $my_pat) {
                    json_response(403, ["success" => false, "message" => "Forbidden: You cannot pay another patient's bill."]);
                }
            }

            if ($inv['status'] === 'Paid') {
                json_response(400, ["success" => false, "message" => "This invoice has already been paid."]);
            }

            $paid_date = date('Y-m-d');
            $upd = $db->prepare("UPDATE invoices SET status = 'Paid', payment_method = :method, paid_at = :paid_date WHERE id = :id");
            $upd->execute([
                ':method'    => $method,
                ':paid_date' => $paid_date,
                ':id'        => $id
            ]);

            json_response(200, [
                "success" => true,
                "message" => "Payment of $" . number_format($inv['total'], 2) . " settled successfully via {$method}.",
                "id"            => $id,
                "status"        => 'Paid',
                "paymentMethod" => $method,
                "paidAt"        => $paid_date
            ]);

        } catch (PDOException $e) {
            error_log("Pay invoice error: " . $e->getMessage());
            json_response(500, ["success" => false, "message" => "Failed to process payment."]);
        }
    }

    // ------------------------------------------------------------------------
    // Action 2: Admin Manual Invoice Creation
    // ------------------------------------------------------------------------
    require_role(['Admin']);

    $patient_id = trim($input['patientId'] ?? $input['patient_id'] ?? '');
    $amount     = isset($input['amount']) ? (float)$input['amount'] : 0.0;
    $discount   = isset($input['discount']) ? (float)$input['discount'] : 0.0;
    $due_date   = trim($input['dueDate'] ?? $input['due_date'] ?? date('Y-m-d', strtotime('+14 days')));

    if (empty($patient_id) || $amount <= 0) {
        json_response(400, ["success" => false, "message" => "Patient ID and valid amount greater than zero are required."]);
    }

    try {
        $inv_id = generate_unique_id($db, 'invoices', 'INV', 10000, 99999);
        $tax = round($amount * 0.08, 2);
        $total = round($amount + $tax - $discount, 2);
        $cur_date = date('Y-m-d');

        $stmt = $db->prepare("INSERT INTO invoices (id, patient_id, appointment_id, amount, tax, discount, total, date, due_date, status, payment_method)
                              VALUES (:id, :pid, NULL, :amt, :tax, :disc, :total, :cur_date, :due_date, 'Unpaid', '')");

        $stmt->execute([
            ':id'       => $inv_id,
            ':pid'      => $patient_id,
            ':amt'      => $amount,
            ':tax'      => $tax,
            ':disc'     => $discount,
            ':total'    => $total,
            ':cur_date' => $cur_date,
            ':due_date' => $due_date
        ]);

        json_response(201, [
            "success" => true,
            "message" => "Invoice #{$inv_id} generated successfully.",
            "id" => $inv_id,
            "invoice" => [
                "id"            => $inv_id,
                "patientId"     => $patient_id,
                "amount"        => $amount,
                "tax"           => $tax,
                "discount"      => $discount,
                "total"         => $total,
                "date"          => $cur_date,
                "dueDate"       => $due_date,
                "status"        => 'Unpaid',
                "paymentMethod" => ''
            ]
        ]);

    } catch (PDOException $e) {
        error_log("Create invoice error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to generate invoice."]);
    }
}
