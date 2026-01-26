'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { ProfileHeader } from '@/components/employee/portal/ProfileHeader';
import { ShortcutsWidget } from '@/components/employee/portal/ShortcutsWidget';
import { TimesheetWidget } from '@/components/employee/portal/TimesheetWidget';
import { ChecklistWidget } from '@/components/employee/portal/ChecklistWidget';
import { CalendarWidget } from '@/components/employee/portal/CalendarWidget';
import { ReviewWidget } from '@/components/employee/portal/ReviewWidget';
import { AssetWidget } from '@/components/employee/portal/AssetWidget';
import { JobPortalWidget } from '@/components/employee/portal/JobPortalWidget';
import { IDCardWidget } from '@/components/employee/portal/IDCardWidget';

export default function EmployeePortal() {
  const { user } = useAuth();

  // Employee data from user context or mock
  const employeeData = {
    firstName: user?.firstName || 'Gracie',
    lastName: user?.lastName || 'Collins',
    position: 'Senior Pilot',
    department: 'Flight Operations',
    code: 'COLLG',
    status: 'Full Time',
    location: 'Sydney Office',
    joinDate: '2014-06-01',
    avatarUrl: 'https://i.pravatar.cc/150?u=gracie', // Placeholder
  };

  const trainings = [
    { type: 'Internal', course: 'Customer Support', date: '15/11/2019', status: 'Pending' },
    { type: 'First Aid', course: 'St. Johns First Aid', date: '01/05/2017', status: 'Completed' },
    { type: 'Internal', course: 'Instrument Flight', date: '15/04/2017', status: 'Completed' },
  ];

  const positionHistory = [
    { position: 'Senior Pilot', commenced: '06/08/2019', completed: 'N/A', remuneration: '$120,000.00' },
    { position: 'Senior Pilot', commenced: '01/05/2019', completed: '06/08/2019', remuneration: '$110,000.00' },
    { position: 'Senior Pilot', commenced: '01/09/2018', completed: '30/04/2019', remuneration: '$85,000.00' },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Profile Header */}
        <ProfileHeader employee={employeeData} />

        {/* Shortcuts */}
        <ShortcutsWidget />

        {/* 3-Column Widget Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Column 1: Active Work (Timesheets, Checklists, Calendar) */}
          <div className="space-y-6">
            <div className="h-48">
              <TimesheetWidget />
            </div>
            <div className="h-48">
              <ChecklistWidget />
            </div>
            <CalendarWidget />
          </div>

          {/* Column 2: Reporting & Reviews */}
          <div className="space-y-6">
            <IDCardWidget user={user} />

            <ReviewWidget />
            <AssetWidget />
          </div>

          {/* Column 3: Career & Resources */}
          <div className="space-y-6">
            <JobPortalWidget />

            {/* Training Widget */}
            <IOSCard className="border-none shadow-sm bg-white overflow-hidden">
              <div className="p-4 bg-stone-50 border-b border-stone-100">
                <h3 className="font-bold text-stone-900">Recent Training</h3>
              </div>
              <div className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-white text-stone-500 font-bold uppercase">
                    <tr>
                      <th className="text-left p-3">Type</th>
                      <th className="text-left p-3">Course</th>
                      <th className="text-right p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {trainings.map((t, i) => (
                      <tr key={i} className="hover:bg-stone-50">
                        <td className="p-3 text-stone-500">{t.type}</td>
                        <td className="p-3 font-medium text-stone-900">{t.course}</td>
                        <td className="p-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full ${t.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>{t.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IOSCard>

            {/* Position History Widget */}
            <IOSCard className="border-none shadow-sm bg-white overflow-hidden">
              <div className="p-4 bg-stone-100 border-b border-stone-200">
                <h3 className="font-bold text-stone-900">Your Position History</h3>
              </div>
              <div className="p-0 max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white text-stone-500 font-bold uppercase sticky top-0">
                    <tr>
                      <th className="text-left p-3">Position</th>
                      <th className="text-left p-3">Commenced</th>
                      <th className="text-right p-3">Remuneration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {positionHistory.map((p, i) => (
                      <tr key={i} className="hover:bg-stone-50">
                        <td className="p-3 font-medium text-stone-900">{p.position}</td>
                        <td className="p-3 text-stone-500">{p.commenced}</td>
                        <td className="p-3 text-right font-mono text-stone-900">{p.remuneration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IOSCard>

          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
