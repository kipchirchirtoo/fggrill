'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface SalesFilter {
  payment_methods?: string[];
  order_types?: string[];
  categories?: string[];
}

interface DateRange {
  start: string;
  end: string;
}

interface FilterPanelProps {
  dateRange: DateRange;
  filters: SalesFilter;
  onApply: (filters: SalesFilter, dateRange: DateRange) => void;
  onReset: () => void;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'mixed', label: 'Mixed' }
];

const ORDER_TYPES = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'online', label: 'Online' },
  { value: 'booking', label: 'Booking' },
  { value: 'room_service', label: 'Room Service' },
  { value: 'dine_in', label: 'Dine-in' },
  { value: 'takeaway', label: 'Takeaway' }
];

const CATEGORIES = [
  { value: 'rooms', label: 'Rooms' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'bar', label: 'Bar' },
  { value: 'spa', label: 'Spa' },
  { value: 'conference', label: 'Conference' },
  { value: 'dynamic_services', label: 'Other Services' }
];

export default function FilterPanel({ dateRange, filters, onApply, onReset }: FilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<SalesFilter>(filters);
  const [localDateRange, setLocalDateRange] = useState<DateRange>(dateRange);
  const [startDate, setStartDate] = useState<Date | undefined>(
    dateRange.start ? new Date(dateRange.start) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    dateRange.end ? new Date(dateRange.end) : undefined
  );

  // Quick date range presets
  const setPreset = (preset: string) => {
    const end = new Date();
    let start = new Date();

    switch (preset) {
      case 'today':
        start = new Date();
        break;
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(end.getFullYear() - 1);
        break;
    }

    setStartDate(start);
    setEndDate(end);
    setLocalDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  };

  // Handle checkbox changes
  const handleCheckboxChange = (category: keyof SalesFilter, value: string, checked: boolean) => {
    setLocalFilters(prev => {
      const current = prev[category] || [];
      if (checked) {
        return { ...prev, [category]: [...current, value] };
      } else {
        return { ...prev, [category]: current.filter(v => v !== value) };
      }
    });
  };

  // Update date range when dates change
  useEffect(() => {
    if (startDate && endDate) {
      setLocalDateRange({
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      });
    }
  }, [startDate, endDate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Range */}
        <div className="space-y-2">
          <Label>Date Range</Label>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setPreset('today')}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset('week')}>
              Last 7 Days
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset('month')}>
              Last 30 Days
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset('year')}>
              Last Year
            </Button>
          </div>
          <div className="flex gap-4 mt-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP') : 'Start date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP') : 'End date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-2">
          <Label>Payment Methods</Label>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((method) => (
              <div key={method.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`payment-${method.value}`}
                  checked={localFilters.payment_methods?.includes(method.value)}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange('payment_methods', method.value, checked as boolean)
                  }
                />
                <label
                  htmlFor={`payment-${method.value}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {method.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Order Types */}
        <div className="space-y-2">
          <Label>Order Types</Label>
          <div className="grid grid-cols-2 gap-2">
            {ORDER_TYPES.map((type) => (
              <div key={type.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`order-${type.value}`}
                  checked={localFilters.order_types?.includes(type.value)}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange('order_types', type.value, checked as boolean)
                  }
                />
                <label
                  htmlFor={`order-${type.value}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {type.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-2">
          <Label>Categories</Label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((category) => (
              <div key={category.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category.value}`}
                  checked={localFilters.categories?.includes(category.value)}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange('categories', category.value, checked as boolean)
                  }
                />
                <label
                  htmlFor={`category-${category.value}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {category.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => onApply(localFilters, localDateRange)}
            className="flex-1"
          >
            Apply Filters
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setLocalFilters({});
              setStartDate(undefined);
              setEndDate(undefined);
              onReset();
            }}
          >
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
