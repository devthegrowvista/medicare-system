/**
 * Medicare System - Hospital Administrator Portal
 *
 * Implements Complete CRUD for Doctors, Patients, and Departments,
 * Appointment Monitoring & Conflict Resolution, Billing Generation,
 * Real-time Analytics & SQL Revenue Reports, Role Permissions Matrix,
 * and Atomic Database Backup/Restore.
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Calendar,
  CreditCard,
  Building2,
  BarChart3,
  Database,
  Lock,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  DollarSign
} from 'lucide-react';
import {
  Doctor,
  Patient,
  Appointment,
  Invoice,
  Department,
  HospitalStats,
  DetailedReports,
  RolePermission
} from '../types';
import {
  reportService,
  permissionService,
  systemService
} from '../apiService';

interface AdminViewProps {
  doctors: Doctor[];
  patients: Patient[];
  appointments: Appointment[];
  invoices: Invoice[];
  departments: Department[];
  onAddDoctor: (doc: any) => Promise<void> | void;
  onUpdateDoctor: (doc: Doctor) => Promise<void> | void;
  onDeleteDoctor: (id: string) => Promise<void> | void;
  onAddPatient: (pat: any) => Promise<void> | void;
  onUpdatePatient: (pat: Patient) => Promise<void> | void;
  onDeletePatient: (id: string) => Promise<void> | void;
  onAddInvoice: (inv: any) => Promise<void> | void;
  onPayInvoice: (
    invoiceId: string,
    method: 'Cash' | 'Card' | 'Online Transfer'
  ) => Promise<void> | void;
  onAddDepartment: (dept: any) => Promise<void> | void;
  onBackupState: () => void;
  onRestoreState: (json: string) => void;
  onUpdateAppointmentStatus: (id: string, status: any) => Promise<void> | void;
}

export default function AdminView({
  doctors,
  patients,
  appointments,
  invoices,
  departments,
  onAddDoctor,
  onUpdateDoctor,
  onDeleteDoctor,
  onAddPatient,
  onUpdatePatient,
  onDeletePatient,
  onAddInvoice,
  onPayInvoice,
  onAddDepartment,
  onBackupState,
  onRestoreState,
  onUpdateAppointmentStatus,
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<
    'analytics' | 'doctors' | 'patients' | 'departments' | 'appointments' | 'billing' | 'permissions' | 'system'
  >('analytics');

  // Reports state
  const [stats, setStats] = useState<HospitalStats | null>(null);
  const [detailedReports, setDetailedReports] = useState<DetailedReports | null>(null);
  const [reportStartDate, setReportStartDate] = useState<string>(
    new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
  );
  const [reportEndDate, setReportEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isLoadingReports, setIsLoadingReports] = useState<boolean>(false);

  // Role permissions matrix
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [isLoadingPerms, setIsLoadingPerms] = useState<boolean>(false);

  // Doctor Form Modal
  const [showDoctorModal, setShowDoctorModal] = useState<boolean>(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [docName, setDocName] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [docSpec, setDocSpec] = useState('');
  const [docDept, setDocDept] = useState(departments[0]?.name || 'Cardiology');
  const [docRoom, setDocRoom] = useState('');
  const [docBio, setDocBio] = useState('');

  // Patient Form Modal
  const [showPatientModal, setShowPatientModal] = useState<boolean>(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [patName, setPatName] = useState('');
  const [patEmail, setPatEmail] = useState('');
  const [patPhone, setPatPhone] = useState('');
  const [patGender, setPatGender] = useState('Male');
  const [patDob, setPatDob] = useState('1990-01-01');
  const [patBloodGroup, setPatBloodGroup] = useState('O+');
  const [patAddress, setPatAddress] = useState('');

  // Department Form Modal
  const [showDeptModal, setShowDeptModal] = useState<boolean>(false);
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptHead, setDeptHead] = useState('');
  const [deptRoom, setDeptRoom] = useState('');

  // Manual Invoice Modal
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);
  const [adminPayMethod, setAdminPayMethod] = useState<Record<string, 'Cash' | 'Card' | 'Online Transfer'>>({});
  const [adminPayingId, setAdminPayingId] = useState<string | null>(null);
  const [invPatientId, setInvPatientId] = useState(patients[0]?.id || '');
  const [invAmount, setInvAmount] = useState('150');
  const [invDiscount, setInvDiscount] = useState('0');

  // Backup & Restore states
  const [restoreJsonInput, setRestoreJsonInput] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [systemMsg, setSystemMsg] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Load stats and detailed reports
  const refreshAnalytics = async () => {
    setIsLoadingReports(true);
    try {
      const [s, d] = await Promise.all([
        reportService.getStats(),
        reportService.getDetailedReports(reportStartDate, reportEndDate),
      ]);
      setStats(s);
      setDetailedReports(d);
    } catch {
      // Fallback calculations from props if server endpoint is busy
      const totalRev = invoices.filter((i) => i.status === 'Paid').reduce((acc, i) => acc + Number(i.total), 0);
      setStats({
        totalPatients: patients.length,
        totalDoctors: doctors.length,
        totalAppointments: appointments.length,
        totalRevenue: Math.round(totalRev * 100) / 100,
      });
    } finally {
      setIsLoadingReports(false);
    }
  };

  // Load permissions
  const refreshPermissions = async () => {
    setIsLoadingPerms(true);
    try {
      const p = await permissionService.getAll();
      setPermissions(p);
    } catch {
      setPermissions([]);
    } finally {
      setIsLoadingPerms(false);
    }
  };

  useEffect(() => {
    refreshAnalytics();
    refreshPermissions();
  }, [reportStartDate, reportEndDate]);

  // Toggle permission
  const handleTogglePermission = async (id: number, currentAllowed: number) => {
    try {
      await permissionService.update(id, currentAllowed !== 1);
      setPermissions((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_allowed: currentAllowed === 1 ? 0 : 1 } : p))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update permission.');
    }
  };

  // Open Doctor Modal
  const handleOpenDoctorModal = (doc?: Doctor) => {
    if (doc) {
      setEditingDoctor(doc);
      setDocName(doc.name);
      setDocEmail(doc.email);
      setDocPhone(doc.phone);
      setDocSpec(doc.specialization);
      setDocDept(doc.department || 'Cardiology');
      setDocRoom(doc.roomNo);
      setDocBio(doc.bio || '');
    } else {
      setEditingDoctor(null);
      setDocName('');
      setDocEmail('');
      setDocPhone('');
      setDocSpec('');
      setDocDept(departments[0]?.name || 'Cardiology');
      setDocRoom('Room 101');
      setDocBio('');
    }
    setShowDoctorModal(true);
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDoctor) {
        await onUpdateDoctor({
          ...editingDoctor,
          name: docName,
          phone: docPhone,
          specialization: docSpec,
          department: docDept,
          roomNo: docRoom,
          bio: docBio,
        });
      } else {
        await onAddDoctor({
          name: docName,
          email: docEmail,
          phone: docPhone,
          specialization: docSpec,
          department: docDept,
          roomNo: docRoom,
          bio: docBio,
        });
      }
      setShowDoctorModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save doctor.');
    }
  };

  // Open Patient Modal
  const handleOpenPatientModal = (pat?: Patient) => {
    if (pat) {
      setEditingPatient(pat);
      setPatName(pat.name);
      setPatEmail(pat.email);
      setPatPhone(pat.phone);
      setPatGender(pat.gender);
      setPatDob(pat.dob);
      setPatBloodGroup(pat.bloodGroup);
      setPatAddress(pat.address);
    } else {
      setEditingPatient(null);
      setPatName('');
      setPatEmail('');
      setPatPhone('');
      setPatGender('Male');
      setPatDob('1990-01-01');
      setPatBloodGroup('O+');
      setPatAddress('');
    }
    setShowPatientModal(true);
  };

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPatient) {
        await onUpdatePatient({
          ...editingPatient,
          name: patName,
          phone: patPhone,
          gender: patGender,
          dob: patDob,
          bloodGroup: patBloodGroup,
          address: patAddress,
        });
      } else {
        await onAddPatient({
          name: patName,
          email: patEmail,
          phone: patPhone,
          gender: patGender,
          dob: patDob,
          bloodGroup: patBloodGroup,
          address: patAddress,
        });
      }
      setShowPatientModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save patient.');
    }
  };

  // Save Department
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onAddDepartment({
        name: deptName,
        description: deptDesc,
        headOfDepartment: deptHead,
        roomNo: deptRoom,
      });
      setShowDeptModal(false);
      setDeptName('');
      setDeptDesc('');
      setDeptHead('');
      setDeptRoom('');
    } catch (err: any) {
      alert(err.message || 'Failed to create department.');
    }
  };

  // Save Invoice
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onAddInvoice({
        patientId: invPatientId,
        amount: parseFloat(invAmount),
        discount: parseFloat(invDiscount) || 0,
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      });
      setShowInvoiceModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to generate invoice.');
    }
  };

  // Perform Restore
  const handlePerformRestore = async () => {
    if (!restoreJsonInput.trim()) {
      alert('Please paste a valid JSON database backup payload.');
      return;
    }
    setIsRestoring(true);
    setSystemMsg(null);
    try {
      await systemService.restoreDatabase(restoreJsonInput);
      setSystemMsg('Database restored successfully from backup package.');
      setRestoreJsonInput('');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setSystemMsg(`Restore error: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* Admin Header */}
      <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Hospital Administration</span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Hospital Control Center</h1>
          <p className="text-xs text-slate-500 mt-1">
            Global management portal for doctors, departments, clinical schedules, billing, and system operations.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('analytics')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5 text-indigo-600" />
            Refresh Analytics
          </button>
          <button
            onClick={onBackupState}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700"
          >
            <Download className="h-3.5 w-3.5" />
            Backup Database
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 flex overflow-x-auto rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
        {[
          { id: 'analytics', label: 'Reports & Analytics', icon: BarChart3 },
          { id: 'doctors', label: `Doctors (${doctors.length})`, icon: Users },
          { id: 'patients', label: `Patients (${patients.length})`, icon: Users },
          { id: 'departments', label: `Departments (${departments.length})`, icon: Building2 },
          { id: 'appointments', label: `Appointments (${appointments.length})`, icon: Calendar },
          { id: 'billing', label: `Invoices (${invoices.length})`, icon: CreditCard },
          { id: 'permissions', label: 'Role Permissions', icon: Lock },
          { id: 'system', label: 'Backup & Restore', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2.5 transition-all ${
                activeTab === tab.id ? 'bg-white text-indigo-700 shadow' : 'hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ---------------- TAB 1: REPORTS & ANALYTICS ---------------- */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Registered Patients</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats?.totalPatients || patients.length}</p>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">Active Medical Profiles</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Medical Doctors</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats?.totalDoctors || doctors.length}</p>
              <p className="text-[11px] text-indigo-600 font-medium mt-1">Across {departments.length} Departments</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Total Consultations</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats?.totalAppointments || appointments.length}</p>
              <p className="text-[11px] text-blue-600 font-medium mt-1">Tracked in Database</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Settled Revenue (SQL Paid)</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                ${(stats?.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Real database invoices sum</p>
            </div>
          </div>

          {/* Date Filter Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">Filter Date Range:</span>
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                className="rounded-lg border border-slate-200 p-1.5 text-xs text-slate-700"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                className="rounded-lg border border-slate-200 p-1.5 text-xs text-slate-700"
              />
              <button
                onClick={refreshAnalytics}
                className="rounded-lg bg-indigo-50 text-indigo-700 px-3 py-1.5 text-xs font-bold border border-indigo-200 hover:bg-indigo-100"
              >
                Apply Range
              </button>
            </div>
            {isLoadingReports && <span className="text-xs text-indigo-600 font-medium animate-pulse">Recalculating...</span>}
          </div>

          {/* Real Monthly Revenue & Department Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Revenue Chart */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-1">Monthly Settled Revenue</h3>
              <p className="text-xs text-slate-500 mb-4">Real SQL aggregation from Paid hospital invoices</p>

              <div className="space-y-3">
                {(detailedReports?.monthlyRevenue || []).map((m) => {
                  const maxRev = Math.max(...(detailedReports?.monthlyRevenue.map((r) => r.revenue) || [1000]));
                  const pct = Math.min(100, Math.round((m.revenue / (maxRev || 1)) * 100));
                  return (
                    <div key={m.month}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700">{m.month}</span>
                        <span className="font-bold text-emerald-600">${Number(m.revenue).toFixed(2)}</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Department Activity */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-1">Department Consultation Load</h3>
              <p className="text-xs text-slate-500 mb-4">Volume of appointments distributed across wings</p>

              <div className="space-y-3">
                {(detailedReports?.departmentActivity || []).map((dept) => {
                  const maxVal = Math.max(...(detailedReports?.departmentActivity.map((d) => d.value) || [10]));
                  const pct = Math.min(100, Math.round((dept.value / (maxVal || 1)) * 100));
                  return (
                    <div key={dept.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700">{dept.name}</span>
                        <span className="font-bold text-slate-900">{dept.value} bookings</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Doctor Performance Report Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Physician Performance Matrix</h3>
            <p className="text-xs text-slate-500 mb-4">Completed consultations, rating benchmarks, and workloads</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">Physician Name</th>
                    <th className="py-3 px-4">Specialization</th>
                    <th className="py-3 px-4">Total Bookings</th>
                    <th className="py-3 px-4">Completed Consultations</th>
                    <th className="py-3 px-4">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(detailedReports?.doctorPerformance || []).map((doc) => (
                    <tr key={doc.doctorName} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">{doc.doctorName}</td>
                      <td className="py-3 px-4 text-slate-600">{doc.specialization}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{doc.totalAppointments}</td>
                      <td className="py-3 px-4 text-emerald-600 font-bold">{doc.completedAppointments}</td>
                      <td className="py-3 px-4 text-amber-600 font-bold">★ {doc.rating || 4.8}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 2: DOCTORS CRUD ---------------- */}
      {activeTab === 'doctors' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">Hospital Medical Practitioners</h2>
              <p className="text-xs text-slate-500">Manage clinical staff profiles, credentials, and room assignments</p>
            </div>
            <button
              onClick={() => handleOpenDoctorModal()}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Add New Doctor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="font-mono text-xs font-bold text-slate-500">{doc.id}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      doc.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {doc.status}
                  </span>
                </div>

                <div className="my-3">
                  <h3 className="text-sm font-bold text-slate-900">{doc.name}</h3>
                  <p className="text-xs font-medium text-indigo-600">{doc.specialization}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Dept: {doc.department} • Room: {doc.roomNo}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">Phone: {doc.phone}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">Email: {doc.email}</p>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => handleOpenDoctorModal(doc)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteDoctor(doc.id)}
                    className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3 w-3" />
                    Deactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- TAB 3: PATIENTS CRUD ---------------- */}
      {activeTab === 'patients' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">Patient Directory</h2>
              <p className="text-xs text-slate-500">Manage registered patient profiles and account statuses</p>
            </div>
            <button
              onClick={() => handleOpenPatientModal()}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Register Patient
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((pat) => (
              <div key={pat.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="font-mono text-xs font-bold text-slate-500">{pat.id}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      pat.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {pat.status}
                  </span>
                </div>

                <div className="my-3">
                  <h3 className="text-sm font-bold text-slate-900">{pat.name}</h3>
                  <p className="text-xs text-slate-500">
                    {pat.gender} • DOB: {pat.dob} • Blood: <span className="font-bold text-rose-600">{pat.bloodGroup}</span>
                  </p>
                  <p className="text-xs text-slate-600 mt-1">Phone: {pat.phone}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">Email: {pat.email}</p>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => handleOpenPatientModal(pat)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => onDeletePatient(pat.id)}
                    className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3 w-3" />
                    Suspend
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- TAB 4: DEPARTMENTS CRUD ---------------- */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">Hospital Departments & Clinical Wings</h2>
              <p className="text-xs text-slate-500">Organize medical divisions and departmental supervision</p>
            </div>
            <button
              onClick={() => setShowDeptModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Create Department
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <div key={dept.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="font-mono text-xs font-bold text-slate-500">{dept.id}</span>
                  <span className="font-bold text-emerald-600 text-xs">{dept.status}</span>
                </div>

                <div className="my-3">
                  <h3 className="text-base font-bold text-slate-900">{dept.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{dept.description}</p>
                  <p className="text-xs font-semibold text-indigo-700 mt-2">Head: {dept.headOfDepartment}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Location: {dept.roomNo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- TAB 5: APPOINTMENTS ---------------- */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-800">Master Consultation Schedules ({appointments.length})</h2>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                  <th className="py-3.5 px-4">Appointment #</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Doctor</th>
                  <th className="py-3.5 px-4">Date & Slot</th>
                  <th className="py-3.5 px-4">Fee</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Admin Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{apt.id}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{apt.patientName}</td>
                    <td className="py-3 px-4 text-slate-700">{apt.doctorName}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {apt.date} • {apt.timeSlot}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-600">${apt.fee}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          apt.status === 'Accepted'
                            ? 'bg-emerald-50 text-emerald-700'
                            : apt.status === 'Completed'
                            ? 'bg-blue-50 text-blue-700'
                            : apt.status === 'Pending'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {apt.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <select
                        value={apt.status}
                        onChange={(e) => onUpdateAppointmentStatus(apt.id, e.target.value as any)}
                        className="rounded border border-slate-200 p-1 text-[11px] font-medium text-slate-700"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- TAB 6: BILLING & INVOICES ---------------- */}
      {activeTab === 'billing' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">Billing Records & Invoices</h2>
              <p className="text-xs text-slate-500">Track paid and outstanding patient billing</p>
            </div>
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Generate Manual Invoice
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Tax</th>
                  <th className="py-3.5 px-4">Total</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Method / Paid Date</th>
                  <th className="py-3.5 px-4">Record payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{inv.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{inv.patientName || inv.patientId}</td>
                    <td className="py-3 px-4 text-slate-600">{inv.date}</td>
                    <td className="py-3 px-4 text-slate-700">${Number(inv.amount).toFixed(2)}</td>
                    <td className="py-3 px-4 text-slate-500">${Number(inv.tax).toFixed(2)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">${Number(inv.total).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          inv.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700'
                            : inv.status === 'Overdue'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {inv.paymentMethod ? `${inv.paymentMethod} (${inv.paidAt || 'Recorded'})` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {inv.status !== 'Paid' ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            className="rounded-lg border border-slate-200 px-1.5 py-1 text-[10px]"
                            value={adminPayMethod[inv.id] || 'Cash'}
                            onChange={(e) =>
                              setAdminPayMethod((p) => ({
                                ...p,
                                [inv.id]: e.target.value as 'Cash' | 'Card' | 'Online Transfer',
                              }))
                            }
                          >
                            <option value="Cash">Cash</option>
                            <option value="Card">Card</option>
                            <option value="Online Transfer">Online Transfer</option>
                          </select>
                          <button
                            type="button"
                            disabled={adminPayingId === inv.id}
                            onClick={async () => {
                              setAdminPayingId(inv.id);
                              try {
                                await onPayInvoice(inv.id, adminPayMethod[inv.id] || 'Cash');
                              } catch (err: any) {
                                alert(err?.message || 'Failed to record payment.');
                              } finally {
                                setAdminPayingId(null);
                              }
                            }}
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {adminPayingId === inv.id ? '...' : 'Record'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">Settled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- TAB 7: ROLE PERMISSIONS MATRIX ---------------- */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Role Permissions Matrix</h2>
            <p className="text-xs text-slate-500">
              Admin feature to toggle and configure granular capabilities per user role.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                  <th className="py-3.5 px-4">Target Role</th>
                  <th className="py-3.5 px-4">Permission Key</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 text-right">Status / Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {permissions.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-indigo-700">{p.role}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">{p.permission_key}</td>
                    <td className="py-3 px-4 text-slate-600">{p.description}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleTogglePermission(p.id, p.is_allowed)}
                        className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                          p.is_allowed === 1
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {p.is_allowed === 1 ? 'Enabled ✓' : 'Disabled ✗'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- TAB 8: BACKUP & RESTORE ---------------- */}
      {activeTab === 'system' && (
        <div className="max-w-2xl space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-1">Export Database Backup</h2>
            <p className="text-xs text-slate-500 mb-4">
              Download a complete JSON database dump containing users, departments, doctors, patients, appointments, medical records, invoices, and permissions.
            </p>

            <button
              onClick={onBackupState}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700"
            >
              <Download className="h-4 w-4" />
              Download Snapshot File (.json)
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-1">Restore Database from Snapshot</h2>
            <p className="text-xs text-slate-500 mb-4">
              Paste the exported JSON content below. The restoration runs in an atomic database transaction with foreign key toggles.
            </p>

            {systemMsg && (
              <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs font-medium text-indigo-900">
                {systemMsg}
              </div>
            )}

            <textarea
              rows={6}
              value={restoreJsonInput}
              onChange={(e) => setRestoreJsonInput(e.target.value)}
              placeholder="Paste JSON dump content here..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs font-mono text-slate-900 bg-slate-50/50 mb-4 focus:bg-white focus:outline-none"
            />

            <button
              onClick={handlePerformRestore}
              disabled={isRestoring || !restoreJsonInput.trim()}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-rose-700 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {isRestoring ? 'Restoring Tables...' : 'Execute Database Restore'}
            </button>
          </div>
        </div>
      )}

      {/* ---------------- DOCTOR MODAL ---------------- */}
      {showDoctorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-800 mb-4">
              {editingDoctor ? 'Update Doctor Profile' : 'Register New Medical Practitioner'}
            </h3>

            <form onSubmit={handleSaveDoctor} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Doctor Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Sarah Jenkins"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                />
              </div>

              {!editingDoctor && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Account Email</label>
                  <input
                    type="email"
                    required
                    placeholder="doctor@medicare.com"
                    value={docEmail}
                    onChange={(e) => setDocEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Phone</label>
                  <input
                    type="text"
                    required
                    value={docPhone}
                    onChange={(e) => setDocPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Room / Clinic No</label>
                  <input
                    type="text"
                    required
                    value={docRoom}
                    onChange={(e) => setDocRoom(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Specialization</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Interventional Cardiology"
                    value={docSpec}
                    onChange={(e) => setDocSpec(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Department</label>
                  <select
                    value={docDept}
                    onChange={(e) => setDocDept(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Bio / Qualifications</label>
                <textarea
                  rows={2}
                  value={docBio}
                  onChange={(e) => setDocBio(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDoctorModal(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
                >
                  Save Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- PATIENT MODAL ---------------- */}
      {showPatientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-4">
              {editingPatient ? 'Update Patient Record' : 'Register New Patient Profile'}
            </h3>

            <form onSubmit={handleSavePatient} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={patName}
                    onChange={(e) => setPatName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                  />
                </div>
                {!editingPatient && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
                    <input
                      type="email"
                      required
                      value={patEmail}
                      onChange={(e) => setPatEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Phone</label>
                  <input
                    type="text"
                    required
                    value={patPhone}
                    onChange={(e) => setPatPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Gender</label>
                  <select
                    value={patGender}
                    onChange={(e) => setPatGender(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Blood Group</label>
                  <select
                    value={patBloodGroup}
                    onChange={(e) => setPatBloodGroup(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Address</label>
                <input
                  type="text"
                  required
                  value={patAddress}
                  onChange={(e) => setPatAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPatientModal(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
                >
                  Save Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- DEPARTMENT MODAL ---------------- */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-4">Create New Hospital Department</h3>

            <form onSubmit={handleSaveDepartment} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Department Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ophthalmology"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Head of Department</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Robert Carter"
                  value={deptHead}
                  onChange={(e) => setDeptHead(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Room / Wing</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wing D, Floor 3"
                  value={deptRoom}
                  onChange={(e) => setDeptRoom(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
                >
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- INVOICE MODAL ---------------- */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-4">Generate Manual Patient Invoice</h3>

            <form onSubmit={handleSaveInvoice} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Select Patient</label>
                <select
                  value={invPatientId}
                  onChange={(e) => setInvPatientId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Base Amount ($)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={invAmount}
                    onChange={(e) => setInvAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Discount ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={invDiscount}
                    onChange={(e) => setInvDiscount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Calculated Tax (8%):</span>
                  <span>${(parseFloat(invAmount || '0') * 0.08).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 mt-2 pt-2">
                  <span>Grand Total:</span>
                  <span className="text-emerald-600">
                    $
                    {(
                      parseFloat(invAmount || '0') * 1.08 -
                      parseFloat(invDiscount || '0')
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
                >
                  Issue Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
