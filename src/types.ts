/**
 * Medicare System - TypeScript Interface Definitions
 */

export type UserRole = 'Admin' | 'Doctor' | 'Patient';

export interface Doctor {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  department?: string;
  department_id?: string;
  availability: string[];
  timeSlots: string[];
  roomNo: string;
  room_no?: string;
  status: 'Active' | 'Inactive';
  bio?: string;
  rating?: number;
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender: string;
  dob: string;
  bloodGroup: string;
  blood_group?: string;
  address: string;
  status: 'Active' | 'Suspended';
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  department?: string;
  department_id?: string;
  date: string;
  timeSlot: string;
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Completed' | 'Cancelled';
  notes?: string;
  fee: number;
}

export interface MedicalReportFile {
  id?: number;
  name: string;
  type: string;
  size: string;
  downloadUrl?: string;
  path?: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  appointmentId?: string;
  date: string;
  diagnosis: string;
  symptoms: string;
  prescription: string;
  treatmentHistory: string;
  reports?: MedicalReportFile[];
}

export interface Invoice {
  id: string;
  patientId: string;
  patientName?: string;
  appointmentId?: string;
  amount: number;
  tax: number;
  discount: number;
  total: number;
  date: string;
  dueDate: string;
  status: 'Paid' | 'Unpaid' | 'Overdue';
  paymentMethod: 'Cash' | 'Card' | 'Online Transfer' | '';
  paidAt?: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  headOfDepartment: string;
  roomNo: string;
  status: 'Active' | 'Inactive';
}

export interface HospitalStats {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  totalRevenue: number;
}

export interface RolePermission {
  id: number;
  role: UserRole;
  permission_key: string;
  description: string;
  is_allowed: number;
}

export interface DetailedReports {
  patientDemographics: { name: string; value: number }[];
  departmentActivity: { name: string; value: number }[];
  monthlyRevenue: { month: string; year_month?: string; revenue: number }[];
  doctorPerformance: {
    doctorName: string;
    specialization: string;
    rating: number;
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
  }[];
  dailyAppointments: {
    date: string;
    total: number;
    completed: number;
    pending: number;
  }[];
  dateRange?: { startDate: string; endDate: string };
}
