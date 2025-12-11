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
    // Admin roles
    { email: 'admin@dev.com', password: 'any', role: 'Dev Admin', category: 'dev', description: 'Full Access (All Branches)' },
    { email: 'admin@famousgate.com', password: 'admin123', role: 'Super Admin', category: 'mgmt', description: 'Full Access (All Branches)' },
    
    // New consolidated roles (highlighted)
    { email: 'central-ops@famousgate.com', password: 'central123', role: 'Central Ops', category: 'new', description: 'Multi-Branch Management' },
    { email: 'branch-ops@famousgate.com', password: 'branch123', role: 'Branch Ops', category: 'new', description: 'Single Branch Management' },
    { email: 'facilities@famousgate.com', password: 'facil123', role: 'Facilities', category: 'new', description: 'Maintenance & Housekeeping' },
    
    // Central operations specific roles
    { email: 'central.manager@famousgate.com', password: 'central123', role: 'Central Ops Manager', category: 'central', description: 'All Branches Access' },
    { email: 'warehouse@famousgate.com', password: 'warehouse123', role: 'Warehouse Manager', category: 'central', description: 'Central Warehouse Access' },
    { email: 'logistics@famousgate.com', password: 'logistics123', role: 'Logistics', category: 'central', description: 'Dispatch Management' },
    
    // Legacy roles (will be phased out)
    { email: 'gm@famousgate.com', password: 'gm123', role: 'General Manager', category: 'mgmt', description: 'All Branches Access' },
    { email: 'manager.bomet@famousgate.com', password: 'bomet123', role: 'Bomet Manager', category: 'branch', description: 'Bomet Branch Access' },
    { email: 'central@famousgate.com', password: 'central123', role: 'Central Store', category: 'store', description: 'All Branches Access' },
    
    // Other operational roles
    { email: 'reception@famousgate.com', password: 'reception123', role: 'Reception', category: 'ops', description: 'Bomet Branch Access' },
    { email: 'restaurant@famousgate.com', password: 'rest123', role: 'Restaurant', category: 'ops', description: 'Bomet Branch Access' },
    { email: 'bar.bomet@famousgate.com', password: 'bar123', role: 'Bar Bomet', category: 'ops', description: 'Bomet Branch Access' },
    { email: 'bar.kericho@famousgate.com', password: 'bar123', role: 'Bar Kericho', category: 'ops', description: 'Kericho Branch Access' },
    { email: 'bar.litein@famousgate.com', password: 'bar123', role: 'Bar Litein', category: 'ops', description: 'Litein Branch Access' },
    { email: 'auditor@famousgate.com', password: 'audit123', role: 'Auditor', category: 'finance', description: 'All Branches Access' },
    { email: 'accountant@famousgate.com', password: 'account123', role: 'Accountant', category: 'finance', description: 'All Branches Access' },
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
            
            {/* New Consolidated Roles (Highlighted) */}
            <div className="mb-3">
              <p className="text-[10px] text-[#8E8E93] mb-1.5 font-medium">New Consolidated Roles:</p>
              <div className="grid grid-cols-3 gap-1.5">
                {demoAccounts
                  .filter(acc => acc.category === 'new')
                  .map((acc) => (
                    <button
                      key={acc.role}
                      onClick={() => login(acc.email, acc.password)}
                      className="text-[10px] px-1.5 py-2 rounded-ios-lg bg-[#007AFF] text-white hover:bg-[#0051FF] transition-colors font-medium truncate flex items-center justify-center gap-1"
                      title={`${acc.role} - ${acc.description}`}
                    >
                      <Building2 className="h-3 w-3" />
                      <div className="flex flex-col items-start">
                        <span>{acc.role}</span>
                        <span className="text-[7px] opacity-80">{acc.description}</span>
                      </div>
                    </button>
                  ))
                }
              </div>
            </div>
            
            {/* Central Operations Roles */}
            <div className="mb-3">
              <p className="text-[10px] text-[#8E8E93] mb-1.5 font-medium">Central Operations Team:</p>
              <div className="grid grid-cols-3 gap-1.5">
                {demoAccounts
                  .filter(acc => acc.category === 'central')
                  .map((acc) => (
                    <button
                      key={acc.role}
                      onClick={() => login(acc.email, acc.password)}
                      className="text-[10px] px-1.5 py-2 rounded-ios-lg bg-[#FF9500] text-white hover:bg-[#FF8000] transition-colors font-medium truncate flex items-center justify-center gap-1"
                      title={`${acc.role} - ${acc.description}`}
                    >
                      <div className="flex flex-col items-start">
                        <span>{acc.role}</span>
                        <span className="text-[7px] opacity-80">{acc.description}</span>
                      </div>
                    </button>
                  ))
                }
              </div>
            </div>
            
            {/* Other Roles */}
            <div>
              <p className="text-[10px] text-[#8E8E93] mb-1.5 font-medium">Other Roles:</p>
              <div className="grid grid-cols-4 gap-1.5">
                {demoAccounts
                  .filter(acc => !['new', 'central'].includes(acc.category))
                  .map((acc) => (
                    <button
                      key={acc.role}
                      onClick={() => login(acc.email, acc.password)}
                      className="text-[10px] px-1.5 py-2 rounded-ios-lg bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA] transition-colors font-medium truncate flex flex-col items-center justify-center"
                      title={`${acc.role} - ${acc.description}`}
                    >
                      <span>{acc.role.split(' ')[0]}</span>
                      <span className="text-[7px] opacity-60">{acc.description.includes('All') ? 'All Branches' : 'Single Branch'}</span>
                    </button>
                  ))
                }
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <div className="mb-4 text-center">
            <p className="text-xs text-[#8E8E93]">
              Dev Mode: Backend connection required for proper functionality. 
              Click any button to login with a demo account.
            </p>
            <p className="text-xs text-[#FF3B30] mt-1">
              Warning: No mock data - you must have backend server running
            </p>
          </div>
          <p className="text-sm text-[#8E8E93]">
            Need help? Call{' '}
            <a href="tel:0790900777" className="text-[#3C3C43] font-medium hover:underline">
              0790 900 777
            </a>
          </p>
          <p className="text-xs text-[#8E8E93] mt-2">
            &copy; 2024 Famous Gate Hotel & Lounge
          </p>
        </div>
      </motion.div>
    </div>
  );
}
