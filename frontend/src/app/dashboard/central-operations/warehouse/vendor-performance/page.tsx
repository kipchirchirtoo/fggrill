'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, RefreshCw, FileText, Truck, Award, BarChart3 } from 'lucide-react';
import vendorPerformanceAPI from '@/lib/vendor-performance-api';
import VendorList from './components/vendor-list';
import VendorRankings from './components/vendor-rankings';
import VendorMetrics from './components/vendor-metrics';
import VendorReports from './components/vendor-reports';

function VendorPerformanceContent() {
  const [activeTab, setActiveTab] = useState('vendors');
  const [isLoading, setIsLoading] = useState(false);
  const [vendorsData, setVendorsData] = useState<any[]>([]);
  const [categoriesData, setCategoriesData] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { user } = useAuth();

  // Fetch vendor data
  const fetchVendorData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await vendorPerformanceAPI.getAllVendorPerformance();
      
      if (response.success) {
        setVendorsData(response.data || []);
        
        // Extract unique categories
        const categories = [...new Set((response.data || []).map((v: any) => v.category))];
        setCategoriesData(categories);
      } else {
        toast.error(response.message || 'Failed to load vendor data');
      }
    } catch (error) {
      console.error('Error fetching vendor data:', error);
      toast.error('Failed to load vendor data');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Fetch rankings
  const fetchRankings = useCallback(async (category?: string) => {
    setIsLoading(true);
    try {
      const response = await vendorPerformanceAPI.getVendorRankings(category || undefined);
      
      if (response.success) {
        setVendorsData(response.data?.vendors || []);
        
        if (!category) {
          // Extract unique categories from rankings data
          const categories = [...new Set((response.data?.vendors || []).map((v: any) => v.category))];
          setCategoriesData(categories);
        }
      } else {
        toast.error(response.message || 'Failed to load vendor rankings');
      }
    } catch (error) {
      console.error('Error fetching vendor rankings:', error);
      toast.error('Failed to load vendor rankings');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if (activeTab === 'vendors' || activeTab === 'metrics') {
      fetchVendorData();
    } else if (activeTab === 'rankings') {
      fetchRankings(selectedCategory || undefined);
    }
  }, [activeTab, selectedCategory, fetchVendorData, fetchRankings]);
  
  const handleSelectVendor = (vendor: any) => {
    setSelectedVendor(vendor);
  };
  
  const handleSelectCategory = (category: string | null) => {
    setSelectedCategory(category);
    if (activeTab === 'rankings') {
      fetchRankings(category || undefined);
    }
  };
  
  return (
    <ProtectedRoute allowedRoles={[
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER, 
      UserRole.CENTRAL_OPERATIONS_MANAGER,
      UserRole.CENTRAL_STOREKEEPER
    ]}>
      <BranchAwareDashboardLayout
        title="Vendor Performance"
        subtitle="Track and analyze vendor performance metrics"
        requireBranchContext={false}
        actionButton={
          <IOSButton 
            variant="secondary" 
            onClick={() => {
              if (activeTab === 'vendors' || activeTab === 'metrics') {
                fetchVendorData();
              } else if (activeTab === 'rankings') {
                fetchRankings(selectedCategory || undefined);
              }
            }} 
            leftIcon={isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </IOSButton>
        }
      >
        <div className="space-y-6">
          <IOSCard className="overflow-hidden">
            <Tabs defaultValue="vendors" value={activeTab} onValueChange={setActiveTab}>
              <div className="border-b px-6 py-2">
                <TabsList className="grid grid-cols-4">
                  <TabsTrigger value="vendors" className="flex items-center gap-1">
                    <Truck className="h-4 w-4" /> Vendors
                  </TabsTrigger>
                  <TabsTrigger value="rankings" className="flex items-center gap-1">
                    <Award className="h-4 w-4" /> Rankings
                  </TabsTrigger>
                  <TabsTrigger value="metrics" className="flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" /> Metrics
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="flex items-center gap-1">
                    <FileText className="h-4 w-4" /> Reports
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <div className="p-0">
                <TabsContent value="vendors" className="m-0">
                  <VendorList 
                    vendors={vendorsData}
                    categories={categoriesData}
                    isLoading={isLoading}
                    onSelectVendor={handleSelectVendor}
                    onSelectCategory={handleSelectCategory}
                    selectedCategory={selectedCategory}
                  />
                </TabsContent>
                
                <TabsContent value="rankings" className="m-0">
                  <VendorRankings 
                    vendors={vendorsData}
                    categories={categoriesData}
                    isLoading={isLoading}
                    onSelectCategory={handleSelectCategory}
                    selectedCategory={selectedCategory}
                  />
                </TabsContent>
                
                <TabsContent value="metrics" className="m-0">
                  <VendorMetrics 
                    vendors={vendorsData}
                    categories={categoriesData}
                    isLoading={isLoading}
                  />
                </TabsContent>
                
                <TabsContent value="reports" className="m-0">
                  <VendorReports 
                    vendors={vendorsData}
                    categories={categoriesData}
                    isLoading={isLoading}
                    onSelectVendor={handleSelectVendor}
                    onSelectCategory={handleSelectCategory}
                    selectedVendor={selectedVendor}
                    selectedCategory={selectedCategory}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </IOSCard>
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function VendorPerformancePage() {
  return (
    <BranchPageWrapper>
      <VendorPerformanceContent />
    </BranchPageWrapper>
  );
}
