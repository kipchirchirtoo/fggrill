'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Branch } from '@/types/inventory';
import { API_URL } from '@/lib/config';

interface StockItem {
  id: string;
  item_code: string;
  name: string;
  category: string;
  subcategory: string;
  current_stock: number;
  unit: string;
  average_cost: number;
  total_value: number;
  last_counted: string;
  variance_value: number;
}

interface StockValuationProps {
  branch: Branch;
  onBranchChange: (branch: Branch) => void;
}

import { apiClient } from '@/lib/api/core';

export function StockValuation({ branch, onBranchChange }: StockValuationProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<StockItem[]>([]);
  const [totals, setTotals] = useState({
    totalItems: 0,
    totalValue: 0,
    totalVariance: 0
  });

  const branches: Branch[] = ['Bomet', 'Kapsoit', 'Kericho', 'Mogogosiek', 'Litein', 'Bomet Town', 'Kaplong'];

  useEffect(() => {
    fetchStockValuation();
  }, [branch]);

  const fetchStockValuation = async () => {
    try {
      const res = await apiClient.get<any>(`/inventory/valuation?branch=${branch}`);

      if (!res.success) throw new Error(res.error || res.message || 'Failed to fetch stock valuation');

      const data = res.data;
      setItems(data.items);
      
      // Calculate totals
      const totalItems = data.items.length;
      const totalValue = data.items.reduce((sum: number, item: StockItem) => sum + item.total_value, 0);
      const totalVariance = data.items.reduce((sum: number, item: StockItem) => sum + item.variance_value, 0);
      
      setTotals({ totalItems, totalValue, totalVariance });
    } catch (error) {
      console.error('Error fetching stock valuation:', error);
      toast.error('Failed to fetch stock valuation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Stock Valuation Report</h2>
        <Select value={branch} onValueChange={(value) => onBranchChange(value as Branch)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            {branches.map(b => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <Card className="p-4 bg-blue-50">
          <h3 className="text-sm font-medium text-blue-600">Total Items</h3>
          <p className="text-2xl font-bold">{totals.totalItems}</p>
        </Card>
        <Card className="p-4 bg-green-50">
          <h3 className="text-sm font-medium text-green-600">Total Value</h3>
          <p className="text-2xl font-bold">KES {totals.totalValue.toLocaleString()}</p>
        </Card>
        <Card className="p-4 bg-orange-50">
          <h3 className="text-sm font-medium text-orange-600">Total Variance</h3>
          <p className="text-2xl font-bold">KES {totals.totalVariance.toLocaleString()}</p>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="relative overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Avg. Cost</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead>Last Counted</TableHead>
                <TableHead className="text-right">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.item_code}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.subcategory}</p>
                    </div>
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="text-right">
                    {item.current_stock} {item.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    KES {item.average_cost.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    KES {item.total_value.toLocaleString()}
                  </TableCell>
                  <TableCell>{new Date(item.last_counted).toLocaleDateString()}</TableCell>
                  <TableCell className={`text-right ${
                    item.variance_value < 0 ? 'text-red-600' : 
                    item.variance_value > 0 ? 'text-green-600' : ''
                  }`}>
                    {item.variance_value !== 0 && (
                      `${item.variance_value > 0 ? '+' : ''}${item.variance_value.toLocaleString()}`
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
