'use client';

import React from 'react';
import { Briefcase } from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';

export function JobPortalWidget() {
    return (
        <IOSCard className="border-none shadow-sm bg-sky-50 p-6 flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm">
                <Briefcase className="h-6 w-6 text-sky-600" />
            </div>
            <h3 className="font-bold text-sky-900 mb-1">Internal Job Portal</h3>
            <p className="text-xs text-sky-700 mb-4">
                Explore open positions within the company.<br />
                There are <span className="font-bold">3 jobs</span> currently listed.
            </p>
            <a href="#" className="text-xs font-bold text-sky-600 hover:text-sky-800 underline">
                View Opportunities
            </a>
        </IOSCard>
    );
}
