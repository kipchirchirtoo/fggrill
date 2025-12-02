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
  ChevronRight,
  Building2
} from 'lucide-react';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!formData.email) {
      setErrors(prev => ({ ...prev, email: 'Email is required' }));
      return;
    }
    if (!formData.password) {
      setErrors(prev => ({ ...prev, password: 'Password is required' }));
      return;
    }

    try {
      await login(formData.email, formData.password);
    } catch (error) {
      setErrors({ general: 'Invalid email or password' });
    }
  };

  // Quick login buttons for demo
  const demoAccounts = [
    { email: 'admin@dev.com', password: 'any', role: 'Dev Admin', category: 'dev' },
    { email: 'admin@famousgate.com', password: 'admin123', role: 'Super Admin', category: 'mgmt' },
    { email: 'gm@famousgate.com', password: 'gm123', role: 'General Manager', category: 'mgmt' },
    { email: 'manager.bomet@famousgate.com', password: 'bomet123', role: 'Bomet Manager', category: 'branch' },
    { email: 'central@famousgate.com', password: 'central123', role: 'Central Store', category: 'store' },
    { email: 'store.bomet@famousgate.com', password: 'store123', role: 'Branch Store', category: 'store' },
    { email: 'reception@famousgate.com', password: 'reception123', role: 'Reception', category: 'ops' },
    { email: 'restaurant@famousgate.com', password: 'rest123', role: 'Restaurant', category: 'ops' },
    { email: 'housekeeping@famousgate.com', password: 'house123', role: 'Housekeeping', category: 'ops' },
    { email: 'accountant@famousgate.com', password: 'account123', role: 'Accountant', category: 'finance' },
  ];

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#3C3C43] mb-4 overflow-hidden"
          >
            <Image
              src="/fglogo.png"
              alt="Famous Gate"
              width={48}
              height={48}
              className="object-cover scale-150"
              style={{ objectPosition: 'center 30%', width: 'auto', height: 'auto' }}
            />
          </motion.div>
          <h1 className="text-2xl font-bold text-[#000000]">Famous Gate</h1>
          <p className="text-[#8E8E93] text-sm">Hotel Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[rgba(60,60,67,0.12)] p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold font-sf-pro-display text-[#000000]">Sign In</h2>
            <p className="text-sm text-[#8E8E93]">Access your dashboard</p>
          </div>

          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#3C3C43] mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#8E8E93]" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full pl-10 pr-4 py-3 bg-[#F2F2F7] border rounded-xl focus:ring-2 focus:ring-[#3C3C43] focus:border-transparent focus:bg-white transition-all ${
                    errors.email ? 'border-red-500' : 'border-[rgba(60,60,67,0.12)]'
                  }`}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#3C3C43] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#8E8E93]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className={`w-full pl-10 pr-12 py-3 bg-[#F2F2F7] border rounded-xl focus:ring-2 focus:ring-[#3C3C43] focus:border-transparent focus:bg-white transition-all ${
                    errors.password ? 'border-red-500' : 'border-[rgba(60,60,67,0.12)]'
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#3C3C43]"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-[rgba(60,60,67,0.12)] text-[#3C3C43] focus:ring-[#3C3C43]" />
                <span className="ml-2 text-[#8E8E93]">Remember me</span>
              </label>
              <a href="#" className="text-[#3C3C43] hover:underline font-medium">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#3C3C43] text-white py-3 rounded-xl font-medium hover:bg-[#2C2C33] focus:outline-none focus:ring-2 focus:ring-[#3C3C43] focus:ring-offset-2 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Demo Quick Login */}
          <div className="mt-6 pt-6 border-t border-[rgba(60,60,67,0.12)]">
            <p className="text-xs text-[#8E8E93] mb-3 text-center">Quick Demo Login</p>
            <div className="grid grid-cols-5 gap-1.5">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.role}
                  onClick={() => login(acc.email, acc.password)}
                  className="text-[10px] px-1.5 py-2 rounded-ios-lg bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA] transition-colors font-medium truncate"
                  title={acc.role}
                >
                  {acc.role.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-[#8E8E93]">
            Need help? Call{' '}
            <a href="tel:0790900777" className="text-[#3C3C43] font-medium hover:underline">
              0790 900 777
            </a>
          </p>
          <p className="text-xs text-[#8E8E93] mt-2">
            © 2024 Famous Gate Hotel & Lounge
          </p>
        </div>
      </motion.div>
    </div>
  );
}
