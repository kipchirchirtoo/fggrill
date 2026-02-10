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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/IMG_8704.JPG"
          alt="Famous Gates Hotels Background"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>

      {!mounted ? (
        <div className="z-10 bg-white/10 backdrop-blur-xl p-12 rounded-[3rem] border border-white/20">
          <Loader2 className="h-10 w-10 text-white animate-spin" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md z-10"
        >
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 mb-6 overflow-hidden shadow-2xl"
            >
              <Image
                src="/fglogo.png"
                alt="Famous Gate"
                width={56}
                height={56}
                className="object-cover scale-150"
                style={{ height: 'auto', width: 'auto' }}
                priority
              />
            </motion.div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-1">
              FAMOUS GATES SYSTEM
            </h1>
            <p className="text-white/70 text-sm font-medium tracking-wide uppercase">
              Exclusive Hospitality Gateway
            </p>
          </div>

          {/* Mode Selector */}
          <div className="bg-white/10 backdrop-blur-md p-1 rounded-2xl mb-6 flex gap-1 border border-white/10 shadow-lg">
            <button
              onClick={() => {
                setLoginMode('standard');
                setErrors({});
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${loginMode === 'standard'
                ? 'bg-white text-stone-900 shadow-xl scale-[1.02]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
            >
              <Shield className="w-4 h-4" />
              STANDARD
            </button>
            <button
              onClick={() => {
                setLoginMode('pos');
                setErrors({});
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${loginMode === 'pos'
                ? 'bg-white text-stone-900 shadow-xl scale-[1.02]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
            >
              <Key className="w-4 h-4" />
              STAFF PIN
            </button>
          </div>

          {/* Login Card - Glassmorphism */}
          <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden min-h-[420px]">
            <div className="p-8 sm:p-10">
              {errors.general && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 text-sm flex items-start gap-3"
                >
                  <Shield className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold uppercase tracking-tight">Access Denied</p>
                    <p className="text-red-500 text-xs mt-0.5 font-medium">{errors.general}</p>
                  </div>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {loginMode === 'standard' ? (
                  <motion.div
                    key="standard"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest ml-1">Account Entity</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400 group-focus-within:text-stone-900 transition-colors pointer-events-none" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          className={`w-full pl-12 pr-4 py-3.5 bg-stone-100/50 border-2 rounded-2xl text-sm text-stone-900 font-medium placeholder:text-stone-400 transition-all focus:bg-white focus:outline-none focus:ring-4 ${errors.email
                            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                            : 'border-transparent focus:border-stone-900/10 focus:ring-stone-900/5'
                            }`}
                          placeholder="Email Address"
                          autoComplete="email"
                        />
                      </div>
                      {errors.email && <p className="mt-1.5 text-xs text-red-500 font-bold ml-1">{errors.email}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between ml-1">
                        <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest">Secret Key</label>
                        <button type="button" className="text-[10px] font-bold text-amber-600 hover:text-amber-700 transition-colors uppercase tracking-widest">
                          Reset Access
                        </button>
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400 group-focus-within:text-stone-900 transition-colors pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          className={`w-full pl-12 pr-12 py-3.5 bg-stone-100/50 border-2 rounded-2xl text-sm text-stone-900 font-medium placeholder:text-stone-400 transition-all focus:bg-white focus:outline-none focus:ring-4 ${errors.password
                            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                            : 'border-transparent focus:border-stone-900/10 focus:ring-stone-900/5'
                            }`}
                          placeholder="Password"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="mt-1.5 text-xs text-red-500 font-bold ml-1">{errors.password}</p>}
                    </div>

                    <div className="flex items-center ml-1">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="peer sr-only"
                          />
                          <div className="w-6 h-6 border-2 border-stone-200 rounded-lg peer-checked:bg-stone-900 peer-checked:border-stone-900 transition-all group-hover:border-stone-300 shadow-sm" />
                          <CheckCircle2 className="absolute inset-0 w-6 h-6 text-white scale-0 peer-checked:scale-100 transition-transform p-1" />
                        </div>
                        <span className="text-xs font-bold text-stone-500 group-hover:text-stone-900 transition-colors uppercase tracking-widest">Maintain Session</span>
                      </label>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="pos"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-8"
                  >
                    <div className="text-center">
                      <div className="inline-flex gap-6 mb-6">
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          className="w-16 h-16 rounded-[1.5rem] bg-orange-100 flex items-center justify-center text-orange-600 shadow-lg shadow-orange-100/50"
                        >
                          <ChefHat className="w-8 h-8" />
                        </motion.div>
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          className="w-16 h-16 rounded-[1.5rem] bg-blue-100 flex items-center justify-center text-blue-600 shadow-lg shadow-blue-100/50"
                        >
                          <GlassWater className="w-8 h-8" />
                        </motion.div>
                      </div>
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest leading-relaxed px-2">
                        Personalized 4-character POS PIN required
                      </p>
                    </div>

                    <div className="space-y-6">
                      <div className="relative max-w-[260px] mx-auto group">
                        <div
                          className={`w-full text-center text-4xl font-black tracking-[0.3em] py-5 bg-stone-100 border-2 rounded-[2rem] transition-all shadow-inner ${errors.pin
                            ? 'border-red-300 text-red-600'
                            : 'border-transparent text-stone-900 group-hover:bg-stone-50'
                            }`}
                        >
                          {formData.pin || <span className="text-stone-300">____</span>}
                        </div>
                      </div>
                      {errors.pin && <p className="text-xs text-red-600 font-bold text-center -mt-2 uppercase tracking-wide">{errors.pin}</p>}

                      {/* Keypad */}
                      <div className="grid grid-cols-3 gap-4 max-w-[300px] mx-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              if (formData.pin.length < 4) {
                                setFormData(prev => ({ ...prev, pin: prev.pin + num }));
                                setErrors({});
                              }
                            }}
                            className="h-16 rounded-2xl bg-white border-2 border-stone-100 text-2xl font-black text-stone-800 hover:bg-stone-50 hover:border-stone-200 active:scale-90 transition-all shadow-sm hover:shadow-md"
                          >
                            {num}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.pin.length < 4) {
                              setFormData(prev => ({ ...prev, pin: prev.pin + 'R' }));
                              setErrors({});
                            }
                          }}
                          className="h-16 rounded-2xl bg-orange-50 border-2 border-orange-100 text-2xl font-black text-orange-600 hover:bg-orange-100 active:scale-90 transition-all shadow-sm"
                        >
                          R
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.pin.length < 4) {
                              setFormData(prev => ({ ...prev, pin: prev.pin + '0' }));
                              setErrors({});
                            }
                          }}
                          className="h-16 rounded-2xl bg-white border-2 border-stone-100 text-2xl font-black text-stone-800 hover:bg-stone-50 hover:border-stone-200 active:scale-90 transition-all shadow-sm"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.pin.length < 4) {
                              setFormData(prev => ({ ...prev, pin: prev.pin + 'B' }));
                              setErrors({});
                            }
                          }}
                          className="h-16 rounded-2xl bg-blue-50 border-2 border-blue-100 text-2xl font-black text-blue-600 hover:bg-blue-100 active:scale-90 transition-all shadow-sm"
                        >
                          B
                        </button>

                      </div>

                      <div className="flex gap-3 max-w-[300px] mx-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, pin: '' }));
                            setErrors({});
                          }}
                          className="flex-1 h-14 rounded-2xl bg-stone-100 border-2 border-transparent text-[10px] font-black text-stone-500 hover:bg-stone-200 active:scale-95 transition-all uppercase tracking-widest"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, pin: prev.pin.slice(0, -1) }));
                          }}
                          className="flex-1 h-14 rounded-2xl bg-stone-100 border-2 border-transparent flex items-center justify-center text-stone-500 hover:bg-stone-200 active:scale-95 transition-all"
                        >
                          <ArrowRight className="w-5 h-5 rotate-180" />
                        </button>
                      </div>

                      <p className="mt-4 text-[10px] text-stone-400 text-center flex items-center justify-center gap-2 uppercase tracking-[0.2em] font-black">
                        <Shield className="w-3.5 h-3.5" /> Station Identification required
                      </p>
                    </div>
                  </motion.div>
                )}

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-3 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] disabled:shadow-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Authorizing Portal</span>
                    </>
                  ) : (
                    <>
                      <span>ENTER FAMOUSGATES HOTELS</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </motion.button>
              </form>
            </div>

            {/* Footer Info */}
            <div className="px-8 py-5 bg-stone-50 border-t border-stone-100">
              <div className="flex items-center justify-center gap-3 text-[10px] text-stone-400 font-bold tracking-[0.15em] uppercase">
                <Shield className="w-3.5 h-3.5" />
                <span>AES-256 Military Grade Security</span>
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="mt-10 text-center space-y-3">
            <p className="text-[11px] text-white/50 font-bold tracking-widest uppercase">
              &copy; {new Date().getFullYear()} Famous Gates Hotels. Proprietary System.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
