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
import {
  Bell, MessageSquare, Megaphone, Mail,
  ArrowRightCircle, Users, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

// Communication item interface
interface CommunicationItem {
  id: string;
  type: 'announcement' | 'message' | 'notification';
  title: string;
  content: string;
  date: string;
  sender: string;
  priority?: 'low' | 'medium' | 'high';
  isRead: boolean;
  recipient?: string;
  recipients?: string[];
}

export default function BranchCommunicationsPage() {
  return (
    <ProtectedRoute allowedRoles={[
      UserRole.BRANCH_OPERATIONS_MANAGER,
      UserRole.BRANCH_MANAGER,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.AUDITOR
    ]}>
      <BranchAwareDashboardLayout>
        <BranchCommunicationsContent />
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

function BranchCommunicationsContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [communications, setCommunications] = useState<CommunicationItem[]>([]);
  const [announcements, setAnnouncements] = useState<CommunicationItem[]>([]);
  const [messages, setMessages] = useState<CommunicationItem[]>([]);
  const [notifications, setNotifications] = useState<CommunicationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    unreadNotifications: 0,
    unreadMessages: 0,
    totalAnnouncements: 0
  });

  useEffect(() => {
    if (activeBranchId) {
      fetchCommunications();
    }
  }, [activeBranchId]);

  const fetchCommunications = async () => {
    setIsLoading(true);
    try {
      // Try to fetch real data from API
      const response = await branchOperationsAPI.getCommunications(activeBranchId);

      if (response.success) {
        const commsData = response.data || [];
        processCommunicationsData(commsData);
      } else {
        // Show empty state
        processCommunicationsData([]);
      }
    } catch (error) {
      console.error('Error fetching communications:', error);
      toast.error('Failed to load communications');
      // Show empty state on error
      processCommunicationsData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const processCommunicationsData = (data: CommunicationItem[]) => {
    setCommunications(data);

    const announcements = data.filter(item => item.type === 'announcement');
    const messages = data.filter(item => item.type === 'message');
    const notifications = data.filter(item => item.type === 'notification');

    setAnnouncements(announcements);
    setMessages(messages);
    setNotifications(notifications);

    setStats({
      unreadNotifications: notifications.filter(n => !n.isRead).length,
      unreadMessages: messages.filter(m => !m.isRead).length,
      totalAnnouncements: announcements.length
    });
  };

  const generatePlaceholderCommunications = (): CommunicationItem[] => {
    return [
      {
        id: '1',
        type: 'announcement',
        title: 'New Menu Items Available',
        content: 'We have added new items to our restaurant menu. Please review and familiarize yourself with the new offerings.',
        date: new Date().toISOString(),
        sender: 'Management',
        priority: 'medium',
        isRead: false
      },
      {
        id: '2',
        type: 'message',
        title: 'Staff Meeting Tomorrow',
        content: 'Reminder: All staff meeting scheduled for tomorrow at 10 AM in the conference room.',
        date: new Date(Date.now() - 86400000).toISOString(),
        sender: 'HR Department',
        priority: 'high',
        isRead: false
      },
      {
        id: '3',
        type: 'notification',
        title: 'Inventory Alert',
        content: 'Low stock alert for several items. Please check inventory management system.',
        date: new Date(Date.now() - 172800000).toISOString(),
        sender: 'System',
        priority: 'high',
        isRead: true
      }
    ];
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <BranchPageWrapper
      title="Communications"
      subtitle="Branch announcements, messages, and notifications"
      actions={
        <IOSButton variant="secondary" size="sm" onClick={fetchCommunications}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </IOSButton>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <IOSCard className="p-4 bg-blue-50 border-blue-100">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm text-blue-600 font-medium mb-1">Unread Notifications</div>
              <div className="text-2xl font-bold text-blue-700">{stats.unreadNotifications}</div>
            </div>
            <div className="p-2 bg-blue-100 rounded-full">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </IOSCard>

        <IOSCard className="p-4 bg-purple-50 border-purple-100">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm text-purple-600 font-medium mb-1">Unread Messages</div>
              <div className="text-2xl font-bold text-purple-700">{stats.unreadMessages}</div>
            </div>
            <div className="p-2 bg-purple-100 rounded-full">
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </IOSCard>

        <IOSCard className="p-4 bg-orange-50 border-orange-100">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm text-orange-600 font-medium mb-1">Announcements</div>
              <div className="text-2xl font-bold text-orange-700">{stats.totalAnnouncements}</div>
            </div>
            <div className="p-2 bg-orange-100 rounded-full">
              <Megaphone className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </IOSCard>
      </div>

      {/* Communications List */}
      <IOSCard className="p-4">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Recent Communications</h3>

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : communications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No communications found</div>
          ) : (
            <div className="space-y-3">
              {communications.map(item => (
                <div
                  key={item.id}
                  className={`p-4 border rounded-lg transition-colors ${item.isRead ? 'bg-white' : 'bg-blue-50 border-blue-200'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-gray-100 rounded-full">
                        {item.type === 'announcement' && <Megaphone className="w-4 h-4 text-gray-600" />}
                        {item.type === 'message' && <MessageSquare className="w-4 h-4 text-gray-600" />}
                        {item.type === 'notification' && <Bell className="w-4 h-4 text-gray-600" />}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">{item.title}</h4>
                          {item.priority && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(item.priority)}`}>
                              {item.priority.toUpperCase()}
                            </span>
                          )}
                          {!item.isRead && (
                            <IOSBadge variant="filled" size="sm" className="bg-blue-500 text-white">
                              New
                            </IOSBadge>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 mb-2">{item.content}</p>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {item.sender}
                          </span>
                          <span>{format(new Date(item.date), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                      </div>
                    </div>

                    <IOSButton variant="ghost" size="sm">
                      <ArrowRightCircle className="w-4 h-4" />
                    </IOSButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </IOSCard>
    </BranchPageWrapper>
  );
}
