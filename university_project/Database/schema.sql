-- ====================================================================
-- PROJECT: MEDICARE HOSPITAL MANAGEMENT SYSTEM
-- ROLE: VIRTUAL UNIVERSITY CS619 FINAL YEAR PROJECT DATABASE SCHEMA
-- DATABASE ENGINE: MySQL (XAMPP / WAMP Compatible)
-- AUTHOR: Virtual University BSCS/BSIT Final Year Project Team
-- ====================================================================

CREATE DATABASE IF NOT EXISTS medicare_db;
USE medicare_db;

-- 1. Temporarily disable foreign key checks
SET FOREIGN_KEY_CHECKS = 0;

-- 2. Safely drop all existing tables in reverse dependency order
DROP TABLE IF EXISTS uploaded_reports;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS medical_records;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS users;

-- --------------------------------------------------------
-- 1. TABLE: users
-- Core credentials table for authentication and session roles
-- --------------------------------------------------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Admin', 'Doctor', 'Patient') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 2. TABLE: departments
-- Hospital clinical departments/wards
-- --------------------------------------------------------
CREATE TABLE departments (
    id VARCHAR(20) PRIMARY KEY, -- e.g., 'DEP-01'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    head_of_department VARCHAR(100) NOT NULL,
    room_no VARCHAR(20) NOT NULL,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 3. TABLE: admins
-- Administrative details tied to core user accounts
-- --------------------------------------------------------
CREATE TABLE admins (
    id VARCHAR(20) PRIMARY KEY, -- e.g., 'ADM-001'
    user_id INT UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 4. TABLE: doctors
-- Medical practitioners and staff information
-- --------------------------------------------------------
CREATE TABLE doctors (
    id VARCHAR(20) PRIMARY KEY, -- e.g., 'DOC-101'
    user_id INT UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    department_id VARCHAR(20),
    availability VARCHAR(255) NOT NULL, -- e.g. '["Mon", "Wed", "Fri"]' (JSON)
    time_slots VARCHAR(255) NOT NULL, -- e.g. '["09:00 AM", "10:00 AM"]' (JSON)
    room_no VARCHAR(20) NOT NULL,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    bio TEXT,
    rating DECIMAL(2,1) DEFAULT 4.8,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 5. TABLE: patients
-- Patient health charts and general contact cards
-- --------------------------------------------------------
CREATE TABLE patients (
    id VARCHAR(20) PRIMARY KEY, -- e.g., 'PAT-1001'
    user_id INT UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    gender VARCHAR(10) NOT NULL,
    dob DATE NOT NULL,
    blood_group VARCHAR(5) NOT NULL,
    address TEXT NOT NULL,
    status ENUM('Active', 'Suspended') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 6. TABLE: appointments
-- Scheduled clinical and outpatient appointments
-- --------------------------------------------------------
CREATE TABLE appointments (
    id VARCHAR(20) PRIMARY KEY, -- e.g. 'APT-10001'
    patient_id VARCHAR(20) NOT NULL,
    doctor_id VARCHAR(20) NOT NULL,
    department_id VARCHAR(20),
    date DATE NOT NULL,
    time_slot VARCHAR(50) NOT NULL,
    status ENUM('Pending', 'Accepted', 'Rejected', 'Completed', 'Cancelled') DEFAULT 'Pending',
    notes TEXT,
    fee DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_doc_date_slot (doctor_id, date, time_slot),
    INDEX idx_pat (patient_id),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 7. TABLE: medical_records
-- Clinical diagnoses, findings and histories
-- --------------------------------------------------------
CREATE TABLE medical_records (
    id VARCHAR(20) PRIMARY KEY, -- e.g. 'REC-10001'
    patient_id VARCHAR(20) NOT NULL,
    doctor_id VARCHAR(20) NOT NULL,
    appointment_id VARCHAR(20),
    date DATE NOT NULL,
    diagnosis VARCHAR(255) NOT NULL,
    symptoms TEXT NOT NULL,
    prescription TEXT NOT NULL,
    treatment_history TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 8. TABLE: invoices
-- Billing records linked to patient appointments
-- --------------------------------------------------------
CREATE TABLE invoices (
    id VARCHAR(20) PRIMARY KEY, -- e.g. 'INV-10001'
    patient_id VARCHAR(20) NOT NULL,
    appointment_id VARCHAR(20),
    amount DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('Paid', 'Unpaid', 'Overdue') DEFAULT 'Unpaid',
    payment_method VARCHAR(50) DEFAULT '',
    paid_at DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 9. TABLE: uploaded_reports
-- Scan reports, scan images and PDFs uploaded by clinicians
-- --------------------------------------------------------
CREATE TABLE uploaded_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    record_id VARCHAR(20) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size VARCHAR(20) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 10. TABLE: password_resets
-- Password reset tokens for forgot-password flow
-- --------------------------------------------------------
CREATE TABLE password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (token_hash),
    INDEX (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 11. TABLE: role_permissions
-- Permissions matrix assigned by Admin
-- --------------------------------------------------------
CREATE TABLE role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role ENUM('Admin', 'Doctor', 'Patient') NOT NULL,
    permission_key VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    is_allowed TINYINT(1) DEFAULT 1,
    UNIQUE KEY (role, permission_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ====================================================================
-- SEED HIGH QUALITY ACADEMIC EVALUATION DATA
-- Passwords:
-- admin@medicare.com    => admin123
-- dr.clara@medicare.com  => doctor123
-- dr.marcus@medicare.com => doctor123
-- dr.sarah@medicare.com  => doctor123
-- sarah.connor@gmail.com => patient123
-- john.doe@yahoo.com     => patient123
-- bruce.wayne@waynecorp.com => patient123
--
-- Password hash: $2y$10$Rz/6h7fL8tOnuT5K0/ePSezY4i7V263n899Vb9lX6VvjP7oO2C6D2
-- ====================================================================

-- 1. Users accounts
INSERT INTO users (id, email, password_hash, role) VALUES
(1, 'admin@medicare.com', '$2y$10$Rz/6h7fL8tOnuT5K0/ePSezY4i7V263n899Vb9lX6VvjP7oO2C6D2', 'Admin'),
(2, 'dr.clara@medicare.com', '$2y$10$Rz/6h7fL8tOnuT5K0/ePSezY4i7V263n899Vb9lX6VvjP7oO2C6D2', 'Doctor'),
(3, 'dr.marcus@medicare.com', '$2y$10$Rz/6h7fL8tOnuT5K0/ePSezY4i7V263n899Vb9lX6VvjP7oO2C6D2', 'Doctor'),
(4, 'dr.sarah@medicare.com', '$2y$10$Rz/6h7fL8tOnuT5K0/ePSezY4i7V263n899Vb9lX6VvjP7oO2C6D2', 'Doctor'),
(5, 'sarah.connor@gmail.com', '$2y$10$Rz/6h7fL8tOnuT5K0/ePSezY4i7V263n899Vb9lX6VvjP7oO2C6D2', 'Patient'),
(6, 'john.doe@yahoo.com', '$2y$10$Rz/6h7fL8tOnuT5K0/ePSezY4i7V263n899Vb9lX6VvjP7oO2C6D2', 'Patient'),
(7, 'bruce.wayne@waynecorp.com', '$2y$10$Rz/6h7fL8tOnuT5K0/ePSezY4i7V263n899Vb9lX6VvjP7oO2C6D2', 'Patient');

-- 2. Seed Departments
INSERT INTO departments (id, name, description, head_of_department, room_no, status) VALUES
('DEP-01', 'Cardiology', 'Treatment of heart-related ailments and blood vessel complications.', 'Dr. Marcus Vance', 'Room 301, Block B', 'Active'),
('DEP-02', 'Neurology', 'Handling nerve system, spine, and brain diagnostics.', 'Dr. Clara Sterling', 'Room 405, Block A', 'Active'),
('DEP-03', 'Pediatrics', 'Comprehensive healthcare solutions for infants, toddlers, and teenagers.', 'Dr. Sarah Lin', 'Room 102, Block C', 'Active'),
('DEP-04', 'Orthopedics', 'Skeletal surgery, bone fractures, joints, and ligaments treatment.', 'Dr. Thomas Wayne', 'Room 211, Block B', 'Active');

-- 3. Seed Admins
INSERT INTO admins (id, user_id, name, phone) VALUES
('ADM-001', 1, 'Admin Director', '+1 (555) 019-9231');

-- 4. Seed Doctors
INSERT INTO doctors (id, user_id, name, phone, specialization, department_id, availability, time_slots, room_no, status, bio, rating) VALUES
('DOC-101', 2, 'Dr. Clara Sterling', '+1 (555) 321-4921', 'Neurologist', 'DEP-02', '["Mon", "Wed", "Fri"]', '["09:00 AM", "10:30 AM", "01:00 PM", "03:30 PM"]', 'Room 405-A', 'Active', 'Specialist in complex neuro-imaging, neurodegenerative diseases, and brain rehabilitation systems.', 4.9),
('DOC-102', 3, 'Dr. Marcus Vance', '+1 (555) 892-2311', 'Cardiologist', 'DEP-01', '["Tue", "Thu"]', '["10:00 AM", "11:30 AM", "02:00 PM", "04:30 PM"]', 'Room 301-B', 'Active', 'Renowned interventional cardiologist focusing on cardiac bypass therapy and rhythm correction.', 4.8),
('DOC-103', 4, 'Dr. Sarah Lin', '+1 (555) 441-3921', 'Pediatrician', 'DEP-03', '["Mon", "Tue", "Thu"]', '["09:00 AM", "11:00 AM", "02:30 PM"]', 'Room 102-C', 'Active', 'Compassionate pediatric practitioner with 12 years of clinical devotion in child immunization and nutrition.', 4.7);

-- 5. Seed Patients
INSERT INTO patients (id, user_id, name, phone, gender, dob, blood_group, address, status) VALUES
('PAT-1001', 5, 'Sarah Connor', '+1 (555) 782-9901', 'Female', '1985-11-12', 'A-', '425 SkyNet Way, Pasadena, California', 'Active'),
('PAT-1002', 6, 'John Doe', '+1 (555) 123-4567', 'Male', '1990-05-15', 'O+', '742 Evergreen Terrace, Springfield', 'Active'),
('PAT-1003', 7, 'Bruce Wayne', '+1 (555) 999-1000', 'Male', '1982-02-19', 'AB+', '1007 Mountain Drive, Gotham City', 'Active');

-- 6. Seed Appointments
INSERT INTO appointments (id, patient_id, doctor_id, department_id, date, time_slot, status, notes, fee) VALUES
('APT-10001', 'PAT-1001', 'DOC-101', 'DEP-02', '2026-10-15', '10:30 AM', 'Accepted', 'Regular checkup regarding recurring localized tension headaches.', 150.00),
('APT-10002', 'PAT-1002', 'DOC-102', 'DEP-01', '2026-10-12', '02:00 PM', 'Pending', 'Pre-operative cardiovascular evaluation and stress test planning.', 200.00),
('APT-10003', 'PAT-1003', 'DOC-103', 'DEP-03', '2026-10-08', '09:00 AM', 'Completed', 'Consultation for skeletal sprains and knee ligament strain.', 120.00);

-- 7. Seed Medical Records
INSERT INTO medical_records (id, patient_id, doctor_id, appointment_id, date, diagnosis, symptoms, prescription, treatment_history) VALUES
('REC-10001', 'PAT-1003', 'DOC-103', 'APT-10003', '2026-10-08', 'Grade 1 Patellar Ligament Strain', 'Mild inflammation, swelling over knee-joint cap, local muscle tightness.', '1. Ibuprofen 400mg twice daily after meals for 5 days\n2. Elastic patellar sleeve during exercises\n3. Hot compress thrice daily', 'Patient presented minor pain during running. Movement tests showed mild localized knee tenderness without tearing. Prescribed rest and recovery management.');

-- 8. Seed Invoices
INSERT INTO invoices (id, patient_id, appointment_id, amount, tax, discount, total, date, due_date, status, payment_method, paid_at) VALUES
('INV-10001', 'PAT-1001', 'APT-10001', 150.00, 12.00, 0.00, 162.00, '2026-10-01', '2026-10-15', 'Unpaid', '', NULL),
('INV-10002', 'PAT-1002', 'APT-10002', 200.00, 16.00, 10.00, 206.00, '2026-10-01', '2026-10-15', 'Unpaid', '', NULL),
('INV-10003', 'PAT-1003', 'APT-10003', 120.00, 9.60, 0.00, 129.60, '2026-10-01', '2026-10-08', 'Paid', 'Card', '2026-10-08');

-- 9. Seed Role Permissions Matrix
INSERT INTO role_permissions (role, permission_key, description, is_allowed) VALUES
('Admin', 'manage_users', 'Add, update, or remove doctors and patients', 1),
('Admin', 'manage_departments', 'Create and modify hospital departments', 1),
('Admin', 'view_reports', 'Access analytics, financials and reports', 1),
('Admin', 'backup_restore', 'Perform database backups and restorations', 1),
('Doctor', 'view_schedule', 'Access daily appointment queue', 1),
('Doctor', 'create_diagnosis', 'Publish diagnosis and prescriptions', 1),
('Doctor', 'upload_reports', 'Upload diagnostic scans and PDF lab reports', 1),
('Patient', 'book_appointments', 'Schedule doctor consultations and time slots', 1),
('Patient', 'view_medical_records', 'Review treatment history and prescriptions', 1),
('Patient', 'pay_invoices', 'Settle billing balances online or via card', 1);
