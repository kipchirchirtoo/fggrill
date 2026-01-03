import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileText, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import vendorPerformanceAPI from '@/lib/vendor-performance-api';

interface VendorReportsProps {
  vendors: any[];
  categories: string[];
  isLoading: boolean;
  onSelectVendor: (vendor: any) => void;
  onSelectCategory: (category: string | null) => void;
  selectedVendor: any | null;
  selectedCategory: string | null;
}

export default function VendorReports({
  vendors,
  categories,
  isLoading,
  onSelectVendor,
  onSelectCategory,
  selectedVendor,
  selectedCategory
}: VendorReportsProps) {
  const [reportType, setReportType] = useState('overview');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState<any | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');

  // When selectedVendor changes from parent
  useEffect(() => {
    if (selectedVendor?.id) {
      setSelectedVendorId(selectedVendor.id.toString());
    }
  }, [selectedVendor]);

  // Generate report
  const generateReport = async () => {
    setGeneratingReport(true);
    setReportData(null);

    try {
      const vendorId = selectedVendorId ? Number(selectedVendorId) : undefined;
      const response = await vendorPerformanceAPI.generateReport(vendorId, selectedCategory || undefined);

      if (response.success) {
        setReportData(response.data);
        toast.success('Report generated successfully');
      } else {
        toast.error(response.message || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Export report
  const exportReport = (format: 'pdf' | 'excel') => {
    // This would connect to the export endpoint
    toast.info(`Exporting report as ${format.toUpperCase()}...`);

    // Mock export for now
    setTimeout(() => {
      toast.success(`Report exported as ${format.toUpperCase()}`);
    }, 1500);
  };

  // Format vendor options for select
  const getVendorOptions = () => {
    // Filter by category if selected
    const filteredVendors = selectedCategory
      ? vendors.filter(v => v.category === selectedCategory)
      : vendors;

    return filteredVendors.map(vendor => ({
      value: vendor.id.toString(),
      label: vendor.name || `Vendor ${vendor.id}`
    }));
  };

  // Handle vendor selection
  const handleVendorChange = (value: string) => {
    setSelectedVendorId(value);
    const vendor = vendors.find(v => v.id.toString() === value);
    if (vendor) {
      onSelectVendor(vendor);
    }
  };

  // Handle category selection 
  const handleCategoryChange = (value: string) => {
    onSelectCategory(value || null);
    setSelectedVendorId(''); // Reset vendor when category changes
  };

  const vendorOptions = getVendorOptions();

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <IOSCard className="p-4">
            <h3 className="text-lg font-medium mb-4">Generate Report</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Report Type</label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overview">Vendor Overview</SelectItem>
                    <SelectItem value="performance">Performance Analysis</SelectItem>
                    <SelectItem value="price">Price Comparison</SelectItem>
                    <SelectItem value="quality">Quality Assessment</SelectItem>
                    <SelectItem value="delivery">Delivery Performance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <Select value={selectedCategory || 'ALL'} onValueChange={(value) => handleCategoryChange(value === 'ALL' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Vendor (Optional)</label>
                <Select value={selectedVendorId || 'ALL'} onValueChange={(value) => handleVendorChange(value === 'ALL' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Vendors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Vendors</SelectItem>
                    {vendorOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <IOSButton
                className="w-full mt-4"
                onClick={generateReport}
                disabled={generatingReport}
                leftIcon={generatingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              >
                {generatingReport ? 'Generating...' : 'Generate Report'}
              </IOSButton>
            </div>
          </IOSCard>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>About Reports</AlertTitle>
            <AlertDescription>
              Reports provide in-depth analysis of vendor performance and can be exported as PDF or Excel files.
              Select specific vendors or categories for detailed insights.
            </AlertDescription>
          </Alert>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {generatingReport ? (
            <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-gray-50">
              <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
              <p className="mt-4 text-lg">Generating report...</p>
              <p className="text-sm text-gray-500">This may take a few moments</p>
            </div>
          ) : !reportData ? (
            <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-gray-50">
              <FileText className="h-12 w-12 text-gray-400" />
              <p className="mt-4 text-lg">No report generated</p>
              <p className="text-sm text-gray-500">Select parameters and generate a report</p>
            </div>
          ) : (
            <>
              {/* Report Header */}
              <IOSCard className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold">
                      {selectedVendor?.name
                        ? `${selectedVendor.name} Report`
                        : selectedCategory
                          ? `${selectedCategory} Category Report`
                          : 'Vendor Performance Report'
                      }
                    </h3>
                    <p className="text-gray-500">
                      Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="flex space-x-2">
                    <IOSButton
                      variant="outline"
                      size="sm"
                      onClick={() => exportReport('pdf')}
                      leftIcon={<Download className="h-4 w-4" />}
                    >
                      Export PDF
                    </IOSButton>
                    <IOSButton
                      variant="outline"
                      size="sm"
                      onClick={() => exportReport('excel')}
                      leftIcon={<Download className="h-4 w-4" />}
                    >
                      Export Excel
                    </IOSButton>
                  </div>
                </div>
              </IOSCard>

              {/* Report Content */}
              <IOSCard className="p-6">
                <h4 className="font-medium mb-4">Report Summary</h4>
                <p className="text-sm text-gray-600 mb-4">
                  This report provides a comprehensive analysis of vendor performance metrics including delivery timeliness, product quality, price competitiveness, and overall satisfaction.
                </p>

                {/* Top Vendors Section */}
                {reportData.top_vendors?.length > 0 && (
                  <div className="mt-6">
                    <h5 className="font-medium text-sm uppercase text-gray-500 mb-3">Top Performing Vendors</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {reportData.top_vendors.slice(0, 3).map((vendor: any, index: number) => (
                        <div key={vendor.id} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg text-blue-600">#{index + 1}</span>
                            <div>
                              <p className="font-medium">{vendor.name}</p>
                              <p className="text-xs text-gray-500">{vendor.category}</p>
                            </div>
                          </div>
                          <div className="mt-2">
                            <div className="flex justify-between items-center text-sm">
                              <span>Score:</span>
                              <span className="font-medium">{vendor.overall_score?.toFixed(1) || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Issues Section */}
                {reportData.recent_issues?.length > 0 && (
                  <div className="mt-6">
                    <h5 className="font-medium text-sm uppercase text-gray-500 mb-3">Recent Issues</h5>
                    <div className="border rounded-md overflow-hidden">
                      <table className="min-w-full divide-y">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Issue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {reportData.recent_issues.map((issue: any, index: number) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm">{issue.vendor_name}</td>
                              <td className="px-4 py-2 text-sm">{issue.category}</td>
                              <td className="px-4 py-2 text-sm">
                                {new Date(issue.delivery_date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs ${issue.quality_issues ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                                  {issue.quality_issues ? 'Quality Issue' : 'Late Delivery'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Performance Trends */}
                {reportData.performance_trends?.length > 0 && (
                  <div className="mt-6">
                    <h5 className="font-medium text-sm uppercase text-gray-500 mb-3">Performance Trends</h5>
                    <p className="text-sm text-gray-600 mb-4">
                      Performance trends show how vendor metrics have changed over time. This helps identify improvements or declines in service quality.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {reportData.performance_trends.slice(0, 6).map((trend: any, index: number) => (
                        <div key={index} className="border rounded p-3">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">{trend.vendor_name || trend.month}</p>
                              <p className="text-xs text-gray-500">{trend.month}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{trend.on_time_score?.toFixed(1) || 'N/A'}</p>
                              <p className="text-xs text-gray-500">On-time Score</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Metrics */}
                <div className="mt-6">
                  <h5 className="font-medium text-sm uppercase text-gray-500 mb-3">Key Metrics</h5>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="border rounded p-3">
                      <p className="text-xs text-gray-500">Total Vendors</p>
                      <p className="text-2xl font-bold">
                        {reportData.vendors?.length || vendors.length || 0}
                      </p>
                    </div>

                    <div className="border rounded p-3">
                      <p className="text-xs text-gray-500">Avg. On-time</p>
                      <p className="text-2xl font-bold">
                        {reportData.top_vendors?.length
                          ? (reportData.top_vendors.reduce((sum: number, v: any) => sum + (v.on_time_delivery_score || 0), 0) / reportData.top_vendors.length).toFixed(1)
                          : 'N/A'
                        }
                      </p>
                    </div>

                    <div className="border rounded p-3">
                      <p className="text-xs text-gray-500">Avg. Quality</p>
                      <p className="text-2xl font-bold">
                        {reportData.top_vendors?.length
                          ? (reportData.top_vendors.reduce((sum: number, v: any) => sum + (v.quality_score || 0), 0) / reportData.top_vendors.length).toFixed(1)
                          : 'N/A'
                        }
                      </p>
                    </div>

                    <div className="border rounded p-3">
                      <p className="text-xs text-gray-500">Avg. Price</p>
                      <p className="text-2xl font-bold">
                        {reportData.top_vendors?.length
                          ? (reportData.top_vendors.reduce((sum: number, v: any) => sum + (v.price_score || 0), 0) / reportData.top_vendors.length).toFixed(1)
                          : 'N/A'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Report Footer */}
                <div className="mt-8 pt-4 border-t text-xs text-gray-500">
                  <p>Report ID: {reportData.report_date}</p>
                  <p>Report Type: {reportData.report_type}</p>
                  <p>Generated by FG Grill Vendor Performance System</p>
                </div>
              </IOSCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
