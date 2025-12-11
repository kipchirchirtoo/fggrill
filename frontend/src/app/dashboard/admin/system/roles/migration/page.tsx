'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { auditAPI } from '@/lib/api';
import {
  Users, RefreshCw, Check, AlertTriangle, ArrowRight,
  CheckCircle, XCircle, Filter, Search, Download, Save
} from 'lucide-react';

interface RoleMigration {
  id: number;
  old_role: string;
  new_role: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  affected_users: number;
  is_reversible: boolean;
  created_at: string;
  completed_at?: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  branch_id?: number;
  branch_name?: string;
}

export default function RoleMigrationPage() {
  const { user } = useAuth();
  const [migrations, setMigrations] = useState<RoleMigration[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMigration, setSelectedMigration] = useState<RoleMigration | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [affectedUsers, setAffectedUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchMigrations();
  }, []);

  const fetchMigrations = async () => {
    setIsLoading(true);
    try {
      const response = await auditAPI.getRoleMigrations();
      if (response.success) {
        setMigrations(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching migrations:', error);
      toast.error('Failed to load role migrations');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Filtered migrations based on search and status filter
  const filteredMigrations = migrations.filter(migration => {
    const matchesSearch = searchTerm === '' || 
      migration.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      migration.old_role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      migration.new_role.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === 'all' || migration.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  const fetchMigrationDetails = (migration: RoleMigration) => {
    setSelectedMigration(migration);
    setAffectedUsers([]);
    setIsDetailsModalOpen(true);
  };
  
  const handleExecuteMigration = async (migration: RoleMigration) => {
    setIsLoading(true);
    try {
      const response = await auditAPI.executeRoleMigration(migration.id);
      if (response.success) {
        toast.success(`Migration ${migration.id} started successfully`);
        fetchMigrations();
      } else {
        toast.error('Failed to execute migration');
      }
    } catch (error) {
      console.error('Error executing migration:', error);
      toast.error('Failed to execute migration');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRevertMigration = async (migration: RoleMigration) => {
    if (!migration.is_reversible) {
      toast.error('This migration cannot be reverted');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await auditAPI.revertRoleMigration(migration.id);
      if (response.success) {
        toast.success(`Migration ${migration.id} reverted successfully`);
        fetchMigrations();
      } else {
        toast.error('Failed to revert migration');
      }
    } catch (error) {
      console.error('Error reverting migration:', error);
      toast.error('Failed to revert migration');
    } finally {
      setIsLoading(false);
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <IOSBadge className="bg-yellow-100 text-yellow-700">Pending</IOSBadge>;
      case 'in_progress':
        return <IOSBadge className="bg-blue-100 text-blue-700">In Progress</IOSBadge>;
      case 'completed':
        return <IOSBadge className="bg-green-100 text-green-700">Completed</IOSBadge>;
      default:
        return <IOSBadge className="bg-gray-100 text-gray-700">{status}</IOSBadge>;
    }
  };
  
  const formatRole = (role: string) => {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-6 w-6" /> Role Migration Management
              </h1>
              <p className="text-gray-500">Manage role consolidation across the system</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchMigrations} leftIcon={<RefreshCw />}>
                Refresh
              </IOSButton>
              <IOSButton leftIcon={<Download />}>
                Export Log
              </IOSButton>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <Users className="h-5 w-5 text-blue-600 mb-2" />
              <p className="text-sm text-gray-500">Total Migrations</p>
              <p className="text-lg font-bold">{migrations.length}</p>
            </IOSCard>
            
            <IOSCard className="p-4">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mb-2" />
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-lg font-bold text-yellow-600">
                {migrations.filter(m => m.status === 'pending').length}
              </p>
            </IOSCard>
            
            <IOSCard className="p-4">
              <ArrowRight className="h-5 w-5 text-blue-600 mb-2" />
              <p className="text-sm text-gray-500">In Progress</p>
              <p className="text-lg font-bold text-blue-600">
                {migrations.filter(m => m.status === 'in_progress').length}
              </p>
            </IOSCard>
            
            <IOSCard className="p-4">
              <CheckCircle className="h-5 w-5 text-green-600 mb-2" />
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-lg font-bold text-green-600">
                {migrations.filter(m => m.status === 'completed').length}
              </p>
            </IOSCard>
          </div>

          {/* Search and Filter */}
          <IOSCard className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by description or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              
              <div>
                <IOSButton 
                  onClick={() => {}}
                  leftIcon={<Filter />}
                  className="w-full"
                >
                  Filter
                </IOSButton>
              </div>
            </div>
          </IOSCard>

          {/* Migrations Table */}
          <IOSCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To Role</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Users</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredMigrations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center">
                          <Users className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-gray-500">No migrations found matching your criteria</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMigrations.map((migration) => (
                      <tr key={migration.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-mono text-sm">
                          {migration.id}
                        </td>
                        <td className="px-4 py-4">
                          {migration.description}
                        </td>
                        <td className="px-4 py-4">
                          {formatRole(migration.old_role)}
                        </td>
                        <td className="px-4 py-4">
                          {formatRole(migration.new_role)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(migration.status)}
                        </td>
                        <td className="px-4 py-4 text-center font-medium">
                          {migration.affected_users}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {formatDate(migration.created_at)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {formatDate(migration.completed_at)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-center space-x-2">
                            <IOSButton
                              size="sm"
                              variant="secondary"
                              onClick={() => fetchMigrationDetails(migration)}
                            >
                              Details
                            </IOSButton>
                            {migration.status === 'pending' && (
                              <IOSButton
                                size="sm"
                                onClick={() => handleExecuteMigration(migration)}
                                disabled={isLoading}
                              >
                                Execute
                              </IOSButton>
                            )}
                            {migration.status === 'completed' && migration.is_reversible && (
                              <IOSButton
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleRevertMigration(migration)}
                                disabled={isLoading}
                              >
                                Revert
                              </IOSButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </IOSCard>
        </div>
        
        {/* Migration Details Modal */}
        <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Migration Details</DialogTitle>
            </DialogHeader>
            
            {selectedMigration && (
              <div className="space-y-6 mt-4">
                {/* Migration Header */}
                <div className="flex flex-col md:flex-row justify-between gap-4 pb-4 border-b">
                  <div>
                    <h3 className="text-lg font-bold">Migration #{selectedMigration.id}</h3>
                    <p className="text-sm text-gray-500">{selectedMigration.description}</p>
                    <p className="text-sm mt-1">
                      <span className="font-medium">{formatRole(selectedMigration.old_role)}</span>
                      <ArrowRight className="inline h-4 w-4 mx-2" />
                      <span className="font-medium">{formatRole(selectedMigration.new_role)}</span>
                    </p>
                  </div>
                  <div className="flex gap-2 items-start">
                    {getStatusBadge(selectedMigration.status)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">Created</p>
                    <p>{formatDate(selectedMigration.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Completed</p>
                    <p>{formatDate(selectedMigration.completed_at)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Affected Users</p>
                    <p>{selectedMigration.affected_users}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Reversible</p>
                    <p>{selectedMigration.is_reversible ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                
                {/* Affected Users Table */}
                <div>
                  <h3 className="font-medium mb-3">Affected Users</h3>
                  
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50 text-xs">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Email</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Current Role</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Branch</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm">
                        {affectedUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">
                              {user.firstName} {user.lastName}
                            </td>
                            <td className="px-3 py-2">
                              {user.email}
                            </td>
                            <td className="px-3 py-2">
                              {formatRole(user.role)}
                            </td>
                            <td className="px-3 py-2">
                              {user.branch_name}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {selectedMigration.status === 'completed' ? (
                                <Check className="h-4 w-4 text-green-600 inline" />
                              ) : selectedMigration.status === 'in_progress' ? (
                                <RefreshCw className="h-4 w-4 text-blue-600 inline animate-spin" />
                              ) : (
                                <span className="text-yellow-600 text-xs">Pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <IOSButton
                    variant="secondary"
                    onClick={() => setIsDetailsModalOpen(false)}
                  >
                    Close
                  </IOSButton>
                  {selectedMigration.status === 'pending' && (
                    <IOSButton
                      onClick={() => {
                        setIsDetailsModalOpen(false);
                        handleExecuteMigration(selectedMigration);
                      }}
                      leftIcon={<ArrowRight />}
                    >
                      Execute Migration
                    </IOSButton>
                  )}
                  {selectedMigration.status === 'completed' && selectedMigration.is_reversible && (
                    <IOSButton
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setIsDetailsModalOpen(false);
                        handleRevertMigration(selectedMigration);
                      }}
                    >
                      Revert Migration
                    </IOSButton>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
