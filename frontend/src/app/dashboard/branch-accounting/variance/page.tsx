'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, MessageSquare, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Variance {
  id: string;
  shift_id: string;
  shift_date: string;
  item_sku: string;
  item_name: string;
  theoretical_qty: number;
  actual_qty: number;
  variance_qty: number;
  unit_of_measure: string;
  variance_cost: number;
  variance_percent: number;
  explanation: string | null;
  explained_by: string | null;
  explained_at: string | null;
  is_flagged: boolean;
}

export default function VariancePage() {
  const queryClient = useQueryClient();
  const [selectedVariance, setSelectedVariance] = useState<Variance | null>(null);
  const [explanation, setExplanation] = useState('');
  const [showExplainModal, setShowExplainModal] = useState(false);

  const { data: variances, isLoading } = useQuery<Variance[]>({
    queryKey: ['pending-variances'],
    queryFn: async () => {
      const response = await fetch('/api/food-control/variance/pending', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch variances');
      const result = await response.json();
      return result.data;
    },
  });

  const explainMutation = useMutation({
    mutationFn: async (data: { id: string; explanation: string }) => {
      const response = await fetch(`/api/food-control/variance/${data.id}/explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ explanation: data.explanation }),
      });
      if (!response.ok) throw new Error('Failed to explain variance');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Variance explained successfully');
      setShowExplainModal(false);
      setExplanation('');
      queryClient.invalidateQueries({ queryKey: ['pending-variances'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const flagMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/food-control/variance/${id}/flag`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to flag variance');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Variance flagged for audit');
      queryClient.invalidateQueries({ queryKey: ['pending-variances'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleExplain = (variance: Variance) => {
    setSelectedVariance(variance);
    setExplanation(variance.explanation || '');
    setShowExplainModal(true);
  };

  const handleSubmitExplanation = () => {
    if (!selectedVariance || !explanation.trim()) {
      toast.error('Please provide an explanation');
      return;
    }
    explainMutation.mutate({
      id: selectedVariance.id,
      explanation: explanation.trim(),
    });
  };

  const getVarianceSeverity = (percent: number) => {
    if (Math.abs(percent) >= 20) return 'high';
    if (Math.abs(percent) >= 10) return 'medium';
    return 'low';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Variance Management</h1>
        <p className="text-gray-600 mt-1">Review and explain food cost variances</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Variances</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{variances?.length || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Requiring attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Unexplained</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {variances?.filter(v => !v.explanation).length || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Need explanation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Cost Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              KES {variances?.reduce((sum, v) => sum + Math.abs(v.variance_cost), 0).toLocaleString() || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Across all items</p>
          </CardContent>
        </Card>
      </div>

      {/* Variance List */}
      {isLoading ? (
        <div className="text-center py-12">Loading variances...</div>
      ) : !variances || variances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No variances found - great job!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {variances.map((variance) => {
            const severity = getVarianceSeverity(variance.variance_percent);
            return (
              <Card key={variance.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{variance.item_name}</h3>
                        <Badge className={getSeverityColor(severity)}>
                          {severity.toUpperCase()}
                        </Badge>
                        {variance.is_flagged && (
                          <Badge className="bg-red-100 text-red-800">
                            <Flag className="w-3 h-3 mr-1" />
                            FLAGGED
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {format(new Date(variance.shift_date), 'EEEE, MMMM dd, yyyy')} • SKU: {variance.item_sku}
                      </p>

                      <div className="grid grid-cols-4 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">Theoretical</p>
                          <p className="font-medium">{variance.theoretical_qty} {variance.unit_of_measure}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Actual</p>
                          <p className="font-medium">{variance.actual_qty} {variance.unit_of_measure}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Variance</p>
                          <p className={`font-bold ${variance.variance_qty >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {variance.variance_qty >= 0 ? '+' : ''}{variance.variance_qty} {variance.unit_of_measure}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Cost Impact</p>
                          <p className="font-bold text-red-600">
                            KES {Math.abs(variance.variance_cost).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {variance.explanation ? (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800">
                            <strong>Explanation:</strong> {variance.explanation}
                          </p>
                          {variance.explained_at && (
                            <p className="text-xs text-green-600 mt-1">
                              Explained on {format(new Date(variance.explained_at), 'MMM dd, yyyy HH:mm')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          <p className="text-sm text-yellow-800">
                            This variance requires an explanation
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExplain(variance)}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        {variance.explanation ? 'Update' : 'Explain'}
                      </Button>
                      {!variance.is_flagged && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => flagMutation.mutate(variance.id)}
                          disabled={flagMutation.isPending}
                        >
                          <Flag className="w-4 h-4 mr-2" />
                          Flag
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Explain Modal */}
      <Dialog open={showExplainModal} onOpenChange={setShowExplainModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Explain Variance</DialogTitle>
          </DialogHeader>
          {selectedVariance && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{selectedVariance.item_name}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Variance: {selectedVariance.variance_qty >= 0 ? '+' : ''}{selectedVariance.variance_qty} {selectedVariance.unit_of_measure}
                  ({selectedVariance.variance_percent.toFixed(1)}%)
                </p>
                <p className="text-sm text-red-600 font-medium mt-1">
                  Cost Impact: KES {Math.abs(selectedVariance.variance_cost).toLocaleString()}
                </p>
              </div>

              <div>
                <Label htmlFor="explanation">Explanation *</Label>
                <Textarea
                  id="explanation"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explain the reason for this variance (e.g., wastage, theft, measurement error, recipe change)"
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Be specific and provide details that will help with future prevention
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExplainModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitExplanation}
              disabled={explainMutation.isPending || !explanation.trim()}
            >
              {explainMutation.isPending ? 'Saving...' : 'Save Explanation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
