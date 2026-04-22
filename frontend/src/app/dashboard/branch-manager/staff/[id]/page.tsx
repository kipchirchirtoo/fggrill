'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { staffAPI } from '@/lib/api/staff';
import {
  ArrowLeft, User, Mail, Phone, MapPin, Calendar, Briefcase,
  Clock, Award, TrendingUp, CheckCircle, XCircle, AlertCircle,
  FileText, Image as ImageIcon, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  branch_id: number;
  branch_name?: string;
  status: string;
  hire_date?: string;
  photo_url?: string;
  profile_photo?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  created_at: string;
}

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const staffId = params.id as string;

  useEffect(() => {
    fetchStaffDetails();
  }, [staffId]);

  const fetchStaffDetails = async () => {
    if (!staffId) return;

    setIsLoading(true);
    try {
      const response = await staffAPI.getStaffMember(staffId);
      if (response.success && response.data) {
        setStaff(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching staff details:', error);
      toast.error(error.message || 'Failed to load staff details');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700';
      case 'inactive':
        return 'bg-stone-100 text-stone-700';
      case 'on_leave':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
        <DashboardLayout>
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-2 opacity-50">
              <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
              <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">Loading staff details...</span>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (!staff) {
    return (
      <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
        <DashboardLayout>
          <div className="text-center py-20 px-6">
            <div className="h-16 w-16 rounded-full bg-stone-50 flex items-center justify-center mb-4 mx-auto">
              <User className="h-8 w-8 text-stone-300" />
            </div>
            <h3 className="text-lg font-bold text-stone-900">Staff Member Not Found</h3>
            <p className="text-sm text-stone-500 mt-1">The staff member you're looking for doesn't exist.</p>
            <Link href="/dashboard/branch-manager/staff/performance">
              <button className="btn-primary mt-4">
                <ArrowLeft className="h-4 w-4" />
                Back to Performance
              </button>
            </Link>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/branch-manager/staff/performance" className="text-stone-400 hover:text-stone-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-[12px] font-bold text-stone-400 uppercase tracking-widest">
              Branch Manager / Staff / Details
            </span>
          </div>

          {/* Staff Profile Card */}
          <div className="card-elevated p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Photo */}
              <div className="flex-shrink-0">
                <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center overflow-hidden">
                  {(staff.photo_url || staff.profile_photo) ? (
                    <img 
                      src={
                        staff.photo_url?.startsWith('http') 
                          ? staff.photo_url 
                          : `${SUPABASE_URL}/storage/v1/object/public/profile/${staff.profile_photo || staff.photo_url}`
                      } 
                      alt={`${staff.first_name} ${staff.last_name}`} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<svg class="h-16 w-16 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>';
                        }
                      }}
                    />
                  ) : (
                    <User className="h-16 w-16 text-stone-400" />
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">
                      {staff.first_name} {staff.last_name}
                    </h1>
                    <p className="text-stone-500 mt-0.5">{staff.role} • {staff.department || 'No Department'}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-3 py-1 rounded-full ${getStatusColor(staff.status)}`}>
                    {staff.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-stone-400" />
                    <span className="text-stone-600">{staff.email}</span>
                  </div>
                  {staff.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-stone-400" />
                      <span className="text-stone-600">{staff.phone}</span>
                    </div>
                  )}
                  {staff.address && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-stone-400" />
                      <span className="text-stone-600">{staff.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-stone-400" />
                    <span className="text-stone-600">Hired: {formatDate(staff.hire_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-stone-400" />
                    <span className="text-stone-600">Branch: {staff.branch_name || `Branch ${staff.branch_id}`}</span>
                  </div>
                </div>

                {(staff.emergency_contact || staff.emergency_phone) && (
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <p className="text-[11px] font-bold text-amber-900 uppercase tracking-widest mb-1">Emergency Contact</p>
                    <div className="flex flex-col gap-1">
                      {staff.emergency_contact && (
                        <p className="text-sm text-amber-800">{staff.emergency_contact}</p>
                      )}
                      {staff.emergency_phone && (
                        <p className="text-sm text-amber-800">{staff.emergency_phone}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href={`/dashboard/branch-manager/staff/${staff.id}/attendance`}>
              <button className="w-full p-4 bg-white border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-sm transition-all text-left">
                <Clock className="h-5 w-5 text-blue-600 mb-2" />
                <p className="text-[13px] font-medium text-stone-900">Attendance</p>
                <p className="text-[11px] text-stone-500">View records</p>
              </button>
            </Link>
            <Link href={`/dashboard/branch-manager/staff/${staff.id}/performance`}>
              <button className="w-full p-4 bg-white border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-sm transition-all text-left">
                <Award className="h-5 w-5 text-emerald-600 mb-2" />
                <p className="text-[13px] font-medium text-stone-900">Performance</p>
                <p className="text-[11px] text-stone-500">View KPIs</p>
              </button>
            </Link>
            <Link href={`/dashboard/branch-manager/staff/${staff.id}/leave`}>
              <button className="w-full p-4 bg-white border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-sm transition-all text-left">
                <Calendar className="h-5 w-5 text-purple-600 mb-2" />
                <p className="text-[13px] font-medium text-stone-900">Leave</p>
                <p className="text-[11px] text-stone-500">Manage requests</p>
              </button>
            </Link>
            <Link href={`/dashboard/branch-manager/staff/${staff.id}/documents`}>
              <button className="w-full p-4 bg-white border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-sm transition-all text-left">
                <FileText className="h-5 w-5 text-amber-600 mb-2" />
                <p className="text-[13px] font-medium text-stone-900">Documents</p>
                <p className="text-[11px] text-stone-500">View files</p>
              </button>
            </Link>
          </div>

          {/* Placeholder for future sections */}
          <div className="card-elevated p-6">
            <div className="text-center py-10">
              <AlertCircle className="h-12 w-12 text-stone-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-stone-900">More Details Coming Soon</h3>
              <p className="text-sm text-stone-500 mt-1">Additional staff information and analytics will be displayed here.</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
