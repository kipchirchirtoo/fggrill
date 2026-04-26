'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Users, DollarSign, Calendar, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function BuffetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const buffetId = params.buffetId as string;
  
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualGuests, setActualGuests] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const { data: buffet, isLoading } = useQuery({
    queryKey: ['buffet', buffetId],
    queryFn: async () => {
      const response = await fetch(`/api/buffet/${buffetId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch buffet');
      const result = await response.json();
      return result.data;
    },
  });

  const { data: variance } = useQuery({
    queryKey: ['buffet-variance', buffetId],
    queryFn: async () => {
      if (buffet?.status !== 'CLOSED') return null;
      const response = await fetch(`/api/food-control/variance/buffet/${buffetId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) return null;
      const result = await response.json();
      return result.data;
    },
    enabled: buffet?.status === 'CLOSED',
  });

  const openBuffetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/buffet/${buffetId}/open`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to open buffet');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Buffet opened successfully');
      queryClient.invalidateQueries({ queryKey: ['buffet', buffetId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const closeBuffetMutation = useMutation({
    mutationFn: async (data: { actual_guests: number; notes?: string }) => {
      const response = await fetch(`/api/buffet/${buffetId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to close buffet');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Buffet closed successfully');
      setShowCloseModal(false);
      queryClient.invalidateQueries({ queryKey: ['buffet', buffetId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const cancelBuffetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/buffet/${buffetId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to cancel buffet');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Buffet cancelled');
      queryClient.invalidateQueries({ queryKey: ['buffet', buffetId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleClose = () => {
    if (!actualGuests || parseInt(actualGuests) < 0) {
      toast.error('Please enter valid actual guest count');
      return;
    }
    closeBuffetMutation.mutate({
      actual_guests: parseInt(actualGuests),
      notes: closeNotes,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'bg-blue-100 text-blue-800';
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'CLOSED': return 'bg-gray-100 text-gray-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center">Loading buffet details...</div>;
  }

  if (!buffet) {
    return <div className="p-6 text-center">Buffet not found</div>;
  }

  const expectedRevenue = buffet.expected_guests * buffet.price_per_guest;
  const actualRevenue = buffet.actual_guests ? buffet.actual_guests * buffet.price_per_guest : null;
  const guestVariance = buffet.actual_guests ? buffet.actual_guests - buffet.expected_guests : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/branch-accounting/buffet">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{buffet.buffet_name}</h1>
              <Badge className={getStatusColor(buffet.status)}>
                {buffet.status}
              </Badge>
            </div>
            <p className="text-gray-600 mt-1">#{buffet.buffet_number}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {buffet.status === 'PLANNED' && (
            <>
              <Button onClick={() => openBuffetMutation.mutate()} disabled={openBuffetMutation.isPending}>
                Open Buffet
              </Button>
              <Button variant="destructive" onClick={() => cancelBuffetMutation.mutate()} disabled={cancelBuffetMutation.isPending}>
                Cancel
              </Button>
            </>
          )}
          {buffet.status === 'ACTIVE' && (
            <Button onClick={() => setShowCloseModal(true)}>
              Close Buffet
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <p className="text-2xl font-bold">{format(new Date(buffet.buffet_date), 'MMM dd')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Guests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <p className="text-2xl font-bold">
                {buffet.actual_guests || buffet.expected_guests}
                {buffet.actual_guests && <span className="text-sm text-gray-500"> / {buffet.expected_guests}</span>}
              </p>
            </div>
            {guestVariance !== null && (
              <p className={`text-sm mt-1 ${guestVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {guestVariance >= 0 ? '+' : ''}{guestVariance} variance
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Price/Guest</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <p className="text-2xl font-bold">KES {buffet.price_per_guest.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              KES {(actualRevenue || expectedRevenue).toLocaleString()}
            </p>
            {actualRevenue && (
              <p className="text-sm text-gray-500 mt-1">
                Expected: KES {expectedRevenue.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Menu Items */}
      <Card>
        <CardHeader>
          <CardTitle>Menu Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {buffet.menu_items?.map((item: any) => (
              <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{item.menu_item_name}</p>
                  <p className="text-sm text-gray-600">
                    {item.portion_per_guest} portion(s) per guest
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {Math.round(item.portion_per_guest * (buffet.actual_guests || buffet.expected_guests))} portions
                  </p>
                  <p className="text-sm text-gray-600">Total expected</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Variance Report (only for closed buffets) */}
      {buffet.status === 'CLOSED' && variance && (
        <Card>
          <CardHeader>
            <CardTitle>Variance Report</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Theoretical Cost</p>
                  <p className="text-xl font-bold">KES {variance.theoretical_cost?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Actual Cost</p>
                  <p className="text-xl font-bold">KES {variance.actual_cost?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Variance</p>
                  <p className={`text-xl font-bold ${variance.variance_amount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    KES {Math.abs(variance.variance_amount).toLocaleString()}
                    <span className="text-sm ml-2">
                      ({variance.variance_percent?.toFixed(1)}%)
                    </span>
                  </p>
                </div>
              </div>

              {/* Item-level variance */}
              {variance.items && variance.items.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Item Breakdown</h4>
                  <div className="space-y-2">
                    {variance.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{item.item_name}</p>
                          <p className="text-sm text-gray-600">
                            Expected: {item.theoretical_qty} {item.unit} | Actual: {item.actual_qty} {item.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${item.variance_qty >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {item.variance_qty >= 0 ? '+' : ''}{item.variance_qty} {item.unit}
                          </p>
                          <p className="text-sm text-gray-600">
                            KES {Math.abs(item.variance_cost).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {buffet.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{buffet.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Close Buffet Modal */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Buffet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="actual_guests">Actual Guest Count *</Label>
              <Input
                id="actual_guests"
                type="number"
                value={actualGuests}
                onChange={(e) => setActualGuests(e.target.value)}
                placeholder={buffet.expected_guests.toString()}
                min="0"
              />
              <p className="text-sm text-gray-500 mt-1">
                Expected: {buffet.expected_guests} guests
              </p>
            </div>
            <div>
              <Label htmlFor="close_notes">Notes (Optional)</Label>
              <Textarea
                id="close_notes"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Any observations or notes about the buffet service"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleClose} disabled={closeBuffetMutation.isPending}>
              {closeBuffetMutation.isPending ? 'Closing...' : 'Close Buffet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
