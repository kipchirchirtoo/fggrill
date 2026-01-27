'use client';

import { useState, useEffect } from 'react';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import {
    Fingerprint,
    CreditCard,
    Key,
    ArrowRight,
    CheckCircle2,
    XCircle,
    Info,
    History
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
            // In a real system, we'd look up by ID number or card serial
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
        <div className="min-h-screen bg-stone-900 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-stone-800 to-stone-950">
            <div className="w-full max-w-md">
                {/* Header / Clock */}
                <div className="text-center mb-10">
                    <h1 className="text-5xl font-bold text-white tracking-tighter mb-2">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </h1>
                    <p className="text-stone-400 font-medium">
                        {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                <IOSCard className="p-8 bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden relative">
                    {/* Animated Glow Background Piece */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 blur-[80px] rounded-full pointer-events-none" />

                    {step === 'id' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4">
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-white">Identify Yourself</h2>
                                <p className="text-stone-400 text-sm">Please enter your Staff ID or Scan Card</p>
                            </div>

                            <div className="space-y-4">
                                <Input
                                    className="h-14 bg-white/5 border-white/10 text-white text-xl font-bold text-center tracking-widest focus:ring-blue-500/50"
                                    placeholder="STAFF-ID"
                                    value={staffId}
                                    onChange={e => setStaffId(e.target.value)}
                                    autoFocus
                                />
                                <IOSButton
                                    className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-500"
                                    onClick={handleIdentify}
                                    isLoading={isLoading}
                                    rightIcon={<ArrowRight />}
                                >
                                    Proceed
                                </IOSButton>
                            </div>
                        </div>
                    )}

                    {step === 'method' && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95">
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-white">Choose Method</h2>
                                <p className="text-stone-400 text-sm">Select verification method for {staffInfo.first_name}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => { setMethod('biometric'); setStep('action'); }}
                                    className="flex items-center gap-4 p-4 rounded-ios-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left"
                                >
                                    <div className="w-12 h-12 rounded-ios-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                                        <Fingerprint className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">Biometric</p>
                                        <p className="text-xs text-stone-500">Fingerprint or Face ID</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setMethod('rfid'); setStep('action'); }}
                                    className="flex items-center gap-4 p-4 rounded-ios-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left"
                                >
                                    <div className="w-12 h-12 rounded-ios-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                        <CreditCard className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">RFID Card</p>
                                        <p className="text-xs text-stone-500">Scan staff badge</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setMethod('pin'); setStep('action'); }}
                                    className="flex items-center gap-4 p-4 rounded-ios-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left"
                                >
                                    <div className="w-12 h-12 rounded-ios-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                                        <Key className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">PIN Fallback</p>
                                        <p className="text-xs text-stone-500 italic">Requires Manager Approval</p>
                                    </div>
                                </button>
                            </div>
                            <IOSButton variant="secondary" className="w-full bg-white/5 text-stone-400" onClick={() => setStep('id')}>Back</IOSButton>
                        </div>
                    )}

                    {step === 'action' && (
                        <div className="space-y-6 animate-in slide-in-from-right-8">
                            <div className="text-center space-y-2">
                                <div className="w-20 h-20 rounded-full bg-blue-500 mx-auto flex items-center justify-center text-white text-2xl font-bold mb-4">
                                    {staffInfo.first_name[0]}{staffInfo.last_name[0]}
                                </div>
                                <h2 className="text-2xl font-bold text-white">{staffInfo.first_name} {staffInfo.last_name}</h2>
                                <p className="text-stone-400 text-sm font-medium uppercase tracking-widest">{staffInfo.role}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <button
                                    onClick={() => handleClock('in')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-4 p-6 rounded-ios-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all text-emerald-400 group disabled:opacity-50"
                                >
                                    <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                                        <History className="h-8 w-8" />
                                    </div>
                                    <span className="font-bold text-lg">Clock IN</span>
                                </button>
                                <button
                                    onClick={() => handleClock('out')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-4 p-6 rounded-ios-2xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all text-rose-400 group disabled:opacity-50"
                                >
                                    <div className="w-16 h-16 rounded-full bg-rose-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                                        <History className="h-8 w-8 rotate-180" />
                                    </div>
                                    <span className="font-bold text-lg">Clock OUT</span>
                                </button>
                            </div>

                            {method === 'pin' && (
                                <div className="p-3 bg-amber-500/10 rounded-ios-lg border border-amber-500/20 flex gap-3 text-amber-200 text-xs">
                                    <Info className="h-4 w-4 shrink-0" />
                                    <p>Your clock-in will be flagged for supervisor verification due to using PIN method.</p>
                                </div>
                            )}

                            <IOSButton variant="secondary" className="w-full bg-white/5 text-stone-400" onClick={() => setStep('method')}>Back</IOSButton>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="text-center py-12 animate-in zoom-in-50 duration-500">
                            <div className="w-24 h-24 rounded-full bg-emerald-500 mx-auto flex items-center justify-center text-white mb-6 animate-bounce shadow-[0_0_40px_rgba(16,185,129,0.5)]">
                                <CheckCircle2 className="h-12 w-12" />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-2">Success!</h2>
                            <p className="text-stone-400 italic">Have a productive session, {staffInfo.first_name}.</p>
                        </div>
                    )}
                </IOSCard>

                {/* Footer Info */}
                <div className="mt-8 text-center text-stone-500 text-xs font-medium space-x-4">
                    <span>SECURITY: AES-256</span>
                    <span>•</span>
                    <span>DEVICE: FG-TERM-01</span>
                    <span>•</span>
                    <span>BRANCH: MAIN</span>
                </div>
            </div>
        </div>
    );
}
