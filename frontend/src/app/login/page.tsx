'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Shield,
  Key,
  CheckCircle2,
  ChefHat,
  GlassWater
} from 'lucide-react';

export default function LoginPage() {
  const { login, posLogin, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const [loginMode, setLoginMode] = useState<'standard' | 'pos'>('standard');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', pin: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    if (searchParams.get('mode') === 'pos') {
      setLoginMode('pos');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (loginMode === 'standard') {
      // Validation
      if (!formData.email) {
        setErrors(prev => ({ ...prev, email: 'Email is required' }));
        return;
      }
      if (!/\S+@\S+\.\S+/.test(formData.email)) {
        setErrors(prev => ({ ...prev, email: 'Please enter a valid email' }));
        return;
      }
      if (!formData.password) {
        setErrors(prev => ({ ...prev, password: 'Password is required' }));
        return;
      }

      try {
        await login(formData.email, formData.password);
      } catch (error: any) {
        setErrors({ general: error.message || 'Invalid email or password' });
      }
    } else {
      // POS PIN Login
      if (!formData.pin) {
        setErrors(prev => ({ ...prev, pin: 'PIN is required' }));
        return;
      }
      const pinRegex = /^([RB]\d{3}|\d{4})$/;
      if (!pinRegex.test(formData.pin)) {
        setErrors(prev => ({ ...prev, pin: 'Enter 4-digit PIN' }));
        return;
      }

      try {
        await posLogin(formData.pin);
      } catch (error: any) {
        setErrors({ general: error.message || 'Invalid POS PIN' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-stone-200 mb-6 overflow-hidden">
            <Image
              src="/fglogo.png"
              alt="Famous Gate"
              width={48}
              height={48}
              className="object-cover scale-150"
              priority
            />
          </div>
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight mb-2">
            Famous Gates Hotels
          </h1>
          <p className="text-stone-500 text-sm">
            Select your preferred login method
          </p>
        </div>

        {/* Mode Selector */}
        <div className="bg-stone-200/50 p-1 rounded-xl mb-6 flex gap-1">
          <button
            onClick={() => {
              setLoginMode('standard');
              setErrors({});
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${loginMode === 'standard'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
              }`}
          >
            <Shield className="w-4 h-4" />
            Standard
          </button>
          <button
            onClick={() => {
              setLoginMode('pos');
              setErrors({});
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${loginMode === 'pos'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
              }`}
          >
            <Key className="w-4 h-4" />
            Waiters/Bar
          </button>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden min-h-[400px]">
          <div className="p-6 sm:p-8">
            {errors.general && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-start gap-3"
              >
                <Shield className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="font-medium">Authentication failed</p>
                  <p className="text-red-500 text-xs mt-0.5">{errors.general}</p>
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {loginMode === 'standard' ? (
                <motion.div
                  key="standard"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-stone-400 pointer-events-none" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className={`w-full pl-10 pr-4 py-2.5 bg-stone-50 border rounded-xl text-sm text-stone-900 placeholder:text-stone-400 transition-all focus:bg-white focus:outline-none focus:ring-2 ${errors.email
                          ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                          : 'border-stone-200 focus:border-stone-400 focus:ring-stone-100'
                          }`}
                        placeholder="name@company.com"
                        autoComplete="email"
                      />
                    </div>
                    {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email}</p>}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-stone-700">Password</label>
                      <button type="button" className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-stone-400 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        className={`w-full pl-10 pr-10 py-2.5 bg-stone-50 border rounded-xl text-sm text-stone-900 placeholder:text-stone-400 transition-all focus:bg-white focus:outline-none focus:ring-2 ${errors.password
                          ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                          : 'border-stone-200 focus:border-stone-400 focus:ring-stone-100'
                          }`}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-5 h-5 border-2 border-stone-200 rounded-md peer-checked:bg-stone-900 peer-checked:border-stone-900 transition-all group-hover:border-stone-300" />
                        <CheckCircle2 className="absolute inset-0 w-5 h-5 text-white scale-0 peer-checked:scale-100 transition-transform p-0.5" />
                      </div>
                      <span className="text-sm text-stone-600 group-hover:text-stone-900 transition-colors">Keep me signed in</span>
                    </label>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="pos"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="text-center pb-4">
                    <div className="inline-flex gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 shadow-inner">
                        <ChefHat className="w-6 h-6" />
                      </div>
                      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
                        <GlassWater className="w-6 h-6" />
                      </div>
                    </div>
                    <p className="text-sm text-stone-500 px-4">
                      Enter your specialized 4-character POS PIN to quickly log into your branch station.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5 text-center">Enter PIN</label>
                    <div className="relative max-w-[180px] mx-auto">
                      <input
                        type="text"
                        value={formData.pin}
                        autoFocus
                        maxLength={4}
                        onChange={(e) => setFormData(prev => ({ ...prev, pin: e.target.value.toUpperCase() }))}
                        className={`w-full text-center text-2xl font-bold tracking-[0.5em] py-4 bg-stone-50 border rounded-2xl transition-all focus:bg-white focus:outline-none focus:ring-4 ${errors.pin
                          ? 'border-red-300 focus:ring-red-100 text-red-600'
                          : 'border-stone-200 focus:border-stone-400 focus:ring-stone-100 text-stone-900'
                          }`}
                        placeholder="0000"
                      />
                    </div>
                    {errors.pin && <p className="mt-2 text-xs text-red-500 text-center">{errors.pin}</p>}
                    <p className="mt-4 text-[10px] text-stone-400 text-center flex items-center justify-center gap-1.5 uppercase tracking-widest font-semibold">
                      <Shield className="w-3 h-3" /> Branch-Level Security
                    </p>
                  </div>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md disabled:shadow-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Authorizing...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Dashboard</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer Info */}
          <div className="px-6 py-4 bg-stone-50 border-t border-stone-200">
            <div className="flex items-center justify-center gap-2 text-[10px] text-stone-400 font-medium tracking-tight">
              <Shield className="w-3 h-3" />
              <span>AES-256 END-TO-END ENCRYPTED</span>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-xs text-stone-400">
            &copy; {new Date().getFullYear()} Famous Gates Hotels. All rights reserved.
          </p>

        </div>
      </motion.div>
    </div>
  );
}
