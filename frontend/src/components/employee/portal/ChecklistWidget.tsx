'use client';

import React from 'react';
import { CheckSquare, ArrowRight } from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';

export function ChecklistWidget() {
    return (
        <IOSCard className="p-0 border-none shadow-sm bg-white overflow-hidden h-full flex flex-col">
            <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-stone-900">Active Checklists</h3>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-center">
                <p className="text-sm text-stone-500 italic mb-4">
                    You have <span className="font-bold text-stone-900">1 active checklist</span> that needs completing.
                </p>
                <div className="space-y-2">
                    <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 flex items-center justify-between group cursor-pointer hover:border-emerald-300 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <div>
                                <p className="text-xs font-bold text-stone-900 group-hover:text-emerald-700">Daily Opening Checks</p>
                                <p className="text-[10px] text-stone-400">Due today at 10:00 AM</p>
                            </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-stone-300 group-hover:text-emerald-500" />
                    </div>
                </div>
            </div>
        </IOSCard>
    );
}
