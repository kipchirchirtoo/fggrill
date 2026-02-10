'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import {
    User, Clock, ShoppingCart,
    Wallet, LogOut, Loader2, ShieldCheck,
    Utensils, GlassWater, Banknote, Users,
    Wifi, WifiOff, ArrowRight
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
    const [showFooter, setShowFooter] = useState(true);
    const { scrollY } = useScroll();

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = scrollY.getPrevious();
        if (latest > previous && latest > 50) {
            setShowFooter(true); // Scrolling down
        } else if (latest < previous) {
            setShowFooter(false); // Scrolling up
        }
    });

    // Show footer if at bottom
    useEffect(() => {
        const handleScroll = () => {
            const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50;
            if (isAtBottom) setShowFooter(true);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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
        <div className="relative min-h-screen flex flex-col items-center p-4 font-sf-pro overflow-x-hidden pb-96">
            {/* Background Image with Overlay */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/IMG_8704.JPG"
                    alt="Famous Gates Hotels Background"
                    fill
                    className="object-cover"
                    priority
                />
                <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
            </div>

            {view === 'lockscreen' ? (
                <div className="w-full max-w-6xl z-10 animate-in fade-in zoom-in duration-700">
                    <div className="text-center mt-20 mb-16 space-y-3">
                        <motion.h2
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-6xl font-black text-white tracking-tighter uppercase drop-shadow-2xl"
                        >
                            FAMOUS GATES SYSTEM
                        </motion.h2>
                        <p className="text-white/60 font-black text-xs uppercase tracking-[0.4em]">Authorized Personnel Station Entry</p>
                    </div>

                    {/* Login Link */}
                    <div className="absolute top-8 right-8">
                        <a
                            href="/login"
                            className="px-6 py-3 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-xs font-black text-white/80 hover:text-white hover:bg-white/10 transition-all flex items-center gap-3 group uppercase tracking-widest"
                        >
                            <span>Backoffice Portal</span>
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 px-6">
                        {/* Restaurant Card */}
                        <motion.div
                            whileHover={{ y: -10, scale: 1.02 }}
                            onClick={() => handleModuleSelect('restaurant')}
                            className="group relative bg-white/10 backdrop-blur-xl rounded-[3rem] p-10 border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] cursor-pointer overflow-hidden transition-all"
                        >
                            <div className="h-20 w-20 rounded-[2rem] bg-orange-500 flex items-center justify-center mb-8 shadow-2xl shadow-orange-500/20">
                                <Utensils className="h-10 w-10 text-white" />
                            </div>
                            <h3 className="text-3xl font-black text-white mb-3 tracking-tight uppercase">Restaurant</h3>
                            <p className="text-white/60 text-sm font-medium leading-relaxed mb-8">Table management, kitchen sync, and service orders.</p>
                            <div className="flex items-center gap-3 text-orange-400 font-black text-[10px] uppercase tracking-widest">
                                <span>R-Series Protocols</span>
                                <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                <span className="opacity-60">Auth-04 PIN</span>
                            </div>
                        </motion.div>

                        {/* Bar Card */}
                        <motion.div
                            whileHover={{ y: -10, scale: 1.02 }}
                            onClick={() => handleModuleSelect('bar')}
                            className="group relative bg-white/10 backdrop-blur-xl rounded-[3rem] p-10 border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] cursor-pointer overflow-hidden transition-all"
                        >
                            <div className="h-20 w-20 rounded-[2rem] bg-indigo-500 flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/20">
                                <GlassWater className="h-10 w-10 text-white" />
                            </div>
                            <h3 className="text-3xl font-black text-white mb-3 tracking-tight uppercase">Bar & Lounge</h3>
                            <p className="text-white/60 text-sm font-medium leading-relaxed mb-8">Beverage control, lounge tabs, and inventory management.</p>
                            <div className="flex items-center gap-3 text-indigo-400 font-black text-[10px] uppercase tracking-widest">
                                <span>B-Series Protocols</span>
                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                <span className="opacity-60">Auth-04 PIN</span>
                            </div>
                        </motion.div>

                        {/* Cashier Card */}
                        <motion.div
                            whileHover={{ y: -10, scale: 1.02 }}
                            onClick={() => handleModuleSelect('cashier')}
                            className="group relative bg-white/10 backdrop-blur-xl rounded-[3rem] p-10 border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] cursor-pointer overflow-hidden transition-all"
                        >
                            <div className="h-20 w-20 rounded-[2rem] bg-emerald-500 flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/20">
                                <Banknote className="h-10 w-10 text-white" />
                            </div>
                            <h3 className="text-3xl font-black text-white mb-3 tracking-tight uppercase">Cashier</h3>
                            <p className="text-white/60 text-sm font-medium leading-relaxed mb-8">Financial processing, daily audits, and receipts.</p>
                            <div className="flex items-center gap-3 text-emerald-400 font-black text-[10px] uppercase tracking-widest">
                                <span>C-Series Protocols</span>
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span className="opacity-60">Auth-04 PIN</span>
                            </div>
                        </motion.div>

                        {/* HR Terminal Card */}
                        <motion.div
                            whileHover={{ y: -10, scale: 1.02 }}
                            onClick={() => router.push('/dashboard/hr/terminal')}
                            className="group relative bg-white/10 backdrop-blur-xl rounded-[3rem] p-10 border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] cursor-pointer overflow-hidden transition-all"
                        >
                            <div className="h-20 w-20 rounded-[2rem] bg-stone-900 flex items-center justify-center mb-8 shadow-2xl shadow-stone-900/20">
                                <Users className="h-10 w-10 text-white" />
                            </div>
                            <h3 className="text-3xl font-black text-stone-900 mb-3 tracking-tight uppercase">Staff</h3>
                            <p className="text-stone-500 text-sm font-medium leading-relaxed mb-8">Biometric clock-in/out and shift schedule viewing.</p>
                            <div className="flex items-center gap-3 text-stone-900 font-black text-[10px] uppercase tracking-widest">
                                <span>Open Protocol</span>
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span className="text-emerald-600 font-black">Free Entry</span>
                            </div>
                        </motion.div>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-5xl mt-20 grid md:grid-cols-2 gap-16 items-center z-10 animate-in slide-in-from-bottom-12 duration-700">
                    <div className="flex flex-col gap-8">
                        <div className="p-12 bg-white/10 backdrop-blur-2xl rounded-[3.5rem] shadow-2xl space-y-8 border border-white/10">
                            <button
                                onClick={() => setView('lockscreen')}
                                className="inline-flex items-center gap-3 text-white/40 hover:text-white transition-all mb-4 text-[10px] font-black tracking-[0.2em] uppercase group"
                            >
                                <LogOut className="h-4 w-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                                Abort Session Access
                            </button>

                            <div className="h-24 w-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center shadow-inner border border-white/10">
                                {selectedModule === 'restaurant' ? (
                                    <Utensils className="h-12 w-12 text-orange-400" />
                                ) : selectedModule === 'bar' ? (
                                    <GlassWater className="h-12 w-12 text-indigo-400" />
                                ) : (
                                    <Banknote className="h-12 w-12 text-emerald-400" />
                                )}
                            </div>

                            <div className="space-y-3">
                                <h2 className="text-6xl font-black tracking-tighter capitalize text-white drop-shadow-lg">{selectedModule} Station</h2>
                                <p className="text-white/60 text-xs leading-relaxed uppercase tracking-[0.4em] font-black">
                                    Identity PIN Required: {selectedModule === 'restaurant' ? 'Service Staff' : selectedModule === 'bar' ? 'Mixologist' : 'Financial Controller'}
                                </p>
                            </div>

                            <div className="pt-10 border-t border-white/10 text-[10px] text-white/40 font-black tracking-[0.3em] uppercase flex items-center gap-4">
                                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                End-To-End Biometric Tunnel Active
                            </div>
                        </div>
                    </div>

                    {/* PIN Pad UI */}
                    <div className="flex flex-col items-center gap-12">
                        <div className="text-center space-y-10">
                            <div className="flex gap-4 justify-center">
                                {[0, 1, 2, 3].map((i) => (
                                    <motion.div
                                        key={i}
                                        animate={{
                                            scale: pin.length > i ? 1.2 : 1,
                                            backgroundColor: pin.length > i
                                                ? (selectedModule === 'restaurant' ? "#F97316" : selectedModule === 'bar' ? "#6366F1" : "#10B981")
                                                : "rgba(255, 255, 255, 0.2)"
                                        }}
                                        className={cn(
                                            "w-6 h-6 rounded-lg border-2 border-white/20 transition-all duration-300 shadow-xl",
                                        )}
                                    />
                                ))}
                            </div>
                            <div className="h-12 flex items-center justify-center">
                                <p className="text-5xl font-black tracking-[0.6em] text-white drop-shadow-2xl">
                                    {pin.padEnd(4, '_')}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 w-full max-w-[380px]">
                            {['R', 'B', 'C'].map((char) => (
                                <motion.button
                                    key={char}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleNumberClick(char)}
                                    className={cn(
                                        "h-24 w-full rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/10 shadow-xl flex items-center justify-center text-3xl font-black transition-all",
                                        char === 'R' ? "text-orange-400" : char === 'B' ? "text-indigo-400" : "text-emerald-400"
                                    )}
                                >
                                    {char}
                                </motion.button>
                            ))}
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <motion.button
                                    key={num}
                                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.2)' }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleNumberClick(num.toString())}
                                    className="h-24 w-full rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/10 shadow-xl flex items-center justify-center text-3xl font-black text-white transition-all"
                                >
                                    {num}
                                </motion.button>
                            ))}
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handleClear}
                                className="h-24 w-full rounded-[2rem] bg-white/5 backdrop-blur-md border border-white/5 flex flex-col items-center justify-center gap-1 text-[9px] font-black text-white/40 active:scale-95 transition-all tracking-[0.2em] uppercase"
                            >
                                Reset
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.2)' }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleNumberClick('0')}
                                className="h-24 w-full rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/10 shadow-xl flex items-center justify-center text-3xl font-black text-white transition-all"
                            >
                                0
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handleDelete}
                                className="h-24 w-full rounded-[2rem] bg-white/5 backdrop-blur-md border border-white/5 flex flex-col items-center justify-center text-xs font-black text-white/40 active:scale-95 transition-all"
                            >
                                <ArrowRight className="w-6 h-6 rotate-180" />
                            </motion.button>
                        </div>

                        <div className="w-full max-w-[380px] pt-4">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleLogin()}
                                disabled={pin.length < 4 || isAuthenticating}
                                className={cn(
                                    "w-full h-20 rounded-[2rem] text-white font-black text-xl flex items-center justify-center shadow-2xl transition-all disabled:opacity-30 disabled:grayscale",
                                    selectedModule === 'restaurant' ? "bg-orange-600 shadow-orange-500/20" :
                                        selectedModule === 'bar' ? "bg-indigo-600 shadow-indigo-500/20" :
                                            "bg-emerald-600 shadow-emerald-500/20"
                                )}
                            >
                                {isAuthenticating ? (
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                ) : (
                                    <span className="tracking-[0.2em]">INITIALIZE SESSION</span>
                                )}
                            </motion.button>
                        </div>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {showFooter && (
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 left-0 right-0 p-12 flex flex-col items-center gap-8 z-50 pointer-events-none"
                    >
                        <div className="flex items-center gap-8 opacity-40 hover:opacity-100 transition-opacity duration-500 pointer-events-auto">
                            <div className="flex flex-col items-center gap-1">
                                <p className="text-[10px] text-white font-black tracking-[0.4em] uppercase text-center">
                                    Proprietary Terminal Protocol
                                </p>
                                <p className="text-[9px] text-white/60 font-mono tracking-widest">v1.2.9_REL_STABLE</p>
                            </div>

                            <div className="h-8 w-px bg-white/10" />

                            <div className="flex flex-col items-center gap-1">
                                <p className="text-[10px] text-white font-black tracking-[0.4em] uppercase text-center">
                                    Infrastructure Node
                                </p>
                                <p className="text-[9px] text-white/60 font-mono tracking-widest uppercase">Hirall Systems</p>
                            </div>
                        </div>

                        <button
                            onClick={checkUpdates}
                            className="px-10 py-3 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/40 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all font-black tracking-[0.5em] uppercase backdrop-blur-md group pointer-events-auto"
                        >
                            <span className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                System Check Integrity
                            </span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
