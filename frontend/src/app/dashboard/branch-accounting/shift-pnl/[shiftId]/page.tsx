'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, Flag, Download } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ShiftPnLDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const shiftId = params.shiftId as string;
  
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'flag'>('approve');

  const { data: pnl, isLoading } = useQuery({
    queryKey: ['shift-pnl', shiftId],
    queryFn: async () => {
      const response = await fetch(`/api/finance/shift-pnl/${shiftId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch shift P&L');
      const result = await response.json();
      return result.data;
    },
  });

  const { data: variance } = useQuery({
    queryKey: ['shift-variance', shiftId],
    queryFn: async () => {
      const response = await fetch(`/api/food-control/variance/shift/${shiftId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) return null;
      const result = await response.json();
      return result.data;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (data: { action: string; notes: string }) => {
      const response = await fetch(`/api/finance/shift-pnl/${shiftId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to review P&L');
      return response.json();
    },
    onSuccess: () => {
      toast.success('P&L reviewed successfully');
      setShowReviewModal(false);
      queryClient.invalidateQueries({ queryKey: ['shift-pnl', shiftId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleReview = () => {
    reviewMutation.mutate({
      action: reviewAction,
      notes: reviewNotes,
    });
  };

  if (isLoading) {
    return <div className="p-6 text-center">Loading shift P&L...</div>;
  }

  if (!pnl) {
    return <div className="p-6 text-center">Shift P&L not found</div>;
  }

  const profitMargin = (pnl.gross_profit / pnl.total_revenue) * 100;
  const variancePercent = (pnl.variance_cost / pnl.theoretical_cogs) * 100;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/branch-accounting/shift-pnl">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{pnl.shift_name}</h1>
              <Badge className={
                pnl.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                pnl.status === 'FLAGGED' ? 'bg-red-100 text-red-800' :
                pnl.status === 'REVIEWED' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }>
                {pnl.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-gray-600 mt-1">
              {format(new Date(pnl.shift_date), 'EEEE, MMMM dd, yyyy')}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {(pnl.status === 'PENDING_REVIEW' || pnl.status === 'REVIEWED') && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setReviewAction('flag');
                  setShowReviewModal(true);
                }}
              >
                <Flag className="w-4 h-4 mr-2" />
                Flag for Audit
              </Button>
              <Button
                onClick={() => {
                  setReviewAction('approve');
                  setShowReviewModal(true);
                }}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </>
          )}
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">KES {pnl.total_revenue.toLocaleString()}</p>
            <div className="text-xs text-gray-600 mt-2 space-y-1">
              <div className="flex justify-between">
                <span>POS:</span>
                <span className="font-medium">KES {pnl.pos_revenue.toLocaleString()}</span>
              </div>
              {pnl.buffet_revenue > 0 && (
                <div className="flex justify-between">
                  <span>Buffet:</span>
                  <span className="font-medium">KES {pnl.buffet_revenue.toLocaleString()}</span>
                </div>
              )}
              {pnl.catering_revenue > 0 && (
                <div className="flex justify-between">
                  <span>Catering:</span>
                  <span className="font-medium">KES {pnl.catering_revenue.toLocaleString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">COGS Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Theoretical</p>
                <p className="text-lg font-bold">KES {pnl.theoretical_cogs.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Actual</p>
                <p className="text-lg font-bold">KES {pnl.actual_cogs.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Variance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${pnl.variance_cost > 0 ? 'text-red-600' : 'text-green-600'}`}>
              KES {Math.abs(pnl.variance_cost).toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {variancePercent.toFixed(1)}% of theoretical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Gross Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              KES {pnl.gross_profit.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {profitMargin.toFixed(1)}% margin
            </p>
            <p className={`text-sm font-medium mt-1 ${
              pnl.food_cost_percent <= 30 ? 'text-green-600' :
              pnl.food_cost_percent <= 35 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              Food Cost: {pnl.food_cost_percent.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pos">POS Analysis</TabsTrigger>
          {pnl.buffet_revenue > 0 && <TabsTrigger value="buffet">Buffet</TabsTrigger>}
          {pnl.catering_revenue > 0 && <TabsTrigger value="catering">Catering</TabsTrigger>}
          <TabsTrigger value="variance">Variance Detail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">POS Sales</span>
                  <span className="font-bold">KES {pnl.pos_revenue.toLocaleString()}</span>
                </div>
                {pnl.buffet_revenue > 0 && (
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Buffet Revenue</span>
                    <span className="font-bold">KES {pnl.buffet_revenue.toLocaleString()}</span>
                  </div>
                )}
                {pnl.catering_revenue > 0 && (
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Catering Revenue</span>
                    <span className="font-bold">KES {pnl.catering_revenue.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Theoretical COGS</p>
                    <p className="text-2xl font-bold">KES {pnl.theoretical_cogs.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Based on recipes</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Actual COGS</p>
                    <p className="text-2xl font-bold">KES {pnl.actual_cogs.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Based on stock usage</p>
                  </div>
                </div>

                <div className={`p-4 rounded-lg ${pnl.variance_cost > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <p className="text-sm text-gray-600 mb-1">Variance</p>
                  <p className={`text-2xl font-bold ${pnl.variance_cost > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {pnl.variance_cost > 0 ? '+' : ''}KES {pnl.variance_cost.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {variancePercent.toFixed(1)}% of theoretical COGS
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>POS Sales Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">POS sales breakdown and top-selling items will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Variance Detail</CardTitle>
            </CardHeader>
            <CardContent>
              {variance && variance.items ? (
                <div className="space-y-2">
                  {variance.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-sm text-gray-600">
                          Expected: {item.theoretical_qty} {item.unit} | Actual: {item.actual_qty} {item.unit}
                        </p>
                        {item.explanation && (
                          <p className="text-xs text-gray-500 mt-1">
                            Explanation: {item.explanation}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${item.variance_qty >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {item.variance_qty >= 0 ? '+' : ''}{item.variance_qty} {item.unit}
                        </p>
                        <p className="text-sm text-gray-600">
                          KES {Math.abs(item.variance_cost).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No variance data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve Shift P&L' : 'Flag for Audit'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="review_notes">Notes {reviewAction === 'flag' ? '*' : '(Optional)'}</Label>
              <Textarea
                id="review_notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={
                  reviewAction === 'approve'
                    ? 'Any observations or comments'
                    : 'Explain why this P&L is being flagged'
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={reviewMutation.isPending || (reviewAction === 'flag' && !reviewNotes)}
              variant={reviewAction === 'flag' ? 'destructive' : 'default'}
            >
              {reviewMutation.isPending ? 'Processing...' : reviewAction === 'approve' ? 'Approve' : 'Flag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
