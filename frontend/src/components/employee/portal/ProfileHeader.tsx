'use client';

import React from 'react';
import { User, MapPin, Briefcase, Calendar } from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';

interface ProfileHeaderProps {
    employee: {
        firstName: string;
        lastName: string;
        position: string;
        department: string;
        code: string;
        status: string;
        location: string;
        joinDate: string;
        avatarUrl?: string; // Optional real avatar
    };
}

export function ProfileHeader({ employee }: ProfileHeaderProps) {
    // Calculate tenure roughly
    const joinDate = new Date(employee.joinDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - joinDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const tenure = `${years > 0 ? `${years} years ` : ''}${months} months`;

    return (
        <IOSCard className="p-6 border-none shadow-sm bg-white mb-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Avatar */}
                <div className="relative">
                    <div className="h-24 w-24 rounded-full bg-stone-100 border-4 border-white shadow-sm flex items-center justify-center overflow-hidden">
                        {employee.avatarUrl ? (
                            <img src={employee.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                            <User className="h-12 w-12 text-stone-400" />
                        )}
                    </div>
                    <div className="absolute bottom-0 right-0 h-6 w-6 bg-emerald-500 border-2 border-white rounded-full" title="Active Status"></div>
                </div>

                {/* Main Info */}
                <div className="text-center md:text-left flex-1">
                    <h1 className="text-2xl font-bold text-stone-900">{employee.firstName} {employee.lastName}</h1>
                    <p className="text-lg text-stone-500 font-medium">{employee.position}</p>
                </div>

                {/* Detailed Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-4 text-sm w-full md:w-auto mt-4 md:mt-0 bg-stone-50 p-4 rounded-xl border border-stone-100">
                    <div>
                        <p className="text-xs font-bold text-stone-400 uppercase">Code</p>
                        <p className="font-semibold text-stone-900">{employee.code}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-stone-400 uppercase">Status</p>
                        <p className="font-semibold text-stone-900">{employee.status}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-stone-400 uppercase">Department</p>
                        <p className="font-semibold text-stone-900">{employee.department}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-stone-400 uppercase">Location</p>
                        <p className="font-semibold text-stone-900">{employee.location}</p>
                    </div>
                    <div className="col-span-2">
                        <p className="text-xs font-bold text-stone-400 uppercase">Employed For</p>
                        <p className="font-semibold text-stone-900">{tenure}</p>
                    </div>
                    <div className="col-span-2">
                        <p className="text-xs font-bold text-stone-400 uppercase">Born</p>
                        <p className="font-semibold text-stone-900">--</p> {/* Privacy placeholder */}
                    </div>
                </div>
            </div>
        </IOSCard>
    );
}
