'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { 
  Hotel, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff,
  Loader2,
  ChevronRight,
  Sparkles
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

    // Basic validation
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

  // Quick login buttons for demo - organized by category
  const demoAccounts = {
    management: [
      { email: 'admin@famousgate.com', password: 'admin123', role: 'Super Admin', color: 'bg-red-100 text-red-700 border-red-200' },
      { email: 'gm@famousgate.com', password: 'gm123', role: 'General Manager', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    ],
    branchManagers: [
      { email: 'manager.bomet@famousgate.com', password: 'bomet123', role: 'Manager (Bomet HQ)', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
      { email: 'manager.kericho@famousgate.com', password: 'kericho123', role: 'Manager (Kericho)', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
      { email: 'manager.litein@famousgate.com', password: 'litein123', role: 'Manager (Litein)', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    ],
    storekeeping: [
      { email: 'central@famousgate.com', password: 'central123', role: 'Central Storekeeper', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      { email: 'store.bomet@famousgate.com', password: 'store123', role: 'Store (Bomet)', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
      { email: 'store.kericho@famousgate.com', password: 'store123', role: 'Store (Kericho)', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    ],
    operations: [
      { email: 'reception@famousgate.com', password: 'reception123', role: 'Receptionist', color: 'bg-green-100 text-green-700 border-green-200' },
      { email: 'housekeeping@famousgate.com', password: 'house123', role: 'Housekeeping', color: 'bg-teal-100 text-teal-700 border-teal-200' },
      { email: 'restaurant@famousgate.com', password: 'rest123', role: 'Restaurant', color: 'bg-orange-100 text-orange-700 border-orange-200' },
      { email: 'maintenance@famousgate.com', password: 'maint123', role: 'Maintenance', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    ],
    finance: [
      { email: 'accountant@famousgate.com', password: 'account123', role: 'Accountant', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      { email: 'auditor@famousgate.com', password: 'audit123', role: 'Auditor', color: 'bg-lime-100 text-lime-700 border-lime-200' },
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      
      <div className="flex min-h-screen">
        {/* Left Side - Branding */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 to-purple-700 p-12 text-white relative overflow-hidden"
        >
          {/* Decorative circles */}
          <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col justify-between w-full">
            <div>
              <div className="flex items-center space-x-3 mb-12">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Hotel className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Famous Gate Hotel</h1>
                  <p className="text-indigo-200">Kericho, Kenya</p>
                </div>
              </div>
              
              <div className="space-y-8">
                <div>
                  <h2 className="text-4xl font-bold mb-4">
                    Welcome to Your Hotel Management Portal
                  </h2>
                  <p className="text-xl text-indigo-100">
                    Streamline operations, enhance guest experiences, and boost revenue with our comprehensive management system.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <Sparkles className="h-6 w-6 mb-2" />
                    <h3 className="font-semibold mb-1">Smart Booking</h3>
                    <p className="text-sm text-indigo-100">Real-time room availability and instant confirmations</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <Sparkles className="h-6 w-6 mb-2" />
                    <h3 className="font-semibold mb-1">Guest Management</h3>
                    <p className="text-sm text-indigo-100">Complete CRM with loyalty programs</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <Sparkles className="h-6 w-6 mb-2" />
                    <h3 className="font-semibold mb-1">Staff Coordination</h3>
                    <p className="text-sm text-indigo-100">Efficient task management and scheduling</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <Sparkles className="h-6 w-6 mb-2" />
                    <h3 className="font-semibold mb-1">Financial Insights</h3>
                    <p className="text-sm text-indigo-100">Real-time revenue tracking and reports</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-indigo-200">
              © 2024 Famous Gate Hotel. All rights reserved.
            </div>
          </div>
        </motion.div>

        {/* Right Side - Login Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-md"
          >
            {/* Mobile Logo */}
            <div className="lg:hidden mb-8 text-center">
              <div className="inline-flex items-center space-x-3 mb-4">
                <div className="p-3 bg-indigo-100 rounded-xl">
                  <Hotel className="h-8 w-8 text-indigo-600" />
                </div>
                <div className="text-left">
                  <h1 className="text-xl font-bold text-gray-900">Famous Gate Hotel</h1>
                  <p className="text-sm text-gray-600">Management System</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                <p className="text-gray-600">Sign in to access your dashboard</p>
              </div>

              {errors.general && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {errors.general}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                        errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter your email"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                        errors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="ml-2 text-sm text-gray-600">Remember me</span>
                  </label>
                  <a href="#" className="text-sm text-indigo-600 hover:text-indigo-500">
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center space-x-2"
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
              <div className="mt-8 pt-6 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-4 text-center font-medium">🔐 Demo Accounts - Click to Login</p>
                
                {/* Management */}
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">Management</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {demoAccounts.management.map((acc) => (
                      <button
                        key={acc.role}
                        onClick={() => login(acc.email, acc.password)}
                        className={`text-xs px-2 py-1.5 rounded border transition-all hover:scale-105 font-medium ${acc.color}`}
                      >
                        {acc.role}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Branch Managers */}
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">Branch Managers</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {demoAccounts.branchManagers.map((acc) => (
                      <button
                        key={acc.role}
                        onClick={() => login(acc.email, acc.password)}
                        className={`text-xs px-2 py-1.5 rounded border transition-all hover:scale-105 font-medium ${acc.color}`}
                      >
                        {acc.role}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Storekeeping */}
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">Storekeeping</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {demoAccounts.storekeeping.map((acc) => (
                      <button
                        key={acc.role}
                        onClick={() => login(acc.email, acc.password)}
                        className={`text-xs px-2 py-1.5 rounded border transition-all hover:scale-105 font-medium ${acc.color}`}
                      >
                        {acc.role}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Operations */}
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">Operations</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {demoAccounts.operations.map((acc) => (
                      <button
                        key={acc.role}
                        onClick={() => login(acc.email, acc.password)}
                        className={`text-xs px-2 py-1.5 rounded border transition-all hover:scale-105 font-medium ${acc.color}`}
                      >
                        {acc.role}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Finance */}
                <div>
                  <p className="text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">Finance</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {demoAccounts.finance.map((acc) => (
                      <button
                        key={acc.role}
                        onClick={() => login(acc.email, acc.password)}
                        className={`text-xs px-2 py-1.5 rounded border transition-all hover:scale-105 font-medium ${acc.color}`}
                      >
                        {acc.role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-gray-600">
              Need help? Contact{' '}
              <a href="tel:0790900777" className="text-indigo-600 hover:text-indigo-500">
                0790900777
              </a>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
