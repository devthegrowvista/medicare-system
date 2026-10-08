/**
 * Medicare System - Unified API Bridge Service
 *
 * Communicates with the Core PHP RESTful backend on XAMPP/WAMP.
 * Uses HTTP cookies with credentials: 'include' for session-based authentication.
 */

import {
  Doctor,
  Patient,
  Appointment,
  MedicalRecord,
  Invoice,
  Department,
  HospitalStats,
  DetailedReports,
  RolePermission
} from './types';

// The single canonical API base URL targeting the local XAMPP backend
export const PHP_API_BASE_URL = 'http://localhost/medicare-backend/api';

/**
 * Standard fetch wrapper with credentials and JSON parsing
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${PHP_API_BASE_URL}/${endpoint}`;

  const headers = new Headers(options.headers || {});
  // Only set Content-Type to application/json if body is not FormData
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Mandated by session-based authentication
    headers,
  });

  if (response.status === 401) {
    // Session expired or unauthenticated
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error (${response.status}): ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ------------------------------------------------------------------------
// AUTHENTICATION SERVICE
// ------------------------------------------------------------------------
export const authService = {
  login: async (email: string, password: string, role: string) => {
    return apiRequest<{
      success: boolean;
      message: string;
      user: { id: string; name: string; role: string; email: string };
    }>('auth/login.php', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
  },

  register: async (userData: {
    name: string;
    email: string;
    password: string;
    phone: string;
    gender?: string;
    dob?: string;
    bloodGroup?: string;
    address?: string;
  }) => {
    return apiRequest<{
      success: boolean;
      message: string;
      user: { id: string; name: string; role: string; email: string };
    }>('auth/register.php', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  logout: async () => {
    return apiRequest<{ success: boolean; message: string }>('auth/logout.php', {
      method: 'POST',
    });
  },

  me: async () => {
    return apiRequest<{
      success: boolean;
      user: { id: string; name: string; role: string; email: string };
    }>('auth/me.php');
  },

  forgotPassword: async (email: string) => {
    return apiRequest<{
      success: boolean;
      message: string;
      demo_mode?: boolean;
      recovery_code?: string;
      expires_in?: string;
    }>('auth/forgot_password.php', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword: async (token: string, newPassword: string) => {
    return apiRequest<{ success: boolean; message: string }>('auth/reset_password.php', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  },
};

// ------------------------------------------------------------------------
// DOCTORS SERVICE
// ------------------------------------------------------------------------
export const doctorService = {
  getAll: async (): Promise<Doctor[]> => {
    return apiRequest<Doctor[]>('doctors.php');
  },

  getById: async (id: string): Promise<Doctor> => {
    return apiRequest<Doctor>(`doctors.php?id=${encodeURIComponent(id)}`);
  },

  create: async (doctorData: Partial<Doctor>): Promise<any> => {
    return apiRequest('doctors.php', {
      method: 'POST',
      body: JSON.stringify(doctorData),
    });
  },

  update: async (doctorData: Partial<Doctor>): Promise<any> => {
    return apiRequest('doctors.php', {
      method: 'PUT',
      body: JSON.stringify(doctorData),
    });
  },

  delete: async (id: string): Promise<any> => {
    return apiRequest('doctors.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
};

// ------------------------------------------------------------------------
// PATIENTS SERVICE
// ------------------------------------------------------------------------
export const patientService = {
  getAll: async (): Promise<Patient[]> => {
    return apiRequest<Patient[]>('patients.php');
  },

  getById: async (id: string): Promise<Patient> => {
    return apiRequest<Patient>(`patients.php?id=${encodeURIComponent(id)}`);
  },

  create: async (patientData: Partial<Patient>): Promise<any> => {
    return apiRequest('patients.php', {
      method: 'POST',
      body: JSON.stringify(patientData),
    });
  },

  update: async (patientData: Partial<Patient>): Promise<any> => {
    return apiRequest('patients.php', {
      method: 'PUT',
      body: JSON.stringify(patientData),
    });
  },

  delete: async (id: string): Promise<any> => {
    return apiRequest('patients.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
};

// ------------------------------------------------------------------------
// DEPARTMENTS SERVICE
// ------------------------------------------------------------------------
export const departmentService = {
  getAll: async (): Promise<Department[]> => {
    return apiRequest<Department[]>('departments.php');
  },

  create: async (deptData: Partial<Department>): Promise<any> => {
    return apiRequest('departments.php', {
      method: 'POST',
      body: JSON.stringify(deptData),
    });
  },

  update: async (deptData: Partial<Department>): Promise<any> => {
    return apiRequest('departments.php', {
      method: 'PUT',
      body: JSON.stringify(deptData),
    });
  },

  delete: async (id: string): Promise<any> => {
    return apiRequest('departments.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
};

// ------------------------------------------------------------------------
// APPOINTMENTS SERVICE (WITH DOUBLE-BOOKING PREVENTION)
// ------------------------------------------------------------------------
export const appointmentService = {
  getAll: async (params?: { patientId?: string; doctorId?: string; all?: boolean }): Promise<Appointment[]> => {
    const query = new URLSearchParams();
    if (params?.patientId) query.set('patientId', params.patientId);
    if (params?.doctorId) query.set('doctorId', params.doctorId);
    if (params?.all) query.set('all', '1');
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<Appointment[]>(`appointments.php${qStr}`);
  },

  getTakenSlots: async (doctorId: string, date: string): Promise<string[]> => {
    const res = await apiRequest<{ takenSlots: string[] }>(
      `appointments.php?action=taken_slots&doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`
    );
    return res.takenSlots || [];
  },

  create: async (aptData: {
    patientId?: string;
    doctorId: string;
    date: string;
    timeSlot: string;
    notes?: string;
    fee: number;
  }): Promise<any> => {
    return apiRequest('appointments.php', {
      method: 'POST',
      body: JSON.stringify(aptData),
    });
  },

  updateStatus: async (id: string, status: string): Promise<any> => {
    return apiRequest('appointments.php', {
      method: 'PUT',
      body: JSON.stringify({ id, status }),
    });
  },

  reschedule: async (id: string, date: string, timeSlot: string): Promise<any> => {
    return apiRequest('appointments.php', {
      method: 'PUT',
      body: JSON.stringify({ id, date, timeSlot }),
    });
  },

  cancel: async (id: string): Promise<any> => {
    return apiRequest('appointments.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
};

// ------------------------------------------------------------------------
// MEDICAL RECORDS & FILE UPLOADS SERVICE
// ------------------------------------------------------------------------
export const medicalRecordService = {
  getAll: async (params?: { patientId?: string; doctorId?: string }): Promise<MedicalRecord[]> => {
    const query = new URLSearchParams();
    if (params?.patientId) query.set('patientId', params.patientId);
    if (params?.doctorId) query.set('doctorId', params.doctorId);
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<MedicalRecord[]>(`records.php${qStr}`);
  },

  create: async (payload: FormData | Record<string, any>): Promise<any> => {
    const options: RequestInit = {
      method: 'POST',
      body: payload instanceof FormData ? payload : JSON.stringify(payload),
    };
    return apiRequest('records.php', options);
  },

  getExportHistoryUrl: (patientId?: string): string => {
    const pStr = patientId ? `&patientId=${encodeURIComponent(patientId)}` : '';
    return `${PHP_API_BASE_URL}/records.php?action=export_history${pStr}`;
  },

  getFileDownloadUrl: (fileId: number): string => {
    return `${PHP_API_BASE_URL}/records.php?action=download&fileId=${fileId}`;
  },
};

// ------------------------------------------------------------------------
// INVOICES & PAYMENTS SERVICE
// ------------------------------------------------------------------------
export const invoiceService = {
  getAll: async (params?: { patientId?: string }): Promise<Invoice[]> => {
    const query = new URLSearchParams();
    if (params?.patientId) query.set('patientId', params.patientId);
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<Invoice[]>(`invoices.php${qStr}`);
  },

  create: async (invoiceData: {
    patientId: string;
    amount: number;
    discount?: number;
    dueDate?: string;
  }): Promise<any> => {
    return apiRequest('invoices.php', {
      method: 'POST',
      body: JSON.stringify(invoiceData),
    });
  },

  pay: async (
    id: string,
    paymentMethod: 'Cash' | 'Card' | 'Online Transfer',
    details?: {
      cardHolder?: string;
      cardNumber?: string;
      cardExpiry?: string;
      cardCvv?: string;
      transferRef?: string;
    }
  ): Promise<any> => {
    return apiRequest('invoices.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'pay', id, paymentMethod, ...(details || {}) }),
    });
  },
};

// ------------------------------------------------------------------------
// REPORTS & ANALYTICS SERVICE
// ------------------------------------------------------------------------
export const reportService = {
  getStats: async (): Promise<HospitalStats> => {
    return apiRequest<HospitalStats>('reports.php?action=stats');
  },

  getDetailedReports: async (startDate?: string, endDate?: string): Promise<DetailedReports> => {
    const query = new URLSearchParams();
    query.set('action', 'generate');
    if (startDate) query.set('startDate', startDate);
    if (endDate) query.set('endDate', endDate);
    return apiRequest<DetailedReports>(`reports.php?${query.toString()}`);
  },
};

// ------------------------------------------------------------------------
// SYSTEM BACKUP & RESTORE SERVICE
// ------------------------------------------------------------------------
export const systemService = {
  backupDatabase: async (): Promise<{ success: boolean; backup_json: string }> => {
    return apiRequest<{ success: boolean; backup_json: string }>('system.php');
  },

  restoreDatabase: async (backupData: any): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>('system.php', {
      method: 'POST',
      body: JSON.stringify({ backup_data: backupData }),
    });
  },
};

// ------------------------------------------------------------------------
// ROLE PERMISSIONS SERVICE
// ------------------------------------------------------------------------
export const permissionService = {
  getAll: async (): Promise<RolePermission[]> => {
    return apiRequest<RolePermission[]>('permissions.php');
  },

  update: async (id: number, isAllowed: boolean): Promise<any> => {
    return apiRequest('permissions.php', {
      method: 'PUT',
      body: JSON.stringify({ id, is_allowed: isAllowed ? 1 : 0 }),
    });
  },
};
