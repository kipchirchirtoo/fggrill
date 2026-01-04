'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import Image from 'next/image';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  User,
  Hotel,
  Utensils,
  Shield,
  Clock
} from 'lucide-react';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

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
    if (formData.password.length < 6) {
      setErrors(prev => ({ ...prev, password: 'Password must be at least 6 characters' }));
      return;
    }

    try {
      await login(formData.email, formData.password);
    } catch (error: any) {
      setErrors({ general: error.message || 'Invalid email or password' });
    }
  };

  const features = [
    { icon: Hotel, title: 'Room Management', desc: 'Track occupancy & bookings' },
    { icon: Utensils, title: 'Restaurant & Bar', desc: 'POS & inventory control' },
    { icon: Shield, title: 'Secure Access', desc: 'Role-based permissions' },
    { icon: Clock, title: 'Real-time Updates', desc: 'Live dashboard insights' },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col lg:flex-row">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[48%] bg-stone-900 relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-800 via-stone-900 to-stone-950" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <div className="flex items-center gap-3 mb-20">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center overflow-hidden border border-white/5">
                <Image src="/fglogo.png" alt="Famous Gate" width={36} height={36} className="object-cover scale-150" style={{ objectPosition: 'center 30%', width: 'auto', height: 'auto' }} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white tracking-tight">Famous Gate</h1>
                <p className="text-sm text-stone-400">Hotel & Lounge</p>
              </div>
            </div>

            <div className="max-w-lg">
              <h2 className="text-[44px] leading-[1.08] font-semibold text-white tracking-[-0.025em] mb-6">
                Your complete hospitality management solution
              </h2>
              <p className="text-stone-400 text-base leading-relaxed mb-12">
                Streamline operations across all departments — from front desk to kitchen, housekeeping to accounting — all in one powerful platform.
              </p>

              {/* Feature Grid */}
              <div className="grid grid-cols-2 gap-4">
                {features.map((feature, idx) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1, duration: 0.4 }}
                    className="p-4 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm"
                  >
                    <feature.icon className="w-5 h-5 text-amber-400 mb-3" />
                    <h3 className="text-sm font-medium text-white mb-1">{feature.title}</h3>
                    <p className="text-xs text-stone-500">{feature.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full bg-stone-700 border-2 border-stone-900 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                  </div>
                ))}
              </div>
              <p className="text-sm text-stone-500">Trusted by 50+ staff members</p>
            </div>
            <p className="text-xs text-stone-600">v2.0</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-[420px]"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-11 h-11 rounded-xl bg-stone-900 flex items-center justify-center overflow-hidden">
              <Image src="/fglogo.png" alt="Famous Gate" width={30} height={30} className="object-cover scale-150" style={{ objectPosition: 'center 30%', width: 'auto', height: 'auto' }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-stone-900">Famous Gate</h1>
              <p className="text-xs text-stone-500">Hotel & Lounge</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-[28px] font-semibold text-stone-900 tracking-[-0.02em]">Welcome back</h2>
            <p className="text-stone-500 mt-2 text-[15px]">Sign in to access your dashboard</p>
          </div>

          {errors.general && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-start gap-3"
            >
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-red-500 text-xs font-bold">!</span>
              </div>
              <div>
                <p className="font-medium">Authentication failed</p>
                <p className="text-red-500 text-xs mt-0.5">{errors.general}</p>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] pointer-events-none text-stone-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full pl-11 pr-4 py-3 bg-white border rounded-xl text-[15px] text-stone-900 placeholder:text-stone-400 transition-all duration-200 focus:outline-none focus:ring-2 ${errors.email
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                    : 'border-stone-200 focus:border-stone-400 focus:ring-stone-100'
                    }`}
                  placeholder="you@famousgate.com"
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><span>•</span>{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] pointer-events-none text-stone-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className={`w-full pl-11 pr-12 py-3 bg-white border rounded-xl text-[15px] text-stone-900 placeholder:text-stone-400 transition-all duration-200 focus:outline-none focus:ring-2 ${errors.password
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                    : 'border-stone-200 focus:border-stone-400 focus:ring-stone-100'
                    }`}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 transition-colors rounded-md hover:bg-stone-100"
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
              {errors.password && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><span>•</span>{errors.password}</p>}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 rounded-md border-2 border-stone-300 bg-white peer-checked:bg-stone-900 peer-checked:border-stone-900 transition-all duration-200 flex items-center justify-center">
                    {rememberMe && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-stone-600 group-hover:text-stone-900 transition-colors">Remember me</span>
              </label>
              <button
                type="button"
                className="text-sm font-medium text-stone-600 hover:text-amber-600 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mt-6 shadow-lg shadow-stone-900/10 hover:shadow-xl hover:shadow-stone-900/15 disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Help Section */}
          <div className="mt-10 pt-8 border-t border-stone-200">
            <div className="bg-stone-50 rounded-xl p-5">
              <h3 className="text-sm font-medium text-stone-900 mb-2">Need assistance?</h3>
              <p className="text-xs text-stone-500 mb-4">Contact your system administrator or IT support if you're having trouble accessing your account.</p>
              <div className="flex items-center gap-4">
                <a
                  href="tel:0790900777"
                  className="flex items-center gap-2 text-sm font-medium text-stone-700 hover:text-amber-600 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <span>0790 900 777</span>
                </a>
                <a
                  href="mailto:support@famousgate.com"
                  className="flex items-center gap-2 text-sm font-medium text-stone-700 hover:text-amber-600 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <span>Email Support</span>
                </a>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-stone-400">
              &copy; {new Date().getFullYear()} Famous Gate Hotel & Lounge. All rights reserved.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
