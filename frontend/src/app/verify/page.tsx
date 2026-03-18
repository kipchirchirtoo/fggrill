'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { ShieldCheck, Phone, AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { API_URL } from '@/lib/config';

function VerificationContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');

    useEffect(() => {
        if (!id) {
            setStatus('invalid');
            return;
        }

        // Call the backend API to verify the ID
        const verifyId = async () => {
            try {
                const response = await fetch(`${API_URL}/api/verify/${id}`);
                const data = await response.json();

                if (data.success && data.valid) {
                    setStatus('valid');
                } else {
                    setStatus('invalid');
                }
            } catch (error) {
                console.error('Verification error:', error);
                setStatus('invalid');
            }
        };

        verifyId();
    }, [id]);

    return (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full space-y-6">

                {/* Header Logo Area */}
                <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-red-700 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xl ring-4 ring-red-50">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-stone-900">Kyogong</h1>
                        <p className="text-stone-500 text-sm">Official ID Verification Portal</p>
                    </div>
                </div>

                {/* Status Card */}
                <Card className="p-8 text-center space-y-6 border-stone-200 shadow-sm bg-white">
                    {status === 'loading' ? (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
                            <p className="text-stone-500 font-medium animate-pulse">Verifying Credentials...</p>
                        </div>
                    ) : status === 'valid' ? (
                        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto border border-green-100">
                                <ShieldCheck className="w-10 h-10" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-green-700">Valid Identification</h2>
                                <p className="text-stone-500 mt-2 text-sm">ID Number: <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-1 rounded">{id}</span></p>
                                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    Active Status Verified
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-100">
                                <AlertTriangle className="w-10 h-10" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-red-700">Invalid ID</h2>
                                <p className="text-red-600/80 mt-2 text-sm">This identification card could not be verified in our system.</p>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Terms and Emergency Info */}
                <div className="space-y-4">
                    <Card className="p-6 border-stone-200 shadow-sm bg-white overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                        <h3 className="font-bold text-stone-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                            Lost & Found Protocol
                        </h3>
                        <p className="text-sm text-stone-600 leading-relaxed mb-4">
                            If this card is found, please return it to the nearest police station immediately or contact our emergency hotline.
                        </p>
                        <div className="flex items-center gap-4 text-red-700 bg-red-50 p-4 rounded-xl border border-red-100 hover:bg-red-100 transition-colors cursor-pointer group">
                            <div className="bg-white p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                <Phone className="w-5 h-5 flex-shrink-0" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-red-600/70">Emergency Hotline</p>
                                <p className="font-bold text-lg leading-none">+254 700 000 000</p>
                            </div>
                        </div>
                    </Card>

                    <div className="px-4">
                        <h3 className="font-bold text-stone-400 mb-2 text-xs uppercase tracking-widest text-center">Terms of Use</h3>
                        <ul className="space-y-2 text-xs text-stone-500 text-center">
                            <li>Property of Kyogong. Not transferable.</li>
                            <li>Visible wear mandatory while on duty.</li>
                            <li>Unauthorized use is a punishable offense.</li>
                        </ul>
                    </div>
                </div>

                <div className="text-center text-stone-300 text-[10px] py-4">
                    &copy; {new Date().getFullYear()} Kyogong<br />Security & Verification System
                </div>
            </div>
        </div>
    );
}

export default function VerifyPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-stone-50">
                <Loader2 className="w-8 h-8 animate-spin text-stone-300" />
            </div>
        }>
            <VerificationContent />
        </Suspense>
    );
}
