'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function KitchenVariancePage() {
  const { user } = useAuth();
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPendingBills();
    }
  }, [user]);

  const fetchPendingBills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('staff_credit_bills')
        .select(`
          *,
          staff:staff_profiles(first_name, last_name, employee_id),
          kitchen_shift_controls(shift_date, shift_type, item_name, variance)
        `)
        .eq('status', 'pending')
        .eq('branch_id', user?.branch_id || 0)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter to only show bills that originated from kitchen controls
      // (Those have a linked kitchen_shift_controls record)
      const kitchenBills = (data || []).filter(b => b.kitchen_shift_controls && b.kitchen_shift_controls.length > 0);
      setBills(kitchenBills);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load pending bills');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (billId: number, action: 'approve' | 'reject') => {
    try {
      toast.loading(`Processing...`, { id: 'action' });
      
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      
      const { error } = await supabase
        .from('staff_credit_bills')
        .update({ 
          status: newStatus,
          accountant_confirmed_at: new Date().toISOString()
        })
        .eq('id', billId);

      if (error) throw error;

      toast.success(`Bill ${action}d successfully`, { id: 'action' });
      fetchPendingBills();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process bill', { id: 'action' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Kitchen Variances & Pending Staff Bills</h1>
        <p className="text-muted-foreground">
          Review and approve pending credit bills charged to staff due to kitchen stock shortages.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bills.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
            No pending kitchen variance bills to review.
          </div>
        ) : (
          bills.map((bill) => {
            const control = bill.kitchen_shift_controls?.[0];
            return (
              <Card key={bill.id} className="flex flex-col shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3 border-b bg-muted/10">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg font-semibold text-primary">
                        {bill.staff?.first_name} {bill.staff?.last_name}
                      </CardTitle>
                      <CardDescription>ID: {bill.staff?.employee_id}</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                      Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 flex-1 flex flex-col space-y-4">
                  <div className="bg-muted/30 p-3 rounded-md space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span className="font-medium">{control?.shift_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shift:</span>
                      <span className="font-medium">Shift {control?.shift_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Item:</span>
                      <span className="font-medium">{control?.item_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shortage:</span>
                      <span className="font-medium text-destructive">{control?.variance} units</span>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Reason provided</span>
                    <p className="text-sm italic border-l-2 border-primary/30 pl-2">
                      "{bill.reason}"
                    </p>
                  </div>

                  <div className="mt-auto pt-4 flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Amount to Deduct</span>
                      <span className="text-xl font-bold text-destructive">KES {Number(bill.amount).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 text-destructive hover:bg-destructive hover:text-white"
                      onClick={() => handleAction(bill.id, 'reject')}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleAction(bill.id, 'approve')}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
