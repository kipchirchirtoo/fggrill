'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import type { ConsumptionRecord, Branch } from '@/types/inventory';

interface ConsumptionTrackingProps {
  branch: Branch;
  records: ConsumptionRecord[];
}

export function ConsumptionTracking({ branch, records }: ConsumptionTrackingProps) {
  const [activeTab, setActiveTab] = useState('bar');
  const [timeframe, setTimeframe] = useState('daily');
  const [department, setDepartment] = useState('all');

  // Process data for bar consumption
  const barData = records
    .filter(record => record.department === 'Bar')
    .reduce((acc, record) => {
      const date = new Date(record.consumption_date).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { date, total: 0 };
      }
      acc[date].total += record.quantity;
      return acc;
    }, {} as Record<string, { date: string; total: number }>);

  // Process data for sauna consumption
  const saunaData = records
    .filter(record => record.department === 'Sauna')
    .reduce((acc, record) => {
      const date = new Date(record.consumption_date).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { date, total: 0 };
      }
      acc[date].total += record.quantity;
      return acc;
    }, {} as Record<string, { date: string; total: number }>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Consumption Tracking - {branch}</h2>
        <div className="flex items-center gap-4">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
              <SelectItem value="sauna">Sauna</SelectItem>
              <SelectItem value="rooms">Rooms</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="bar">Bar</TabsTrigger>
          <TabsTrigger value="sauna">Sauna</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
        </TabsList>

        <TabsContent value="bar" className="mt-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Bar Consumption</h3>
            <div className="h-[400px] w-full">
              <BarChart width={800} height={400} data={Object.values(barData)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#4f46e5" name="Items Consumed" />
              </BarChart>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="sauna" className="mt-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Sauna Consumption</h3>
            <div className="h-[400px] w-full">
              <BarChart width={800} height={400} data={Object.values(saunaData)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#4f46e5" name="Items Consumed" />
              </BarChart>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="rooms" className="mt-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Room Consumption</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Minibar Items</h4>
                <div className="space-y-2">
                  {records
                    .filter(record => record.department === 'Rooms' && record.notes?.includes('minibar'))
                    .map(record => (
                      <div key={record.record_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{record.item_id}</span>
                        <span className="text-sm font-medium">{record.quantity}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Amenities</h4>
                <div className="space-y-2">
                  {records
                    .filter(record => record.department === 'Rooms' && record.notes?.includes('amenity'))
                    .map(record => (
                      <div key={record.record_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{record.item_id}</span>
                        <span className="text-sm font-medium">{record.quantity}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
