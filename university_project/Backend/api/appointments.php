<?php
/**
 * Medicare System - Appointments RESTful API
 *
 * Handles appointment scheduling, double-booking prevention, status lifecycle,
 * and automatic billing invoice generation.
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
        // Feature: Query occupied slots for a doctor on a specific date (used by UI slot selector)
        if (isset($_GET['action']) && $_GET['action'] === 'taken_slots' && !empty($_GET['doctorId']) && !empty($_GET['date'])) {
            $stmt = $db->prepare("SELECT time_slot FROM appointments 
                                  WHERE doctor_id = :did AND date = :date 
                                  AND status NOT IN ('Cancelled', 'Rejected')");
            $stmt->execute([
                ':did'  => $_GET['doctorId'],
                ':date' => $_GET['date']
            ]);
            $slots = $stmt->fetchAll(PDO::FETCH_COLUMN);
            json_response(200, ["doctorId" => $_GET['doctorId'], "date" => $_GET['date'], "takenSlots" => $slots ?: []]);
        }

        $query = "SELECT a.id, a.patient_id as patientId, a.doctor_id as doctorId, a.department_id,
                         a.date, a.time_slot as timeSlot, a.status, a.notes, a.fee, a.created_at,
                         p.name as patientName, d.name as doctorName, COALESCE(dept.name, d.specialization) as department
                  FROM appointments a
                  INNER JOIN patients p ON a.patient_id = p.id
                  INNER JOIN doctors d ON a.doctor_id = d.id
                  LEFT JOIN departments dept ON a.department_id = dept.id";

        $conditions = [];
        $params = [];

        // Role-based data ownership enforcement
        if ($user['role'] === 'Patient') {
            $my_pat_id = get_current_patient_id($db);
            $conditions[] = "a.patient_id = :my_pat_id";
            $params[':my_pat_id'] = $my_pat_id;
        } elseif ($user['role'] === 'Doctor') {
            $my_doc_id = get_current_doctor_id($db);
            // If doctor, default to own appointments unless an explicit filter was requested
            if (empty($_GET['all'])) {
                $conditions[] = "a.doctor_id = :my_doc_id";
                $params[':my_doc_id'] = $my_doc_id;
            }
        } else {
            // Admin can filter by patientId or doctorId if provided
            if (!empty($_GET['patientId'])) {
                $conditions[] = "a.patient_id = :pat_id";
                $params[':pat_id'] = $_GET['patientId'];
            }
            if (!empty($_GET['doctorId'])) {
                $conditions[] = "a.doctor_id = :doc_id";
                $params[':doc_id'] = $_GET['doctorId'];
            }
        }

        if (!empty($conditions)) {
            $query .= " WHERE " . implode(" AND ", $conditions);
        }

        $query .= " ORDER BY a.date DESC, a.time_slot ASC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $appointments = $stmt->fetchAll();

        // Cast numeric types for JSON
        foreach ($appointments as &$apt) {
            $apt['fee'] = (float)$apt['fee'];
        }

        json_response(200, $appointments);

    } catch (PDOException $e) {
        error_log("Appointments GET error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to load appointments."]);
    }
}

function handlePost($db) {
    $user = require_login();
    $input = get_json_input();

    // Determine target patient ID
    if ($user['role'] === 'Patient') {
        $patient_id = get_current_patient_id($db);
    } elseif ($user['role'] === 'Admin') {
        $patient_id = trim($input['patientId'] ?? $input['patient_id'] ?? '');
    } else {
        json_response(403, ["success" => false, "message" => "Doctors cannot book appointments on behalf of patients."]);
    }

    $doctor_id = trim($input['doctorId'] ?? $input['doctor_id'] ?? '');
    $date      = trim($input['date'] ?? '');
    $time_slot = trim($input['timeSlot'] ?? $input['time_slot'] ?? '');
    $fee       = isset($input['fee']) ? (float)$input['fee'] : 150.00;
    $notes     = trim($input['notes'] ?? '');

    if (empty($patient_id) || empty($doctor_id) || empty($date) || empty($time_slot)) {
        json_response(400, ["success" => false, "message" => "Patient, doctor, date, and time slot are required."]);
    }

    try {
        $db->beginTransaction();

        // 1. Double-booking prevention check (with row lock inside transaction)
        $chk_query = "SELECT id FROM appointments 
                      WHERE doctor_id = :did AND date = :date AND time_slot = :slot 
                      AND status NOT IN ('Cancelled', 'Rejected') 
                      FOR UPDATE";
        $chk_stmt = $db->prepare($chk_query);
        $chk_stmt->execute([
            ':did'  => $doctor_id,
            ':date' => $date,
            ':slot' => $time_slot
        ]);

        if ($chk_stmt->fetch()) {
            $db->rollBack();
            json_response(409, [
                "success" => false,
                "message" => "This doctor is already booked for {$date} at {$time_slot}. Please select another time slot or date."
            ]);
        }

        // 2. Fetch doctor info & department
        $doc_stmt = $db->prepare("SELECT name, department_id FROM doctors WHERE id = :did LIMIT 1");
        $doc_stmt->execute([':did' => $doctor_id]);
        $doctor = $doc_stmt->fetch();
        if (!$doctor) {
            $db->rollBack();
            json_response(404, ["success" => false, "message" => "Selected doctor does not exist."]);
        }

        $pat_stmt = $db->prepare("SELECT name FROM patients WHERE id = :pid LIMIT 1");
        $pat_stmt->execute([':pid' => $patient_id]);
        $patient = $pat_stmt->fetch();
        if (!$patient) {
            $db->rollBack();
            json_response(404, ["success" => false, "message" => "Patient record not found."]);
        }

        // 3. Generate unique appointment ID
        $apt_id = generate_unique_id($db, 'appointments', 'APT', 10000, 99999);

        // 4. Insert appointment
        $ins = $db->prepare("INSERT INTO appointments 
            (id, patient_id, doctor_id, department_id, date, time_slot, status, notes, fee)
            VALUES (:id, :pid, :did, :dept_id, :date, :slot, 'Pending', :notes, :fee)");

        $ins->execute([
            ':id'      => $apt_id,
            ':pid'     => $patient_id,
            ':did'     => $doctor_id,
            ':dept_id' => $doctor['department_id'],
            ':date'    => $date,
            ':slot'    => $time_slot,
            ':notes'   => $notes,
            ':fee'     => $fee
        ]);

        // 5. Automatically generate associated billing invoice
        $inv_id   = generate_unique_id($db, 'invoices', 'INV', 10000, 99999);
        $tax      = round($fee * 0.08, 2); // 8% standard tax
        $total    = round($fee + $tax, 2);
        $due_date = date('Y-m-d', strtotime('+14 days'));

        $inv_stmt = $db->prepare("INSERT INTO invoices 
            (id, patient_id, appointment_id, amount, tax, discount, total, date, due_date, status, payment_method)
            VALUES (:id, :pid, :aid, :amount, :tax, 0.00, :total, :cur_date, :due_date, 'Unpaid', '')");

        $inv_stmt->execute([
            ':id'       => $inv_id,
            ':pid'      => $patient_id,
            ':aid'      => $apt_id,
            ':amount'   => $fee,
            ':tax'      => $tax,
            ':total'    => $total,
            ':cur_date' => date('Y-m-d'),
            ':due_date' => $due_date
        ]);

        $db->commit();

        json_response(201, [
            "success" => true,
            "message" => "Appointment booked successfully. Invoice #{$inv_id} generated.",
            "appointmentId" => $apt_id,
            "invoiceId"     => $inv_id,
            "appointment"   => [
                "id"          => $apt_id,
                "patientId"   => $patient_id,
                "patientName" => $patient['name'],
                "doctorId"    => $doctor_id,
                "doctorName"  => $doctor['name'],
                "date"        => $date,
                "timeSlot"    => $time_slot,
                "status"      => 'Pending',
                "notes"       => $notes,
                "fee"         => $fee
            ]
        ]);

    } catch (PDOException $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log("Book appointment error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to book appointment due to a database error."]);
    }
}

function handlePut($db) {
    $user = require_login();
    $input = get_json_input();
    $id = trim($input['id'] ?? '');

    if (empty($id)) {
        json_response(400, ["success" => false, "message" => "Appointment ID is required."]);
    }

    try {
        // Fetch current appointment
        $stmt = $db->prepare("SELECT * FROM appointments WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $apt = $stmt->fetch();

        if (!$apt) {
            json_response(404, ["success" => false, "message" => "Appointment not found."]);
        }

        // Authorization checks
        if ($user['role'] === 'Patient') {
            $my_pat_id = get_current_patient_id($db);
            if ($apt['patient_id'] !== $my_pat_id) {
                json_response(403, ["success" => false, "message" => "Forbidden: You cannot modify another patient's appointment."]);
            }
        } elseif ($user['role'] === 'Doctor') {
            $my_doc_id = get_current_doctor_id($db);
            if ($apt['doctor_id'] !== $my_doc_id) {
                json_response(403, ["success" => false, "message" => "Forbidden: You cannot modify another doctor's appointment."]);
            }
        }

        // Action 1: Reschedule (date + timeSlot)
        if (!empty($input['date']) && !empty($input['timeSlot'])) {
            $new_date = trim($input['date']);
            $new_slot = trim($input['timeSlot']);

            $db->beginTransaction();

            // Double booking check for new slot
            $chk = $db->prepare("SELECT id FROM appointments 
                                 WHERE doctor_id = :did AND date = :date AND time_slot = :slot 
                                 AND id != :current_id AND status NOT IN ('Cancelled', 'Rejected') 
                                 FOR UPDATE");
            $chk->execute([
                ':did'        => $apt['doctor_id'],
                ':date'       => $new_date,
                ':slot'       => $new_slot,
                ':current_id' => $id
            ]);

            if ($chk->fetch()) {
                $db->rollBack();
                json_response(409, [
                    "success" => false,
                    "message" => "The requested reschedule slot ({$new_date} at {$new_slot}) is already booked."
                ]);
            }

            $upd = $db->prepare("UPDATE appointments SET date = :date, time_slot = :slot, status = 'Pending' WHERE id = :id");
            $upd->execute([
                ':date' => $new_date,
                ':slot' => $new_slot,
                ':id'   => $id
            ]);

            $db->commit();

            json_response(200, [
                "success"  => true,
                "message"  => "Appointment rescheduled successfully to {$new_date} at {$new_slot}.",
                "date"     => $new_date,
                "timeSlot" => $new_slot
            ]);
        }

        // Action 2: Update status
        if (!empty($input['status'])) {
            $allowed_statuses = ['Pending', 'Accepted', 'Rejected', 'Completed', 'Cancelled'];
            if (!in_array($input['status'], $allowed_statuses)) {
                json_response(400, ["success" => false, "message" => "Invalid appointment status."]);
            }

            // Patient can only cancel their own appointment
            if ($user['role'] === 'Patient' && $input['status'] !== 'Cancelled') {
                json_response(403, ["success" => false, "message" => "Patients can only cancel appointments."]);
            }

            $upd = $db->prepare("UPDATE appointments SET status = :status WHERE id = :id");
            $upd->execute([':status' => $input['status'], ':id' => $id]);

            // If cancelled or rejected, mark unpaid invoices accordingly
            if ($input['status'] === 'Cancelled' || $input['status'] === 'Rejected') {
                $inv_upd = $db->prepare("UPDATE invoices SET status = 'Overdue' WHERE appointment_id = :aid AND status = 'Unpaid'");
                $inv_upd->execute([':aid' => $id]);
            }

            json_response(200, [
                "success" => true,
                "message" => "Appointment status updated to {$input['status']}."
            ]);
        }

        json_response(400, ["success" => false, "message" => "No valid update fields provided."]);

    } catch (PDOException $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log("Update appointment error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to update appointment."]);
    }
}

function handleDelete($db) {
    $user = require_login();
    $input = get_json_input();
    $id = trim($input['id'] ?? $_GET['id'] ?? '');

    if (empty($id)) {
        json_response(400, ["success" => false, "message" => "Appointment ID is required."]);
    }

    try {
        $stmt = $db->prepare("SELECT * FROM appointments WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $apt = $stmt->fetch();

        if (!$apt) {
            json_response(404, ["success" => false, "message" => "Appointment not found."]);
        }

        if ($user['role'] === 'Patient') {
            $my_pat_id = get_current_patient_id($db);
            if ($apt['patient_id'] !== $my_pat_id) {
                json_response(403, ["success" => false, "message" => "Forbidden: You cannot cancel another patient's appointment."]);
            }
        }

        // Cancel appointment
        $upd = $db->prepare("UPDATE appointments SET status = 'Cancelled' WHERE id = :id");
        $upd->execute([':id' => $id]);

        $inv_upd = $db->prepare("UPDATE invoices SET status = 'Overdue' WHERE appointment_id = :aid AND status = 'Unpaid'");
        $inv_upd->execute([':aid' => $id]);

        json_response(200, [
            "success" => true,
            "message" => "Appointment cancelled successfully."
        ]);

    } catch (PDOException $e) {
        error_log("Cancel appointment error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to cancel appointment."]);
    }
}
