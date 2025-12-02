'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { UserPlus, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

export default function BranchCheckinPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div><h1 className="text-2xl font-bold text-gray-900">Check-In</h1><p className="text-gray-500">Guest check-in process</p></div>
          <IOSCard className="p-12 text-center">
            <UserPlus className="h-16 w-16 mx-auto text-[#007AFF] mb-4" />
            <h2 className="text-xl font-bold mb-2">Guest Check-In</h2>
            <p className="text-gray-500 mb-6">Use the arrivals page to check in guests with reservations</p>
            <Link href="/dashboard/branch-manager/arrivals"><IOSButton>Go to Arrivals <ArrowRight className="h-4 w-4 ml-2" /></IOSButton></Link>
          </IOSCard>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
