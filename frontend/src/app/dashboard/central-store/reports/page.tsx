'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BarChart3, FileText, Download, Calendar } from 'lucide-react';

export default function CentralStoreReportsPage() {
  const [selectedReport, setSelectedReport] = useState('stock');

  const reports = [
    { id: 'stock', name: 'Stock Report', description: 'Current stock levels and valuation' },
    { id: 'movement', name: 'Stock Movement', description: 'Incoming and outgoing stock' },
    { id: 'dispatch', name: 'Dispatch Report', description: 'All dispatches to branches' },
    { id: 'variance', name: 'Variance Report', description: 'Stock count variances' }
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600 mt-1">Generate and download warehouse reports</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reports.map((report) => (
              <div key={report.id} className={`bg-white rounded-xl p-6 border cursor-pointer transition-all ${selectedReport === report.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'hover:border-gray-300'}`}
                onClick={() => setSelectedReport(report.id)}>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-100 rounded-lg"><FileText className="h-6 w-6 text-indigo-600" /></div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{report.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl p-6 border">
            <h2 className="text-lg font-semibold mb-4">Generate Report</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input type="date" className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input type="date" className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                <select className="w-full px-3 py-2 border rounded-lg">
                  <option>PDF</option>
                  <option>Excel</option>
                  <option>CSV</option>
                </select>
              </div>
            </div>
            <button className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <Download className="h-4 w-4" /> Generate Report
            </button>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
