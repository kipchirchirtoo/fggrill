'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { branchOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import {
  Search, RefreshCw, Bell, CheckCircle2, Filter, Trash2,
  ArrowRightCircle, ArrowDownUp, Info, ShieldAlert, CheckCheck
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Notification interfaces
interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  isRead: boolean;
  source: string;
  isGlobal: boolean;
  action?: {
    label: string;
    url: string;
  };
}

function BranchNotificationsContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (activeBranchId) {
      fetchNotifications();
    }
  }, [activeBranchId]);

  useEffect(() => {
    applyFilters();
  }, [notifications, searchTerm, typeFilter, statusFilter]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      // Call the real API
      const response = await branchOperationsAPI.getNotifications(activeBranchId);

      if (response.success && Array.isArray(response.data)) {
        setNotifications(response.data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...notifications];
    if (searchTerm) {
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (typeFilter !== 'all') {
      filtered = filtered.filter(n => n.type === typeFilter);
    }
    if (statusFilter === 'read') {
      filtered = filtered.filter(n => n.isRead);
    } else if (statusFilter === 'unread') {
      filtered = filtered.filter(n => !n.isRead);
    }
    setFilteredNotifications(filtered);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warning': return <ShieldAlert className="h-5 w-5 text-yellow-500" />;
      case 'error': return <ShieldAlert className="h-5 w-5 text-red-500" />;
      case 'success': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
      <BranchAwareDashboardLayout
        title="Notifications"
        subtitle={`System notifications for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <div className="flex gap-2">
            <IOSButton variant="secondary" onClick={fetchNotifications} leftIcon={<RefreshCw />}>Refresh</IOSButton>
            <IOSButton variant="secondary" leftIcon={<CheckCheck />}>Mark All Read</IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          <IOSCard className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <Input placeholder="Search notifications..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
              </div>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
                <option value="all">All Types</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="success">Success</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
                <option value="all">All Status</option>
                <option value="read">Read</option>
                <option value="unread">Unread</option>
              </select>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredNotifications.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No notifications found</p>
            </IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <IOSCard key={notification.id} className={`p-4 ${!notification.isRead ? 'border-l-4 border-blue-500' : ''}`}>
                  <div className="flex items-start gap-3">
                    {getTypeIcon(notification.type)}
                    <div className="flex-1">
                      <h3 className="font-semibold">{notification.title}</h3>
                      <p className="text-sm text-gray-600">{notification.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400">{notification.timestamp}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{notification.source}</span>
                      </div>
                    </div>
                    {notification.action && (
                      <IOSButton variant="ghost" size="sm">{notification.action.label}</IOSButton>
                    )}
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function BranchNotificationsPage() {
  return (
    <BranchPageWrapper>
      <BranchNotificationsContent />
    </BranchPageWrapper>
  );
}
