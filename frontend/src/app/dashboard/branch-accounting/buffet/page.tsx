'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Calendar, Users, DollarSign, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Buffet {
  id: string;
  buffet_number: string;
  buffet_date: string;
  buffet_name: string;
  expected_guests: number;
  actual_guests: number | null;
  price_per_guest: number;
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
  total_revenue: number | null;
  variance_cost: number | null;
  created_at: string;
}

export default function BuffetListPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: buffets, isLoading } = useQuery<Buffet[]>({
    queryKey: ['buffets', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/buffet?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch buffets');
      const result = await response.json();
      return result.data;
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'bg-blue-100 text-blue-800';
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'CLOSED': return 'bg-gray-100 text-gray-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Buffet Management</h1>
          <p className="text-gray-600 mt-1">Manage buffet events and track performance</p>
        </div>
        <Link href="/dashboard/branch-accounting/buffet/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Buffet Event
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'PLANNED', 'ACTIVE', 'CLOSED'].map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            onClick={() => setStatusFilter(status)}
            size="sm"
          >
            {status === 'all' ? 'All' : status}
          </Button>
        ))}
      </div>

      {/* Buffet List */}
      {isLoading ? (
        <div className="text-center py-12">Loading buffets...</div>
      ) : !buffets || buffets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No buffet events found</p>
            <Link href="/dashboard/branch-accounting/buffet/new">
              <Button className="mt-4">Create First Buffet</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {buffets.map((buffet) => (
            <Link key={buffet.id} href={`/dashboard/branch-accounting/buffet/${buffet.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{buffet.buffet_name}</h3>
                        <Badge className={getStatusColor(buffet.status)}>
                          {buffet.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">#{buffet.buffet_number}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Date</p>
                            <p className="font-medium">{format(new Date(buffet.buffet_date), 'MMM dd, yyyy')}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Guests</p>
                            <p className="font-medium">
                              {buffet.actual_guests || buffet.expected_guests} 
                              {buffet.actual_guests && ` / ${buffet.expected_guests}`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Price/Guest</p>
                            <p className="font-medium">KES {buffet.price_per_guest.toLocaleString()}</p>
                          </div>
                        </div>
                        
                        {buffet.total_revenue && (
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Revenue</p>
                              <p className="font-medium">KES {buffet.total_revenue.toLocaleString()}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
