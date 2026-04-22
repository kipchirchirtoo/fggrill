'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';

interface CategoryBreakdown {
  category: string;
  total_sales: number;
  transaction_count: number;
  percentage: number;
}

interface CategoryBreakdownChartProps {
  data: CategoryBreakdown[];
  loading: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  rooms: '#3b82f6',
  restaurant: '#10b981',
  bar: '#f59e0b',
  spa: '#8b5cf6',
  conference: '#ec4899',
  dynamic_services: '#6b7280'
};

const CATEGORY_LABELS: Record<string, string> = {
  rooms: 'Rooms',
  restaurant: 'Restaurant',
  bar: 'Bar',
  spa: 'Spa',
  conference: 'Conference',
  dynamic_services: 'Other Services'
};

export default function CategoryBreakdownChart({ data, loading }: CategoryBreakdownChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Category Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Category Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No category data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format data for chart
  const chartData = data.map(item => ({
    name: CATEGORY_LABELS[item.category] || item.category,
    sales: item.total_sales,
    transactions: item.transaction_count,
    percentage: item.percentage,
    color: CATEGORY_COLORS[item.category] || '#6b7280'
  }));

  // Sort by sales descending
  chartData.sort((a, b) => b.sales - a.sales);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold mb-1">{data.name}</p>
          <p className="text-sm text-green-600">
            Sales: KES {data.sales.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-blue-600">
            Transactions: {data.transactions.toLocaleString()}
          </p>
          <p className="text-sm font-semibold">
            {data.percentage.toFixed(1)}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Category Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              type="number"
              tick={{ fontSize: 12 }}
              stroke="#888"
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
            />
            <YAxis 
              type="category"
              dataKey="name"
              tick={{ fontSize: 12 }}
              stroke="#888"
              width={120}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="sales" radius={[0, 8, 8, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        
        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{item.name}</p>
                <p className="text-sm font-semibold">
                  KES {(item.sales / 1000).toFixed(1)}K
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
