/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Activity, Shield, Users, Calendar, Key, LogOut } from 'lucide-react';
import { UserRole } from '../types';

interface NavbarProps {
  currentRole: UserRole;
  onChangeRole: (role: UserRole, targetId?: string) => void;
  activeUserName: string;
  onLogout: () => void;
  allDoctors: { id: string; name: string }[];
  allPatients: { id: string; name: string }[];
  activeUserId: string;
}

export default function Navbar({
  currentRole,
  onChangeRole,
  activeUserName,
  onLogout,
  allDoctors,
  allPatients,
  activeUserId,
}: NavbarProps) {
  const [showDemoMenu, setShowDemoMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo and branding */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-100">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-sans text-xl font-bold tracking-tight text-slate-900">
              Medicare <span className="text-blue-600">System</span>
            </h1>
            <p className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">Hospital Portal</p>
          </div>
        </div>

        {/* Demo Switcher Quick Bar */}
        <div className="hidden lg:flex items-center gap-2 rounded-full bg-slate-100 p-1">
          <span className="px-3 text-xs font-medium text-slate-500">Quick Demo Switch:</span>
          <button
            onClick={() => onChangeRole('Admin')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              currentRole === 'Admin'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
            id="nav-role-admin"
          >
            <Shield className="h-3.5 w-3.5" />
            Admin
          </button>

          <button
            onClick={() => onChangeRole('Doctor', allDoctors[0]?.id || 'DOC-101')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              currentRole === 'Doctor'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
            id="nav-role-doctor"
          >
            <Users className="h-3.5 w-3.5" />
            Doctor
          </button>

          <button
            onClick={() => onChangeRole('Patient', allPatients[0]?.id || 'PAT-1001')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              currentRole === 'Patient'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
            id="nav-role-patient"
          >
            <Calendar className="h-3.5 w-3.5" />
            Patient
          </button>
        </div>

        {/* Right Action Items & Mobile Menu Trigger */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowDemoMenu(!showDemoMenu)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              id="nav-demo-accounts-trigger"
            >
              <Key className="h-3.5 w-3.5 text-slate-500" />
              <span>Demo Accounts</span>
            </button>

            {showDemoMenu && (
              <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-xl border border-slate-100 bg-white p-3 shadow-xl ring-1 ring-black/5 z-50">
                <div className="mb-2 border-b border-slate-100 pb-1.5">
                  <h3 className="text-xs font-semibold text-slate-700">Jump to User Perspective</h3>
                  <p className="text-[10px] text-slate-400">Convenient for direct evaluation</p>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {/* Admin section */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Administrators</h4>
                    <button
                      onClick={() => {
                        onChangeRole('Admin');
                        setShowDemoMenu(false);
                      }}
                      className="w-full text-left rounded-lg p-1.5 hover:bg-slate-50 flex justify-between items-center text-xs"
                    >
                      <span className="font-semibold text-indigo-700">Hospital Administrator</span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">Access All</span>
                    </button>
                  </div>

                  {/* Doctors section */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Doctors</h4>
                    <div className="space-y-1">
                      {allDoctors.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => {
                            onChangeRole('Doctor', doc.id);
                            setShowDemoMenu(false);
                          }}
                          className={`w-full text-left rounded-lg p-1.5 hover:bg-slate-50 flex justify-between items-center text-xs ${
                            activeUserId === doc.id ? 'bg-emerald-50 border-l-2 border-emerald-500' : ''
                          }`}
                        >
                          <span className="font-medium text-slate-700">{doc.name}</span>
                          <span className="text-[10px] text-slate-400">View Queue</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Patients section */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Patients</h4>
                    <div className="space-y-1">
                      {allPatients.map((pat) => (
                        <button
                          key={pat.id}
                          onClick={() => {
                            onChangeRole('Patient', pat.id);
                            setShowDemoMenu(false);
                          }}
                          className={`w-full text-left rounded-lg p-1.5 hover:bg-slate-50 flex justify-between items-center text-xs ${
                            activeUserId === pat.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                          }`}
                        >
                          <span className="font-medium text-slate-700">{pat.name}</span>
                          <span className="text-[10px] text-slate-400">Book/Bills</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

          {/* User profile card */}
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-slate-800">{activeUserName}</p>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  currentRole === 'Admin'
                    ? 'bg-indigo-50 text-indigo-700'
                    : currentRole === 'Doctor'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                {currentRole} Role
              </span>
            </div>

            <button
              onClick={onLogout}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-rose-600 transition-colors"
              title="Logout / Change Role"
              id="nav-logout-btn"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
