'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { SearchModal } from '@/components/modals/SearchModal';
import { NotificationModal } from '@/components/modals/NotificationModal';
import { useAuth, UserRole } from '@/lib/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import { notificationsAPI } from '@/lib/api';
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
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    if (user) {
      fetchUnreadCount();
      // Poll for updates every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Update unread count when notification modal closes
  const handleNotificationModalClose = () => {
    setNotificationModalOpen(false);
    // Refresh unread count
    notificationsAPI.getUnreadCount().then(response => {
      if (response.success && response.data) {
        setUnreadCount(response.data.count);
      }
    }).catch(console.error);
  };

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuName) 
        ? prev.filter(m => m !== menuName) 
        : [...prev, menuName]
    );
  };

  // Define navigation items based on user role
  const getNavigationItems = () => {
    const baseItems = [
      { 
        name: 'Dashboard', 
        href: `/dashboard/${getRolePath(user?.role)}`, 
        icon: LayoutDashboard 
      }
    ];

    const roleSpecificItems: Record<string, any[]> = {
      [UserRole.SUPER_ADMIN]: [
        { 
          name: 'Front Desk', 
          icon: Calendar,
          submenu: [
            { name: 'Reservations', href: '/dashboard/admin/reservations', icon: Calendar },
            { name: 'Check In/Out', href: '/dashboard/admin/checkin', icon: ClipboardList },
            { name: 'Rooms', href: '/dashboard/admin/rooms', icon: Bed },
            { name: 'Guests', href: '/dashboard/admin/guests', icon: Users }
          ]
        },
        { 
          name: 'Operations', 
          icon: Home,
          submenu: [
            { name: 'Housekeeping', href: '/dashboard/admin/housekeeping', icon: Home },
            { name: 'Restaurant', href: '/dashboard/admin/restaurant', icon: UtensilsCrossed },
            { name: 'Maintenance', href: '/dashboard/admin/maintenance', icon: Wrench }
          ]
        },
        { 
          name: 'Storekeeping', 
          icon: Warehouse,
          submenu: [
            { name: 'Overview', href: '/dashboard/storekeeping', icon: LayoutDashboard },
            { name: 'Central Warehouse', href: '/dashboard/storekeeping/central', icon: Warehouse },
            { name: 'Branch Stock', href: '/dashboard/storekeeping/branch', icon: Package },
            { name: 'Inventory', href: '/dashboard/storekeeping/inventory', icon: ClipboardList },
            { name: 'Transfers', href: '/dashboard/storekeeping/transfers', icon: Truck },
            { name: 'Requests', href: '/dashboard/storekeeping/requests', icon: Send },
            { name: 'Stock Takes', href: '/dashboard/storekeeping/stock-takes', icon: ClipboardCheck },
            { name: 'Purchase Orders', href: '/dashboard/storekeeping/purchase-orders', icon: ShoppingCart },
            { name: 'GRN', href: '/dashboard/storekeeping/grn', icon: ClipboardCheck },
            { name: 'Wastage', href: '/dashboard/storekeeping/wastage', icon: AlertTriangle }
          ]
        },
        { 
          name: 'Logistics', 
          icon: Truck,
          submenu: [
            { name: 'Vehicles', href: '/dashboard/storekeeping/vehicles', icon: Car },
            { name: 'Drivers', href: '/dashboard/storekeeping/drivers', icon: User },
            { name: 'Suppliers', href: '/dashboard/storekeeping/suppliers', icon: Building2 }
          ]
        },
        { name: 'Finance', href: '/dashboard/finance', icon: DollarSign },
        { name: 'Reports', href: '/dashboard/admin/reports', icon: BarChart3 },
        { name: 'Users', href: '/dashboard/admin/users', icon: User },
        { name: 'Staff', href: '/dashboard/admin/staff', icon: Users },
        { name: 'Settings', href: '/dashboard/admin/settings', icon: Settings }
      ],
      [UserRole.GENERAL_MANAGER]: [
        { 
          name: 'Front Desk', 
          icon: Calendar,
          submenu: [
            { name: 'Reservations', href: '/dashboard/admin/reservations', icon: Calendar },
            { name: 'Check In/Out', href: '/dashboard/admin/checkin', icon: ClipboardList },
            { name: 'Rooms', href: '/dashboard/admin/rooms', icon: Bed },
            { name: 'Guests', href: '/dashboard/admin/guests', icon: Users }
          ]
        },
        { 
          name: 'Operations', 
          icon: Home,
          submenu: [
            { name: 'Housekeeping', href: '/dashboard/admin/housekeeping', icon: Home },
            { name: 'Restaurant', href: '/dashboard/admin/restaurant', icon: UtensilsCrossed },
            { name: 'Maintenance', href: '/dashboard/admin/maintenance', icon: Wrench }
          ]
        },
        { 
          name: 'Storekeeping', 
          icon: Warehouse,
          submenu: [
            { name: 'Overview', href: '/dashboard/storekeeping', icon: LayoutDashboard },
            { name: 'Central Warehouse', href: '/dashboard/storekeeping/central', icon: Warehouse },
            { name: 'Branch Stock', href: '/dashboard/storekeeping/branch', icon: Package },
            { name: 'Inventory', href: '/dashboard/storekeeping/inventory', icon: ClipboardList },
            { name: 'Transfers', href: '/dashboard/storekeeping/transfers', icon: Truck },
            { name: 'Requests', href: '/dashboard/storekeeping/requests', icon: Send },
            { name: 'Stock Takes', href: '/dashboard/storekeeping/stock-takes', icon: ClipboardCheck },
            { name: 'Purchase Orders', href: '/dashboard/storekeeping/purchase-orders', icon: ShoppingCart },
            { name: 'GRN', href: '/dashboard/storekeeping/grn', icon: ClipboardCheck },
            { name: 'Wastage', href: '/dashboard/storekeeping/wastage', icon: AlertTriangle }
          ]
        },
        { 
          name: 'Logistics', 
          icon: Truck,
          submenu: [
            { name: 'Vehicles', href: '/dashboard/storekeeping/vehicles', icon: Car },
            { name: 'Drivers', href: '/dashboard/storekeeping/drivers', icon: User },
            { name: 'Suppliers', href: '/dashboard/storekeeping/suppliers', icon: Building2 }
          ]
        },
        { name: 'Finance', href: '/dashboard/finance', icon: DollarSign },
        { name: 'Reports', href: '/dashboard/admin/reports', icon: BarChart3 },
        { name: 'Branches', href: '/dashboard/admin/system/branches', icon: Building2 },
        { name: 'Users', href: '/dashboard/admin/users', icon: User },
        { name: 'Staff', href: '/dashboard/admin/staff', icon: Users }
      ],
      [UserRole.BRANCH_MANAGER]: [
        { 
          name: 'Front Desk', 
          icon: Calendar,
          submenu: [
            { name: 'Reservations', href: '/dashboard/branch-manager/reservations', icon: Calendar },
            { name: 'Check In/Out', href: '/dashboard/branch-manager/checkin', icon: ClipboardList },
            { name: 'Rooms', href: '/dashboard/branch-manager/rooms', icon: Bed },
            { name: 'Guests', href: '/dashboard/branch-manager/guests', icon: Users }
          ]
        },
        { 
          name: 'Operations', 
          icon: Home,
          submenu: [
            { name: 'Housekeeping', href: '/dashboard/branch-manager/housekeeping', icon: Home },
            { name: 'Restaurant', href: '/dashboard/branch-manager/restaurant', icon: UtensilsCrossed },
            { name: 'Maintenance', href: '/dashboard/branch-manager/maintenance', icon: Wrench }
          ]
        },
        { 
          name: 'Branch Stock', 
          icon: Package,
          submenu: [
            { name: 'Current Stock', href: '/dashboard/branch-manager/stock', icon: Package },
            { name: 'Stock Requests', href: '/dashboard/branch-manager/requests', icon: Send },
            { name: 'Incoming', href: '/dashboard/branch-manager/incoming', icon: Truck },
            { name: 'Stock Out', href: '/dashboard/branch-manager/stock-out', icon: ArrowRightLeft }
          ]
        },
        { name: 'Reports', href: '/dashboard/branch-manager/reports', icon: BarChart3 },
        { name: 'Staff', href: '/dashboard/branch-manager/staff', icon: Users }
      ],
      [UserRole.RECEPTIONIST]: [
        { name: 'Reservations', href: '/dashboard/reception/reservations', icon: Calendar },
        { name: 'Check In/Out', href: '/dashboard/reception/checkin', icon: ClipboardList },
        { name: 'Rooms', href: '/dashboard/reception/rooms', icon: Bed },
        { name: 'Guests', href: '/dashboard/reception/guests', icon: Users }
      ],
      [UserRole.HOUSEKEEPING]: [
        { name: 'Tasks', href: '/dashboard/housekeeping/tasks', icon: ClipboardList },
        { name: 'Rooms', href: '/dashboard/housekeeping/rooms', icon: Bed },
        { name: 'Inventory', href: '/dashboard/housekeeping/inventory', icon: Package }
      ],
      [UserRole.RESTAURANT]: [
        { name: 'POS', href: '/dashboard/restaurant/pos', icon: DollarSign },
        { name: 'Orders', href: '/dashboard/restaurant/orders', icon: ClipboardList },
        { name: 'Kitchen', href: '/dashboard/restaurant/kitchen', icon: ChefHat },
        { name: 'Menu', href: '/dashboard/restaurant/menu', icon: UtensilsCrossed },
        { name: 'Inventory', href: '/dashboard/restaurant/inventory', icon: Package }
      ],
      [UserRole.BARTENDER]: [
        { name: 'Bar POS', href: '/dashboard/bar/pos', icon: DollarSign },
        { name: 'Orders', href: '/dashboard/bar/orders', icon: ClipboardList },
        { name: 'Tabs', href: '/dashboard/bar/tabs', icon: Users },
        { name: 'Drinks Menu', href: '/dashboard/bar/menu', icon: UtensilsCrossed },
        { name: 'Inventory', href: '/dashboard/bar/inventory', icon: Package }
      ],
      [UserRole.ACCOUNTANT]: [
        { name: 'Invoices', href: '/dashboard/finance/invoices', icon: DollarSign },
        { name: 'Payments', href: '/dashboard/finance/payments', icon: DollarSign },
        { name: 'Reports', href: '/dashboard/finance/reports', icon: BarChart3 },
        { name: 'Expenses', href: '/dashboard/finance/expenses', icon: ClipboardList }
      ],
      [UserRole.MAINTENANCE]: [
        { name: 'Work Orders', href: '/dashboard/maintenance/orders', icon: Wrench },
        { name: 'Assets', href: '/dashboard/maintenance/assets', icon: Package },
        { name: 'Schedule', href: '/dashboard/maintenance/schedule', icon: Calendar }
      ],
      [UserRole.CENTRAL_STOREKEEPER]: [
        { 
          name: 'Warehouse', 
          icon: Warehouse,
          submenu: [
            { name: 'Inventory', href: '/dashboard/central-store/inventory', icon: Package },
            { name: 'Stock Levels', href: '/dashboard/central-store/stock', icon: ClipboardList },
            { name: 'Stock Takes', href: '/dashboard/central-store/stock-takes', icon: ClipboardCheck }
          ]
        },
        { 
          name: 'Requests', 
          icon: Send,
          submenu: [
            { name: 'Pending Requests', href: '/dashboard/central-store/requests', icon: Clock },
            { name: 'Approved', href: '/dashboard/central-store/requests/approved', icon: CheckCircle },
            { name: 'All Requests', href: '/dashboard/central-store/requests/all', icon: ClipboardList }
          ]
        },
        { 
          name: 'Dispatches', 
          icon: Truck,
          submenu: [
            { name: 'Create Dispatch', href: '/dashboard/central-store/dispatch/new', icon: Send },
            { name: 'Pending', href: '/dashboard/central-store/dispatch/pending', icon: Clock },
            { name: 'In Transit', href: '/dashboard/central-store/dispatch/transit', icon: Truck },
            { name: 'Delivered', href: '/dashboard/central-store/dispatch/delivered', icon: CheckCircle },
            { name: 'All Dispatches', href: '/dashboard/central-store/dispatch', icon: ClipboardList }
          ]
        },
        { 
          name: 'Logistics', 
          icon: Car,
          submenu: [
            { name: 'Vehicles', href: '/dashboard/central-store/vehicles', icon: Car },
            { name: 'Drivers', href: '/dashboard/central-store/drivers', icon: User },
            { name: 'Suppliers', href: '/dashboard/central-store/suppliers', icon: Building2 }
          ]
        },
        { name: 'Reports', href: '/dashboard/central-store/reports', icon: BarChart3 }
      ],
      [UserRole.BRANCH_STOREKEEPER]: [
        { 
          name: 'My Branch Stock', 
          icon: Package,
          submenu: [
            { name: 'Current Stock', href: '/dashboard/branch-store/stock', icon: Package },
            { name: 'Stock Out', href: '/dashboard/branch-store/stock-out', icon: ArrowRightLeft },
            { name: 'Stock Takes', href: '/dashboard/branch-store/stock-takes', icon: ClipboardCheck }
          ]
        },
        { 
          name: 'Stock Requests', 
          icon: Send,
          submenu: [
            { name: 'New Request', href: '/dashboard/branch-store/request/new', icon: Send },
            { name: 'My Requests', href: '/dashboard/branch-store/requests', icon: ClipboardList },
            { name: 'Pending', href: '/dashboard/branch-store/requests/pending', icon: Clock }
          ]
        },
        { 
          name: 'Incoming', 
          icon: Truck,
          submenu: [
            { name: 'Expected Deliveries', href: '/dashboard/branch-store/incoming', icon: Truck },
            { name: 'Receive Stock', href: '/dashboard/branch-store/receive', icon: CheckCircle }
          ]
        },
        { name: 'Reports', href: '/dashboard/branch-store/reports', icon: BarChart3 }
      ]
    };

    return [...baseItems, ...(roleSpecificItems[user?.role || ''] || [])];
  };

  const getRolePath = (role?: UserRole) => {
    const paths: Record<UserRole, string> = {
      [UserRole.SUPER_ADMIN]: 'admin',
      [UserRole.GENERAL_MANAGER]: 'gm',
      [UserRole.BRANCH_MANAGER]: 'branch-manager',
      [UserRole.RECEPTIONIST]: 'reception',
      [UserRole.HOUSEKEEPING]: 'housekeeping',
      [UserRole.HOUSEKEEPING_SUPERVISOR]: 'housekeeping',
      [UserRole.RESTAURANT]: 'restaurant',
      [UserRole.BARTENDER]: 'bar',
      [UserRole.ACCOUNTANT]: 'finance',
      [UserRole.MAINTENANCE]: 'maintenance',
      [UserRole.CENTRAL_STOREKEEPER]: 'central-store',
      [UserRole.BRANCH_STOREKEEPER]: 'branch-store',
      [UserRole.AUDITOR]: 'audit',
      [UserRole.EMPLOYEE]: 'employee',
      [UserRole.GUEST]: 'guest'
    };
    return paths[role || UserRole.GUEST];
  };

  const navigationItems = getNavigationItems();

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
                            alt="Kyogong"
                            width={32}
                            height={32}
                            className="object-cover scale-150"
                            style={{ objectPosition: 'center 30%', width: 'auto', height: 'auto' }}
                          />
                        </div>
                        <div>
                          <h1 className="text-base font-bold text-[#000000]">Kyogong</h1>
                          <p className="text-xs text-[#8E8E93]">Management</p>
                        </div>
                      </div>
                    </div>

                    {/* Navigation */}
                    <nav className="mt-8 flex-1 space-y-1 px-2 overflow-y-auto">
                      {navigationItems.map((item: any) => {
                        // Check if item has submenu
                        if (item.submenu) {
                          const isExpanded = expandedMenus.includes(item.name);
                          const isSubmenuActive = item.submenu.some((sub: any) => pathname === sub.href || pathname?.startsWith(sub.href + '/'));
                          return (
                            <div key={item.name}>
                              <button
                                onClick={() => toggleMenu(item.name)}
                                className={`w-full group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                                  isSubmenuActive
                                    ? 'bg-[#F2F2F7] text-[#000000]'
                                    : 'text-[#3C3C43] hover:bg-[#F2F2F7]'
                                }`}
                              >
                                <span className="flex items-center">
                                  <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                                  {item.name}
                                </span>
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                              {isExpanded && (
                                <div className="mt-1 ml-4 space-y-1 border-l border-[rgba(60,60,67,0.12)] pl-2">
                                  {item.submenu.map((sub: any) => {
                                    const isSubActive = pathname === sub.href || pathname?.startsWith(sub.href + '/');
                                    return (
                                      <a
                                        key={sub.name}
                                        href={sub.href}
                                        className={`group flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                                          isSubActive
                                            ? 'bg-[#3C3C43] text-white'
                                            : 'text-[#8E8E93] hover:bg-[#F2F2F7] hover:text-[#000000]'
                                        }`}
                                      >
                                        <sub.icon className="mr-2 h-4 w-4 flex-shrink-0" />
                                        {sub.name}
                                      </a>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }
                        
                        // Regular menu item
                        const isActive = pathname === item.href;
                        return (
                          <a
                            key={item.name}
                            href={item.href}
                            className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                              isActive
                                ? 'bg-[#3C3C43] text-white'
                                : 'text-[#3C3C43] hover:bg-[#F2F2F7]'
                            }`}
                          >
                            <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                            {item.name}
                          </a>
                        );
                      })}
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
                      <div className="w-8 h-8 rounded-lg bg-[#3C3C43] flex items-center justify-center overflow-hidden">
                        <Image
                          src="/fglogo.png"
                          alt="Kyogong"
                          width={24}
                          height={24}
                          className="object-cover scale-150"
                          style={{ objectPosition: 'center 30%', width: 'auto', height: 'auto' }}
                        />
                      </div>
                      <h1 className="text-base font-bold text-[#000000]">Kyogong</h1>
                    </div>
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-[#3C3C43]"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <nav className="mt-5 flex-1 space-y-1 px-2 overflow-y-auto">
                    {navigationItems.map((item: any) => {
                      // Check if item has submenu
                      if (item.submenu) {
                        const isExpanded = expandedMenus.includes(item.name);
                        const isSubmenuActive = item.submenu.some((sub: any) => pathname === sub.href || pathname?.startsWith(sub.href + '/'));
                        return (
                          <div key={item.name}>
                            <button
                              onClick={() => toggleMenu(item.name)}
                              className={`w-full group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                                isSubmenuActive
                                  ? 'bg-[#F2F2F7] text-[#000000]'
                                  : 'text-[#3C3C43] hover:bg-[#F2F2F7]'
                              }`}
                            >
                              <span className="flex items-center">
                                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                                {item.name}
                              </span>
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            {isExpanded && (
                              <div className="mt-1 ml-4 space-y-1 border-l border-[rgba(60,60,67,0.12)] pl-2">
                                {item.submenu.map((sub: any) => {
                                  const isSubActive = pathname === sub.href || pathname?.startsWith(sub.href + '/');
                                  return (
                                    <a
                                      key={sub.name}
                                      href={sub.href}
                                      onClick={() => setMobileMenuOpen(false)}
                                      className={`group flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                                        isSubActive
                                          ? 'bg-[#3C3C43] text-white'
                                          : 'text-[#8E8E93] hover:bg-[#F2F2F7] hover:text-[#000000]'
                                      }`}
                                    >
                                      <sub.icon className="mr-2 h-4 w-4 flex-shrink-0" />
                                      {sub.name}
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }
                      
                      const isActive = pathname === item.href;
                      return (
                        <a
                          key={item.name}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                            isActive
                              ? 'bg-[#3C3C43] text-white'
                              : 'text-[#3C3C43] hover:bg-[#F2F2F7]'
                          }`}
                        >
                          <item.icon className="mr-3 h-5 w-5" />
                          {item.name}
                        </a>
                      );
                    })}
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
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-[#3C3C43] text-white text-xs rounded-full flex items-center justify-center font-semibold">
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
