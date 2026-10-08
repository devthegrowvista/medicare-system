/**
 * Medicare System - Patient Portal
 *
 * Doctor consultation booking (with double-booking protection), rescheduling,
 * cancellation, medical charts & prescriptions, history download, invoice
 * settlement (Card / Cash / Online Transfer) and profile management.
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  FileText,
  CreditCard,
  User,
  Plus,
  AlertCircle,
  CheckCircle,
  Download,
  Stethoscope,
  XCircle,
  Banknote,
  Landmark,
  X,
} from 'lucide-react';
import { Doctor, Patient, Appointment, MedicalRecord, Invoice } from '../types';
import { appointmentService } from '../apiService';

interface PatientViewProps {
  patient: Patient;
  doctors: Doctor[];
  appointments: Appointment[];
  medicalRecords: MedicalRecord[];
  invoices: Invoice[];
  departments: string[];
  onBookAppointment: (aptData: any) => Promise<void> | void;
  onCancelAppointment: (id: string) => Promise<void> | void;
  onRescheduleAppointment: (id: string, date: string, timeSlot: string) => Promise<void> | void;
  onPayInvoice: (
    invoiceId: string,
    method: 'Cash' | 'Card' | 'Online Transfer',
    details?: {
      cardHolder?: string;
      cardNumber?: string;
      cardExpiry?: string;
      cardCvv?: string;
      transferRef?: string;
    }
  ) => Promise<void> | void;
  onUpdateProfile: (patient: Patient) => Promise<void> | void;
}

type Tab = 'book' | 'appointments' | 'records' | 'billing' | 'profile';
type PayMethod = 'Cash' | 'Card' | 'Online Transfer';

const DEFAULT_FEE = 150;

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-700',
  Accepted: 'bg-emerald-50 text-emerald-700',
  Completed: 'bg-blue-50 text-blue-700',
  Rejected: 'bg-rose-50 text-rose-700',
  Cancelled: 'bg-slate-100 text-slate-600',
  Paid: 'bg-emerald-50 text-emerald-700',
  Unpaid: 'bg-amber-50 text-amber-700',
  Overdue: 'bg-rose-50 text-rose-700',
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const weekdayShort = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { weekday: 'short' });
};

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function PatientView({
  patient,
  doctors,
  appointments,
  medicalRecords,
  invoices,
  departments,
  onBookAppointment,
  onCancelAppointment,
  onRescheduleAppointment,
  onPayInvoice,
  onUpdateProfile,
}: PatientViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('book');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ---- Booking state ----
  const [department, setDepartment] = useState<string>('');
  const [doctorId, setDoctorId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [timeSlot, setTimeSlot] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [isBooking, setIsBooking] = useState(false);

  // ---- Reschedule state ----
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newSlot, setNewSlot] = useState('');
  const [rescheduleTaken, setRescheduleTaken] = useState<string[]>([]);

  // ---- Billing / checkout state ----
  const [checkoutInv, setCheckoutInv] = useState<Invoice | null>(null);
  const [checkoutMethod, setCheckoutMethod] = useState<PayMethod | null>(null);
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [transferRef, setTransferRef] = useState('');
  const [payError, setPayError] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);

  // ---- Profile state ----
  const [profile, setProfile] = useState<Patient>(patient);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => setProfile(patient), [patient]);

  const activeDoctors = useMemo(
    () =>
      doctors.filter(
        (d) => d.status === 'Active' && (!department || (d.department || d.specialization) === department)
      ),
    [doctors, department]
  );

  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  const myAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.patientId === patient.id)
        .sort((a, b) => (a.date + a.timeSlot < b.date + b.timeSlot ? 1 : -1)),
    [appointments, patient.id]
  );
  const myRecords = useMemo(() => medicalRecords.filter((r) => r.patientId === patient.id), [medicalRecords, patient.id]);
  const myInvoices = useMemo(() => invoices.filter((i) => i.patientId === patient.id), [invoices, patient.id]);
  const unpaidTotal = myInvoices.filter((i) => i.status !== 'Paid').reduce((s, i) => s + Number(i.total), 0);

  // Load occupied slots for booking form
  useEffect(() => {
    setTimeSlot('');
    if (!doctorId || !date) {
      setTakenSlots([]);
      return;
    }
    appointmentService
      .getTakenSlots(doctorId, date)
      .then(setTakenSlots)
      .catch(() => setTakenSlots([]));
  }, [doctorId, date]);

  // Load occupied slots for reschedule form
  const rescheduleApt = myAppointments.find((a) => a.id === rescheduleId);
  useEffect(() => {
    setNewSlot('');
    if (!rescheduleApt || !newDate) {
      setRescheduleTaken([]);
      return;
    }
    appointmentService
      .getTakenSlots(rescheduleApt.doctorId, newDate)
      .then(setRescheduleTaken)
      .catch(() => setRescheduleTaken([]));
  }, [rescheduleApt?.doctorId, newDate]);

  const flash = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => setFeedback(null), 5000);
  };

  const doctorWorksOn = (doc: Doctor | undefined, iso: string) =>
    !doc || !doc.availability?.length || doc.availability.some((d) => d.slice(0, 3) === weekdayShort(iso));

  // ---- Actions ----
  const handleBook = async () => {
    if (!selectedDoctor || !date || !timeSlot) {
      flash('err', 'Please choose a doctor, date and time slot.');
      return;
    }
    if (!doctorWorksOn(selectedDoctor, date)) {
      flash('err', `${selectedDoctor.name} is not available on ${weekdayShort(date)}.`);
      return;
    }
    setIsBooking(true);
    try {
      await onBookAppointment({
        patientId: patient.id,
        doctorId: selectedDoctor.id,
        date,
        timeSlot,
        notes: notes.trim(),
        fee: DEFAULT_FEE,
      });
      flash('ok', 'Appointment requested. The doctor will confirm it shortly.');
      setDoctorId('');
      setDate('');
      setTimeSlot('');
      setNotes('');
      setActiveTab('appointments');
    } catch (err: any) {
      flash('err', err?.message || 'Failed to book appointment.');
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this appointment?')) return;
    try {
      await onCancelAppointment(id);
      flash('ok', 'Appointment cancelled.');
    } catch (err: any) {
      flash('err', err?.message || 'Failed to cancel appointment.');
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleId || !newDate || !newSlot) {
      flash('err', 'Pick a new date and time slot.');
      return;
    }
    try {
      await onRescheduleAppointment(rescheduleId, newDate, newSlot);
      flash('ok', 'Appointment rescheduled.');
      setRescheduleId(null);
      setNewDate('');
      setNewSlot('');
    } catch (err: any) {
      flash('err', err?.message || 'Failed to reschedule appointment.');
    }
  };

  const openCheckout = (inv: Invoice) => {
    setCheckoutInv(inv);
    setCheckoutMethod(null);
    setCardHolder('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setTransferRef('');
    setPayError('');
  };

  const closeCheckout = () => {
    if (payingId) return;
    setCheckoutInv(null);
    setCheckoutMethod(null);
    setPayError('');
  };

  const formatCardNumber = (raw: string) =>
    raw.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');

  const formatExpiry = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const handlePay = async () => {
    if (!checkoutInv || !checkoutMethod) {
      setPayError('Please choose Cash, Card, or Online Transfer.');
      return;
    }

    if (checkoutMethod === 'Card') {
      const digits = cardNumber.replace(/\D/g, '');
      if (!cardHolder.trim()) {
        setPayError('Enter the name on the card.');
        return;
      }
      if (digits.length < 13 || digits.length > 16) {
        setPayError('Enter a valid card number.');
        return;
      }
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)) {
        setPayError('Enter expiry as MM/YY.');
        return;
      }
      if (!/^\d{3,4}$/.test(cardCvv)) {
        setPayError('Enter a valid CVV.');
        return;
      }
    }

    if (checkoutMethod === 'Online Transfer' && transferRef.trim().length < 6) {
      setPayError('Enter the bank transaction ID (at least 6 characters).');
      return;
    }

    setPayingId(checkoutInv.id);
    setPayError('');
    try {
      await onPayInvoice(checkoutInv.id, checkoutMethod, {
        cardHolder: cardHolder.trim(),
        cardNumber: cardNumber.replace(/\s/g, ''),
        cardExpiry,
        cardCvv,
        transferRef: transferRef.trim(),
      });
      flash('ok', `Invoice ${checkoutInv.id} paid via ${checkoutMethod}.`);
      setCheckoutInv(null);
      setCheckoutMethod(null);
    } catch (err: any) {
      setPayError(err?.message || 'Payment failed.');
    } finally {
      setPayingId(null);
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await onUpdateProfile(profile);
      flash('ok', 'Profile updated.');
    } catch (err: any) {
      flash('err', err?.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const downloadHistory = () => {
    const lines = [
      `MEDICARE - MEDICAL HISTORY`,
      `Patient: ${patient.name} (${patient.id})`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      ...myRecords.flatMap((r) => [
        `Date: ${r.date}   Doctor: ${r.doctorName}`,
        `Diagnosis: ${r.diagnosis}`,
        `Symptoms: ${r.symptoms}`,
        `Prescription: ${r.prescription}`,
        `Treatment History: ${r.treatmentHistory}`,
        '-'.repeat(60),
      ]),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical-history-${patient.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- UI helpers ----
  const tabBtn = (id: Tab, label: string, Icon: React.ElementType) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 transition-all whitespace-nowrap ${
        activeTab === id ? 'bg-white text-blue-700 shadow' : 'hover:text-slate-900'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  const badge = (status: string) => (
    <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );

  const slotPicker = (slots: string[], taken: string[], value: string, onPick: (s: string) => void) => (
    <div className="flex flex-wrap gap-2">
      {slots.map((s) => {
        const isTaken = taken.includes(s);
        return (
          <button
            key={s}
            type="button"
            disabled={isTaken}
            onClick={() => onPick(s)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              isTaken
                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through'
                : value === s
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400'
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  const labelCls = 'mb-1 block text-xs font-semibold text-slate-600';
  const emptyBox = (text: string) => (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">{text}</div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Patient Portal</span>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{patient.name}</h1>
          <p className="mt-1 text-xs text-slate-500">
            ID: <span className="font-semibold text-slate-700">{patient.id}</span> | Blood Group:{' '}
            <span className="font-semibold text-slate-700">{patient.bloodGroup || '—'}</span> | Outstanding balance:{' '}
            <span className="font-semibold text-slate-700">{money(unpaidTotal)}</span>
          </p>
        </div>
        <button
          onClick={() => setActiveTab('book')}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Book Appointment
        </button>
      </div>

      {feedback && (
        <div
          className={`mb-6 flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {feedback.type === 'ok' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {feedback.text}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex overflow-x-auto rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
        {tabBtn('book', 'Book Consultation', Stethoscope)}
        {tabBtn('appointments', `My Appointments (${myAppointments.length})`, Calendar)}
        {tabBtn('records', `Medical Records (${myRecords.length})`, FileText)}
        {tabBtn('billing', `Invoices (${myInvoices.length})`, CreditCard)}
        {tabBtn('profile', 'My Profile', User)}
      </div>

      {/* ---------------- BOOK ---------------- */}
      {activeTab === 'book' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3">
            <h2 className="text-base font-bold text-slate-800">Schedule a Consultation</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Department</label>
                <select
                  className={inputCls}
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setDoctorId('');
                  }}
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Doctor</label>
                <select className={inputCls} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                  <option value="">Select a doctor…</option>
                  {activeDoctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.specialization}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedDoctor && (
              <p className="text-xs text-slate-500">
                Available: <span className="font-semibold text-slate-700">{selectedDoctor.availability?.join(', ') || 'Any day'}</span>{' '}
                | Room: <span className="font-semibold text-slate-700">{selectedDoctor.roomNo}</span>
              </p>
            )}

            <div>
              <label className={labelCls}>Date</label>
              <input type="date" min={todayISO()} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
              {selectedDoctor && date && !doctorWorksOn(selectedDoctor, date) && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                  {selectedDoctor.name} does not work on {weekdayShort(date)}. Please pick another day.
                </p>
              )}
            </div>

            {selectedDoctor && date && doctorWorksOn(selectedDoctor, date) && (
              <div>
                <label className={labelCls}>Time slot</label>
                {slotPicker(selectedDoctor.timeSlots || [], takenSlots, timeSlot, setTimeSlot)}
              </div>
            )}

            <div>
              <label className={labelCls}>Symptoms / notes (optional)</label>
              <textarea rows={3} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <button
              onClick={handleBook}
              disabled={isBooking}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 hover:bg-blue-700 disabled:opacity-60"
            >
              {isBooking ? 'Booking…' : `Confirm Booking (${money(DEFAULT_FEE)} consultation fee)`}
            </button>
          </div>

          <div className="space-y-3 lg:col-span-2">
            <h2 className="text-base font-bold text-slate-800">Our Doctors</h2>
            {activeDoctors.length === 0
              ? emptyBox('No doctors available for this department.')
              : activeDoctors.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDoctorId(d.id)}
                    className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors ${
                      doctorId === d.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">{d.name}</h3>
                      {d.rating ? <span className="text-xs font-bold text-amber-600">★ {d.rating}</span> : null}
                    </div>
                    <p className="text-xs text-slate-500">
                      {d.specialization} · {d.department}
                    </p>
                    {d.bio && <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{d.bio}</p>}
                  </button>
                ))}
          </div>
        </div>
      )}

      {/* ---------------- APPOINTMENTS ---------------- */}
      {activeTab === 'appointments' && (
        <div className="space-y-3">
          {myAppointments.length === 0
            ? emptyBox('You have no appointments yet.')
            : myAppointments.map((apt) => {
                const canChange = apt.status === 'Pending' || apt.status === 'Accepted';
                const doc = doctors.find((d) => d.id === apt.doctorId);
                return (
                  <div key={apt.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-slate-700">{apt.id}</span>
                          {badge(apt.status)}
                        </div>
                        <h3 className="mt-1 text-sm font-bold text-slate-900">{apt.doctorName}</h3>
                        <p className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3 w-3" /> {apt.date} at {apt.timeSlot}
                          {apt.department ? ` · ${apt.department}` : ''} · Fee {money(apt.fee)}
                        </p>
                        {apt.notes && <p className="mt-1 text-[11px] italic text-slate-600">"{apt.notes}"</p>}
                      </div>
                      {canChange && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setRescheduleId(rescheduleId === apt.id ? null : apt.id);
                              setNewDate('');
                              setNewSlot('');
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => handleCancel(apt.id)}
                            className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {rescheduleId === apt.id && (
                      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                        <div className="max-w-xs">
                          <label className={labelCls}>New date</label>
                          <input type="date" min={todayISO()} className={inputCls} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                        </div>
                        {newDate && doc && doctorWorksOn(doc, newDate) && slotPicker(doc.timeSlots || [], rescheduleTaken, newSlot, setNewSlot)}
                        {newDate && doc && !doctorWorksOn(doc, newDate) && (
                          <p className="text-[11px] font-semibold text-rose-600">Doctor is not available on {weekdayShort(newDate)}.</p>
                        )}
                        <button
                          onClick={handleReschedule}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                        >
                          Confirm New Time
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
        </div>
      )}

      {/* ---------------- RECORDS ---------------- */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Medical Charts & Prescriptions</h2>
            {myRecords.length > 0 && (
              <button
                onClick={downloadHistory}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" /> Download History
              </button>
            )}
          </div>
          {myRecords.length === 0
            ? emptyBox('No medical records have been published for you yet.')
            : myRecords.map((r) => (
                <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono font-bold text-slate-700">{r.id}</span>
                    <span>
                      {r.date} · {r.doctorName}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-slate-900">{r.diagnosis}</h3>
                  <dl className="mt-2 grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
                    <div>
                      <dt className="font-semibold text-slate-500">Symptoms</dt>
                      <dd className="text-slate-800">{r.symptoms || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">Prescription</dt>
                      <dd className="text-slate-800">{r.prescription || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">Treatment history</dt>
                      <dd className="text-slate-800">{r.treatmentHistory || '—'}</dd>
                    </div>
                  </dl>
                  {r.reports && r.reports.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      {r.reports.map((f, i) => (
                        <a
                          key={f.id ?? i}
                          href={f.downloadUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          <FileText className="h-3 w-3" /> {f.name} ({f.size})
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
        </div>
      )}

      {/* ---------------- BILLING ---------------- */}
      {activeTab === 'billing' && (
        <div className="space-y-3">
          {myInvoices.length === 0
            ? emptyBox('You have no invoices.')
            : myInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-slate-700">{inv.id}</span>
                      {badge(inv.status)}
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900">{money(inv.total)}</p>
                    <p className="text-[11px] text-slate-500">
                      Amount {money(inv.amount)} + Tax {money(inv.tax)}
                      {inv.discount ? ` − Discount ${money(inv.discount)}` : ''} · Issued {inv.date} · Due {inv.dueDate}
                      {inv.status === 'Paid' && inv.paymentMethod ? ` · Paid via ${inv.paymentMethod}` : ''}
                    </p>
                  </div>
                  {inv.status !== 'Paid' && (
                    <button
                      onClick={() => openCheckout(inv)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      Pay Now
                    </button>
                  )}
                </div>
              ))}
        </div>
      )}

      {/* ---------------- PROFILE ---------------- */}
      {activeTab === 'profile' && (
        <div className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-800">My Profile</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Full name</label>
              <input className={inputCls} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={`${inputCls} bg-slate-50`} value={profile.email} disabled />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Gender</label>
              <select className={inputCls} value={profile.gender} onChange={(e) => setProfile({ ...profile, gender: e.target.value })}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Date of birth</label>
              <input type="date" className={inputCls} value={profile.dob} onChange={(e) => setProfile({ ...profile, dob: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Blood group</label>
              <input className={inputCls} value={profile.bloodGroup} onChange={(e) => setProfile({ ...profile, bloodGroup: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <textarea rows={2} className={inputCls} value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={isSavingProfile}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSavingProfile ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {checkoutInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Checkout</p>
                <h3 className="text-base font-bold text-slate-900">Pay invoice {checkoutInv.id}</h3>
                <p className="text-sm font-semibold text-slate-700">{money(checkoutInv.total)}</p>
              </div>
              <button type="button" onClick={closeCheckout} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-2 text-xs font-semibold text-slate-700">Choose a payment option</p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'Cash' as PayMethod, label: 'Cash', hint: 'Hospital counter', Icon: Banknote },
                  { id: 'Card' as PayMethod, label: 'Card', hint: 'Debit / credit', Icon: CreditCard },
                  { id: 'Online Transfer' as PayMethod, label: 'Online Transfer', hint: 'Bank IBFT', Icon: Landmark },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setCheckoutMethod(opt.id);
                    setPayError('');
                  }}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    checkoutMethod === opt.id
                      ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <opt.Icon className={`mb-1 h-4 w-4 ${checkoutMethod === opt.id ? 'text-emerald-700' : 'text-slate-500'}`} />
                  <p className="text-[11px] font-bold text-slate-800">{opt.label}</p>
                  <p className="text-[10px] text-slate-500">{opt.hint}</p>
                </button>
              ))}
            </div>

            {checkoutMethod === 'Cash' && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Pay this amount at the hospital cash counter and quote invoice <span className="font-mono font-bold">{checkoutInv.id}</span>.
                Confirm only if cash has been collected at reception.
              </div>
            )}

            {checkoutMethod === 'Card' && (
              <div className="mb-4 space-y-3">
                <p className="text-[10px] text-slate-500">
                  Simulated card gateway for this university project (no live Stripe/JazzCash). Card numbers are validated, not stored.
                </p>
                <div>
                  <label className={labelCls}>Name on card</label>
                  <input className={inputCls} value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} placeholder="As printed on card" />
                </div>
                <div>
                  <label className={labelCls}>Card number</label>
                  <input
                    className={inputCls}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="ACCT-000015"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Expiry (MM/YY)</label>
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                      placeholder="12/28"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>CVV</label>
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      type="password"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                    />
                  </div>
                </div>
              </div>
            )}

            {checkoutMethod === 'Online Transfer' && (
              <div className="mb-4 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="font-bold text-slate-800">Medicare Hospital Trust Account</p>
                  <p>Bank: Meezan Bank</p>
                  <p>Account: 0042-8891-2201</p>
                  <p>IBAN: PK00 MEDI 0042 8891 2201</p>
                  <p className="mt-1 text-slate-500">Transfer {money(checkoutInv.total)} then enter the bank transaction ID below.</p>
                </div>
                <div>
                  <label className={labelCls}>Transaction / reference ID</label>
                  <input
                    className={inputCls}
                    value={transferRef}
                    onChange={(e) => setTransferRef(e.target.value)}
                    placeholder="e.g. IBFT-884421"
                  />
                </div>
              </div>
            )}

            {payError && (
              <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{payError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeCheckout} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePay}
                disabled={!checkoutMethod || payingId === checkoutInv.id}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {payingId === checkoutInv.id ? 'Processing…' : `Confirm ${checkoutMethod || 'payment'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
