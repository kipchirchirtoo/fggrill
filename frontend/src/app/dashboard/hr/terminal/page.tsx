'use client';

import { useState, useEffect } from 'react';
import {
    Fingerprint,
    CreditCard,
    Key,
    ArrowRight,
    CheckCircle2,
    History,
    RefreshCw
} from 'lucide-react';
import { staffAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function ClockInTerminal() {
    const [staffId, setStaffId] = useState('');
    const [step, setStep] = useState<'id' | 'method' | 'action' | 'success'>('id');
    const [method, setMethod] = useState<'biometric' | 'rfid' | 'pin'>('biometric');
    const [staffInfo, setStaffInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleIdentify = async () => {
        if (!staffId) return;
        setIsLoading(true);
        try {
            const response = await staffAPI.getStaffByIdentifier(staffId);
            if (response.success) {
                setStaffInfo(response.data);
                setStep('action');
            } else {
                toast.error("Staff member not found. Please check your ID.");
            }
        } catch (error) {
            toast.error("Failed to identify staff");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClock = async (action: 'in' | 'out') => {
        setIsLoading(true);
        try {
            const apiCall = action === 'in' ? staffAPI.clockIn : staffAPI.clockOut;
            const response = await apiCall({
                staff_id: staffInfo.id,
                in_method: 'terminal',
                device_id: 'TERMINAL_01'
            });

            if (response.success) {
                setStep('success');
                setTimeout(() => {
                    reset();
                }, 3000);
            } else {
                toast.error(response.message || `Failed to clock ${action}`);
            }
        } catch (error: any) {
            toast.error(error.message || `Error during clock ${action}`);
        } finally {
            setIsLoading(false);
        }
    };

    const reset = () => {
        setStaffId('');
        setStep('id');
        setStaffInfo(null);
    };

    return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 font-sf-pro-display">
            {/* Background Accent */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-stone-200/30 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-stone-200/30 blur-[120px] rounded-full" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Header / Clock */}
                <div className="text-center mb-12 space-y-2">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.3em] leading-none">Management Terminal</p>
                    <h1 className="text-6xl font-bold text-stone-900 tracking-tighter">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </h1>
                    <p className="text-stone-500 font-medium text-sm">
                        {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-center gap-4 mb-6">
                    <button
                        onClick={() => window.location.href = '/terminal'}
                        className="px-6 py-3 bg-white/80 backdrop-blur-sm border border-stone-200 rounded-2xl text-stone-600 hover:text-stone-900 hover:border-stone-300 transition-all text-sm font-bold flex items-center gap-2 shadow-sm hover:shadow-md"
                    >
                        <ArrowRight className="h-4 w-4 rotate-180" />
                        Back
                    </button>
                    <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="px-6 py-3 bg-stone-900 text-white rounded-2xl hover:bg-black transition-all text-sm font-bold flex items-center gap-2 shadow-lg"
                    >
                        Dashboard
                    </button>
                </div>

                <div className="bg-white border border-stone-200 rounded-[32px] p-10 shadow-2xl shadow-stone-200/50 overflow-hidden relative">
                    {step === 'id' && (
                        <div className="space-y-8 animate-ios-fade-in">
                            <div className="space-y-2 text-center">
                                <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Staff Attendance</h2>
                                <p className="text-stone-500 text-[13px] font-medium italic">Enter National ID or Employee ID to begin</p>
                            </div>

                            <div className="space-y-4">
                                <input
                                    className="w-full h-16 bg-stone-50 border border-stone-100 rounded-2xl text-stone-900 text-2xl font-bold text-center tracking-[0.1em] focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 transition-all placeholder:text-stone-200"
                                    placeholder="ID NUMBER"
                                    value={staffId}
                                    onChange={e => setStaffId(e.target.value.toUpperCase())}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleIdentify();
                                    }}
                                />
                                <button
                                    className="w-full h-14 rounded-2xl bg-stone-900 text-white text-md font-bold hover:bg-black transition-all active:scale-95 shadow-lg shadow-stone-200 flex items-center justify-center gap-2 group"
                                    onClick={handleIdentify}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <RefreshCw className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            <span>IDENTIFY PERSONNEL</span>
                                            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'action' && (
                        <div className="space-y-10 animate-ios-fade-in">
                            <div className="text-center space-y-4">
                                <div className="w-24 h-24 rounded-[32px] bg-stone-900 mx-auto flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-xl">
                                    {(staffInfo?.user?.first_name?.[0] || '?').toUpperCase()}{(staffInfo?.user?.last_name?.[0] || '?').toUpperCase()}
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold text-stone-900 tracking-tight">{staffInfo?.user?.first_name} {staffInfo?.user?.last_name}</h2>
                                    <p className="text-stone-500 text-xs font-bold uppercase tracking-widest">{staffInfo?.user?.role || staffInfo?.role} • {staffInfo?.user?.department || staffInfo?.department}</p>
                                    <p className="text-stone-400 text-[10px] font-bold">STAFF ID: {staffInfo?.id_number}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => handleClock('in')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-4 p-6 rounded-3xl bg-stone-50 border border-stone-100 hover:bg-white hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/10 transition-all text-stone-900 group disabled:opacity-50"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg shadow-emerald-200">
                                        <History className="h-7 w-7" />
                                    </div>
                                    <span className="font-bold text-xs uppercase tracking-widest">Clock In</span>
                                </button>
                                <button
                                    onClick={() => handleClock('out')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-4 p-6 rounded-3xl bg-stone-50 border border-stone-100 hover:bg-white hover:border-rose-500/30 hover:shadow-xl hover:shadow-rose-500/10 transition-all text-stone-900 group disabled:opacity-50"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-rose-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg shadow-rose-200">
                                        <History className="h-7 w-7 rotate-180" />
                                    </div>
                                    <span className="font-bold text-xs uppercase tracking-widest">Clock Out</span>
                                </button>
                            </div>

                            <button
                                onClick={reset}
                                className="w-full py-2 text-[11px] font-bold text-stone-400 hover:text-stone-900 transition-colors uppercase tracking-[0.2em]"
                            >
                                Not you? Sign Out
                            </button>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="text-center py-16 animate-ios-fade-in">
                            <div className="w-20 h-20 rounded-full bg-emerald-50 mx-auto flex items-center justify-center text-emerald-500 mb-6 border border-emerald-100">
                                <CheckCircle2 className="h-10 w-10" />
                            </div>
                            <h2 className="text-2xl font-bold text-stone-900 tracking-tight mb-2">SUCCESS</h2>
                            <p className="text-stone-500 font-medium text-sm">Attendance logged for today.</p>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="mt-12 flex items-center justify-center gap-4 text-[9px] font-bold text-stone-400 uppercase tracking-widest bg-stone-100 py-3 px-6 rounded-full mx-auto w-fit">
                    <div className="flex items-center gap-1.5 text-emerald-600">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        SYSTEM ONLINE
                    </div>
                    <div className="w-px h-3 bg-stone-200" />
                    <span>NODE-01</span>
                    <div className="w-px h-3 bg-stone-200" />
                    <span>ENCRYPTION ACTIVE</span>
                </div>
            </div>
        </div>
    );
}
