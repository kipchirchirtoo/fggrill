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
            const response = await staffAPI.getStaffMember(staffId);
            if (response.success) {
                setStaffInfo(response.data);
                setStep('method');
            } else {
                toast.error("Staff ID not found");
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
                in_method: method,
                out_method: method,
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

                {/* Back Button */}
                <div className="text-center mb-6">
                    <button
                        onClick={() => window.location.href = '/terminal'}
                        className="px-6 py-3 bg-white/80 backdrop-blur-sm border border-stone-200 rounded-2xl text-stone-600 hover:text-stone-900 hover:border-stone-300 transition-all text-sm font-bold flex items-center gap-2 mx-auto shadow-sm hover:shadow-md"
                    >
                        <ArrowRight className="h-4 w-4 rotate-180" />
                        Back to Main Terminal
                    </button>
                </div>

                <div className="bg-white/80 backdrop-blur-xl border border-stone-200/60 rounded-[32px] p-10 shadow-2xl shadow-stone-200/50 overflow-hidden relative">
                    {step === 'id' && (
                        <div className="space-y-8 animate-ios-fade-in">
                            <div className="space-y-2 text-center">
                                <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Personnel Identity</h2>
                                <p className="text-stone-500 text-[13px] font-medium">Input National ID or scan staff credential</p>
                            </div>

                            <div className="space-y-4">
                                <input
                                    className="w-full h-16 bg-stone-50 border border-stone-100 rounded-2xl text-stone-900 text-2xl font-bold text-center tracking-[0.2em] focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 transition-all placeholder:text-stone-200"
                                    placeholder="••••••••"
                                    value={staffId}
                                    onChange={e => setStaffId(e.target.value)}
                                    autoFocus
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
                                            <span>Initiate Scan</span>
                                            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'method' && (
                        <div className="space-y-8 animate-ios-fade-in">
                            <div className="space-y-2 text-center">
                                <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Verification Type</h2>
                                <p className="text-stone-500 text-[13px] font-medium">System access protocol for <span className="text-stone-900 font-bold">{staffInfo?.first_name}</span></p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => { setMethod('biometric'); setStep('action'); }}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-stone-50 border border-stone-100 hover:bg-white hover:border-stone-300 hover:shadow-sm transition-all text-left group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white border border-stone-100 flex items-center justify-center text-stone-900 shadow-sm group-hover:scale-110 transition-transform">
                                        <Fingerprint className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-stone-900">Biometric Sensor</p>
                                        <p className="text-[11px] text-stone-400 font-medium">Digital fingerprint signature</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setMethod('rfid'); setStep('action'); }}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-stone-50 border border-stone-100 hover:bg-white hover:border-stone-300 hover:shadow-sm transition-all text-left group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white border border-stone-100 flex items-center justify-center text-stone-900 shadow-sm group-hover:scale-110 transition-transform">
                                        <CreditCard className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-stone-900">Contactless NFC</p>
                                        <p className="text-[11px] text-stone-400 font-medium">Physical credential card scan</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setMethod('pin'); setStep('action'); }}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-stone-50 border border-stone-100 hover:bg-white hover:border-stone-300 hover:shadow-sm transition-all text-left group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white border border-stone-100 flex items-center justify-center text-stone-900 shadow-sm group-hover:scale-110 transition-transform">
                                        <Key className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-stone-900">Manual Override</p>
                                        <p className="text-[11px] text-stone-400 font-medium italic">Manager verification required</p>
                                    </div>
                                </button>
                            </div>
                            <button
                                onClick={() => setStep('id')}
                                className="w-full py-3 text-[13px] font-bold text-stone-400 hover:text-stone-900 transition-colors"
                            >
                                Back to Identification
                            </button>
                        </div>
                    )}

                    {step === 'action' && (
                        <div className="space-y-10 animate-ios-fade-in">
                            <div className="text-center space-y-4">
                                <div className="w-24 h-24 rounded-[32px] bg-stone-900 mx-auto flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-xl">
                                    {(staffInfo?.first_name?.[0] || '?').toUpperCase()}{(staffInfo?.last_name?.[0] || '?').toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-stone-900 tracking-tight">{staffInfo?.first_name} {staffInfo?.last_name}</h2>
                                    <p className="text-stone-400 text-[11px] font-bold uppercase tracking-widest mt-1">{staffInfo?.role} • {staffInfo?.department}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 mt-8">
                                <button
                                    onClick={() => handleClock('in')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-4 p-6 rounded-3xl bg-stone-50 border border-stone-200 hover:bg-white hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/20 transition-all text-stone-900 group disabled:opacity-50"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-stone-900 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg group-hover:bg-emerald-600">
                                        <History className="h-8 w-8" />
                                    </div>
                                    <span className="font-bold text-sm uppercase tracking-widest">Entry</span>
                                </button>
                                <button
                                    onClick={() => handleClock('out')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-4 p-6 rounded-3xl bg-stone-50 border border-stone-200 hover:bg-white hover:border-rose-500/30 hover:shadow-xl hover:shadow-rose-500/20 transition-all text-stone-900 group disabled:opacity-50"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-stone-900 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg group-hover:bg-rose-600">
                                        <History className="h-8 w-8 rotate-180" />
                                    </div>
                                    <span className="font-bold text-sm uppercase tracking-widest">Exit</span>
                                </button>
                            </div>

                            <button
                                onClick={() => setStep('method')}
                                className="w-full py-3 text-[13px] font-bold text-stone-400 hover:text-stone-900 transition-colors"
                            >
                                Change Method
                            </button>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="text-center py-16 animate-ios-fade-in">
                            <div className="w-24 h-24 rounded-full bg-emerald-50 mx-auto flex items-center justify-center text-emerald-500 mb-8 border border-emerald-100 shadow-sm">
                                <CheckCircle2 className="h-12 w-12" />
                            </div>
                            <h2 className="text-3xl font-bold text-stone-900 tracking-tight mb-2">Authenticated</h2>
                            <p className="text-stone-500 italic font-medium">Session recorded successfully. Proceed to post.</p>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="mt-12 flex items-center justify-center gap-6 text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                    <span>Terminal FG-TERM-01</span>
                    <div className="w-1 h-1 bg-stone-200 rounded-full" />
                    <span>Secure Node</span>
                    <div className="w-1 h-1 bg-stone-200 rounded-full" />
                    <span>Main Branch</span>
                </div>
            </div>
        </div>
    );
}
