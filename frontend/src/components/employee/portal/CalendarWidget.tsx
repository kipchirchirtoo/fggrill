'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';

export function CalendarWidget() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    // Mock December 2025 (matching future-ish date or just static)
    // Let's just do a generic month view
    const dates = Array.from({ length: 31 }, (_, i) => i + 1);
    const startOffset = 3; // Start on Wednesday

    return (
        <IOSCard className="border-none shadow-sm bg-white p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-stone-900 border-l-4 border-amber-500 pl-2">Calendar</h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-400 bg-stone-100 px-2 py-1 rounded">today</span>
                    <button className="p-1 hover:bg-stone-100 rounded"><ChevronLeft className="h-4 w-4" /></button>
                    <button className="p-1 hover:bg-stone-100 rounded"><ChevronRight className="h-4 w-4" /></button>
                </div>
            </div>

            <h4 className="text-lg font-bold text-stone-800 mb-2">January 2026</h4>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {days.map(d => <div key={d} className="text-[10px] font-bold text-stone-400 uppercase">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
                {dates.map(date => (
                    <div key={date} className={`
                h-8 w-8 flex items-center justify-center rounded-full mx-auto
                ${date === 25 ? 'bg-stone-900 text-white font-bold' : 'hover:bg-stone-100 text-stone-600'}
            `}>
                        {date}
                    </div>
                ))}
            </div>
        </IOSCard>
    );
}
