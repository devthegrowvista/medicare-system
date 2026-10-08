/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import PatientView from './components/PatientView';
import DoctorView from './components/DoctorView';
import AdminView from './components/AdminView';
import AuthModal from './components/AuthModal';
import { Doctor, Patient, Appointment, MedicalRecord, Invoice, Department, UserRole } from './types';
import {
  INITIAL_DEPARTMENTS,
  INITIAL_DOCTORS,
  INITIAL_PATIENTS,
  INITIAL_APPOINTMENTS,
  INITIAL_MEDICAL_RECORDS,
  INITIAL_INVOICES
} from './initialData';
import {
  authService,
  doctorService,
  patientService,
  departmentService,
  appointmentService,
  medicalRecordService,
  invoiceService,
  systemService,
  PHP_API_BASE_URL
} from './apiService';
import { AlertCircle, RefreshCw, Server } from 'lucide-react';

export default function App() {
  // Session / Authentication state
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [activeUserId, setActiveUserId] = useState<string>('');
  const [activeUserName, setActiveUserName] = useState<string>('');

  // Main Medicare database pools (seeded with graceful fallback data)
  const [departments, setDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS);
  const [doctors, setDoctors] = useState<Doctor[]>(INITIAL_DOCTORS);
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>(INITIAL_MEDICAL_RECORDS);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);

  // Connection & loading state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  /**
   * Load all hospital data pools from the Core PHP backend
   */
  const loadAllData = useCallback(async () => {
    try {
      setBackendError(null);
      let errorCount = 0;
      const [deptsData, docsData, patsData, aptsData, recsData, invsData] = await Promise.all([
        departmentService.getAll().catch(() => { errorCount++; return []; }),
        doctorService.getAll().catch(() => { errorCount++; return []; }),
        patientService.getAll().catch(() => { errorCount++; return []; }),
        appointmentService.getAll().catch(() => { errorCount++; return []; }),
        medicalRecordService.getAll().catch(() => { errorCount++; return []; }),
        invoiceService.getAll().catch(() => { errorCount++; return []; }),
      ]);

      if (deptsData.length) setDepartments(deptsData);
      if (docsData.length) setDoctors(docsData);
      if (patsData.length) setPatients(patsData);
      if (Array.isArray(aptsData)) setAppointments(aptsData);
      if (Array.isArray(recsData)) setMedicalRecords(recsData);
      if (Array.isArray(invsData)) setInvoices(invsData);

      if (errorCount === 6) {
        setBackendError(
          `Unable to reach local PHP backend at ${PHP_API_BASE_URL}. Ensure Apache and MySQL are running in XAMPP.`
        );
      } else if (errorCount > 0) {
        setBackendError(
          `Some hospital APIs failed (${errorCount}/6). Showing available records. Check XAMPP Apache/MySQL.`
        );
      }
    } catch (err: any) {
      console.warn('Backend load notice:', err.message);
      setBackendError(
        `Unable to reach local PHP backend at ${PHP_API_BASE_URL}. Ensure Apache and MySQL are running in XAMPP.`
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Check active session and fetch initial data on mount
   */
  useEffect(() => {
    authService
      .me()
      .then((res) => {
        if (res.success && res.user) {
          setCurrentRole(res.user.role as UserRole);
          setActiveUserId(res.user.id);
          setActiveUserName(res.user.name);
        }
      })
      .catch(() => {
        // No active session, user will see the AuthModal
      })
      .finally(() => {
        loadAllData();
      });
  }, [loadAllData]);

  // Authentication Handlers
  const handleLoginSuccess = (role: UserRole, id: string, name: string) => {
    setCurrentRole(role);
    setActiveUserId(id);
    setActiveUserName(name);
    loadAllData();
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignored
    }
    setCurrentRole(null);
    setActiveUserId('');
    setActiveUserName('');
  };

  // Demo direct perspective switcher (switches active view or signs in)
  const handleDemoChangeRole = async (role: UserRole, targetId?: string) => {
    // Attempt automatic session switch via predefined test users
    try {
      let email = 'admin@medicare.com';
      let pass = 'admin123';
      if (role === 'Doctor') {
        const doc = doctors.find((d) => d.id === targetId) || doctors[0];
        email = doc?.email || 'dr.clara@medicare.com';
        pass = 'doctor123';
      } else if (role === 'Patient') {
        const pat = patients.find((p) => p.id === targetId) || patients[0];
        email = pat?.email || 'sarah.connor@gmail.com';
        pass = 'patient123';
      }

      const res = await authService.login(email, pass, role);
      if (res.success && res.user) {
        handleLoginSuccess(role, res.user.id, res.user.name);
        return;
      }
    } catch {
      // Fallback state update
    }

    setCurrentRole(role);
    if (role === 'Admin') {
      setActiveUserId('ADM-001');
      setActiveUserName('Admin Director');
    } else if (role === 'Doctor') {
      const doc = doctors.find((d) => d.id === targetId) || doctors[0];
      setActiveUserId(doc?.id || 'DOC-101');
      setActiveUserName(doc?.name || 'Dr. Clara Sterling');
    } else {
      const pat = patients.find((p) => p.id === targetId) || patients[0];
      setActiveUserId(pat?.id || 'PAT-1001');
      setActiveUserName(pat?.name || 'Sarah Connor');
    }
    loadAllData();
  };

  // ------------------------------------------------------------------------
  // PATIENT ACTIONS
  // ------------------------------------------------------------------------
  const handleBookAppointment = async (aptData: any) => {
    await appointmentService.create(aptData);
    await loadAllData();
  };

  const handleCancelAppointment = async (id: string) => {
    await appointmentService.cancel(id);
    await loadAllData();
  };

  const handleRescheduleAppointment = async (id: string, date: string, timeSlot: string) => {
    await appointmentService.reschedule(id, date, timeSlot);
    await loadAllData();
  };

  const handlePayInvoice = async (
    invoiceId: string,
    method: 'Cash' | 'Card' | 'Online Transfer',
    details?: {
      cardHolder?: string;
      cardNumber?: string;
      cardExpiry?: string;
      cardCvv?: string;
      transferRef?: string;
    }
  ) => {
    try {
      await invoiceService.pay(invoiceId, method, details);
    } catch (err: any) {
      console.warn('Backend payment notification:', err?.message);
    }
    // Optimistically update invoice to Paid with chosen payment method
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              status: 'Paid',
              paymentMethod: method,
              paidAt: new Date().toISOString().slice(0, 10),
            }
          : inv
      )
    );
  };

  const handleUpdatePatientProfile = async (pat: Patient) => {
    await patientService.update(pat);
    if (activeUserId === pat.id) {
      setActiveUserName(pat.name);
    }
    await loadAllData();
  };

  // ------------------------------------------------------------------------
  // DOCTOR ACTIONS
  // ------------------------------------------------------------------------
  const handleAcceptAppointment = async (id: string) => {
    await appointmentService.updateStatus(id, 'Accepted');
    await loadAllData();
  };

  const handleRejectAppointment = async (id: string) => {
    await appointmentService.updateStatus(id, 'Rejected');
    await loadAllData();
  };

  const handleCompleteAppointment = async (id: string) => {
    await appointmentService.updateStatus(id, 'Completed');
    await loadAllData();
  };

  const handleAddMedicalRecord = async (formDataOrJson: any) => {
    await medicalRecordService.create(formDataOrJson);
    await loadAllData();
  };

  // ------------------------------------------------------------------------
  // ADMIN ACTIONS
  // ------------------------------------------------------------------------
  const handleAddDoctor = async (docData: any) => {
    await doctorService.create(docData);
    await loadAllData();
  };

  const handleUpdateDoctor = async (doc: Doctor) => {
    await doctorService.update(doc);
    await loadAllData();
  };

  const handleDeleteDoctor = async (id: string) => {
    await doctorService.delete(id);
    await loadAllData();
  };

  const handleAddPatientFromAdmin = async (patData: any) => {
    await patientService.create(patData);
    await loadAllData();
  };

  const handleUpdatePatientFromAdmin = async (pat: Patient) => {
    await patientService.update(pat);
    await loadAllData();
  };

  const handleDeletePatient = async (id: string) => {
    await patientService.delete(id);
    await loadAllData();
  };

  const handleAddInvoiceFromAdmin = async (invData: any) => {
    await invoiceService.create(invData);
    await loadAllData();
  };

  const handleAddDepartmentFromAdmin = async (deptData: any) => {
    await departmentService.create(deptData);
    await loadAllData();
  };

  const handleUpdateAppointmentStatusDirect = async (id: string, status: any) => {
    await appointmentService.updateStatus(id, status);
    await loadAllData();
  };

  // ------------------------------------------------------------------------
  // SYSTEM BACKUP & RESTORE ACTIONS
  // ------------------------------------------------------------------------
  const handleBackupDatabase = async () => {
    try {
      const res = await systemService.backupDatabase();
      const blob = new Blob([res.backup_json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Medicare_Database_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Backup failed: ${err.message}`);
    }
  };

  const handleRestoreDatabase = async (jsonContentString: string) => {
    await systemService.restoreDatabase(jsonContentString);
    await loadAllData();
  };

  const activeDoctorObj = doctors.find((d) => d.id === activeUserId) || doctors[0] || INITIAL_DOCTORS[0];
  const activePatientObj = patients.find((p) => p.id === activeUserId) || patients[0] || INITIAL_PATIENTS[0];

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-800 flex flex-col justify-between">
      <div>
        {/* Connection Notice / XAMPP status banner */}
        {backendError && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 shrink-0 text-amber-600" />
                <span className="font-semibold">Local XAMPP Server Notice:</span>
                <span>{backendError}</span>
              </div>
              <button
                onClick={() => loadAllData()}
                className="flex items-center gap-1 rounded bg-amber-200/60 px-2 py-0.5 font-bold hover:bg-amber-200 text-amber-800"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Global Navigation Bar */}
        {currentRole && (
          <Navbar
            currentRole={currentRole}
            onChangeRole={handleDemoChangeRole}
            activeUserName={activeUserName}
            onLogout={handleLogout}
            allDoctors={doctors.map((d) => ({ id: d.id, name: d.name }))}
            allPatients={patients.map((p) => ({ id: p.id, name: p.name }))}
            activeUserId={activeUserId}
          />
        )}

        {/* Main Content View Container */}
        <main className="pb-16">
          {!currentRole ? (
            <AuthModal
              doctors={doctors}
              patients={patients}
              onLoginSuccess={handleLoginSuccess}
              onRegisterPatient={patientService.create}
            />
          ) : (
            <div>
              {currentRole === 'Patient' && (
                <PatientView
                  patient={activePatientObj}
                  doctors={doctors}
                  appointments={appointments}
                  medicalRecords={medicalRecords}
                  invoices={invoices}
                  onBookAppointment={handleBookAppointment}
                  onCancelAppointment={handleCancelAppointment}
                  onRescheduleAppointment={handleRescheduleAppointment}
                  onPayInvoice={handlePayInvoice}
                  onUpdateProfile={handleUpdatePatientProfile}
                  departments={departments.filter((d) => d.status === 'Active').map((d) => d.name)}
                />
              )}

              {currentRole === 'Doctor' && (
                <DoctorView
                  doctor={activeDoctorObj}
                  appointments={appointments}
                  medicalRecords={medicalRecords}
                  patients={patients}
                  onAcceptAppointment={handleAcceptAppointment}
                  onRejectAppointment={handleRejectAppointment}
                  onCompleteAppointment={handleCompleteAppointment}
                  onAddMedicalRecord={handleAddMedicalRecord}
                />
              )}

              {currentRole === 'Admin' && (
                <AdminView
                  doctors={doctors}
                  patients={patients}
                  appointments={appointments}
                  invoices={invoices}
                  departments={departments}
                  onAddDoctor={handleAddDoctor}
                  onUpdateDoctor={handleUpdateDoctor}
                  onDeleteDoctor={handleDeleteDoctor}
                  onAddPatient={handleAddPatientFromAdmin}
                  onUpdatePatient={handleUpdatePatientFromAdmin}
                  onDeletePatient={handleDeletePatient}
                  onAddInvoice={handleAddInvoiceFromAdmin}
                  onPayInvoice={handlePayInvoice}
                  onAddDepartment={handleAddDepartmentFromAdmin}
                  onBackupState={handleBackupDatabase}
                  onRestoreState={handleRestoreDatabase}
                  onUpdateAppointmentStatus={handleUpdateAppointmentStatusDirect}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Hospital Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8 space-y-1.5">
          <p className="text-xs font-semibold text-slate-500">
            Medicare Hospital Management System — Virtual University CS619 Final Year Project
          </p>
          <p className="text-[11px] text-slate-400">
            Supervisor: Muhammad Hashir Khan | MS Team: hashir.khan9996@outlook.com | Email: hashir.khan@vu.edu.pk
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            Stack: React (Frontend) • Core PHP & PDO (Backend) • MySQL (Database) • XAMPP / WAMP
          </p>
        </div>
      </footer>
    </div>
  );
}
