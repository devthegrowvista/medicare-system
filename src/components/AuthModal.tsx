/**
 * Medicare System - Authentication & Password Recovery Modal
 *
 * Implements Session-based Login, Patient Self-Registration, and
 * 6-digit recovery-code password reset (XAMPP demo without SMTP).
 */

import React, { useState } from 'react';
import { Shield, Users, Calendar, Activity, Key, Lock, Mail, Phone, MapPin, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { UserRole, Doctor, Patient } from '../types';
import { authService } from '../apiService';

interface AuthModalProps {
  doctors?: Doctor[];
  patients?: Patient[];
  onLoginSuccess: (role: UserRole, id: string, name: string) => void;
  onRegisterPatient?: (patientData: any) => Promise<void>;
}

export default function AuthModal({ onLoginSuccess }: AuthModalProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Patient');

  // Form states
  const [email, setEmail] = useState('sarah.connor@gmail.com');
  const [password, setPassword] = useState('patient123');

  // Registration states
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regGender, setRegGender] = useState('Male');
  const [regDob, setRegDob] = useState('1995-06-15');
  const [regBloodGroup, setRegBloodGroup] = useState('O+');
  const [regAddress, setRegAddress] = useState('');

  // Password reset states
  const [forgotEmail, setForgotEmail] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Quick preset loader for evaluation
  const setDemoCredentials = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (role === 'Admin') {
      setEmail('admin@medicare.com');
      setPassword('admin123');
    } else if (role === 'Doctor') {
      setEmail('dr.clara@medicare.com');
      setPassword('doctor123');
    } else {
      setEmail('sarah.connor@gmail.com');
      setPassword('patient123');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await authService.login(email.trim(), password.trim(), selectedRole);
      if (response.success && response.user) {
        onLoginSuccess(response.user.role as UserRole, response.user.id, response.user.name);
      } else {
        setErrorMsg(response.message || 'Authentication failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login request failed. Ensure XAMPP MySQL is active.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await authService.register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword.trim(),
        phone: regPhone.trim(),
        gender: regGender,
        dob: regDob,
        bloodGroup: regBloodGroup,
        address: regAddress.trim(),
      });

      if (response.success && response.user) {
        setSuccessMsg('Account created successfully! Logging you in...');
        setTimeout(() => {
          onLoginSuccess('Patient', response.user.id, response.user.name);
        }, 1000);
      } else {
        setErrorMsg(response.message || 'Registration failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create patient account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await authService.forgotPassword(forgotEmail.trim());
      if (res.success) {
        setDemoCode(res.recovery_code || '');
        setRecoveryCode('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMsg(res.message);
        setAuthMode('reset');
      } else {
        setErrorMsg(res.message || 'Could not initiate reset.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Password reset request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await authService.resetPassword(recoveryCode.trim(), newPassword.trim());
      if (res.success) {
        setSuccessMsg('Password updated successfully. You can now sign in.');
        setTimeout(() => {
          setAuthMode('login');
          setPassword('');
        }, 1200);
      } else {
        setErrorMsg(res.message || 'Failed to update password.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[82vh] items-center justify-center p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-100">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-6 text-white text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md shadow-inner">
            <Activity className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Medicare Hospital System</h2>
          <p className="mt-1 text-xs text-blue-100 font-medium">Virtual University CS619 Final Project</p>
        </div>

        {/* Feedback banners */}
        {errorMsg && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ----------------- LOGIN MODE ----------------- */}
        {authMode === 'login' && (
          <div className="p-6">
            {/* Role Tabs */}
            <div className="mb-6 grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDemoCredentials('Patient')}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                  selectedRole === 'Patient'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Patient
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('Doctor')}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                  selectedRole === 'Doctor'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Doctor
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('Admin')}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                  selectedRole === 'Admin'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                Admin
              </button>
            </div>

            {/* Quick Helper for supervisor */}
            <div className="mb-5 flex items-center justify-between rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2 text-[11px] text-blue-800">
              <span className="font-medium">Active Role: {selectedRole}</span>
              <span className="text-blue-600 font-mono">Demo: {email} / {password}</span>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    placeholder="Enter registered email"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] font-medium text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    placeholder="Enter account password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Authenticating with XAMPP...' : `Sign in as ${selectedRole}`}
              </button>
            </form>

            {/* Switch to Register */}
            <div className="mt-6 border-t border-slate-100 pt-4 text-center">
              <p className="text-xs text-slate-500">
                Are you a new patient?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="font-bold text-blue-600 hover:underline"
                >
                  Create Patient Account
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ----------------- PATIENT REGISTRATION MODE ----------------- */}
        {authMode === 'register' && (
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMsg(null);
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-bold text-slate-800">New Patient Registration</h3>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Ali Ahmed"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="ali@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+92 300 1234567"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-8 pr-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Gender</label>
                  <select
                    value={regGender}
                    onChange={(e) => setRegGender(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={regDob}
                    onChange={(e) => setRegDob(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Blood Group</label>
                  <select
                    value={regBloodGroup}
                    onChange={(e) => setRegBloodGroup(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
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
                <label className="mb-1 block text-xs font-semibold text-slate-700">Residential Address</label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="Street Address, City"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-8 pr-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Creating Account in Database...' : 'Register Patient Account'}
              </button>
            </form>

            <div className="mt-4 border-t border-slate-100 pt-3 text-center">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Already have an account? <span className="text-blue-600">Sign in</span>
              </button>
            </div>
          </div>
        )}

        {/* ----------------- FORGOT PASSWORD STEP ----------------- */}
        {authMode === 'forgot' && (
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-bold text-slate-800">Password Recovery</h3>
            </div>

            <p className="mb-4 text-xs text-slate-500">
              Enter your registered email. A 6-digit recovery code will be issued. On XAMPP there is no SMTP mailbox, so the code is shown on the next screen for evaluation.
            </p>

            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Account Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    placeholder="e.g. sarah.connor@gmail.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Sending code...' : 'Send recovery code'}
              </button>
            </form>
          </div>
        )}

        {/* ----------------- RESET PASSWORD STEP ----------------- */}
        {authMode === 'reset' && (
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAuthMode('forgot')}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-bold text-slate-800">Set new password</h3>
            </div>

            {demoCode ? (
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
                <p className="text-[11px] font-bold text-blue-900">Local XAMPP notice</p>
                <p className="mt-1 text-[11px] text-blue-800">
                  Email delivery is not available on XAMPP. Your 6-digit recovery code is:
                </p>
                <p className="mt-2 text-center font-mono text-2xl font-bold tracking-[0.35em] text-blue-900">{demoCode}</p>
                <p className="mt-1 text-[10px] text-blue-600">Type this code below. It expires in 15 minutes.</p>
              </div>
            ) : (
              <p className="mb-4 text-xs text-slate-500">
                If that email is registered, enter the 6-digit recovery code and choose a new password.
              </p>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Recovery code</label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-mono tracking-[0.3em] text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    placeholder="000000"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    placeholder="Minimum 6 characters"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Confirm new password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
