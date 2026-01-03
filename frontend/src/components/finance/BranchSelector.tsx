'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { financeAPI } from '@/lib/api';
import { Building2, RefreshCw, ChevronDown } from 'lucide-react';

interface Branch {
    id: number;
    name: string;
    code?: string;
}

interface BranchSelectorProps {
    selectedBranch: number | null;
    onBranchChange: (branchId: number | null) => void;
    className?: string;
}

export function BranchSelector({ selectedBranch, onBranchChange, className }: BranchSelectorProps) {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchBranches = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await financeAPI.getBranches();
            console.log('Fetched branches:', response.data);
            if (response.success && Array.isArray(response.data)) {
                setBranches(response.data);
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBranches();
    }, [fetchBranches]);

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="relative flex-1 min-w-[160px]">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                <select
                    value={selectedBranch || ''}
                    onChange={(e) => onBranchChange(e.target.value ? Number(e.target.value) : null)}
                    className="w-full pl-9 pr-10 py-2 text-[13px] bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 appearance-none cursor-pointer"
                >
                    <option value="">All Branches</option>
                    {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                            {branch.name}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
            </div>
            <button
                onClick={fetchBranches}
                disabled={isLoading}
                className="p-2 text-stone-500 hover:bg-stone-100 rounded-lg transition-colors border border-stone-200 bg-white"
                title="Refresh branches"
            >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
        </div>
    );
}
