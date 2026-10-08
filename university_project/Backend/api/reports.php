<?php
/**
 * Medicare System - Reports & Analytics API
 *
 * Provides real-time aggregated metrics, daily/monthly clinical reports,
 * SQL revenue tracking, and physician performance indicators.
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/auth.php';

$database = new Database();
$db = $database->getConnection();

// Restricted to Admin
require_role(['Admin']);

$action = $_GET['action'] ?? 'stats';

switch ($action) {
    case 'stats':
        generateStats($db);
        break;
    case 'generate':
        generateDetailedReports($db);
        break;
    default:
        json_response(400, ["success" => false, "message" => "Invalid report action."]);
        break;
}

function generateStats($db) {
    try {
        $pat_count = (int)$db->query("SELECT COUNT(*) FROM patients")->fetchColumn();
        $doc_count = (int)$db->query("SELECT COUNT(*) FROM doctors WHERE status = 'Active'")->fetchColumn();
        $apt_count = (int)$db->query("SELECT COUNT(*) FROM appointments")->fetchColumn();
        
        // Real database revenue: sum of Paid invoices
        $rev_stmt = $db->query("SELECT SUM(total) FROM invoices WHERE status = 'Paid'");
        $total_rev = (float)($rev_stmt->fetchColumn() ?: 0.0);

        json_response(200, [
            "totalPatients"     => $pat_count,
            "totalDoctors"      => $doc_count,
            "totalAppointments" => $apt_count,
            "totalRevenue"      => round($total_rev, 2)
        ]);

    } catch (PDOException $e) {
        error_log("Report stats error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to aggregate hospital stats."]);
    }
}

function generateDetailedReports($db) {
    try {
        $start_date = $_GET['startDate'] ?? date('Y-m-01', strtotime('-3 months'));
        $end_date   = $_GET['endDate']   ?? date('Y-m-d');

        // 1. Patient Demographics (by Gender)
        $g_stmt = $db->query("SELECT gender as name, COUNT(*) as value FROM patients GROUP BY gender");
        $demographics = $g_stmt->fetchAll();

        // 2. Department Activity
        $dept_stmt = $db->query("SELECT d.name as name, COUNT(a.id) as value 
                                 FROM departments d 
                                 LEFT JOIN appointments a ON d.id = a.department_id 
                                 GROUP BY d.id, d.name");
        $dept_activity = $dept_stmt->fetchAll();

        // 3. Real Monthly Revenue from Invoices table (grouped by actual transaction dates)
        $rev_query = "SELECT DATE_FORMAT(date, '%b %Y') as month, 
                             DATE_FORMAT(date, '%Y-%m') as year_month, 
                             ROUND(SUM(total), 2) as revenue 
                      FROM invoices 
                      WHERE status = 'Paid' 
                      GROUP BY year_month, month 
                      ORDER BY year_month ASC";
        $rev_stmt = $db->query($rev_query);
        $monthly_revenue = $rev_stmt->fetchAll();

        // If no invoices yet, provide a baseline with current month $0.00
        if (empty($monthly_revenue)) {
            $monthly_revenue = [
                ["month" => date('M Y'), "year_month" => date('Y-m'), "revenue" => 0.00]
            ];
        } else {
            foreach ($monthly_revenue as &$row) {
                $row['revenue'] = (float)$row['revenue'];
            }
        }

        // 4. Doctor Performance Metrics
        $doc_query = "SELECT d.name as doctorName, d.specialization, 
                             CAST(d.rating AS FLOAT) as rating,
                             COUNT(a.id) as totalAppointments,
                             SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END) as completedAppointments,
                             SUM(CASE WHEN a.status = 'Cancelled' THEN 1 ELSE 0 END) as cancelledAppointments
                      FROM doctors d 
                      LEFT JOIN appointments a ON d.id = a.doctor_id 
                      GROUP BY d.id, d.name, d.specialization, d.rating 
                      ORDER BY totalAppointments DESC";
        $doc_stmt = $db->query($doc_query);
        $doctor_performance = $doc_stmt->fetchAll();

        foreach ($doctor_performance as &$d) {
            $d['totalAppointments']     = (int)$d['totalAppointments'];
            $d['completedAppointments'] = (int)$d['completedAppointments'];
            $d['cancelledAppointments'] = (int)$d['cancelledAppointments'];
            $d['rating']                = (float)$d['rating'];
        }

        // 5. Daily Appointments in date range
        $daily_stmt = $db->prepare("SELECT date, COUNT(*) as total, 
                                           SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
                                           SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending
                                    FROM appointments 
                                    WHERE date BETWEEN :s AND :e 
                                    GROUP BY date 
                                    ORDER BY date ASC");
        $daily_stmt->execute([':s' => $start_date, ':e' => $end_date]);
        $daily_appointments = $daily_stmt->fetchAll();

        json_response(200, [
            "patientDemographics" => $demographics ?: [],
            "departmentActivity"  => $dept_activity ?: [],
            "monthlyRevenue"      => $monthly_revenue,
            "doctorPerformance"   => $doctor_performance ?: [],
            "dailyAppointments"   => $daily_appointments ?: [],
            "dateRange"           => ["startDate" => $start_date, "endDate" => $end_date]
        ]);

    } catch (PDOException $e) {
        error_log("Report generation error: " . $e->getMessage());
        json_response(500, ["success" => false, "message" => "Failed to generate detailed analytics."]);
    }
}
