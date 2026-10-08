<?php
/**
 * Medicare System - Medical Records & Clinical Documents API
 *
 * Handles clinical histories, diagnoses, prescription charts, secure report file uploads,
 * authorized file downloads, and medical history export.
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

    // ------------------------------------------------------------------------
    // Feature: Authorized File Download (Secure streaming)
    // ------------------------------------------------------------------------
    if (isset($_GET['action']) && $_GET['action'] === 'download' && !empty($_GET['fileId'])) {
        $file_id = (int)$_GET['fileId'];
        $stmt = $db->prepare("SELECT r.*, m.patient_id, m.doctor_id 
                              FROM uploaded_reports r 
                              INNER JOIN medical_records m ON r.record_id = m.id 
                              WHERE r.id = :id LIMIT 1");
        $stmt->execute([':id' => $file_id]);
        $file = $stmt->fetch();

        if (!$file) {
            json_response(404, ["success" => false, "message" => "File attachment not found."]);
        }

        // Ownership enforcement
        if ($user['role'] === 'Patient') {
            $my_pat = get_current_patient_id($db);
            if ($file['patient_id'] !== $my_pat) {
                json_response(403, ["success" => false, "message" => "Forbidden: You cannot access other patients' medical files."]);
            }
        }

        $real_path = __DIR__ . '/../' . ltrim($file['file_path'], '/');
        if (!file_exists($real_path)) {
            json_response(404, ["success" => false, "message" => "Physical file not found on server."]);
        }

        header('Content-Description: File Transfer');
        header('Content-Type: ' . $file['file_type']);
        header('Content-Disposition: attachment; filename="' . basename($file['file_name']) . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($real_path));
        readfile($real_path);
        exit();
    }

    // ------------------------------------------------------------------------
    // Feature: Export Patient Medical History (Downloadable Clinical Summary)
    // ------------------------------------------------------------------------
    if (isset($_GET['action']) && $_GET['action'] === 'export_history') {
        $target_pat_id = ($user['role'] === 'Patient')
            ? get_current_patient_id($db)
            : ($_GET['patientId'] ?? get_current_patient_id($db));

        if (empty($target_pat_id)) {
            json_response(400, ["success" => false, "message" => "Patient ID is required for export."]);
        }

        $p_stmt = $db->prepare("SELECT * FROM patients WHERE id = :id LIMIT 1");
        $p_stmt->execute([':id' => $target_pat_id]);
        $pat = $p_stmt->fetch();

        if (!$pat) {
            json_response(404, ["success" => false, "message" => "Patient record not found."]);
        }

        $rec_stmt = $db->prepare("SELECT r.*, d.name as doctorName, d.specialization 
                                  FROM medical_records r 
                                  INNER JOIN doctors d ON r.doctor_id = d.id 
                                  WHERE r.patient_id = :pid 
                                  ORDER BY r.date DESC");
        $rec_stmt->execute([':pid' => $target_pat_id]);
        $records = $rec_stmt->fetchAll();

        // Generate formatted text medical chart
        $out = "=========================================================================\n";
        $out .= "                  MEDICARE HOSPITAL MANAGEMENT SYSTEM                    \n";
        $out .= "                     OFFICIAL PATIENT MEDICAL HISTORY                    \n";
        $out .= "=========================================================================\n\n";
        $out .= "PATIENT INFORMATION:\n";
        $out .= "Name:         " . $pat['name'] . "\n";
        $out .= "Patient ID:   " . $pat['id'] . "\n";
        $out .= "Date of Birth:" . $pat['dob'] . "\n";
        $out .= "Gender:       " . $pat['gender'] . "\n";
        $out .= "Blood Group:  " . $pat['blood_group'] . "\n";
        $out .= "Contact No:   " . $pat['phone'] . "\n";
        $out .= "Address:      " . $pat['address'] . "\n";
        $out .= "Generated On: " . date('Y-m-d H:i:s') . "\n";
        $out .= "-------------------------------------------------------------------------\n\n";

        if (empty($records)) {
            $out .= "No medical diagnostic records found on file for this patient.\n";
        } else {
            foreach ($records as $i => $r) {
                $num = $i + 1;
                $out .= "RECORD #{$num} [{$r['id']}] - Date: {$r['date']}\n";
                $out .= "Attending Physician: {$r['doctorName']} ({$r['specialization']})\n";
                $out .= "Diagnosis:           {$r['diagnosis']}\n";
                $out .= "Symptoms Presented:  {$r['symptoms']}\n";
                $out .= "Prescriptions:       \n" . $r['prescription'] . "\n";
                if (!empty($r['treatment_history'])) {
                    $out .= "Clinical Notes:      " . $r['treatment_history'] . "\n";
                }
                $out .= "-------------------------------------------------------------------------\n";
            }
        }

        header('Content-Type: text/plain; charset=utf-8');
        header('Content-Disposition: attachment; filename="Medicare_Medical_History_' . $pat['id'] . '.txt"');
        echo $out;
        exit();
    }

    // ------------------------------------------------------------------------
    // Standard GET: List Medical Records
    // ------------------------------------------------------------------------
    try {
        $query = "SELECT r.id, r.patient_id as patientId, r.doctor_id as doctorId, r.appointment_id as appointmentId,
                         r.date, r.diagnosis, r.symptoms, r.prescription, r.treatment_history as treatmentHistory,
                         p.name as patientName, d.name as doctorName
                  FROM medical_records r
                  INNER JOIN patients p ON r.patient_id = p.id
                  INNER JOIN doctors d ON r.doctor_id = d.id";

        $conditions = [];
        $params = [];

        if ($user['role'] === 'Patient') {
            $my_pat = get_current_patient_id($db);
            $conditions[] = "r.patient_id = :my_pat";
            $params[':my_pat'] = $my_pat;
        } elseif (!empty($_GET['patientId'])) {
            $conditions[] = "r.patient_id = :pid";
            $params[':pid'] = $_GET['patientId'];
        }

        if ($user['role'] === 'Doctor' && empty($_GET['patientId'])) {
            $my_doc = get_current_doctor_id($db);
            $conditions[] = "r.doctor_id = :my_doc";
            $params[':my_doc'] = $my_doc;
        } elseif (!empty($_GET['doctorId'])) {
            $conditions[] = "r.doctor_id = :did";
            $params[':did'] = $_GET['doctorId'];
        }

        if (!empty($conditions)) {
            $query .= " WHERE " . implode(" AND ", $conditions);
        }

        $query .= " ORDER BY r.date DESC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $records = $stmt->fetchAll();

        // Attach uploaded reports to each medical record
        $f_stmt = $db->prepare("SELECT id, file_name as name, file_type as type, file_size as size, file_path as path 
                                FROM uploaded_reports WHERE record_id = :rid");

        foreach ($records as &$rec) {
            $f_stmt->execute([':rid' => $rec['id']]);
            $files = $f_stmt->fetchAll();
            // Provide download URL for each file
            foreach ($files as &$f) {
                $f['downloadUrl'] = 'http://localhost/medicare-backend/api/records.php?action=download&fileId=' . $f['id'];
            }
            $rec['reports'] = $files ?: [];
        }

        json_response(200, $records);

    } catch (PDOException $e) {
        error_log("Records GET error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to load medical records."]);
    }
}

function handlePost($db) {
    // Both Doctor and Admin can create medical records
    $user = require_role(['Doctor', 'Admin']);

    // Check if multipart/form-data with file upload
    $is_multipart = !empty($_FILES) || (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'multipart/form-data') !== false);

    $patient_id  = trim($_POST['patientId'] ?? $_POST['patient_id'] ?? '');
    $diagnosis   = trim($_POST['diagnosis'] ?? '');
    $symptoms    = trim($_POST['symptoms'] ?? '');
    $prescription= trim($_POST['prescription'] ?? '');
    $treatment   = trim($_POST['treatmentHistory'] ?? $_POST['treatment_history'] ?? '');
    $appointment_id = trim($_POST['appointmentId'] ?? $_POST['appointment_id'] ?? '');

    // If not multipart, read JSON
    if (!$is_multipart) {
        $input = get_json_input();
        $patient_id   = trim($input['patientId'] ?? $input['patient_id'] ?? '');
        $diagnosis    = trim($input['diagnosis'] ?? '');
        $symptoms     = trim($input['symptoms'] ?? '');
        $prescription = trim($input['prescription'] ?? '');
        $treatment    = trim($input['treatmentHistory'] ?? $input['treatment_history'] ?? '');
        $appointment_id = trim($input['appointmentId'] ?? $input['appointment_id'] ?? '');
    }

    if ($user['role'] === 'Doctor') {
        $doctor_id = get_current_doctor_id($db);
    } else {
        $doctor_id = trim($_POST['doctorId'] ?? $input['doctorId'] ?? '');
        if (empty($doctor_id)) {
            $first_doc = $db->query("SELECT id FROM doctors LIMIT 1")->fetch();
            $doctor_id = $first_doc['id'] ?? 'DOC-101';
        }
    }

    if (empty($patient_id) || empty($diagnosis) || empty($prescription)) {
        json_response(400, ["success" => false, "message" => "Patient, diagnosis, and prescription are required."]);
    }

    try {
        $db->beginTransaction();

        $record_id = generate_unique_id($db, 'medical_records', 'REC', 10000, 99999);
        $cur_date = date('Y-m-d');

        $ins = $db->prepare("INSERT INTO medical_records 
            (id, patient_id, doctor_id, appointment_id, date, diagnosis, symptoms, prescription, treatment_history)
            VALUES (:id, :pid, :did, :aid, :date, :diag, :symp, :presc, :treat)");

        $ins->execute([
            ':id'    => $record_id,
            ':pid'   => $patient_id,
            ':did'   => $doctor_id,
            ':aid'   => !empty($appointment_id) ? $appointment_id : null,
            ':date'  => $cur_date,
            ':diag'  => $diagnosis,
            ':symp'  => $symptoms,
            ':presc' => $prescription,
            ':treat' => $treatment
        ]);

        // Process file uploads if present in $_FILES['reports']
        $saved_files = [];
        if (!empty($_FILES['reports'])) {
            $files_array = reArrayFiles($_FILES['reports']);
            $upload_dir = __DIR__ . '/../uploads/reports/';
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0755, true);
            }

            $allowed_exts = ['pdf', 'jpg', 'jpeg', 'png'];
            $allowed_mimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/pjpeg'];
            $max_size = 5 * 1024 * 1024; // 5 MB

            $f_ins = $db->prepare("INSERT INTO uploaded_reports (record_id, file_name, file_type, file_size, file_path)
                                  VALUES (:rid, :fname, :ftype, :fsize, :fpath)");

            foreach ($files_array as $file) {
                if ($file['error'] === UPLOAD_ERR_OK) {
                    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
                    $size = $file['size'];
                    $tmp_path = $file['tmp_name'];

                    // Validation
                    if (!in_array($ext, $allowed_exts)) {
                        $db->rollBack();
                        json_response(400, ["success" => false, "message" => "Invalid file extension '{$ext}'. Allowed: PDF, JPG, PNG."]);
                    }

                    if ($size > $max_size) {
                        $db->rollBack();
                        json_response(400, ["success" => false, "message" => "File {$file['name']} exceeds max permitted size of 5MB."]);
                    }

                    $finfo = finfo_open(FILEINFO_MIME_TYPE);
                    $mime = finfo_file($finfo, $tmp_path);
                    finfo_close($finfo);

                    if (!in_array($mime, $allowed_mimes)) {
                        $db->rollBack();
                        json_response(400, ["success" => false, "message" => "Invalid MIME type '{$mime}' for {$file['name']}."]);
                    }

                    // Save with cryptographically safe random filename
                    $safe_filename = 'rep_' . bin2hex(random_bytes(10)) . '.' . $ext;
                    $dest = $upload_dir . $safe_filename;
                    $rel_path = 'uploads/reports/' . $safe_filename;

                    if (move_uploaded_file($tmp_path, $dest)) {
                        $formatted_size = round($size / 1024, 1) . ' KB';
                        if ($size > 1024 * 1024) {
                            $formatted_size = round($size / (1024 * 1024), 2) . ' MB';
                        }

                        $f_ins->execute([
                            ':rid'   => $record_id,
                            ':fname' => $file['name'],
                            ':ftype' => $mime,
                            ':fsize' => $formatted_size,
                            ':fpath' => $rel_path
                        ]);

                        $saved_files[] = [
                            "name" => $file['name'],
                            "size" => $formatted_size,
                            "type" => $mime
                        ];
                    }
                }
            }
        }

        // If appointment was linked, mark it as Completed
        if (!empty($appointment_id)) {
            $apt_upd = $db->prepare("UPDATE appointments SET status = 'Completed' WHERE id = :aid");
            $apt_upd->execute([':aid' => $appointment_id]);
        }

        $db->commit();

        json_response(201, [
            "success" => true,
            "message" => "Medical record saved successfully.",
            "id" => $record_id,
            "uploadedReports" => $saved_files
        ]);

    } catch (PDOException $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log("Create medical record error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to save medical chart."]);
    }
}

/**
 * Normalizes $_FILES array structure for multiple uploads
 */
function reArrayFiles(&$file_post) {
    $file_ary = [];
    $is_multi = is_array($file_post['name']);
    if (!$is_multi) {
        return [$file_post];
    }
    $file_count = count($file_post['name']);
    $file_keys = array_keys($file_post);
    for ($i = 0; $i < $file_count; $i++) {
        foreach ($file_keys as $key) {
            $file_ary[$i][$key] = $file_post[$key][$i];
        }
    }
    return $file_ary;
}
