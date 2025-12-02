'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, FileText, Calendar, DollarSign, BarChart3,
  Download, Save, Filter, ChevronDown, Loader2, Bed, Home, Wrench
} from 'lucide-react';
import { toast } from 'sonner';
import { reportsService } from '@/lib/api';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReportType?: string;
}

export function ReportModal({ isOpen, onClose, initialReportType }: ReportModalProps): JSX.Element | null {
  const [reportType, setReportType] = useState(initialReportType || 'occupancy');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [generating, setGenerating] = useState(false);

  const reportTypes = [
    { id: 'occupancy', name: 'Occupancy Report', icon: Bed },
    { id: 'daily_sales', name: 'Daily Sales', icon: DollarSign },
    { id: 'financial_summary', name: 'Financial Summary', icon: BarChart3 },
    { id: 'housekeeping', name: 'Housekeeping', icon: Home },
    { id: 'maintenance', name: 'Maintenance', icon: Wrench },
    { id: 'inventory_status', name: 'Inventory Status', icon: FileText }
  ];

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const filters = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate
      };
      
      await reportsService.downloadReport(reportType, filters, format);
      toast.success('Report downloaded successfully!');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
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

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Output Format
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setFormat('pdf')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                  format === 'pdf' 
                    ? 'border-[#3C3C43] bg-[#F2F2F7] text-[#3C3C43]' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText className="h-5 w-5" />
                <span className="text-sm font-medium">PDF</span>
              </button>
              <button
                onClick={() => setFormat('excel')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                  format === 'excel' 
                    ? 'border-[#3C3C43] bg-[#F2F2F7] text-[#3C3C43]' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Download className="h-5 w-5" />
                <span className="text-sm font-medium">Excel</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="px-6 py-2 bg-[#3C3C43] text-white rounded-lg hover:bg-[#2C2C33] disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {generating ? 'Generating...' : 'Download Report'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
