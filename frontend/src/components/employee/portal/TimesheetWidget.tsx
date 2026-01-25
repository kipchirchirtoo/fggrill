'use client';

import React from 'react';
import { Calendar, Edit } from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';

export function TimesheetWidget() {
    return (
        <IOSCard className="p-0 border-none shadow-sm bg-white overflow-hidden h-full flex flex-col">
            <div className="p-4 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-sky-600" />
                <h3 className="font-bold text-stone-900">Active Timesheets</h3>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-center">
                <p className="text-sm text-stone-500 italic mb-4">
                    You have <span className="font-bold text-stone-900">1 active timesheet</span> that needs updating.
                </p>
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-stone-900">Current Week</p>
                        <p className="text-[10px] text-stone-500">Jan 22 - Jan 28, 2024</p>
                    </div>
                    <button className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded flex items-center gap-1 transition-colors">
                        <Edit className="h-3 w-3" /> Update
                    </button>
                </div>
            </div>
        </IOSCard>
    );
}
