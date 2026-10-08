# Medicare Hospital Management System - Complete Project Documentation
## Virtual University - Final Year Project (CS619 / IT619)

---

## Part 1: Installation & Configuration Guide (XAMPP Setup)

To run the Medicare Hospital Management System locally on your machine, you will need a local server environment. **XAMPP** is the recommended choice as it packages Apache (web server), MySQL (database), and PHP together.

### Step 1: Install XAMPP
1. Download **XAMPP for Windows** (with PHP 8.x) from the official Apache Friends website: [https://www.apachefriends.org/](https://www.apachefriends.org/).
2. Run the installer and select at least **Apache**, **MySQL**, and **phpMyAdmin** during setup.
3. Finish installation and open the **XAMPP Control Panel**.
4. Click the **Start** button next to both **Apache** and **MySQL** to launch the local servers.

### Step 2: Set Up the MySQL Database
1. Open your web browser and navigate to `http://localhost/phpmyadmin`.
2. In the left-hand panel, click on **New** to create a new database.
3. Name the database exactly **`medicare_db`** and select collation `utf8mb4_general_ci`, then click **Create**.
4. Click on your newly created database in the list, then click on the **Import** tab at the top.
5. Click **Choose File** and select the database script located in this project under:
   `Database/schema.sql`
6. Scroll down to the bottom and click **Import** (or **Go**). All clinical tables and sample seed records will be generated automatically.

### Step 3: Deploy the PHP Backend
1. Locate your XAMPP installation directory (usually `C:\xampp`).
2. Inside it, navigate to the `htdocs` folder (`C:\xampp\htdocs`).
3. Create a new folder named **`medicare-backend`**.
4. Copy all content from the `Backend` directory of this project and paste it inside `C:\xampp\htdocs\medicare-backend`.
5. Verify your folder structure looks like this:
   - `C:\xampp\htdocs\medicare-backend\config\db.php`
   - `C:\xampp\htdocs\medicare-backend\api\doctors.php`
   - `C:\xampp\htdocs\medicare-backend\api\patients.php`
   - ...and so on.
6. Verify your API is live by browsing to: `http://localhost/medicare-backend/api/doctors.php`. You should receive a JSON list of all seeded doctors!

### Step 4: Configure & Run the React Frontend in VS Code
1. Open **VS Code** (Visual Studio Code).
2. Go to `File > Open Folder...` and select the **`Frontend`** folder of this project.
3. Open a terminal in VS Code (`Ctrl + ~`) and run:
   ```bash
   npm install
   ```
4. To connect the React UI directly to your local PHP backend, open the file `src/apiService.ts` and set:
   ```typescript
   export const USE_PHP_BACKEND = true;
   ```
5. Start your React developer web server:
   ```bash
   npm run dev
   ```
6. Open the printed local URL (typically `http://localhost:3000`) in your browser. The application is now fully live, routing all actions to your local XAMPP MySQL database through the PHP REST APIs!

---

## Part 2: REST API Documentation

All API requests accept and return JSON payloads. The base URL for the backend is:
`http://localhost/medicare-backend/api`

### 1. Authentication APIs
* **Login User**
  - **Endpoint**: `/auth/login.php`
  - **Method**: `POST`
  - **Request Body**:
    ```json
    { "email": "admin@medicare.com", "password": "admin123", "role": "Admin" }
    ```
  - **Success Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Login successful",
      "token": "base64_encoded_web_token_data",
      "user": { "id": "ADM-001", "name": "Admin Director", "role": "Admin", "email": "admin@medicare.com" }
    }
    ```

* **Register Patient Account**
  - **Endpoint**: `/auth/register.php`
  - **Method**: `POST`
  - **Request Body**:
    ```json
    {
      "name": "Sarah Connor",
      "email": "sarah.connor@gmail.com",
      "password": "patient123",
      "phone": "+1 (555) 782-9901",
      "gender": "Female",
      "dob": "1985-11-12",
      "blood_group": "A-",
      "address": "425 SkyNet Way, Pasadena"
    }
    ```

---

### 2. Doctors CRUD API
* **Endpoint**: `/doctors.php`
* **Fetch All Doctors**: `GET /doctors.php`
* **Fetch Specific Doctor**: `GET /doctors.php?id=DOC-101`
* **Create Doctor (Admin)**: `POST /doctors.php`
  - **Request Body**:
    ```json
    {
      "name": "Dr. Clara Sterling",
      "email": "dr.clara@medicare.com",
      "phone": "+1 (555) 321-4921",
      "specialization": "Neurologist",
      "department_id": "DEP-02",
      "availability": ["Mon", "Wed", "Fri"],
      "timeSlots": ["09:00 AM", "10:30 AM"],
      "room_no": "Room 405-A",
      "bio": "Specialist in complex neurodegenerative rehabilitation."
    }
    ```
* **Update Doctor Details**: `PUT /doctors.php`
* **Delete Doctor**: `DELETE /doctors.php` (Request body contains `{"id": "DOC-101"}`)

---

### 3. Appointments API
* **Endpoint**: `/appointments.php`
* **Fetch All Appointments**: `GET /appointments.php`
* **Filter Appointments by Role**: `GET /appointments.php?patientId=PAT-1001` or `?doctorId=DOC-101`
* **Book Appointment**: `POST /appointments.php` (Automatically compiles and creates a linked Patient invoice in the database)
* **Update Status**: `PUT /appointments.php` (Request body: `{"id": "APT-10001", "status": "Accepted"}`)
* **Reschedule**: `PUT /appointments.php` (Request body: `{"id": "APT-10001", "date": "2026-07-20", "timeSlot": "02:00 PM"}`)

---

### 4. Medical Records & Invoices APIs
* **Get Medical Records**: `GET /records.php?patientId=PAT-1001` (Lists treatment histories, diagnoses, symptoms, prescriptions and PDF uploads)
* **Create Clinical History**: `POST /records.php` (Saves a new diagnosis, list of prescriptions, and optionally marks the associated appointment as completed)
* **Get All Billing Invoices**: `GET /invoices.php`
* **Settle Invoice Payment**: `POST /invoices.php`
  - **Request Body**:
    ```json
    { "action": "pay", "id": "INV-10001", "paymentMethod": "Card" }
    ```

---

## Part 3: Entity-Relationship Diagram & Database Schematics

The `medicare_db` schema represents a clean relational model. Key relationships include:

```
  +------------------+                    +-----------------+
  |      users       | <----------------- |     admins      |
  | (Primary key: id)| 1 : 1 (user_id)    | (Admin Details) |
  +------------------+                    +-----------------+
        |          |
        | 1 : 1    | 1 : 1 (user_id)
        v          v
  +------------------+                    +-----------------+
  |     patients     | <---------------+  |     doctors     |
  | (PAT-xxxx ID)    |                 |  | (DOC-xxx ID)    |
  +------------------+                 |  +-----------------+
    | 1            | 1                 | 1   | 1
    |              |                   |     |
    | 1 : N        | 1 : N             | 1:N | 1 : N
    v              +------------+      |     |
  +------------------+          |      |     |
  |   appointments   | <--------+------+-----+
  | (APT-xxxxx ID)   |          |      |
  +------------------+          |      |
    | 1                         |      |
    | 1 : 1 (appointment_id)    v      v
    v                     +-------------------+
  +------------------+    |  medical_records  |
  |     invoices     |    | (REC-xxxxx ID)    |
  | (INV-xxxxx ID)   |    +-------------------+
  +------------------+              | 1
                                    | 1 : N
                                    v
                          +-------------------+
                          |  uploaded_reports |
                          | (Clinical files)  |
                          +-------------------+
```

### Relational Integrity (Rules & Constraints)
1. **Cascade Delete**: When a user account in the `users` table is deleted, the corresponding child record in `patients` or `doctors` is automatically wiped to maintain integrity.
2. **Nullable Reference Constraints**: Appointments and invoices refer to Departments. If a department is deleted, the foreign key column sets to `NULL` (`ON DELETE SET NULL`), preserving historical schedules and clinical data without crashing.

---

## Part 4: Virtual University Viva (Oral Defense) Q&A

*Prepare with these high-yield, Virtual University-focused questions to impress your supervisor:*

#### Q1: Why did you choose Core PHP instead of a PHP framework like Laravel or a Node.js framework?
**Answer**: Core PHP was chosen because it allows us to demonstrate a deep, low-level understanding of fundamental web concepts, including database connectivity, HTTP header configurations, and direct request-response routing. It runs natively on XAMPP/WAMP servers without requiring heavy composer packages or external installation environments, making it highly portable and compliant with university evaluation constraints.

#### Q2: How did you protect your PHP backend against SQL Injection attacks?
**Answer**: We strictly avoid building SQL query strings using string concatenation (e.g. `SELECT * WHERE email = '$email'`). Instead, we use **PDO (PHP Data Objects) Prepared Statements**. Prepared statements separate the SQL query template from the actual variable data. Placeholders (like `:email`) are compiled by the database first, and then the values are securely bound using `$stmt->bindParam()`. This makes it mathematically impossible for an attacker to inject dangerous SQL commands.

#### Q3: What is CORS and why did you configure it in `config/db.php`?
**Answer**: **CORS** stands for *Cross-Origin Resource Sharing*. By default, modern browsers block frontend websites running on one port (e.g. React running on `http://localhost:3000`) from requesting data from a backend server running on another port (e.g. Apache running on `http://localhost:80`). To allow our React app to fetch data, we send the header `Access-Control-Allow-Origin: *` from PHP, authorizing the browser to safely complete the request.

#### Q4: How is Role-Based Authorization structured in your application?
**Answer**: We enforce user roles at both the database level (using an `ENUM('Admin', 'Doctor', 'Patient')` column inside the `users` table) and at the application level. During login, the PHP API verifies the credentials, confirms that the user role matches their login form selection, and returns a secure token containing their unique role. The React client parses this role and conditional-renders pages to protect administrative features.

#### Q5: How do the database Backup and Restore features operate?
**Answer**: To make the backup feature 100% portable on any Windows/Mac server without requiring system shell commands like `mysqldump` (which are often blocked by XAMPP security policies), we built a **JSON-based snapshot engine**. 
- The **Backup** API fetches all rows from every table in the database, organizes them into a hierarchical JSON object with a timestamp, and serves it as a downloadable JSON file.
- The **Restore** API takes this JSON payload, temporarily disables foreign key checks, truncates (empties) the tables, inserts the records back in correct relational sequence, and re-enables foreign key checks.

#### Q6: Why did you use transactions (PDO `beginTransaction`, `commit`, `rollBack`)?
**Answer**: We use database transactions when creating dependent records. For example, when a patient books an appointment, we must create an appointment record and immediately auto-generate an invoice. If the database crashes mid-way after creating the appointment but before creating the invoice, we would get corrupt data. By wrapping both operations in a transaction, if any query fails, the database automatically rolls back all actions to its original clean state.

---

## Part 5: Project Report Content (VU Academic Template)

### 1. Abstract
The **Medicare System** is an integrated, full-stack Hospital Management System designed to bridge the operational gap between administrative workflows, clinical care, and patient services. Developed using a decoupled client-server architecture with React and TypeScript on the front-end, and Core PHP and MySQL on the back-end, the system provides a robust digital environment for clinical management. The system supports three user roles: Administrators (overseeing doctors, departments, invoices, and analytics), Doctors (managing daily schedules, writing clinical prescriptions, and diagnosing histories), and Patients (booking appointments, paying invoices, and reviewing medical charts).

### 2. Functional Requirements List (FRs)
- **FR1 (Authentication)**: Secure login for Admin, Doctor, and Patient; profile registration for new Patients.
- **FR2 (Doctor Management)**: Admin can execute full CRUD operations on medical practitioners.
- **FR3 (Department Management)**: Admin can organize and manage hospital wings and departments.
- **FR4 (Booking Engine)**: Patients can book, reschedule, or cancel appointments based on clinical availability.
- **FR5 (Clinical Reporting)**: Doctors can create medical records, publish diagnoses, and prescribe treatments.
- **FR6 (Billing System)**: Automatic invoice compilation upon appointment booking with secure online payment options.
- **FR7 (Analytical Reports)**: Graphical charts indicating patient demographics, departmental load, and doctor performance.
- **FR8 (Database Maintenance)**: One-click JSON-based backup and restore utility.

### 3. Non-Functional Requirements List (NFRs)
- **NFR1 (Performance)**: High API response speeds (<1.5s under average loads).
- **NFR2 (Security)**: Password encryption using standard PHP `bcrypt` hashing algorithms.
- **NFR3 (Reliability)**: 100% data preservation during complex queries using atomic transactions.
- **NFR4 (Usability)**: Adaptive responsive user interface that is easy to navigate on desktops, laptops, and tablets.
