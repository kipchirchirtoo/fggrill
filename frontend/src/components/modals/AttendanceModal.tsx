'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Clock,
    MapPin,
    User,
    Calendar,
    LogIn,
    LogOut,
    Loader2,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { toast } from 'sonner';
import { attendanceAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface AttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const AttendanceModal = ({ isOpen, onClose, onSuccess }: AttendanceModalProps) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [activeAttendance, setActiveAttendance] = useState<any>(null);

    useEffect(() => {
        if (isOpen && user) {
            fetchData();
        }
    }, [isOpen, user]);

    const fetchData = async () => {
        try {
            const res = await attendanceAPI.getAttendance({ userId: user?.id });
            if (res.success) {
                setHistory(res.data || []);
                const active = res.data?.find((a: any) => !a.clock_out);
                setActiveAttendance(active || null);
            }
        } catch (error) {
            console.error('Failed to fetch attendance:', error);
        }
    };

    const handleClockAction = async () => {
        setLoading(true);
        try {
            const res = activeAttendance
                ? await attendanceAPI.clockOut()
                : await attendanceAPI.clockIn();

            if (res.success) {
                toast.success(activeAttendance ? 'Clocked out successfully' : 'Clocked in successfully');
                fetchData();
                onSuccess();
            } else {
                toast.error(res.error || 'Action failed');
            }
        } catch (error: any) {
            toast.error(error.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-stone-50 rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden"
            >
                <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-stone-900">Staff Attendance</h2>
                            <p className="text-xs text-stone-500">Track your working hours</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                    >
                        <X className="h-5 w-5 text-stone-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Card */}
                    <IOSCard className="p-6 bg-white border-none shadow-sm flex flex-col items-center text-center gap-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${activeAttendance ? 'bg-green-100' : 'bg-stone-100'}`}>
                            {activeAttendance ? (
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                            ) : (
                                <AlertCircle className="h-8 w-8 text-stone-400" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-stone-900">
                                {activeAttendance ? 'Currently Clocked In' : 'Currently Clocked Out'}
                            </h3>
                            <p className="text-sm text-stone-500 mt-1">
                                {activeAttendance
                                    ? `Started at ${new Date(activeAttendance.clock_in).toLocaleTimeString()}`
                                    : 'Ready to start your shift?'}
                            </p>
                        </div>

                        <IOSButton
                            onClick={handleClockAction}
                            disabled={loading}
                            className={`w-full py-6 rounded-2xl text-lg font-bold ${activeAttendance ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        >
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : activeAttendance ? (
                                <><LogOut className="h-5 w-5 mr-2" /> Clock Out Now</>
                            ) : (
                                <><LogIn className="h-5 w-5 mr-2" /> Clock In Now</>
                            )}
                        </IOSButton>
                    </IOSCard>

                    {/* History List */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider px-1">Recent Activity</h4>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {history.length === 0 ? (
                                <div className="text-center py-8 text-stone-400 text-sm italic">No recent attendance records</div>
                            ) : history.map((record) => (
                                <div key={record.id} className="bg-white p-3 rounded-2xl border border-stone-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-stone-50">
                                            <Calendar className="h-4 w-4 text-stone-500" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-stone-900">
                                                {new Date(record.clock_in).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="text-[10px] text-stone-500 flex items-center gap-2">
                                                <span>{new Date(record.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <span>→</span>
                                                <span>{record.clock_out ? new Date(record.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {record.clock_out ? (
                                        <IOSBadge variant="secondary" className="bg-stone-100 text-stone-600">
                                            {Math.round((new Date(record.clock_out).getTime() - new Date(record.clock_in).getTime()) / (1000 * 60 * 60) * 10) / 10} hrs
                                        </IOSBadge>
                                    ) : (
                                        <IOSBadge variant="success">Active</IOSBadge>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
