'use client';

import React from 'react';
import { Calendar } from 'lucide-react';

export type DateRangePreset = 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface DateRangeSelectorProps {
    startDate: string;
    endDate: string;
    onRangeChange: (start: string, end: string) => void;
    preset: DateRangePreset;
    onPresetChange: (preset: DateRangePreset) => void;
    className?: string;
}

export function DateRangeSelector({
    startDate,
    endDate,
    onRangeChange,
    preset,
    onPresetChange,
    className
}: DateRangeSelectorProps) {

    const handlePresetClick = (p: DateRangePreset) => {
        onPresetChange(p);

        const end = new Date();
        let start = new Date();

        switch (p) {
            case 'week':
                start.setDate(end.getDate() - 7);
                break;
            case 'month':
                start.setMonth(end.getMonth() - 1);
                break;
            case 'quarter':
                start.setMonth(end.getMonth() - 3);
                break;
            case 'year':
                start.setFullYear(end.getFullYear() - 1);
                break;
            default:
                return;
        }

        onRangeChange(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    };

    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
            <div className="flex bg-stone-100 p-1 rounded-lg border border-stone-200">
                {(['week', 'month', 'quarter', 'year'] as const).map((p) => (
                    <button
                        key={p}
                        onClick={() => handlePresetClick(p)}
                        className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${preset === p
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-500 hover:text-stone-700'
                            }`}
                    >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-3 py-1.5">
                <Calendar className="h-4 w-4 text-stone-400" />
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                        onPresetChange('custom');
                        onRangeChange(e.target.value, endDate);
                    }}
                    className="text-[13px] text-stone-600 bg-transparent border-none focus:ring-0 p-0 w-[110px]"
                />
                <span className="text-stone-300">→</span>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                        onPresetChange('custom');
                        onRangeChange(startDate, e.target.value);
                    }}
                    className="text-[13px] text-stone-600 bg-transparent border-none focus:ring-0 p-0 w-[110px]"
                />
            </div>
        </div>
    );
}
