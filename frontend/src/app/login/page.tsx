'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import Image from 'next/image';
import { 
  Hotel, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff,
  Loader2,
  ChevronRight,
  Sparkles,
  Coffee,
  Leaf,
  Star
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
      { email: 'admin@famousgate.com', password: 'admin123', role: 'Super Admin', color: 'bg-amber-900/20 text-amber-900 border-amber-300 hover:bg-amber-900/30' },
      { email: 'gm@famousgate.com', password: 'gm123', role: 'General Manager', color: 'bg-green-800/20 text-green-900 border-green-300 hover:bg-green-800/30' },
    ],
    branchManagers: [
      { email: 'manager.bomet@famousgate.com', password: 'bomet123', role: 'Manager (Bomet HQ)', color: 'bg-amber-800/20 text-amber-800 border-amber-200 hover:bg-amber-800/30' },
      { email: 'manager.kericho@famousgate.com', password: 'kericho123', role: 'Manager (Kericho)', color: 'bg-amber-800/20 text-amber-800 border-amber-200 hover:bg-amber-800/30' },
      { email: 'manager.litein@famousgate.com', password: 'litein123', role: 'Manager (Litein)', color: 'bg-amber-800/20 text-amber-800 border-amber-200 hover:bg-amber-800/30' },
    ],
    storekeeping: [
      { email: 'central@famousgate.com', password: 'central123', role: 'Central Storekeeper', color: 'bg-green-700/20 text-green-800 border-green-200 hover:bg-green-700/30' },
      { email: 'store.bomet@famousgate.com', password: 'store123', role: 'Store (Bomet)', color: 'bg-green-600/20 text-green-700 border-green-200 hover:bg-green-600/30' },
      { email: 'store.kericho@famousgate.com', password: 'store123', role: 'Store (Kericho)', color: 'bg-green-600/20 text-green-700 border-green-200 hover:bg-green-600/30' },
    ],
    operations: [
      { email: 'reception@famousgate.com', password: 'reception123', role: 'Receptionist', color: 'bg-stone-200 text-stone-700 border-stone-300 hover:bg-stone-300' },
      { email: 'housekeeping@famousgate.com', password: 'house123', role: 'Housekeeping', color: 'bg-stone-200 text-stone-700 border-stone-300 hover:bg-stone-300' },
      { email: 'restaurant@famousgate.com', password: 'rest123', role: 'Restaurant', color: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200' },
      { email: 'maintenance@famousgate.com', password: 'maint123', role: 'Maintenance', color: 'bg-stone-200 text-stone-700 border-stone-300 hover:bg-stone-300' },
    ],
    finance: [
      { email: 'accountant@famousgate.com', password: 'account123', role: 'Accountant', color: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200' },
      { email: 'auditor@famousgate.com', password: 'audit123', role: 'Auditor', color: 'bg-lime-100 text-lime-800 border-lime-200 hover:bg-lime-200' },
    ],
    bar: [
      { email: 'bar.bomet@famousgate.com', password: 'bar123', role: 'Bartender (Bomet)', color: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200' },
      { email: 'bar.kericho@famousgate.com', password: 'bar123', role: 'Bartender (Kericho)', color: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200' },
      { email: 'bar.litein@famousgate.com', password: 'bar123', role: 'Bartender (Litein)', color: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200' },
    ]
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(62, 39, 22, 0.92) 0%, rgba(34, 54, 34, 0.88) 50%, rgba(62, 39, 22, 0.92) 100%), 
                           url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />
      
      {/* Decorative Elements */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-green-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/4 w-48 h-48 bg-green-400/5 rounded-full blur-2xl" />
      
      <div className="relative z-10 flex min-h-screen">
        {/* Left Side - Hero Branding */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:flex lg:w-1/2 p-12 text-white relative"
        >
          <div className="flex flex-col justify-center items-center w-full">
            {/* Large Centered Logo */}
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative mb-8"
            >
              <div className="absolute inset-0 bg-white/20 rounded-full blur-3xl scale-150" />
              <div className="relative h-48 w-48 bg-white rounded-full overflow-hidden shadow-2xl border-4 border-white/30 p-4">
                <Image
                  src="/fglogo.png"
                  alt="Famous Gate"
                  fill
                  className="object-contain p-2"
                  priority
                />
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-center"
            >
              <h1 className="text-5xl font-bold mb-2 text-white drop-shadow-lg">
                Famous Gate
              </h1>
              <p className="text-2xl text-amber-200 font-light mb-6">Hotel & Lounge</p>
              <div className="flex items-center justify-center gap-2 text-green-200 mb-8">
                <Leaf className="h-5 w-5" />
                <span className="text-lg">Bomet, Kenya</span>
                <Leaf className="h-5 w-5" />
              </div>
              
              <p className="text-xl text-white/80 max-w-md mx-auto leading-relaxed">
                Experience warmth, comfort, and exceptional hospitality in the heart of the Rift Valley
              </p>
            </motion.div>
            
            {/* Feature Cards */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="grid grid-cols-2 gap-4 mt-12 max-w-lg"
            >
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <Coffee className="h-6 w-6 mb-2 text-amber-300" />
                <h3 className="font-semibold text-white mb-1">Premium Lounge</h3>
                <p className="text-sm text-white/70">Finest coffee & cuisine</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <Star className="h-6 w-6 mb-2 text-amber-300" />
                <h3 className="font-semibold text-white mb-1">Luxury Rooms</h3>
                <p className="text-sm text-white/70">Comfort redefined</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <Sparkles className="h-6 w-6 mb-2 text-green-300" />
                <h3 className="font-semibold text-white mb-1">Events & Meetings</h3>
                <p className="text-sm text-white/70">Perfect venue</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <Hotel className="h-6 w-6 mb-2 text-green-300" />
                <h3 className="font-semibold text-white mb-1">6 Branches</h3>
                <p className="text-sm text-white/70">Across the region</p>
              </div>
            </motion.div>
            
            <div className="absolute bottom-8 text-sm text-white/50">
              © 2024 Famous Gate Hotel & Lounge. All rights reserved.
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
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="inline-block mb-4"
              >
                <div className="relative h-24 w-24 bg-white rounded-full overflow-hidden shadow-xl border-4 border-white/50 mx-auto p-2">
                  <Image
                    src="/fglogo.png"
                    alt="Famous Gate"
                    fill
                    className="object-contain"
                  />
                </div>
              </motion.div>
              <h1 className="text-2xl font-bold text-white">Famous Gate</h1>
              <p className="text-amber-200">Hotel & Lounge</p>
            </div>

            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
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
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors ${
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
                      className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors ${
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
                    <input type="checkbox" className="rounded border-gray-300 text-amber-800 focus:ring-amber-500" />
                    <span className="ml-2 text-sm text-gray-600">Remember me</span>
                  </label>
                  <a href="#" className="text-sm text-amber-800 hover:text-amber-600">
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-amber-800 to-green-800 text-white py-3 rounded-lg font-semibold hover:from-amber-900 hover:to-green-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg"
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
                <div className="mb-3">
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

                {/* Bar */}
                <div>
                  <p className="text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">🍸 Bar & Lounge</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {demoAccounts.bar.map((acc) => (
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

            <p className="mt-8 text-center text-sm text-white/80">
              Need help? Contact{' '}
              <a href="tel:0790900777" className="text-amber-300 hover:text-amber-200 font-medium">
                0790900777
              </a>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
