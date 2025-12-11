'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { SearchModal } from '@/components/modals/SearchModal';
import { NotificationModal } from '@/components/modals/NotificationModal';
import { useAuth, UserRole } from '@/lib/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import { notificationsAPI } from '@/lib/api';
import { ConsolidatedNav } from '@/components/layout/consolidated-nav';
import {
  Hotel,
  LayoutDashboard,
  Calendar,
  Users,
  Bed,
  UtensilsCrossed,
  DollarSign,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  User,
  Home,
  Package,
  ClipboardList,
  ClipboardCheck,
  Wrench,
  Search,
  Moon,
  Sun,
  Warehouse,
  ArrowRightLeft,
  Truck,
  Car,
  Building2,
  FileText,
  ShoppingCart,
  Send,
  Clock,
  CheckCircle,
  ChefHat,
  AlertTriangle
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // Dark mode removed - light theme only
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Storekeeping']);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await notificationsAPI.getUnreadCount();
        if (response.success && response.data) {
          setUnreadCount(response.data.count);
        } else {
          // If API returns error, reset count to 0
          setUnreadCount(0);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
        setUnreadCount(0);
      }
    };

    if (user) {
      fetchUnreadCount();
      // Poll for updates every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    } else {
      // Clear notifications if no user
      setUnreadCount(0);
    }
  }, [user]);

  // Update unread count when notification modal closes
  const handleNotificationModalClose = () => {
    setNotificationModalOpen(false);
    // Refresh unread count
    notificationsAPI.getUnreadCount().then(response => {
      if (response.success && response.data) {
        setUnreadCount(response.data.count);
      } else {
        // Reset count on error
        setUnreadCount(0);
      }
    }).catch(error => {
      console.error('Error updating notification count:', error);
      setUnreadCount(0);
    });
  };

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuName) 
        ? prev.filter(m => m !== menuName) 
        : [...prev, menuName]
    );
  };

  // Use ConsolidatedNav for navigation

  return (
    <div className="min-h-screen">
      <div className="flex h-screen bg-[#F2F2F7]">
        {/* Sidebar - Desktop */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="hidden lg:flex lg:flex-shrink-0"
            >
              <div className="flex w-64 flex-col">
                <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-[rgba(60,60,67,0.12)]">
                  <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
                    {/* Logo */}
                    <div className="flex items-center flex-shrink-0 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-[#3C3C43] flex items-center justify-center overflow-hidden">
                          <Image
                            src="/fglogo.png"
                            alt="Famous Gate"
                            width={32}
                            height={32}
                            className="object-cover scale-150"
                            style={{ objectPosition: 'center 30%', width: 'auto', height: 'auto' }}
                          />
                        </div>
                        <div>
                          <h1 className="text-base font-bold text-[#000000]">Famous Gate</h1>
                          <p className="text-xs text-[#8E8E93]">Management</p>
                        </div>
                      </div>
                    </div>

                    {/* Navigation */}
                    <nav className="mt-8 flex-1 space-y-1 px-2 overflow-y-auto">
                      <ConsolidatedNav />
                    </nav>
                  </div>

                  {/* User section */}
                  <div className="flex flex-shrink-0 border-t border-[rgba(60,60,67,0.12)] p-4">
                    <div className="flex items-center w-full">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-[#F2F2F7] flex items-center justify-center">
                          <User className="h-6 w-6 text-[#3C3C43]" />
                        </div>
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-[#000000]">
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs text-[#8E8E93]">
                          {user?.role.replace('_', ' ')}
                        </p>
                      </div>
                      <button
                        onClick={logout}
                        className="ml-auto text-[#8E8E93] hover:text-[#3C3C43]"
                      >
                        <LogOut className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Mobile sidebar */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black lg:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-[rgba(60,60,67,0.12)] lg:hidden"
              >
                {/* Mobile menu content - same as desktop */}
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center justify-between p-4 border-b border-[rgba(60,60,67,0.12)]">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-ios-lg bg-[#3C3C43] flex items-center justify-center overflow-hidden">
                        <Image
                          src="/fglogo.png"
                          alt="Famous Gate"
                          width={24}
                          height={24}
                          className="object-cover scale-150"
                          style={{ objectPosition: 'center 30%', width: 'auto', height: 'auto' }}
                        />
                      </div>
                      <h1 className="text-base font-bold text-[#000000]">Famous Gate</h1>
                    </div>
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-[#3C3C43]"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <nav className="mt-5 flex-1 space-y-1 px-2 overflow-y-auto">
                    <ConsolidatedNav />
                  </nav>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="bg-white border-b border-[rgba(60,60,67,0.12)]">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="hidden lg:block text-[#3C3C43] hover:text-[#000000]"
                >
                  <Menu className="h-6 w-6" />
                </button>
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden text-[#3C3C43] hover:text-[#000000]"
                >
                  <Menu className="h-6 w-6" />
                </button>

                {/* Search */}
                <div className="ml-4 flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#8E8E93]" />
                    <button
                      onClick={() => setSearchModalOpen(true)}
                      className="w-full pl-10 pr-4 py-2 bg-[#F2F2F7] border border-[rgba(60,60,67,0.12)] rounded-xl text-left text-[#8E8E93] hover:bg-white"
                    >
                      Search...
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Notifications */}
                <button
                  onClick={() => setNotificationModalOpen(true)}
                  className="relative text-[#3C3C43] hover:text-[#000000]"
                >
                  <Bell className="h-6 w-6" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-[#3C3C43] text-white text-xs rounded-full flex items-center justify-center font-semibold font-sf-pro-display">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* User menu */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-2 text-[#3C3C43] hover:text-[#000000]"
                  >
                    <div className="h-8 w-8 rounded-full bg-[#F2F2F7] flex items-center justify-center">
                      <User className="h-5 w-5 text-[#3C3C43]" />
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-[rgba(60,60,67,0.12)] shadow-lg py-1 z-50"
                      >
                        <a
                          href="/dashboard/profile"
                          className="block px-4 py-2 text-sm text-[#000000] hover:bg-[#F2F2F7]"
                        >
                          Profile
                        </a>
                        <a
                          href="/dashboard/settings"
                          className="block px-4 py-2 text-sm text-[#000000] hover:bg-[#F2F2F7]"
                        >
                          Settings
                        </a>
                        <hr className="my-1 border-[rgba(60,60,67,0.12)]" />
                        <button
                          onClick={logout}
                          className="block w-full text-left px-4 py-2 text-sm text-[#FF3B30] hover:bg-[#F2F2F7]"
                        >
                          Sign out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </header>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto bg-[#F2F2F7]">
            <div className="p-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Modals */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
      <NotificationModal
        isOpen={notificationModalOpen}
        onClose={handleNotificationModalClose}
      />
    </div>
  );
}
