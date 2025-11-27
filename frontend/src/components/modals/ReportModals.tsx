'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, FileText, Calendar, DollarSign, BarChart3,
  Download, Save, Filter, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportModal({ isOpen, onClose }: ReportModalProps): JSX.Element | null {
  const [reportType, setReportType] = useState('occupancy');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [filters, setFilters] = useState({
    roomType: 'all',
    paymentStatus: 'all'
  });

  const reportTypes = [
    { id: 'occupancy', name: 'Occupancy Report', icon: BarChart3 },
    { id: 'revenue', name: 'Revenue Report', icon: DollarSign },
    { id: 'housekeeping', name: 'Housekeeping Report', icon: FileText },
    { id: 'maintenance', name: 'Maintenance Report', icon: FileText }
  ];

  const handleGenerateReport = async () => {
    try {
      // TODO: Implement API call
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reportType,
          dateRange,
          filters
        })
      });

      if (!response.ok) throw new Error('Failed to generate report');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = reportType + '-report.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Report generated successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to generate report');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Generate Report</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Report Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              {reportTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setReportType(type.id)}
                  className={'flex items-center gap-2 p-3 rounded-lg border ' + (reportType === type.id ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-200 hover:border-gray-300')}
                >
                  <type.icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{type.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({
                  ...prev,
                  startDate: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({
                  ...prev,
                  endDate: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filters
            </label>
            <div className="grid grid-cols-2 gap-4">
              <select
                value={filters.roomType}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  roomType: e.target.value
                }))}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">All Room Types</option>
                <option value="standard">Standard</option>
                <option value="deluxe">Deluxe</option>
                <option value="suite">Suite</option>
              </select>
              <select
                value={filters.paymentStatus}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  paymentStatus: e.target.value
                }))}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">All Payment Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleGenerateReport}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <FileText className="inline h-4 w-4 mr-2" />
            Generate Report
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
