'use client';

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';

interface FloatDisplayProps {
  shiftId: string;
  refreshTrigger?: number;
}

interface FloatData {
  currentFloat: number;
  openingFloat: number;
  expectedClosingCash: number;
  lastUpdated: string;
}

export default function FloatDisplay({ shiftId, refreshTrigger = 0 }: FloatDisplayProps) {
  const [floatData, setFloatData] = useState<FloatData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date>(new Date());

  const formatCurrency = (amount: number): string => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fetchFloatData = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/kyogong/shifts/${shiftId}/float`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch float data');
      }

      const result = await response.json();
      if (result.success) {
        setFloatData(result.data);
        setLastFetchTime(new Date());
      } else {
        throw new Error(result.message || 'Failed to fetch float data');
      }
    } catch (err: any) {
      console.error('Error fetching float:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and auto-refresh every 5 seconds
  useEffect(() => {
    fetchFloatData();
    const interval = setInterval(fetchFloatData, 5000);
    return () => clearInterval(interval);
  }, [shiftId]);

  // Refresh when trigger changes (e.g., after transaction)
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchFloatData();
    }
  }, [refreshTrigger]);

  const handleRetry = () => {
    setIsLoading(true);
    fetchFloatData();
  };

  if (isLoading && !floatData) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-sm text-blue-700">Loading float data...</span>
        </div>
      </div>
    );
  }

  if (error && !floatData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error loading float</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
            <button
              onClick={handleRetry}
              className="mt-2 text-xs text-red-700 hover:text-red-900 underline"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!floatData) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-green-900">Cash Float</h3>
        <button
          onClick={fetchFloatData}
          className="text-green-600 hover:text-green-800 transition-colors"
          title="Refresh float data"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        {/* Current Float - Most Prominent */}
        <div className="bg-white rounded-lg p-3 border-2 border-green-400">
          <p className="text-xs text-gray-600 mb-1">Current Float</p>
          <p className="text-2xl font-bold text-green-700">
            {formatCurrency(floatData.currentFloat)}
          </p>
        </div>

        {/* Opening Float */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-700">Opening Float:</span>
          <span className="text-sm font-semibold text-gray-900">
            {formatCurrency(floatData.openingFloat)}
          </span>
        </div>

        {/* Expected Closing Cash */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-700">Expected Closing:</span>
          <span className="text-sm font-semibold text-gray-900">
            {formatCurrency(floatData.expectedClosingCash)}
          </span>
        </div>

        {/* Last Updated */}
        <div className="pt-2 border-t border-green-200">
          <p className="text-xs text-gray-500">
            Last updated: {new Date(lastFetchTime).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}
