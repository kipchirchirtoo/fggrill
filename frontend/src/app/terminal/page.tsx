'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
    Loader2, ShieldCheck, ArrowRight, Delete, Wifi, WifiOff, CloudOff, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { useElectron } from '@/hooks/use-electron';

export default function MasterTerminalPage() {
    const router = useRouter();
    const { posLogin } = useAuth();
    const { isElectron, isOnline, cachePin, verifyPinOffline, syncStatus } = useElectron();
    const [pin, setPin] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [terminalTime, setTerminalTime] = useState(new Date());

    useEffect(() => {
        setMounted(true);
        const timer = setInterval(() => setTerminalTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleNumberClick = (num: string) => {
        if (pin.length < 5 && !isAuthenticating) {
            setPin(prev => prev + num);
        }
    };

    const handleDelete = () => {
        if (pin.length > 0 && !isAuthenticating) {
            setPin(prev => prev.slice(0, -1));
        }
    };

    const handleClear = () => {
        if (!isAuthenticating) setPin('');
    };

    // Keyboard support
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (isAuthenticating) return;
            if (/^[0-9]$/.test(e.key)) {
                handleNumberClick(e.key);
            } else if (/^[rRbBcC]$/.test(e.key)) {
                handleNumberClick(e.key.toUpperCase());
            } else if (e.key === 'Backspace') {
                handleDelete();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [pin, isAuthenticating]);

    const handleLogin = async () => {
        if (pin.length !== 5) return;
        setIsAuthenticating(true);
        try {
            // If in Electron and offline, try local PIN verification
            if (isElectron && !isOnline) {
                const cachedUser = await verifyPinOffline(pin);
                if (cachedUser) {
                    toast.success(`Offline login: ${cachedUser.firstName || cachedUser.first_name}`, {
                        description: 'Orders will sync when back online'
                    });
                    // Store user in localStorage for the app to work
                    localStorage.setItem('user', JSON.stringify(cachedUser));
                    // Route based on cached role
                    const role = cachedUser.role;
                    if (role === 'cashier') router.push('/dashboard/cashier');
                    else if (role === 'bartender') router.push('/dashboard/pos-kitchen?tab=bar');
                    else router.push('/dashboard/pos-kitchen?tab=restaurant');
                } else {
                    toast.error('PIN not recognized offline');
                    setPin('');
                }
            } else {
                // Online: normal API login (posLogin handles routing internally)
                await posLogin(pin);
                // Cache PIN + user data for offline use when in Electron
                if (isElectron) {
                    try {
                        const storedUser = localStorage.getItem('user');
                        if (storedUser) {
                            const userData = JSON.parse(storedUser) as any;
                            await cachePin(pin, userData.id, userData, userData.branch_id || 0);
                        }
                    } catch (e) { /* caching is best-effort */ }
                }
            }
        } catch (error: any) {
            setPin('');
        } finally {
            setIsAuthenticating(false);
        }
    };

    // Auto-submit when PIN reaches 5 characters (letter + 4 digits)
    useEffect(() => {
        if (pin.length === 5) {
            handleLogin();
        }
    }, [pin]);

    if (!mounted) return null;

    const formattedTime = terminalTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    const formattedDate = terminalTime.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center font-sf-pro overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/IMG_8704.JPG"
                    alt="Famous Gates Hotels Background"
                    fill
                    className="object-cover"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80 backdrop-blur-[3px]" />
            </div>

            {/* Backoffice link */}
            <div className="absolute top-6 right-6 z-20">
                <a
                    href="/login"
                    className="px-5 py-2.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white/50 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 group uppercase tracking-[0.15em]"
                >
                    <span>Backoffice</span>
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </a>
            </div>

            {/* Main content */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="z-10 flex flex-col items-center gap-10"
            >
                {/* Header Information */}
                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <h1 className="text-4xl font-bold tracking-tight text-white/90">
                                {terminalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </h1>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">
                                {terminalTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                        </div>

                        {isElectron && (
                            <div className="h-10 w-[1px] bg-white/10" />
                        )}

                        {isElectron && (
                            <div className="flex flex-col gap-1.5">
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-colors",
                                    isOnline
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                        : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                )}>
                                    {isOnline ? (
                                        <><Wifi className="h-3 w-3" /> Connected</>
                                    ) : (
                                        <><WifiOff className="h-3 w-3" /> Offline Mode</>
                                    )}
                                </div>
                                {syncStatus.pending > 0 && (
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                                        <RefreshCw className="h-3 w-3 animate-spin-slow" />
                                        {syncStatus.pending} Pending Sync
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* PIN Area */}
                <div className="flex flex-col items-center gap-8 w-full max-w-xs">
                    {/* PIN dots */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-white/30" />
                            <p className="text-[11px] text-white/40 font-medium uppercase tracking-[0.2em]">
                                Enter PIN
                            </p>
                        </div>
                        <div className="flex gap-3 justify-center">
                            {[0, 1, 2, 3, 4].map((i) => (
                                <motion.div
                                    key={i}
                                    animate={{
                                        scale: pin.length > i ? [1, 1.3, 1] : 1,
                                        backgroundColor: pin.length > i
                                            ? 'rgba(255, 255, 255, 0.95)'
                                            : 'rgba(255, 255, 255, 0.15)',
                                    }}
                                    transition={{ duration: 0.2 }}
                                    className="w-3.5 h-3.5 rounded-full border border-white/20"
                                />
                            ))}
                        </div>
                        {isAuthenticating && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-2 text-white/60"
                            >
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-xs font-medium">Authenticating...</span>
                            </motion.div>
                        )}
                    </div>

                    {/* PIN Pad */}
                    <div className="grid grid-cols-3 gap-3 w-full">
                        {/* Letter keys */}
                        {[
                            { char: 'R', color: 'text-orange-400 active:bg-orange-500/20' },
                            { char: 'B', color: 'text-indigo-400 active:bg-indigo-500/20' },
                            { char: 'C', color: 'text-emerald-400 active:bg-emerald-500/20' },
                        ].map(({ char, color }) => (
                            <motion.button
                                key={char}
                                whileTap={{ scale: 0.85 }}
                                onClick={() => handleNumberClick(char)}
                                disabled={isAuthenticating}
                                className={cn(
                                    "h-[72px] rounded-2xl bg-white/10 backdrop-blur-md border border-white/5 flex items-center justify-center text-2xl font-bold transition-colors disabled:opacity-30",
                                    color
                                )}
                            >
                                {char}
                            </motion.button>
                        ))}
                        {/* Number keys */}
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <motion.button
                                key={num}
                                whileTap={{ scale: 0.85 }}
                                onClick={() => handleNumberClick(num.toString())}
                                disabled={isAuthenticating}
                                className="h-[72px] rounded-2xl bg-white/10 backdrop-blur-md border border-white/5 flex items-center justify-center text-2xl font-light text-white active:bg-white/20 transition-colors disabled:opacity-30"
                            >
                                {num}
                            </motion.button>
                        ))}
                        <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => router.push('/dashboard/hr/terminal')}
                            className="h-[72px] rounded-2xl bg-white/5 backdrop-blur-md border border-white/5 flex items-center justify-center text-[10px] font-bold text-white/30 uppercase tracking-wider transition-colors hover:text-white/50"
                        >
                            Staff
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => handleNumberClick('0')}
                            disabled={isAuthenticating}
                            className="h-[72px] rounded-2xl bg-white/10 backdrop-blur-md border border-white/5 flex items-center justify-center text-2xl font-light text-white active:bg-white/20 transition-colors disabled:opacity-30"
                        >
                            0
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={handleDelete}
                            disabled={isAuthenticating}
                            className="h-[72px] rounded-2xl bg-white/5 backdrop-blur-md border border-white/5 flex items-center justify-center text-white/40 active:bg-white/10 transition-colors disabled:opacity-30"
                        >
                            <Delete className="h-5 w-5" />
                        </motion.button>
                    </div>
                </div>

                {/* Branding */}
                <div className="text-center space-y-1.5 mt-4 opacity-30">
                    <p className="text-[10px] text-white font-bold tracking-[0.4em] uppercase">
                        Famous Gates Hotels
                    </p>
                    <p className="text-[9px] text-white/50 font-mono tracking-widest">
                        Hirall Systems
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
