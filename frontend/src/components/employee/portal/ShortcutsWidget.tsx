'use client';

import React from 'react';
import {
    Calendar, Users, User, CheckSquare,
    Clock, FileText, Newspaper, DollarSign
} from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';

const SHORTCUTS = [
    { id: 'timeoff', label: 'Request Time-Off', icon: Calendar, color: 'text-sky-500', bg: 'bg-sky-50' },
    { id: 'directory', label: 'Company Directory', icon: Users, color: 'text-orange-500', bg: 'bg-orange-50' },
    { id: 'profile', label: 'My Profile', icon: User, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'checklist', label: 'Complete Checklist', icon: CheckSquare, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'timesheet', label: 'Fill in Timesheet', icon: Clock, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { id: 'orgchart', label: 'Company Org. Chart', icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'news', label: 'News', icon: Newspaper, color: 'text-stone-500', bg: 'bg-stone-50' },
    { id: 'expense', label: 'File an Expense Claim', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
];

export function ShortcutsWidget() {
    return (
        <div className="mb-6">
            <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-emerald-500">★</span> Shortcuts
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {SHORTCUTS.map((sc) => (
                    <IOSCard
                        key={sc.id}
                        className="p-4 border-none shadow-sm bg-white hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4 group"
                    >
                        <div className={`h-10 w-10 rounded-full ${sc.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                            <sc.icon className={`h-5 w-5 ${sc.color}`} />
                        </div>
                        <span className="text-sm font-bold text-stone-700 group-hover:text-stone-900 leading-tight">
                            {sc.label}
                        </span>
                    </IOSCard>
                ))}
            </div>
        </div>
    );
}
