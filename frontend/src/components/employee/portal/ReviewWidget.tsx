'use client';

import React from 'react';
import { Award } from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';

export function ReviewWidget() {
    const reviews = [
        { type: 'Annual', description: '2023 Annual Review', date: '30/11/2023', status: 'Planned' },
        { type: 'Peer', description: 'Mid-Year Peer Evaluation', date: '27/07/2023', status: 'Completed' },
        { type: 'Annual', description: '2022 Annual Review', date: '25/11/2022', status: 'Completed' },
        { type: 'Annual', description: '2021 Annual Review', date: '24/08/2021', status: 'Completed' },
    ];

    return (
        <IOSCard className="border-none shadow-sm bg-stone-50 overflow-hidden h-full">
            <div className="p-4 flex items-center gap-2 border-b border-stone-200">
                <Award className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-stone-900">Recent Reviews</h3>
            </div>
            <div className="p-0">
                <table className="w-full text-xs">
                    <thead className="bg-stone-100 text-stone-500 font-bold uppercase">
                        <tr>
                            <th className="text-left p-3">Type</th>
                            <th className="text-left p-3">Description</th>
                            <th className="text-right p-3">Date</th>
                            <th className="text-right p-3">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                        {reviews.map((rev, i) => (
                            <tr key={i} className="bg-white hover:bg-stone-50 transition-colors">
                                <td className="p-3 font-medium text-stone-900">{rev.type}</td>
                                <td className="p-3 text-stone-600">{rev.description}</td>
                                <td className="p-3 text-right text-stone-500">{rev.date}</td>
                                <td className="p-3 text-right">
                                    <span className={`px-2 py-0.5 rounded-full font-bold ${rev.status === 'Planned' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                        }`}>
                                        {rev.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </IOSCard>
    );
}
