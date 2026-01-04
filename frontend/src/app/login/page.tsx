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
  Shield,
  CheckCircle2
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

    try {
      await login(formData.email, formData.password);
    } catch (error: any) {
      setErrors({ general: error.message || 'Invalid email or password' });
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
        <div className="text-center mb-8">
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
            Welcome back
          </h1>
          <p className="text-stone-500 text-sm">
            Sign in to your dashboard to manage operations
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
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
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
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

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                  <span className="text-sm text-stone-600">Remember me</span>
                </label>
                <button type="button" className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors">
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md disabled:shadow-none"
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
          </div>

          {/* Footer Info */}
          <div className="px-6 py-4 bg-stone-50 border-t border-stone-200">
            <div className="flex items-center justify-center gap-2 text-xs text-stone-500">
              <Shield className="w-3 h-3" />
              <span>Secure, encrypted connection</span>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-xs text-stone-400">
            &copy; {new Date().getFullYear()} Famous Gate Hotel. All rights reserved.
          </p>
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-stone-400">
            <span>System managed by</span>
            <span className="font-semibold text-amber-600">Hirall</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
