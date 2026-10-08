/**
 * Medicare System - Doctor Workplace Portal
 *
 * Implements Appointment Queue, Consultation handling (Accept, Reject, Complete),
 * Patient History inspection, Diagnosis & Prescription publishing,
 * and real Medical Report file uploads (PDF/JPG/PNG).
 */

import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  FileText,
  Upload,
  User,
  Plus,
  AlertCircle
} from 'lucide-react';
import { Doctor, Patient, Appointment, MedicalRecord } from '../types';
import { medicalRecordService } from '../apiService';

interface DoctorViewProps {
  doctor: Doctor;
  appointments: Appointment[];
  medicalRecords: MedicalRecord[];
  patients: Patient[];
  onAcceptAppointment: (id: string) => Promise<void> | void;
  onRejectAppointment: (id: string) => Promise<void> | void;
  onCompleteAppointment: (id: string) => Promise<void> | void;
  onAddMedicalRecord: (recData: any) => Promise<void> | void;
}

export default function DoctorView({
  doctor,
  appointments,
  medicalRecords,
  patients,
  onAcceptAppointment,
  onRejectAppointment,
  onCompleteAppointment,
  onAddMedicalRecord,
}: DoctorViewProps) {
  const [activeTab, setActiveTab] = useState<'queue' | 'consultation' | 'patients'>('queue');

  // Consultation chart states
  const [targetPatientId, setTargetPatientId] = useState<string>(patients[0]?.id || '');
  const [linkedAptId, setLinkedAptId] = useState<string>('');
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [symptoms, setSymptoms] = useState<string>('');
  const [prescription, setPrescription] = useState<string>('');
  const [treatmentHistory, setTreatmentHistory] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const [isSubmittingRecord, setIsSubmittingRecord] = useState<boolean>(false);
  const [chartSuccessMsg, setChartSuccessMsg] = useState<string | null>(null);
  const [chartErrorMsg, setChartErrorMsg] = useState<string | null>(null);

  // Filter doctor's appointments
  const myAppointments = appointments.filter((a) => a.doctorId === doctor.id);
  const pendingAppointments = myAppointments.filter((a) => a.status === 'Pending');
  const activeQueue = myAppointments.filter((a) => a.status === 'Accepted');

  // Filter doctor's clinical charts
  const myRecords = medicalRecords.filter((r) => r.doctorId === doctor.id);

  // Quick initiate consultation from an accepted appointment
  const startConsultationForApt = (apt: Appointment) => {
    setTargetPatientId(apt.patientId);
    setLinkedAptId(apt.id);
    setSymptoms(apt.notes || '');
    setActiveTab('consultation');
  };

  const handleCreateMedicalRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRecord(true);
    setChartSuccessMsg(null);
    setChartErrorMsg(null);

    const patObj = patients.find((p) => p.id === targetPatientId);
    if (!patObj) {
      setChartErrorMsg('Selected patient was not found.');
      setIsSubmittingRecord(false);
      return;
    }

    try {
      // Build FormData to support real multipart file uploads
      const formData = new FormData();
      formData.append('patientId', targetPatientId);
      formData.append('patientName', patObj.name);
      formData.append('diagnosis', diagnosis.trim());
      formData.append('symptoms', symptoms.trim());
      formData.append('prescription', prescription.trim());
      formData.append('treatmentHistory', treatmentHistory.trim());
      if (linkedAptId) {
        formData.append('appointmentId', linkedAptId);
      }

      if (selectedFiles && selectedFiles.length > 0) {
        for (let i = 0; i < selectedFiles.length; i++) {
          formData.append('reports[]', selectedFiles[i]);
        }
      }

      await onAddMedicalRecord(formData);

      setChartSuccessMsg('Clinical chart and prescriptions published successfully!');
      setDiagnosis('');
      setSymptoms('');
      setPrescription('');
      setTreatmentHistory('');
      setSelectedFiles(null);
      setLinkedAptId('');

      setTimeout(() => {
        setActiveTab('queue');
        setChartSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setChartErrorMsg(err.message || 'Failed to save clinical record.');
    } finally {
      setIsSubmittingRecord(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* Doctor Header Banner */}
      <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Physician Workspace</span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{doctor.name}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Department: <span className="font-semibold text-slate-700">{doctor.department}</span> | Room:{' '}
            <span className="font-semibold text-slate-700">{doctor.roomNo}</span> | Specialization: {doctor.specialization}
          </p>
        </div>

        <button
          onClick={() => {
            setLinkedAptId('');
            setActiveTab('consultation');
          }}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-200 hover:bg-emerald-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Write Clinical Chart
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 flex overflow-x-auto rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 transition-all ${
            activeTab === 'queue' ? 'bg-white text-emerald-700 shadow' : 'hover:text-slate-900'
          }`}
        >
          <Clock className="h-4 w-4" />
          Consultation Queue & Appointments ({myAppointments.length})
        </button>

        <button
          onClick={() => setActiveTab('consultation')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 transition-all ${
            activeTab === 'consultation' ? 'bg-white text-emerald-700 shadow' : 'hover:text-slate-900'
          }`}
        >
          <FileText className="h-4 w-4" />
          Diagnosis & Prescriptions
        </button>

        <button
          onClick={() => setActiveTab('patients')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 transition-all ${
            activeTab === 'patients' ? 'bg-white text-emerald-700 shadow' : 'hover:text-slate-900'
          }`}
        >
          <Users className="h-4 w-4" />
          Patient Registry & Medical Histories
        </button>
      </div>

      {/* ---------------- TAB 1: CONSULTATION QUEUE ---------------- */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          
          {/* Incoming Pending Requests */}
          {pendingAppointments.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
              <h2 className="text-sm font-bold text-amber-900 mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Action Required: Pending Appointments ({pendingAppointments.length})
              </h2>
              <p className="text-xs text-amber-700 mb-4">Review incoming patient bookings and Accept or Reject consultations.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingAppointments.map((apt) => (
                  <div key={apt.id} className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono font-bold text-slate-700">{apt.id}</span>
                      <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Pending</span>
                    </div>
                    <div className="my-2">
                      <h4 className="text-sm font-bold text-slate-900">{apt.patientName}</h4>
                      <p className="text-xs text-slate-500">{apt.date} at {apt.timeSlot}</p>
                      {apt.notes && <p className="text-[11px] text-slate-600 mt-1 italic">"{apt.notes}"</p>}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => onAcceptAppointment(apt.id)}
                        className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => onRejectAppointment(apt.id)}
                        className="flex-1 rounded-lg bg-rose-50 border border-rose-200 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Queue & Daily Schedule */}
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-3">All Schedule Records ({myAppointments.length})</h2>

            {myAppointments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <Calendar className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">No scheduled appointments for your calendar</p>
                <p className="text-xs text-slate-400 mt-1">Patients will appear here once bookings are placed.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                      <th className="py-3.5 px-4">Appointment #</th>
                      <th className="py-3.5 px-4">Patient Name</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Time Slot</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myAppointments.map((apt) => (
                      <tr key={apt.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{apt.id}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{apt.patientName}</td>
                        <td className="py-3 px-4 text-slate-600">{apt.date}</td>
                        <td className="py-3 px-4 font-medium text-slate-700">{apt.timeSlot}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
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
                          {apt.status === 'Pending' && (
                            <>
                              <button
                                onClick={() => onAcceptAppointment(apt.id)}
                                className="rounded px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => onRejectAppointment(apt.id)}
                                className="rounded px-2.5 py-1 text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {apt.status === 'Accepted' && (
                            <>
                              <button
                                onClick={() => startConsultationForApt(apt)}
                                className="rounded px-3 py-1 text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                Start Consultation
                              </button>
                              <button
                                onClick={() => onCompleteAppointment(apt.id)}
                                className="rounded px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                              >
                                Mark Done
                              </button>
                            </>
                          )}
                          {apt.status === 'Completed' && (
                            <span className="text-[11px] font-semibold text-blue-600">Completed ✓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- TAB 2: DIAGNOSIS & PRESCRIPTIONS ---------------- */}
      {activeTab === 'consultation' && (
        <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-1">Publish Clinical Diagnostic Record</h2>
          <p className="text-xs text-slate-500 mb-5">
            Submit formal diagnosis, prescriptions, and upload laboratory scan reports (PDF, JPG, PNG).
          </p>

          {chartSuccessMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span>{chartSuccessMsg}</span>
            </div>
          )}

          {chartErrorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              <span>{chartErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateMedicalRecord} className="space-y-4">
            {/* Patient Selection & Linked Appointment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Patient</label>
                <select
                  required
                  value={targetPatientId}
                  onChange={(e) => setTargetPatientId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id} - {p.gender})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Linked Appointment (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. APT-10001 (auto-completes appointment)"
                  value={linkedAptId}
                  onChange={(e) => setLinkedAptId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Primary Diagnosis</label>
              <input
                type="text"
                required
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Acute Bronchitis / Stage 1 Essential Hypertension"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Observed Clinical Symptoms</label>
              <textarea
                rows={2}
                required
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Patient symptoms, fever level, pulse, localized aches..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Prescription Regimen & Dosage</label>
              <textarea
                rows={4}
                required
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
                placeholder="1. Medication name, strength, timing&#10;2. Dietary advice&#10;3. Follow-up consultation date"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Clinical History & Treatment Progress</label>
              <textarea
                rows={2}
                value={treatmentHistory}
                onChange={(e) => setTreatmentHistory(e.target.value)}
                placeholder="Prior medications, therapy responses, and physician observations..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Real File Upload Input */}
            <div className="rounded-xl border border-dashed border-slate-300 p-4 bg-slate-50">
              <label className="mb-1 block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Upload className="h-4 w-4 text-emerald-600" />
                Attach Lab Reports & Scans (PDF, JPG, PNG - Max 5MB)
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Files are validated server-side for MIME type, sanitized, and stored securely in Backend/uploads/reports/.
              </p>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setSelectedFiles(e.target.files)}
                className="text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-emerald-700"
              />
              {selectedFiles && selectedFiles.length > 0 && (
                <p className="mt-2 text-xs font-semibold text-emerald-700">
                  {selectedFiles.length} file(s) queued for upload
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmittingRecord}
              className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isSubmittingRecord ? 'Uploading & Publishing...' : 'Publish Medical Chart'}
            </button>
          </form>
        </div>
      )}

      {/* ---------------- TAB 3: PATIENT REGISTRY ---------------- */}
      {activeTab === 'patients' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-800">Hospital Patient Clinical Directory</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((pat) => {
              const patRecords = medicalRecords.filter((r) => r.patientId === pat.id);
              return (
                <div key={pat.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-mono text-xs font-bold text-slate-500">{pat.id}</span>
                    <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-[10px]">
                      {pat.bloodGroup}
                    </span>
                  </div>

                  <div className="my-3">
                    <h3 className="text-sm font-bold text-slate-900">{pat.name}</h3>
                    <p className="text-xs text-slate-500">{pat.gender} • DOB: {pat.dob}</p>
                    <p className="text-xs text-slate-600 mt-1">Phone: {pat.phone}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{pat.address}</p>
                  </div>

                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{patRecords.length} chart(s) on file</span>
                    <button
                      onClick={() => {
                        setTargetPatientId(pat.id);
                        setActiveTab('consultation');
                      }}
                      className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                    >
                      New Chart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
