'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import { Building2, ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MultiBranchSelectorProps {
    className?: string;
    selectedIds: number[];
    onChange: (ids: number[]) => void;
    placeholder?: string;
}

export function MultiBranchSelector({
    className = '',
    selectedIds,
    onChange,
    placeholder = "Select Branches"
}: MultiBranchSelectorProps) {
    const { userBranches, isLoading } = useBranch();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleBranch = (id: number) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(i => i !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const toggleAll = () => {
        if (selectedIds.length === userBranches.length) {
            onChange([]);
        } else {
            onChange(userBranches.map(b => b.id));
        }
    };

    const getDisplayText = () => {
        if (selectedIds.length === 0) return placeholder;
        if (selectedIds.length === userBranches.length) return "All Branches";
        if (selectedIds.length === 1) {
            return userBranches.find(b => b.id === selectedIds[0])?.name || placeholder;
        }
        return `${selectedIds.length} Branches Selected`;
    };

    if (isLoading) {
        return <div className="h-10 w-48 bg-stone-100 animate-pulse rounded-xl" />;
    }

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-4 py-2.5 h-10 shadow-sm hover:border-stone-900 transition-all text-left min-w-[200px]"
            >
                <Building2 className="h-4 w-4 text-stone-400" />
                <span className="text-sm font-bold text-stone-900 flex-1 truncate">{getDisplayText()}</span>
                <ChevronDown className={cn("h-4 w-4 text-stone-400 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 left-0 w-64 bg-white border border-stone-200 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="max-h-60 overflow-y-auto">
                        <div
                            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors border-b border-stone-100 mb-1"
                            onClick={toggleAll}
                        >
                            <div className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                selectedIds.length === userBranches.length ? "bg-stone-900 border-stone-900" : "border-stone-300"
                            )}>
                                {selectedIds.length === userBranches.length && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className="text-sm font-bold text-stone-900 tracking-tight">Select All</span>
                        </div>
                        {userBranches.map((branch) => {
                            const isSelected = selectedIds.includes(branch.id);
                            return (
                                <div
                                    key={branch.id}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors"
                                    onClick={() => toggleBranch(branch.id)}
                                >
                                    <div className={cn(
                                        "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                        isSelected ? "bg-stone-900 border-stone-900" : "border-stone-300"
                                    )}>
                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className="text-sm font-medium text-stone-600 truncate">{branch.name}</span>
                                </div>
                            );
                        })}
                    </div>
                    {selectedIds.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-stone-100 flex justify-between items-center px-1">
                            <span className="text-[10px] uppercase font-black tracking-widest text-stone-400">{selectedIds.length} Selected</span>
                            <button
                                onClick={() => onChange([])}
                                className="text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors uppercase tracking-widest"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
