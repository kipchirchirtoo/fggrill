'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    User, Clock, ShoppingCart,
    Wallet, LogOut, Loader2, ShieldCheck,
    ChefHat, Wine, Monitor, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { IOSCard } from '@/components/ui/ios-card';
import { cn } from '@/lib/utils';

export default function MasterTerminalPage() {
    const router = useRouter();
    const { posLogin } = useAuth();
    const [pin, setPin] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [terminalTime, setTerminalTime] = useState(new Date());
    const [mounted, setMounted] = useState(false);
    const [view, setView] = useState<'lockscreen' | 'pinpad'>('lockscreen');
    const [selectedModule, setSelectedModule] = useState<'restaurant' | 'bar' | 'cashier' | null>(null);

    // Update clock every second
    useEffect(() => {
        setMounted(true);
        const timer = setInterval(() => setTerminalTime(new Date()), 1000);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        setIsOnline(navigator.onLine);

        return () => {
            clearInterval(timer);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleNumberClick = (num: string) => {
        if (pin.length < 4) {
            setPin(prev => prev + num);
        }
    };

    const handleDelete = () => {
        if (pin.length > 0) {
            setPin(prev => prev.slice(0, -1));
        }
    };

    const handleClear = () => {
        setPin('');
    };

    const handleModuleSelect = (module: 'restaurant' | 'bar' | 'cashier') => {
        setSelectedModule(module);
        setPin('');
        setView('pinpad');
    };

    // Keyboard support for PIN entry
    useEffect(() => {
        if (view !== 'pinpad') return;

        const handleKeyPress = (e: KeyboardEvent) => {
            if (/^[0-9a-zA-Z]$/.test(e.key)) {
                handleNumberClick(e.key.toUpperCase());
            } else if (e.key === 'Backspace') {
                handleDelete();
            } else if (e.key === 'Enter' && pin.length === 4) {
                handleLogin();
            } else if (e.key === 'Escape') {
                setView('lockscreen');
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [view, pin]);

    const handleLogin = async (overridePin?: string) => {
        const finalPin = overridePin || pin;
        if (finalPin.length !== 4) {
            toast.error('Please enter a 4-digit PIN');
            return;
        }

        setIsAuthenticating(true);
        try {
            let targetPath = '/dashboard/pos-kitchen?tab=restaurant';
            if (selectedModule === 'cashier') {
                targetPath = '/dashboard/cashier';
            } else if (selectedModule === 'bar') {
                targetPath = '/dashboard/pos-kitchen?tab=bar';
            }

            await posLogin(finalPin, targetPath);
        } catch (error: any) {
            setPin('');
        } finally {
            setIsAuthenticating(false);
        }
    };

    // Auto-submit when length reaches 4
    useEffect(() => {
        if (pin.length === 4) {
            handleLogin();
        }
    }, [pin]);

    const checkUpdates = () => {
        if (typeof window !== 'undefined' && (window as any).require) {
            try {
                const { ipcRenderer } = (window as any).require('electron');
                ipcRenderer.send('check-for-updates');
                toast.info('Checking for updates...');
            } catch (e) {
                console.error('Failed to check for updates:', e);
            }
        }
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center p-4 font-sf-pro overflow-hidden">

            {view === 'lockscreen' ? (
                <div className="w-full max-w-6xl animate-in fade-in zoom-in duration-500">
                    <div className="text-center mb-12 space-y-2">
                        <h2 className="text-4xl font-black text-stone-900 tracking-tight">Select Module</h2>
                        <p className="text-stone-500 font-medium text-lg">Touch an option below to begin your session</p>
                    </div>

                    {/* Login Link */}
                    <div className="absolute top-8 right-8">
                        <a
                            href="/login"
                            className="px-4 py-2 text-sm font-medium text-stone-400 hover:text-stone-900 transition-colors flex items-center gap-2 group"
                        >
                            <span>Login</span>
                            <svg className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                        {/* Restaurant Card */}
                        <div
                            onClick={() => handleModuleSelect('restaurant')}
                            className="group relative bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                <ChefHat className="h-32 w-32" />
                            </div>
                            <div className="h-16 w-16 rounded-3xl bg-orange-100 flex items-center justify-center mb-6 group-hover:bg-orange-500 transition-colors">
                                <ChefHat className="h-8 w-8 text-orange-600 group-hover:text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-stone-900 mb-2">Restaurant</h3>
                            <p className="text-stone-500 text-sm leading-relaxed mb-6">Access tables, orders and kitchen management.</p>
                            <div className="flex items-center gap-2 text-orange-600 font-bold text-sm">
                                <span>R-Series Access</span>
                                <div className="h-1 w-1 rounded-full bg-orange-400" />
                                <span className="opacity-60 text-[10px] uppercase tracking-widest">Requires PIN</span>
                            </div>
                        </div>

                        {/* Bar Card */}
                        <div
                            onClick={() => handleModuleSelect('bar')}
                            className="group relative bg-white rounded-[1.5rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Wine className="h-32 w-32" />
                            </div>
                            <div className="h-16 w-16 rounded-3xl bg-indigo-100 flex items-center justify-center mb-6 group-hover:bg-indigo-500 transition-colors">
                                <Wine className="h-8 w-8 text-indigo-600 group-hover:text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-stone-900 mb-2">Bar & Lounge</h3>
                            <p className="text-stone-500 text-sm leading-relaxed mb-6">Manage drinks, lounge tabs and inventory.</p>
                            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                                <span>B-Series Access</span>
                                <div className="h-1 w-1 rounded-full bg-indigo-400" />
                                <span className="opacity-60 text-[10px] uppercase tracking-widest">Requires PIN</span>
                            </div>
                        </div>

                        {/* Cashier Card */}
                        <div
                            onClick={() => handleModuleSelect('cashier')}
                            className="group relative bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Wallet className="h-32 w-32" />
                            </div>
                            <div className="h-16 w-16 rounded-3xl bg-emerald-100 flex items-center justify-center mb-6 group-hover:bg-emerald-500 transition-colors">
                                <Wallet className="h-8 w-8 text-emerald-600 group-hover:text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-stone-900 mb-2">Cashier</h3>
                            <p className="text-stone-500 text-sm leading-relaxed mb-6">Process payments, receipts and daily reports.</p>
                            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                                <span>C-Series Access</span>
                                <div className="h-1 w-1 rounded-full bg-emerald-400" />
                                <span className="opacity-60 text-[10px] uppercase tracking-widest">Requires PIN</span>
                            </div>
                        </div>

                        {/* HR Terminal Card */}
                        <div
                            onClick={() => router.push('/dashboard/hr/terminal')}
                            className="group relative bg-stone-900 rounded-[2.5rem] p-8 shadow-xl shadow-stone-900/20 hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Clock className="h-32 w-32 text-white" />
                            </div>
                            <div className="h-16 w-16 rounded-3xl bg-white/10 flex items-center justify-center mb-6 group-hover:bg-white transition-colors">
                                <Clock className="h-8 w-8 text-white group-hover:text-stone-900" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Staff Terminal</h3>
                            <p className="text-stone-400 text-sm leading-relaxed mb-6">Clock-in, clock-out and view your shifts.</p>
                            <div className="flex items-center gap-2 text-white font-bold text-sm">
                                <span>Open Access</span>
                                <div className="h-1 w-1 rounded-full bg-stone-500" />
                                <span className="opacity-60 text-[10px] uppercase tracking-widest text-emerald-400">No PIN Required</span>
                            </div>
                        </div>
                    </div>


                </div>
            ) : (
                <div className="w-full max-w-4xl grid md:grid-cols-2 gap-12 items-center animate-in slide-in-from-bottom-8 duration-500">
                    <div className="flex flex-col gap-6">
                        <IOSCard className="p-10 bg-white border border-stone-200 shadow-lg space-y-6">
                            <button
                                onClick={() => setView('lockscreen')}
                                className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors mb-4 text-sm font-bold"
                            >
                                <LogOut className="h-4 w-4 rotate-180" />
                                BACK TO SELECTION
                            </button>

                            <div className="h-16 w-16 bg-stone-50 border-2 border-stone-200 rounded-2xl flex items-center justify-center">
                                {selectedModule === 'restaurant' ? (
                                    <ChefHat className="h-8 w-8 text-orange-500" />
                                ) : selectedModule === 'bar' ? (
                                    <Wine className="h-8 w-8 text-indigo-500" />
                                ) : (
                                    <Wallet className="h-8 w-8 text-emerald-500" />
                                )}
                            </div>

                            <div>
                                <h2 className="text-3xl font-black tracking-tight capitalize text-stone-900">{selectedModule} Access</h2>
                                <p className="text-stone-500 text-sm leading-relaxed mt-2 uppercase tracking-widest font-bold">
                                    Enter {selectedModule === 'restaurant' ? 'Waiter' : selectedModule === 'bar' ? 'Bar' : 'Cashier'} PIN
                                </p>
                            </div>

                            <div className="pt-6 border-t border-stone-200 text-[10px] text-stone-400 font-bold tracking-[0.2em] uppercase">
                                System logging active • Secure encryption enabled
                            </div>
                        </IOSCard>
                    </div>

                    {/* PIN Pad UI */}
                    <div className="flex flex-col items-center gap-10">
                        <div className="text-center space-y-6">
                            <div className="flex gap-4 justify-center">
                                {[0, 1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "w-5 h-5 rounded-lg border-2 transition-all duration-300",
                                            pin.length > i
                                                ? (selectedModule === 'restaurant' ? "bg-orange-500 border-orange-500" : selectedModule === 'bar' ? "bg-indigo-500 border-indigo-500" : "bg-emerald-500 border-emerald-500") + " scale-110 shadow-lg"
                                                : "bg-white border-gray-200"
                                        )}
                                    />
                                ))}
                            </div>
                            <div className="h-8 flex items-center justify-center">
                                <p className="text-3xl font-black tracking-[0.6em] text-stone-900">
                                    {pin.padEnd(4, '_')}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 w-full max-w-[340px]">
                            {['R', 'B', 'C'].map((char) => (
                                <button
                                    key={char}
                                    onClick={() => handleNumberClick(char)}
                                    className={cn(
                                        "h-20 w-20 rounded-3xl bg-white border border-gray-200 shadow-sm hover:bg-stone-50 hover:border-stone-300 active:scale-95 transition-all flex items-center justify-center text-3xl font-black",
                                        char === 'R' ? "text-orange-500" : char === 'B' ? "text-indigo-500" : "text-emerald-500"
                                    )}
                                >
                                    {char}
                                </button>
                            ))}
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button
                                    key={num}
                                    onClick={() => handleNumberClick(num.toString())}
                                    className="h-20 w-20 rounded-3xl bg-white border border-gray-200 shadow-sm hover:bg-stone-50 hover:border-stone-300 active:scale-95 transition-all flex items-center justify-center text-3xl font-black text-stone-900"
                                >
                                    {num}
                                </button>
                            ))}
                            <button
                                onClick={handleClear}
                                className="h-20 w-20 rounded-3xl bg-stone-100 flex items-center justify-center text-xs font-black text-stone-500 hover:bg-stone-200 active:scale-95 transition-all underline decoration-2 underline-offset-4"
                            >
                                RESET
                            </button>
                            <button
                                onClick={() => handleNumberClick('0')}
                                className="h-20 w-20 rounded-3xl bg-white border border-gray-200 shadow-sm hover:bg-stone-50 hover:border-stone-300 active:scale-95 transition-all flex items-center justify-center text-3xl font-black text-stone-900"
                            >
                                0
                            </button>
                            <button
                                onClick={handleDelete}
                                className="h-20 w-20 rounded-3xl bg-stone-100 flex items-center justify-center text-xs font-black text-stone-500 hover:bg-stone-200 active:scale-95 transition-all"
                            >
                                DELETE
                            </button>
                        </div>

                        <div className="w-full max-w-[340px] pt-4">
                            <button
                                onClick={() => handleLogin()}
                                disabled={pin.length < 4 || isAuthenticating}
                                className={cn(
                                    "w-full h-16 rounded-3xl text-white font-black text-lg flex items-center justify-center shadow-2xl active:scale-[0.98] transition-all disabled:opacity-50",
                                    selectedModule === 'restaurant' ? "bg-orange-600 hover:bg-orange-700 shadow-orange-200" :
                                        selectedModule === 'bar' ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200" :
                                            "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                                )}
                            >
                                {isAuthenticating ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    'AUTHENTICATE'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                <p className="text-[11px] text-stone-400 font-medium tracking-wide">
                    Made by <span className="font-bold text-stone-600">Hirall</span>
                </p>
                <button
                    onClick={checkUpdates}
                    className="text-[9px] text-stone-300 hover:text-stone-500 transition-colors font-mono"
                >
                    v1.0.16 • Check for updates
                </button>
            </div>
        </div>
    );
}
