'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Calendar, Users, DollarSign, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface CateringEvent {
  id: string;
  catering_number: string;
  event_date: string;
  event_name: string;
  client_name: string;
  venue: string;
  expected_guests: number;
  actual_guests: number | null;
  price_per_guest: number;
  status: 'PLANNED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  total_revenue: number | null;
  total_cost: number | null;
  profit_margin: number | null;
}

export default function CateringListPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: events, isLoading } = useQuery<CateringEvent[]>({
    queryKey: ['catering-events', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/catering-food-control?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch catering events');
      const result = await response.json();
      return result.data;
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'bg-blue-100 text-blue-800';
      case 'CONFIRMED': return 'bg-purple-100 text-purple-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Catering Management</h1>
          <p className="text-gray-600 mt-1">Manage outside catering events and track profitability</p>
        </div>
        <Link href="/dashboard/branch-accounting/catering/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Catering Event
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'PLANNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].map((status) => (
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

      {/* Event List */}
      {isLoading ? (
        <div className="text-center py-12">Loading catering events...</div>
      ) : !events || events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No catering events found</p>
            <Link href="/dashboard/branch-accounting/catering/new">
              <Button className="mt-4">Create First Event</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <Link key={event.id} href={`/dashboard/branch-accounting/catering/${event.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{event.event_name}</h3>
                        <Badge className={getStatusColor(event.status)}>
                          {event.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">#{event.catering_number}</p>
                      <p className="text-sm text-gray-600 mb-4">Client: {event.client_name}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Date</p>
                            <p className="font-medium">{format(new Date(event.event_date), 'MMM dd, yyyy')}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Venue</p>
                            <p className="font-medium">{event.venue}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Guests</p>
                            <p className="font-medium">
                              {event.actual_guests || event.expected_guests}
                              {event.actual_guests && ` / ${event.expected_guests}`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Revenue</p>
                            <p className="font-medium">
                              KES {(event.total_revenue || (event.expected_guests * event.price_per_guest)).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {event.profit_margin !== null && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Profit Margin</span>
                            <span className={`font-bold ${event.profit_margin >= 30 ? 'text-green-600' : event.profit_margin >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {event.profit_margin.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}
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
