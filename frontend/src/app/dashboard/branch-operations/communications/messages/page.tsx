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
  Search, RefreshCw, MessageSquare, ArrowRightCircle,
  Users, Filter, Send, User, ArrowUpDown, PenSquare
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// Message interfaces
interface StaffMember {
  id: string;
  name: string;
  position: string;
  department: string;
  avatar?: string;
}

interface Message {
  id: string;
  subject: string;
  content: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  recipient: {
    id: string;
    name: string;
    avatar?: string;
  };
  timestamp: string;
  isRead: boolean;
  priority?: 'high' | 'medium' | 'low';
}

function BranchMessagesContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [staffFilter, setStaffFilter] = useState('all');
  const [showMessageDetails, setShowMessageDetails] = useState(false);
  
  // New message state
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newMessageRecipient, setNewMessageRecipient] = useState('');
  const [newMessageSubject, setNewMessageSubject] = useState('');
  const [newMessageContent, setNewMessageContent] = useState('');
  const [newMessagePriority, setNewMessagePriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (activeBranchId) {
      fetchMessages();
      fetchStaff();
    }
  }, [activeBranchId]);

  useEffect(() => {
    applyFilters();
  }, [messages, searchTerm, staffFilter]);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      // Call the real API
      const response = await branchOperationsAPI.getMessages(activeBranchId);
      
      if (response.success && Array.isArray(response.data)) {
        setMessages(response.data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await branchOperationsAPI.getStaff(activeBranchId);
      if (response.success && Array.isArray(response.data)) {
        setStaffList(response.data);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...messages];
    if (searchTerm) {
      filtered = filtered.filter(m => 
        m.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.sender.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (staffFilter !== 'all') {
      filtered = filtered.filter(m => m.sender.id === staffFilter || m.recipient.id === staffFilter);
    }
    setFilteredMessages(filtered);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <BranchAwareDashboardLayout
        title="Messages"
        subtitle={`Staff messages for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <div className="flex gap-2">
            <IOSButton variant="secondary" onClick={fetchMessages} leftIcon={<RefreshCw />}>Refresh</IOSButton>
            <IOSButton variant="primary" onClick={() => setShowNewMessage(true)} leftIcon={<PenSquare />}>Compose</IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          <IOSCard className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <Input placeholder="Search messages..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
              </div>
              <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
                <option value="all">All Staff</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredMessages.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No messages found</p>
            </IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredMessages.map((message) => (
                <IOSCard key={message.id} className={`p-4 cursor-pointer hover:shadow-md ${!message.isRead ? 'border-l-4 border-blue-500' : ''}`} onClick={() => { setSelectedMessage(message); setShowMessageDetails(true); }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{message.sender.name}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-gray-600">{message.recipient.name}</span>
                      </div>
                      <h3 className="font-semibold">{message.subject}</h3>
                      <p className="text-sm text-gray-600 line-clamp-1">{message.content}</p>
                      <p className="text-xs text-gray-400 mt-1">{message.timestamp}</p>
                    </div>
                    <ArrowRightCircle className="h-5 w-5 text-gray-400" />
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

export default function BranchMessagesPage() {
  return (
    <BranchPageWrapper>
      <BranchMessagesContent />
    </BranchPageWrapper>
  );
}
