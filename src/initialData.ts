/**
 * Medicare System - Seed / Fallback Data Constants
 *
 * Matches the schema.sql seed records. Used as graceful fallback
 * when local XAMPP MySQL backend is not yet started or is offline,
 * preventing white screen crashes.
 */

import { Doctor, Patient, Appointment, MedicalRecord, Invoice, Department } from './types';

export const INITIAL_DEPARTMENTS: Department[] = [
  {
    id: 'DEP-01',
    name: 'Cardiology',
    description: 'Treatment of heart-related ailments and blood vessel complications.',
    headOfDepartment: 'Dr. Marcus Vance',
    roomNo: 'Room 301, Block B',
    status: 'Active'
  },
  {
    id: 'DEP-02',
    name: 'Neurology',
    description: 'Handling nerve system, spine, and brain diagnostics.',
    headOfDepartment: 'Dr. Clara Sterling',
    roomNo: 'Room 405, Block A',
    status: 'Active'
  },
  {
    id: 'DEP-03',
    name: 'Pediatrics',
    description: 'Comprehensive healthcare solutions for infants, toddlers, and teenagers.',
    headOfDepartment: 'Dr. Sarah Lin',
    roomNo: 'Room 102, Block C',
    status: 'Active'
  },
  {
    id: 'DEP-04',
    name: 'Orthopedics',
    description: 'Skeletal surgery, bone fractures, joints, and ligaments treatment.',
    headOfDepartment: 'Dr. Thomas Wayne',
    roomNo: 'Room 211, Block B',
    status: 'Active'
  }
];

export const INITIAL_DOCTORS: Doctor[] = [
  {
    id: 'DOC-101',
    name: 'Dr. Clara Sterling',
    email: 'dr.clara@medicare.com',
    phone: '+1 (555) 321-4921',
    specialization: 'Neurologist',
    department: 'Neurology',
    availability: ['Mon', 'Wed', 'Fri'],
    timeSlots: ['09:00 AM', '10:30 AM', '01:00 PM', '03:30 PM'],
    roomNo: 'Room 405-A',
    status: 'Active',
    bio: 'Specialist in complex neuro-imaging, neurodegenerative diseases, and brain rehabilitation systems.',
    rating: 4.9
  },
  {
    id: 'DOC-102',
    name: 'Dr. Marcus Vance',
    email: 'dr.marcus@medicare.com',
    phone: '+1 (555) 892-2311',
    specialization: 'Cardiologist',
    department: 'Cardiology',
    availability: ['Tue', 'Thu'],
    timeSlots: ['10:00 AM', '11:30 AM', '02:00 PM', '04:30 PM'],
    roomNo: 'Room 301-B',
    status: 'Active',
    bio: 'Renowned interventional cardiologist focusing on cardiac bypass therapy and rhythm correction.',
    rating: 4.8
  },
  {
    id: 'DOC-103',
    name: 'Dr. Sarah Lin',
    email: 'dr.sarah@medicare.com',
    phone: '+1 (555) 441-3921',
    specialization: 'Pediatrician',
    department: 'Pediatrics',
    availability: ['Mon', 'Tue', 'Thu'],
    timeSlots: ['09:00 AM', '11:00 AM', '02:30 PM'],
    roomNo: 'Room 102-C',
    status: 'Active',
    bio: 'Compassionate pediatric practitioner with 12 years of clinical devotion in child immunization and nutrition.',
    rating: 4.7
  }
];

export const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'PAT-1001',
    name: 'Sarah Connor',
    email: 'sarah.connor@gmail.com',
    phone: '+1 (555) 782-9901',
    gender: 'Female',
    dob: '1985-11-12',
    bloodGroup: 'A-',
    address: '425 SkyNet Way, Pasadena, California',
    status: 'Active'
  },
  {
    id: 'PAT-1002',
    name: 'John Doe',
    email: 'john.doe@yahoo.com',
    phone: '+1 (555) 123-4567',
    gender: 'Male',
    dob: '1990-05-15',
    bloodGroup: 'O+',
    address: '742 Evergreen Terrace, Springfield',
    status: 'Active'
  },
  {
    id: 'PAT-1003',
    name: 'Bruce Wayne',
    email: 'bruce.wayne@waynecorp.com',
    phone: '+1 (555) 999-1000',
    gender: 'Male',
    dob: '1982-02-19',
    bloodGroup: 'AB+',
    address: '1007 Mountain Drive, Gotham City',
    status: 'Active'
  }
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'APT-10001',
    patientId: 'PAT-1001',
    patientName: 'Sarah Connor',
    doctorId: 'DOC-101',
    doctorName: 'Dr. Clara Sterling',
    department: 'Neurology',
    date: '2026-10-15',
    timeSlot: '10:30 AM',
    status: 'Accepted',
    notes: 'Regular checkup regarding recurring localized tension headaches.',
    fee: 150
  },
  {
    id: 'APT-10002',
    patientId: 'PAT-1002',
    patientName: 'John Doe',
    doctorId: 'DOC-102',
    doctorName: 'Dr. Marcus Vance',
    department: 'Cardiology',
    date: '2026-10-12',
    timeSlot: '02:00 PM',
    status: 'Pending',
    notes: 'Pre-operative cardiovascular evaluation and stress test planning.',
    fee: 200
  },
  {
    id: 'APT-10003',
    patientId: 'PAT-1003',
    patientName: 'Bruce Wayne',
    doctorId: 'DOC-103',
    doctorName: 'Dr. Sarah Lin',
    department: 'Pediatrics',
    date: '2026-10-08',
    timeSlot: '09:00 AM',
    status: 'Completed',
    notes: 'Consultation for skeletal sprains and knee ligament strain.',
    fee: 120
  }
];

export const INITIAL_MEDICAL_RECORDS: MedicalRecord[] = [
  {
    id: 'REC-10001',
    patientId: 'PAT-1003',
    patientName: 'Bruce Wayne',
    doctorId: 'DOC-103',
    doctorName: 'Dr. Sarah Lin',
    date: '2026-10-08',
    diagnosis: 'Grade 1 Patellar Ligament Strain',
    symptoms: 'Mild inflammation, swelling over knee-joint cap, local muscle tightness.',
    prescription: '1. Ibuprofen 400mg twice daily after meals for 5 days\n2. Elastic patellar sleeve during exercises\n3. Hot compress thrice daily',
    treatmentHistory: 'Patient presented minor pain during running. Movement tests showed mild localized knee tenderness without tearing.',
    reports: [
      { name: 'patellar_ligament_mri.jpg', type: 'image/jpeg', size: '2.4 MB' }
    ]
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'INV-10001',
    patientId: 'PAT-1001',
    patientName: 'Sarah Connor',
    appointmentId: 'APT-10001',
    amount: 150,
    tax: 12,
    discount: 0,
    total: 162,
    date: '2026-10-01',
    dueDate: '2026-10-15',
    status: 'Unpaid',
    paymentMethod: ''
  },
  {
    id: 'INV-10002',
    patientId: 'PAT-1002',
    patientName: 'John Doe',
    appointmentId: 'APT-10002',
    amount: 200,
    tax: 16,
    discount: 10,
    total: 206,
    date: '2026-10-01',
    dueDate: '2026-10-15',
    status: 'Unpaid',
    paymentMethod: ''
  },
  {
    id: 'INV-10003',
    patientId: 'PAT-1003',
    patientName: 'Bruce Wayne',
    appointmentId: 'APT-10003',
    amount: 120,
    tax: 9.6,
    discount: 0,
    total: 129.6,
    date: '2026-10-01',
    dueDate: '2026-10-08',
    status: 'Paid',
    paymentMethod: 'Card',
    paidAt: '2026-10-08'
  }
];
