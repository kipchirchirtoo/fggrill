'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { TrendingUp, Plus, RefreshCw, Loader2, Target, BarChart3, Calendar, Edit2, Trash2, Eye, LineChart } from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Forecast {
  id: number;
  branch_id: number;
  branch_name: string;
  forecast_type: string;
  metric_name: string;
  forecast_date: string;
  forecast_value: number;
  actual_value: number | null;
  confidence_level: number;
  model_used: string;
  notes: string;
}

interface ForecastModel { id: number; name: string; description: string; model_type: string; accuracy_score: number; }

function ForecastingContent() {
  const { user } = useAuth();
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [models, setModels] = useState<ForecastModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingForecast, setEditingForecast] = useState<Forecast | null>(null);
  const [filterType, setFilterType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewForecast, setViewForecast] = useState<Forecast | null>(null);
  const [formData, setFormData] = useState({
    forecast_type: 'revenue',
    metric_name: '',
    forecast_date: new Date().toISOString().split('T')[0],
    forecast_value: '',
    confidence_level: '80',
    model_used: 'linear',
    notes: ''
  });

  const fetchForecasts = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const res = await fetch(`${API_BASE}/api/central-operations/strategic-planning/forecasting`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (res.ok) {
        const data = await res.json();
        setForecasts(Array.isArray(data.data?.forecasts) ? data.data.forecasts : []);
        setModels(Array.isArray(data.data?.models) ? data.data.models : []);
      }
    } catch (error) { 
      console.error('Error:', error); 
      toast.error('Failed to load forecasts'); 
    } finally { 
      setIsLoading(false); 
    }
  }, []);

  useEffect(() => { fetchForecasts(); }, [fetchForecasts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const url = editingForecast 
        ? `${API_BASE}/api/central-operations/strategic-planning/forecasting/${editingForecast.id}`
        : `${API_BASE}/api/central-operations/strategic-planning/forecasting`;
      const method = editingForecast ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          forecast_value: parseFloat(formData.forecast_value) || 0,
          confidence_level: parseFloat(formData.confidence_level) || 80
        })
      });
      
      if (res.ok) { 
        toast.success(editingForecast ? 'Forecast updated' : 'Forecast created'); 
        setShowForm(false);
        setEditingForecast(null);
        resetForm();
        fetchForecasts(); 
      } else { 
        toast.error('Failed to save forecast'); 
      }
    } catch (error) { 
      console.error('Error:', error); 
      toast.error('Failed to save forecast'); 
    }
  };

  const handleEdit = (forecast: Forecast) => {
    setEditingForecast(forecast);
    setFormData({
      forecast_type: forecast.forecast_type,
      metric_name: forecast.metric_name,
      forecast_date: forecast.forecast_date?.split('T')[0] || '',
      forecast_value: forecast.forecast_value?.toString() || '',
      confidence_level: forecast.confidence_level?.toString() || '80',
      model_used: forecast.model_used || 'linear',
      notes: forecast.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this forecast?')) return;
    try {
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const res = await fetch(`${API_BASE}/api/central-operations/strategic-planning/forecasting/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Forecast deleted');
        fetchForecasts();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to delete forecast');
    }
  };

  const handleUpdateActual = async (id: number, actual_value: string) => {
    try {
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const res = await fetch(`${API_BASE}/api/central-operations/strategic-planning/forecasting/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_value: parseFloat(actual_value) || 0 })
      });
      if (res.ok) {
        toast.success('Actual value updated');
        fetchForecasts();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update');
    }
  };

  const resetForm = () => {
    setFormData({
      forecast_type: 'revenue',
      metric_name: '',
      forecast_date: new Date().toISOString().split('T')[0],
      forecast_value: '',
      confidence_level: '80',
      model_used: 'linear',
      notes: ''
    });
  };

  const filteredForecasts = forecasts.filter(f => {
    if (filterType && f.forecast_type !== filterType) return false;
    if (searchTerm && !f.metric_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const forecastTypes = ['revenue', 'expense', 'occupancy', 'sales', 'custom'];
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'revenue': return 'bg-gray-100 text-gray-700';
      case 'expense': return 'bg-gray-100 text-gray-700';
      case 'occupancy': return 'bg-gray-100 text-gray-700';
      case 'sales': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const avgConfidence = forecasts.length > 0 ? (forecasts.reduce((sum, f) => sum + (f.confidence_level || 0), 0) / forecasts.length) : 0;
  const accurateForecasts = forecasts.filter(f => f.actual_value !== null && Math.abs((f.forecast_value - f.actual_value) / f.forecast_value) < 0.1).length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CENTRAL_OPERATIONS_MANAGER, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Forecasting</h1>
              <p className="text-gray-500">Predict future trends and plan accordingly</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchForecasts} disabled={isLoading} leftIcon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}>
                Refresh
              </IOSButton>
              <IOSButton variant="primary" onClick={() => { resetForm(); setEditingForecast(null); setShowForm(true); }} leftIcon={<Plus className="h-4 w-4" />}>
                Add Forecast
              </IOSButton>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <BarChart3 className="h-6 w-6 text-gray-500 mb-2" />
              <p className="text-sm text-gray-500">Total Forecasts</p>
              <p className="text-xl font-bold">{forecasts.length}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <TrendingUp className="h-6 w-6 text-gray-500 mb-2" />
              <p className="text-sm text-gray-500">Revenue Forecasts</p>
              <p className="text-xl font-bold text-gray-600">{forecasts.filter(f => f.forecast_type === 'revenue').length}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <Target className="h-6 w-6 text-gray-500 mb-2" />
              <p className="text-sm text-gray-500">Avg Confidence</p>
              <p className="text-xl font-bold text-gray-600">{avgConfidence.toFixed(0)}%</p>
            </IOSCard>
            <IOSCard className="p-4">
              <LineChart className="h-6 w-6 text-gray-500 mb-2" />
              <p className="text-sm text-gray-500">Accurate (±10%)</p>
              <p className="text-xl font-bold text-gray-600">{accurateForecasts}</p>
            </IOSCard>
          </div>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Search</label>
                <Input 
                  placeholder="Search metrics..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700">
                  <option value="">All Types</option>
                  {forecastTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
            </div>
          </IOSCard>

          {/* Add/Edit Form */}
          {showForm && (
            <IOSCard className="p-4">
              <h3 className="font-semibold text-lg mb-4">{editingForecast ? 'Edit Forecast' : 'Create New Forecast'}</h3>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Type *</label>
                  <select value={formData.forecast_type} onChange={(e) => setFormData({ ...formData, forecast_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700">
                    {forecastTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Metric Name *</label>
                  <Input value={formData.metric_name} onChange={(e) => setFormData({ ...formData, metric_name: e.target.value })} placeholder="e.g., Monthly Revenue" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Forecast Date *</label>
                  <Input type="date" value={formData.forecast_date} onChange={(e) => setFormData({ ...formData, forecast_date: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Forecast Value *</label>
                  <Input type="number" value={formData.forecast_value} onChange={(e) => setFormData({ ...formData, forecast_value: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Confidence Level (%)</label>
                  <Input type="number" min="0" max="100" value={formData.confidence_level} onChange={(e) => setFormData({ ...formData, confidence_level: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Model</label>
                  <select value={formData.model_used} onChange={(e) => setFormData({ ...formData, model_used: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700">
                    <option value="linear">Linear</option>
                    <option value="exponential">Exponential</option>
                    <option value="seasonal">Seasonal</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes" />
                </div>
                <div className="flex items-end gap-2">
                  <IOSButton type="submit" variant="primary">{editingForecast ? 'Update' : 'Create'}</IOSButton>
                  <IOSButton type="button" variant="secondary" onClick={() => { setShowForm(false); setEditingForecast(null); }}>Cancel</IOSButton>
                </div>
              </form>
            </IOSCard>
          )}

          {/* Forecasts Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : filteredForecasts.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <TrendingUp className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No forecasts found. Create your first forecast to get started.</p>
            </IOSCard>
          ) : (
            <IOSCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Metric</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Branch</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Forecast</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Actual</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">Confidence</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredForecasts.map((forecast) => (
                      <tr key={forecast.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(forecast.forecast_type)}`}>
                            {forecast.forecast_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium">{forecast.metric_name}</td>
                        <td className="py-3 px-4">{new Date(forecast.forecast_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4">{forecast.branch_name || 'All'}</td>
                        <td className="py-3 px-4 text-right font-medium">{parseFloat(forecast.forecast_value?.toString() || '0').toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">
                          {forecast.actual_value !== null ? parseFloat(forecast.actual_value?.toString() || '0').toLocaleString() : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div className="bg-gray-500 h-2 rounded-full" style={{ width: `${forecast.confidence_level || 0}%` }} />
                            </div>
                            <span className="text-sm">{forecast.confidence_level || 0}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <IOSButton variant="ghost" size="sm" onClick={() => setViewForecast(forecast)}>
                              <Eye className="h-4 w-4" />
                            </IOSButton>
                            <IOSButton variant="ghost" size="sm" onClick={() => handleEdit(forecast)}>
                              <Edit2 className="h-4 w-4" />
                            </IOSButton>
                            <IOSButton variant="ghost" size="sm" onClick={() => handleDelete(forecast.id)}>
                              <Trash2 className="h-4 w-4 text-gray-500" />
                            </IOSButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IOSCard>
          )}

          {/* View Dialog */}
          <Dialog open={!!viewForecast} onOpenChange={() => setViewForecast(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Forecast Details</DialogTitle>
              </DialogHeader>
              {viewForecast && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-sm text-gray-500">Type</p><p className="font-medium capitalize">{viewForecast.forecast_type}</p></div>
                    <div><p className="text-sm text-gray-500">Metric</p><p className="font-medium">{viewForecast.metric_name}</p></div>
                    <div><p className="text-sm text-gray-500">Date</p><p className="font-medium">{new Date(viewForecast.forecast_date).toLocaleDateString()}</p></div>
                    <div><p className="text-sm text-gray-500">Branch</p><p className="font-medium">{viewForecast.branch_name || 'All'}</p></div>
                    <div><p className="text-sm text-gray-500">Forecast Value</p><p className="font-medium">{parseFloat(viewForecast.forecast_value?.toString() || '0').toLocaleString()}</p></div>
                    <div><p className="text-sm text-gray-500">Actual Value</p><p className="font-medium">{viewForecast.actual_value !== null ? parseFloat(viewForecast.actual_value?.toString() || '0').toLocaleString() : 'Not recorded'}</p></div>
                    <div><p className="text-sm text-gray-500">Confidence</p><p className="font-medium">{viewForecast.confidence_level}%</p></div>
                    <div><p className="text-sm text-gray-500">Model</p><p className="font-medium capitalize">{viewForecast.model_used || 'Linear'}</p></div>
                  </div>
                  {viewForecast.notes && (
                    <div><p className="text-sm text-gray-500">Notes</p><p>{viewForecast.notes}</p></div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function ForecastingPage() {
  return (
    <BranchPageWrapper>
      <ForecastingContent />
    </BranchPageWrapper>
  );
}
