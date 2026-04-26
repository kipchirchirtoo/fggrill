'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, DollarSign, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface ShiftPnL {
  id: string;
  shift_id: string;
  shift_date: string;
  shift_name: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'REVIEWED' | 'APPROVED' | 'FLAGGED';
  total_revenue: number;
  pos_revenue: number;
  buffet_revenue: number;
  catering_revenue: number;
  theoretical_cogs: number;
  actual_cogs: number;
  variance_cost: number;
  gross_profit: number;
  food_cost_percent: number;
  created_at: string;
}

export default function ShiftPnLListPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const { data: pnls, isLoading } = useQuery<ShiftPnL[]>({
    queryKey: ['shift-pnls', statusFilter, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (dateRange.start) params.append('start_date', dateRange.start);
      if (dateRange.end) params.append('end_date', dateRange.end);
      
      const response = await fetch(`/api/finance/shift-pnl?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch shift P&Ls');
      const result = await response.json();
      return result.data;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['shift-pnl-summary', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.start) params.append('start_date', dateRange.start);
      if (dateRange.end) params.append('end_date', dateRange.end);
      
      const response = await fetch(`/api/finance/shift-pnl/summary?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) return null;
      const result = await response.json();
      return result.data;
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'PENDING_REVIEW': return 'bg-yellow-100 text-yellow-800';
      case 'REVIEWED': return 'bg-blue-100 text-blue-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'FLAGGED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getFoodCostColor = (percent: number) => {
    if (percent <= 30) return 'text-green-600';
    if (percent <= 35) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Shift P&L Review</h1>
        <p className="text-gray-600 mt-1">Review and approve shift-level profit & loss statements</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">KES {summary.total_revenue?.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">{summary.shift_count} shifts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Gross Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                KES {summary.total_gross_profit?.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {summary.avg_profit_margin?.toFixed(1)}% margin
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Food Cost %</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${getFoodCostColor(summary.avg_food_cost_percent)}`}>
                {summary.avg_food_cost_percent?.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Average across shifts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Variance Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">
                KES {summary.total_variance_cost?.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Total unexplained</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex gap-2">
              {['all', 'PENDING_REVIEW', 'REVIEWED', 'APPROVED', 'FLAGGED'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(status)}
                  size="sm"
                >
                  {status === 'all' ? 'All' : status.replace('_', ' ')}
                </Button>
              ))}
            </div>

            <div className="flex gap-2 ml-auto">
              <input
                type="date"
                className="border rounded-md px-3 py-1 text-sm"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                placeholder="Start date"
              />
              <input
                type="date"
                className="border rounded-md px-3 py-1 text-sm"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                placeholder="End date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* P&L List */}
      {isLoading ? (
        <div className="text-center py-12">Loading shift P&Ls...</div>
      ) : !pnls || pnls.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No shift P&Ls found for the selected filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pnls.map((pnl) => (
            <Link key={pnl.id} href={`/dashboard/branch-accounting/shift-pnl/${pnl.shift_id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-semibold">{pnl.shift_name}</h3>
                        <Badge className={getStatusColor(pnl.status)}>
                          {pnl.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {format(new Date(pnl.shift_date), 'EEEE, MMMM dd, yyyy')}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-gray-600">Food Cost %</p>
                      <p className={`text-2xl font-bold ${getFoodCostColor(pnl.food_cost_percent)}`}>
                        {pnl.food_cost_percent.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Total Revenue</p>
                      <p className="font-bold">KES {pnl.total_revenue.toLocaleString()}</p>
                      <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                        <div>POS: {pnl.pos_revenue.toLocaleString()}</div>
                        {pnl.buffet_revenue > 0 && <div>Buffet: {pnl.buffet_revenue.toLocaleString()}</div>}
                        {pnl.catering_revenue > 0 && <div>Catering: {pnl.catering_revenue.toLocaleString()}</div>}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Theoretical COGS</p>
                      <p className="font-bold">KES {pnl.theoretical_cogs.toLocaleString()}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Actual COGS</p>
                      <p className="font-bold">KES {pnl.actual_cogs.toLocaleString()}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Variance</p>
                      <p className={`font-bold ${pnl.variance_cost > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        KES {Math.abs(pnl.variance_cost).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Gross Profit</p>
                      <p className="font-bold text-green-600">
                        KES {pnl.gross_profit.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {((pnl.gross_profit / pnl.total_revenue) * 100).toFixed(1)}% margin
                      </p>
                    </div>
                  </div>

                  {pnl.variance_cost > 200 && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <p className="text-sm text-yellow-800">
                        High variance detected - requires explanation
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
