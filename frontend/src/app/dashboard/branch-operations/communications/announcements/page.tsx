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
  Search, RefreshCw, Megaphone, Pin, CheckCircle2, Filter,
  PlusCircle, Eye, Calendar, CalendarDays
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// Announcement interfaces
interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  created_at: string;
  expires_at: string | null;
  is_pinned: boolean;
  is_global: boolean;
  target_departments?: string[];
  importance: 'high' | 'medium' | 'low';
}

function BranchAnnouncementsContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [importanceFilter, setImportanceFilter] = useState('all');
  const [showAnnouncementDetails, setShowAnnouncementDetails] = useState(false);

  // New announcement state
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImportance, setNewImportance] = useState<'high' | 'medium' | 'low'>('medium');
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [newIsGlobal, setNewIsGlobal] = useState(false);
  const [newExpiryDate, setNewExpiryDate] = useState('');

  useEffect(() => {
    if (activeBranchId) {
      fetchAnnouncements();
    }
  }, [activeBranchId]);

  useEffect(() => {
    applyFilters();
  }, [announcements, searchTerm, importanceFilter]);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      // Try to get data from API
      const response = await branchOperationsAPI.getAnnouncements(activeBranchId);

      if (response.success && Array.isArray(response.data)) {
        setAnnouncements(response.data);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast.error('Failed to load announcements');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...announcements];
    if (searchTerm) {
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (importanceFilter !== 'all') {
      filtered = filtered.filter(a => a.importance === importanceFilter);
    }
    setFilteredAnnouncements(filtered);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
      <BranchAwareDashboardLayout
        title="Announcements"
        subtitle={`Branch announcements for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <div className="flex gap-2">
            <IOSButton variant="secondary" onClick={fetchAnnouncements} leftIcon={<RefreshCw />}>Refresh</IOSButton>
            <IOSButton variant="primary" onClick={() => setShowNewAnnouncement(true)} leftIcon={<PlusCircle />}>New</IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          <IOSCard className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <Input placeholder="Search announcements..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
              </div>
              <select value={importanceFilter} onChange={(e) => setImportanceFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
                <option value="all">All Importance</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredAnnouncements.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Megaphone className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No announcements found</p>
            </IOSCard>
          ) : (
            <div className="space-y-4">
              {filteredAnnouncements.map((announcement) => (
                <IOSCard key={announcement.id} className="p-4 cursor-pointer hover:shadow-md" onClick={() => { setSelectedAnnouncement(announcement); setShowAnnouncementDetails(true); }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {announcement.is_pinned && <Pin className="h-4 w-4 text-blue-500" />}
                        <h3 className="font-semibold">{announcement.title}</h3>
                        <IOSBadge color={announcement.importance === 'high' ? 'danger' : announcement.importance === 'medium' ? 'warning' : 'secondary'}>{announcement.importance}</IOSBadge>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{announcement.content}</p>
                      <p className="text-xs text-gray-400 mt-2">By {announcement.author} • {announcement.created_at}</p>
                    </div>
                    <Eye className="h-5 w-5 text-gray-400" />
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

export default function BranchAnnouncementsPage() {
  return (
    <BranchPageWrapper>
      <BranchAnnouncementsContent />
    </BranchPageWrapper>
  );
}
