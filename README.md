Medicare Hospital Management System
Virtual University of Pakistan — CS619 Final Year Project
Group / Student Project Submission
1. Project Overview & Architecture
The Medicare Hospital Management System is a full-stack, enterprise-grade clinical management web application developed specifically according to the Virtual University (CS619 / IT619) project requirements and guidelines.
Mandatory Technology Stack
Frontend: React 19, TypeScript, Tailwind CSS, Lucide Icons
Backend: Plain / Core PHP 8.x with PDO (PHP Data Objects) Prepared Statements (Zero heavy composer frameworks)
Database: MySQL (Relational Schema medicare_db, InnoDB engine)
Environment: XAMPP / WAMP on Windows / macOS / Linux
System Roles
Administrator: Global supervision of doctors, departments, clinical schedules, billing invoices, permissions matrix, aggregated analytical reports, and atomic database backup/restore.
Doctor: Daily consultation queue, appointment management (Accept, Reject, Complete), patient clinical history inspection, diagnosis & prescription publishing, and real report file uploads (PDF, JPG, PNG).
Patient: Self-registration, secure session login, password recovery, doctor consultation booking with conflict/double-booking protection, rescheduling, cancellation, medical charts & prescription exploration, history download, and invoice settlement via Card, Cash, or Online Transfer.
2. Directory Structure
code
Text
medicare-system/
├── Backend/                    # Core PHP RESTful Backend (to be placed in XAMPP htdocs)
│   ├── config/
│   │   ├── db.php              # PDO database connection, error logging, and CORS credentials
│   │   └── auth.php            # Session validation, RBAC enforcement, ownership checks
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.php       # Session-based authentication with session_regenerate_id()
│   │   │   ├── register.php    # Patient self-registration with BCRYPT password hashing
│   │   │   ├── logout.php      # Session invalidation & cookie clearance
│   │   │   ├── me.php          # Active session validation & profile check
│   │   │   ├── forgot_password.php # Tokenized password recovery with on-screen demo keys
│   │   │   └── reset_password.php  # SHA-256 token verification and password update
│   │   ├── doctors.php         # Doctor CRUD & specialization scheduling
│   │   ├── patients.php        # Patient profiles & account statuses
│   │   ├── departments.php     # Hospital clinical wings & departments CRUD
│   │   ├── appointments.php    # Scheduling engine with double-booking prevention & auto-invoicing
│   │   ├── records.php         # Diagnoses, prescriptions, PDF/JPG uploads, download streaming
│   │   ├── invoices.php        # Billing records & payments (Cash, Card, Online Transfer)
│   │   ├── reports.php         # Real SQL revenue, department workloads, doctor performance
│   │   ├── system.php          # Atomic JSON database snapshot backup & restore
│   │   └── permissions.php     # Role permissions configuration matrix
│   └── uploads/
│       ├── .htaccess           # Security hardening: blocks arbitrary PHP execution
│       └── reports/            # Storage directory for verified clinical report attachments
├── Database/
│   └── schema.sql              # Clean MySQL schema with tables, constraints, and seed accounts
├── Frontend/                   # Standalone React + TypeScript web application (no node_modules)
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── apiService.ts       # Unified API bridge (credentials: 'include', single base URL)
│       ├── types.ts            # TypeScript interfaces
│       ├── App.tsx             # Root application orchestrator
│       ├── main.tsx
│       ├── index.css
│       └── components/
│           ├── Navbar.tsx      # Navigation bar with role badge & demo perspective switcher
│           ├── AuthModal.tsx   # Login, registration, and forgot-password wizard
│           ├── PatientView.tsx # Patient booking, records, history export, payments
│           ├── DoctorView.tsx  # Doctor consultation queue, charts, and file upload
│           └── AdminView.tsx   # Admin overview, CRUD managers, reports, backup/restore
└── README.md                   # Complete setup, testing, and viva defense guide
3. Step-by-Step Installation Guide (XAMPP Setup)
Step 1: Install & Start XAMPP
Download and install XAMPP for Windows (with PHP 8.1 or 8.2) from https://www.apachefriends.org/.
Open the XAMPP Control Panel.
Click Start for Apache and MySQL. Both should turn green.
Step 2: Import the Database (medicare_db)
Open your web browser and navigate to http://localhost/phpmyadmin.
Click on the Databases tab or New in the left sidebar.
Enter database name: medicare_db and collation: utf8mb4_general_ci, then click Create.
Select medicare_db in the left sidebar, then click on the Import tab at the top.
Click Choose File and select Database/schema.sql from this repository.
Scroll down and click Import (or Go).
All 11 tables (users, departments, admins, doctors, patients, appointments, medical_records, invoices, uploaded_reports, password_resets, role_permissions) and seed records will be created.
Step 3: Deploy the PHP Backend
Go to your XAMPP installation directory, typically C:\xampp\htdocs.
Create a folder named medicare-backend.
Copy the entire contents of the Backend/ folder from this project and paste them into C:\xampp\htdocs\medicare-backend.
Your path structure must be:
C:\xampp\htdocs\medicare-backend\config\db.php
C:\xampp\htdocs\medicare-backend\api\doctors.php
C:\xampp\htdocs\medicare-backend\api\appointments.php
C:\xampp\htdocs\medicare-backend\uploads\reports\
Verify the API: Open your browser and visit:
http://localhost/medicare-backend/api/doctors.php
You should receive a JSON response listing the seeded doctors.
Step 4: Run the React Frontend in VS Code
Open Visual Studio Code.
Click File > Open Folder... and select the Frontend/ folder.
Open a terminal in VS Code (Ctrl + ~) and install dependencies:
code
Bash
npm install
Verify the backend API URL in Frontend/src/apiService.ts:
code
TypeScript
export const PHP_API_BASE_URL = 'http://localhost/medicare-backend/api';
Launch the developer web server:
code
Bash
npm run dev
Open your browser at http://localhost:3000 (or the port displayed in your terminal).
4. Default Demo Accounts
All accounts use industry-standard BCRYPT hashed passwords (password_hash in PHP):
Role	Email	Password	Profile ID	Purpose
Admin	admin@medicare.com	admin123	ADM-001	Full administrative control, reports, backups
Doctor	dr.clara@medicare.com	doctor123	DOC-101	Neurologist (Queue, Prescriptions, Uploads)
Doctor	dr.marcus@medicare.com	doctor123	DOC-102	Cardiologist
Doctor	dr.sarah@medicare.com	doctor123	DOC-103	Pediatrician
Patient	sarah.connor@gmail.com	patient123	PAT-1001	Booking, Medical Charts, Invoices
Patient	john.doe@yahoo.com	patient123	PAT-1002	Booking & Invoices
Patient	bruce.wayne@waynecorp.com	patient123	PAT-1003	Completed consult history & paid bills
(Tip: You can use the "Demo Accounts" quick-switcher in the top navbar to instantly test different user perspectives).
5. Security & Robustness Features
SQL Injection Prevention: All queries use PDO Prepared Statements ($stmt->prepare() with $stmt->execute([':key' => $val])). Zero raw string concatenation.
Session Authentication & Fixation Defense:
session_regenerate_id(true) is executed upon every successful login.
Sessions expire after 2 hours of inactivity (last_activity check).
Cookies use HttpOnly, SameSite=Lax, and credentials: 'include'.
CORS Security:
Instead of wildcard *, CORS headers reflect the exact trusted client origin (http://localhost:3000), allowing secure credentialed cookies.
Role-Based Access Control (RBAC):
Server-side enforcement using require_role([...]).
Patient endpoints enforce ownership ($_SESSION['profile_id']); patients cannot view or pay other users' records even if they manipulate client request payloads.
Double-Booking Prevention:
Executed inside an atomic transaction with SELECT ... FOR UPDATE row locks.
UI automatically queries action=taken_slots and disables booked time slots.
File Upload Security:
Whitelist validation of extensions (.pdf, .jpg, .jpeg, .png) and MIME types via PHP finfo_file().
Maximum size limit strictly enforced (5 MB).
Files stored with cryptographically random hex filenames (rep_...).
.htaccess in Backend/uploads/ disables PHP script execution (php_flag engine off).
Downloads streamed via authorized endpoint with ownership checks (records.php?action=download).
Production Error Masking:
display_errors is set to 0. Database details are logged via error_log() rather than exposed to clients.
Demo-Level Notes:
Run on http:// on localhost for development without SSL certificates. In production deployment, HTTPS should be enabled with session.cookie_secure = 1.
Password reset displays the generated token on screen because XAMPP does not bundle a configured SMTP mail server by default.