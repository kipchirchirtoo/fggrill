'use client';

import React from 'react';
import { Package } from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';

export function AssetWidget() {
    const assets = [
        { id: 'FF545333', desc: 'Toshiba Laptop', dateOut: '01/05/2020', dueBack: 'N/A' },
        { id: 'GT55543', desc: 'Building Access Card', dateOut: '02/10/2019', dueBack: 'N/A' },
        { id: 'MB2211', desc: 'Uniform Set (3)', dateOut: '15/01/2023', dueBack: 'N/A' },
    ];

    return (
        <IOSCard className="border-none shadow-sm bg-stone-50 overflow-hidden h-full">
            <div className="p-4 flex items-center gap-2 border-b border-stone-200">
                <Package className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-stone-900">Assets In Your Care</h3>
            </div>
            <div className="p-0">
                <table className="w-full text-xs">
                    <thead className="bg-stone-100 text-stone-500 font-bold uppercase">
                        <tr>
                            <th className="text-left p-3">Asset ID</th>
                            <th className="text-left p-3">Description</th>
                            <th className="text-right p-3">Date Out</th>
                            <th className="text-right p-3">Due Back</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                        {assets.map((asset, i) => (
                            <tr key={i} className="bg-white hover:bg-stone-50 transition-colors">
                                <td className="p-3 font-mono text-stone-500">{asset.id}</td>
                                <td className="p-3 font-medium text-stone-900">{asset.desc}</td>
                                <td className="p-3 text-right text-stone-500">{asset.dateOut}</td>
                                <td className="p-3 text-right text-stone-900 font-bold">{asset.dueBack}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </IOSCard>
    );
}
