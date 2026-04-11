'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { NotificationModal } from '@/components/modals/NotificationModal';
import { useAuth, UserRole } from '@/lib/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import { notificationsAPI } from '@/lib/api';
import { ConsolidatedNav } from '@/components/layout/consolidated-nav';
import { NotificationListener } from '@/components/notifications/NotificationListener';
import { cn } from '@/lib/utils';
import {
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
  hideSidebar?: boolean;
}

export function DashboardLayout(props: DashboardLayoutProps) {
  const { children, hideHeader, hideSidebar } = props;
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Storekeeping']);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!user) return;
      try {
        const response = await notificationsAPI.getUnreadCount();
        if (response.success && response.data) {
          setUnreadCount(response.data.count);
        } else {
          setUnreadCount(0);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
        setUnreadCount(0);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleNotificationModalClose = async () => {
    setNotificationModalOpen(false);
    try {
      const response = await notificationsAPI.getUnreadCount();
      if (response.success && response.data) {
        setUnreadCount(response.data.count);
      } else {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error updating notification count:', error);
      setUnreadCount(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="flex h-screen">
        {/* Sidebar - Desktop */}
        {!hideSidebar && (
          <AnimatePresence>
            {sidebarOpen && (
              <motion.aside
                initial={{ x: -260 }}
                animate={{ x: 0 }}
                exit={{ x: -260 }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                className="hidden lg:flex lg:flex-shrink-0"
              >
                <div className="flex w-[260px] flex-col">
                  <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-stone-200/60">
                    <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden scrollbar-thin">
                      {/* Logo */}
                      <div className="flex items-center gap-3 px-5 py-5 border-b border-stone-100">
                        <div className="w-9 h-9 rounded-lg bg-stone-900 flex items-center justify-center overflow-hidden">
                          <Image
                            src="/fglogo.png"
                            alt="FamousGate Hotels"
                            width={28}
                            height={28}
                            className="object-cover scale-150"
                            style={{ objectPosition: 'center 30%', width: 'auto', height: 'auto' }}
                          />
                        </div>
                        <div>
                          <h1 className="text-[15px] font-semibold text-stone-900">Famous Gates Hotels</h1>
                          <p className="text-[11px] text-stone-500">Management System</p>
                        </div>
                      </div>

                      {/* Navigation */}
                      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
                        <ConsolidatedNav />
                      </nav>
                    </div>

                    {/* User section */}
                    <div className="flex-shrink-0 border-t border-stone-100 p-4 bg-stone-50/50">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 rounded-full bg-white border border-stone-200 flex items-center justify-center">
                          <User className="h-4 w-4 text-stone-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-stone-900 truncate">
                            {user?.firstName} {user?.lastName}
                          </p>
                          <p className="text-[11px] text-stone-500 truncate">
                            {user?.role.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <button
                          onClick={() => logout()}
                          className="p-1.5 rounded-md text-stone-400 hover:text-stone-600 hover:bg-white border border-transparent hover:border-stone-200 transition-all"
                          title="Sign out"
                        >
                          <LogOut className="h-4 w-4" />
                        </button>
                      </div>


                    </div>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        )}

        {/* Mobile sidebar */}
        {!hideSidebar && (
          <AnimatePresence>
            {mobileMenuOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-stone-900/20 backdrop-blur-sm lg:hidden"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <motion.aside
                  initial={{ x: -280 }}
                  animate={{ x: 0 }}
                  exit={{ x: -280 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-white shadow-soft-lg lg:hidden"
                >
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center overflow-hidden">
                          <Image
                            src="/fglogo.png"
                            alt="FamousGate Hotels"
                            width={24}
                            height={24}
                            className="object-cover scale-150"
                            style={{ objectPosition: 'center 30%' }}
                          />
                        </div>
                        <span className="text-[15px] font-semibold text-stone-900">Famous Gates Hotels</span>
                      </div>
                      <button
                        onClick={() => setMobileMenuOpen(false)}
                        className="p-1.5 rounded-md text-stone-500 hover:bg-stone-100"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
                      <ConsolidatedNav />
                    </nav>
                  </div>
                </motion.aside>
              </>
            )}
          </AnimatePresence>
        )}

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden w-full">
          {/* Top bar */}
          {!hideHeader && (
            <header className="bg-white border-b border-stone-200/60 flex-shrink-0">
              <div className="flex h-14 items-center justify-between px-4 lg:px-6">
                <div className="flex items-center gap-3">
                  {!hideSidebar && (
                    <>
                      <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="hidden lg:flex p-2 rounded-lg text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                      >
                        <Menu className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="lg:hidden p-2 rounded-lg text-stone-500 hover:text-stone-700 hover:bg-stone-100"
                      >
                        <Menu className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNotificationModalOpen(true)}
                    className="relative p-2 rounded-lg text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 h-4 w-4 bg-amber-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9' : unreadCount}
                      </span>
                    )}
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-stone-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-stone-600" />
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                    </button>

                    <AnimatePresence>
                      {userMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 mt-2 w-52 bg-white rounded-lg border border-stone-200 shadow-soft-md py-1.5 z-50"
                        >
                          <div className="px-3 py-2 border-b border-stone-100">
                            <p className="text-[13px] font-medium text-stone-900">{user?.firstName} {user?.lastName}</p>
                            <p className="text-[11px] text-stone-500">{user?.email}</p>
                          </div>
                          <a href="/dashboard/profile" className="block px-3 py-2 text-[13px] text-stone-700 hover:bg-stone-50">Profile</a>
                          <a href="/dashboard/settings" className="block px-3 py-2 text-[13px] text-stone-700 hover:bg-stone-50">Settings</a>
                          <div className="border-t border-stone-100 mt-1.5 pt-1.5">
                            <button onClick={() => logout()} className="block w-full text-left px-3 py-2 text-[13px] text-red-600 hover:bg-red-50">Sign out</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </header>
          )}

          {/* Main content area */}
          <main className={cn(
            "flex-1 bg-[#FAFAF8] scrollbar-thin",
            hideSidebar && hideHeader ? "overflow-hidden" : "overflow-y-auto"
          )}>
            <div className={cn(hideSidebar && hideHeader ? "p-0 h-full w-full" : "p-4 sm:p-5 lg:p-6")}>
              {children}
            </div>
          </main>
        </div>
      </div>

      <NotificationModal
        isOpen={notificationModalOpen}
        onClose={handleNotificationModalClose}
      />

      <NotificationListener />
    </div>
  );
}
