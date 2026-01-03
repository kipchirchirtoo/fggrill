import { useState, useEffect } from 'react';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Search, ChevronUp, ChevronDown, Loader2, Star } from 'lucide-react';
import vendorPerformanceAPI from '@/lib/vendor-performance-api';

interface VendorListProps {
  vendors: any[];
  categories: string[];
  isLoading: boolean;
  onSelectVendor: (vendor: any) => void;
  onSelectCategory: (category: string | null) => void;
  selectedCategory: string | null;
}

export default function VendorList({
  vendors,
  categories,
  isLoading,
  onSelectVendor,
  onSelectCategory,
  selectedCategory
}: VendorListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('overall_score');
  const [sortDirection, setSortDirection] = useState('desc');
  const [viewVendor, setViewVendor] = useState<any | null>(null);
  const [vendorDetails, setVendorDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Filter and sort vendors
  const filteredVendors = vendors.filter(vendor => {
    // Category filter
    if (selectedCategory && vendor.category !== selectedCategory) {
      return false;
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        vendor.name?.toLowerCase().includes(searchLower) ||
        vendor.contact_person?.toLowerCase().includes(searchLower) ||
        vendor.category?.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  const sortedVendors = [...filteredVendors].sort((a, b) => {
    let aValue = a[sortField] || 0;
    let bValue = b[sortField] || 0;

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Handle sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get vendor details
  const getVendorDetails = async (vendorId: number) => {
    setLoadingDetails(true);
    try {
      const response = await vendorPerformanceAPI.getVendorDetails(vendorId);

      if (response.success) {
        setVendorDetails(response.data);
      } else {
        console.error('Failed to load vendor details:', response.message);
      }
    } catch (error) {
      console.error('Error fetching vendor details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  // When viewVendor changes, fetch details
  useEffect(() => {
    if (viewVendor?.id) {
      getVendorDetails(viewVendor.id);
    } else {
      setVendorDetails(null);
    }
  }, [viewVendor]);

  // Render score with color
  const renderScore = (score: number) => {
    let colorClass = 'text-gray-500';

    if (score >= 90) {
      colorClass = 'text-green-600';
    } else if (score >= 75) {
      colorClass = 'text-blue-600';
    } else if (score >= 60) {
      colorClass = 'text-yellow-600';
    } else if (score > 0) {
      colorClass = 'text-red-600';
    }

    return <span className={colorClass}>{score.toFixed(1)}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
          <Input
            placeholder="Search vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            value={selectedCategory || 'ALL'}
            onValueChange={(value) => onSelectCategory(value === 'ALL' ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full text-sm text-left rtl:text-right">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('name')}>
                <div className="flex items-center">
                  Vendor
                  {sortField === 'name' && (
                    sortDirection === 'asc' ?
                      <ChevronUp className="h-4 w-4 ml-1" /> :
                      <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('category')}>
                <div className="flex items-center">
                  Category
                  {sortField === 'category' && (
                    sortDirection === 'asc' ?
                      <ChevronUp className="h-4 w-4 ml-1" /> :
                      <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('overall_score')}>
                <div className="flex items-center">
                  Overall Score
                  {sortField === 'overall_score' && (
                    sortDirection === 'asc' ?
                      <ChevronUp className="h-4 w-4 ml-1" /> :
                      <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th className="px-4 py-3">On-time</th>
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <p className="mt-2 text-gray-500">Loading vendors...</p>
                </td>
              </tr>
            ) : sortedVendors.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  No vendors found
                </td>
              </tr>
            ) : (
              sortedVendors.map((vendor) => (
                <tr key={vendor.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-4 font-medium">
                    {vendor.name || 'Unknown Vendor'}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs">
                      <div>{vendor.contact_person || 'N/A'}</div>
                      <div className="text-gray-500">{vendor.contact_email || 'N/A'}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                      {vendor.category || 'Uncategorized'}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-medium">
                    <div className="flex items-center">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < Math.round(vendor.overall_score / 20) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
                        />
                      ))}
                      <span className="ml-2">{renderScore(vendor.overall_score)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {renderScore(vendor.on_time_delivery_score)}
                  </td>
                  <td className="px-4 py-4">
                    {renderScore(vendor.quality_score)}
                  </td>
                  <td className="px-4 py-4">
                    {renderScore(vendor.price_score)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <IOSButton
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setViewVendor(vendor);
                          onSelectVendor(vendor);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </IOSButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Vendor Details Dialog */}
      <Dialog open={!!viewVendor} onOpenChange={(open) => !open && setViewVendor(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vendor Details</DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <p className="mt-4 text-gray-500">Loading vendor details...</p>
            </div>
          ) : !vendorDetails ? (
            <div className="text-center py-8 text-gray-500">
              No details available for this vendor
            </div>
          ) : (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{vendorDetails.vendor?.name}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Category</p>
                      <p>{vendorDetails.vendor?.category || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <p>{vendorDetails.vendor?.active ? 'Active' : 'Inactive'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Contact Person</p>
                      <p>{vendorDetails.vendor?.contact_person || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Contact Email</p>
                      <p>{vendorDetails.vendor?.contact_email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Contact Phone</p>
                      <p>{vendorDetails.vendor?.contact_phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Date Onboarded</p>
                      <p>
                        {vendorDetails.vendor?.date_onboarded
                          ? new Date(vendorDetails.vendor.date_onboarded).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Performance Scores</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Overall Score</span>
                      <div className="flex items-center">
                        <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                          <div
                            className={`h-2 rounded-full ${vendorDetails.vendor?.overall_score >= 90 ? 'bg-green-500' :
                                vendorDetails.vendor?.overall_score >= 75 ? 'bg-blue-500' :
                                  vendorDetails.vendor?.overall_score >= 60 ? 'bg-yellow-500' :
                                    'bg-red-500'
                              }`}
                            style={{ width: `${vendorDetails.vendor?.overall_score || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">
                          {vendorDetails.vendor?.overall_score?.toFixed(1) || '0'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm">On-time Delivery</span>
                      <div className="flex items-center">
                        <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                          <div
                            className={`h-2 rounded-full ${vendorDetails.vendor?.on_time_delivery_score >= 90 ? 'bg-green-500' :
                                vendorDetails.vendor?.on_time_delivery_score >= 75 ? 'bg-blue-500' :
                                  vendorDetails.vendor?.on_time_delivery_score >= 60 ? 'bg-yellow-500' :
                                    'bg-red-500'
                              }`}
                            style={{ width: `${vendorDetails.vendor?.on_time_delivery_score || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">
                          {vendorDetails.vendor?.on_time_delivery_score?.toFixed(1) || '0'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm">Quality</span>
                      <div className="flex items-center">
                        <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                          <div
                            className={`h-2 rounded-full ${vendorDetails.vendor?.quality_score >= 90 ? 'bg-green-500' :
                                vendorDetails.vendor?.quality_score >= 75 ? 'bg-blue-500' :
                                  vendorDetails.vendor?.quality_score >= 60 ? 'bg-yellow-500' :
                                    'bg-red-500'
                              }`}
                            style={{ width: `${vendorDetails.vendor?.quality_score || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">
                          {vendorDetails.vendor?.quality_score?.toFixed(1) || '0'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm">Price</span>
                      <div className="flex items-center">
                        <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                          <div
                            className={`h-2 rounded-full ${vendorDetails.vendor?.price_score >= 90 ? 'bg-green-500' :
                                vendorDetails.vendor?.price_score >= 75 ? 'bg-blue-500' :
                                  vendorDetails.vendor?.price_score >= 60 ? 'bg-yellow-500' :
                                    'bg-red-500'
                              }`}
                            style={{ width: `${vendorDetails.vendor?.price_score || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">
                          {vendorDetails.vendor?.price_score?.toFixed(1) || '0'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm">Responsiveness</span>
                      <div className="flex items-center">
                        <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                          <div
                            className={`h-2 rounded-full ${vendorDetails.vendor?.responsiveness_score >= 90 ? 'bg-green-500' :
                                vendorDetails.vendor?.responsiveness_score >= 75 ? 'bg-blue-500' :
                                  vendorDetails.vendor?.responsiveness_score >= 60 ? 'bg-yellow-500' :
                                    'bg-red-500'
                              }`}
                            style={{ width: `${vendorDetails.vendor?.responsiveness_score || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">
                          {vendorDetails.vendor?.responsiveness_score?.toFixed(1) || '0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Deliveries */}
              <div>
                <h3 className="text-lg font-medium mb-3">Recent Deliveries</h3>
                {vendorDetails.deliveries?.length ? (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase font-medium">
                        <tr>
                          <th className="px-4 py-2 text-left">PO #</th>
                          <th className="px-4 py-2 text-left">Delivery Date</th>
                          <th className="px-4 py-2 text-left">Expected Date</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-left">Delay</th>
                          <th className="px-4 py-2 text-left">Issues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorDetails.deliveries.map((delivery: any) => (
                          <tr key={delivery.id} className="border-t">
                            <td className="px-4 py-2">{delivery.order_number}</td>
                            <td className="px-4 py-2">
                              {new Date(delivery.delivery_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2">
                              {new Date(delivery.expected_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-1 rounded-full text-xs 
                                ${delivery.status === 'complete' ? 'bg-green-100 text-green-800' :
                                  delivery.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                {delivery.status}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              {delivery.days_delayed === 0 ? (
                                <span className="text-green-600">On time</span>
                              ) : (
                                <span className="text-red-600">{delivery.days_delayed} days</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {delivery.quality_issues ? (
                                <span className="text-red-600">Yes</span>
                              ) : (
                                <span className="text-green-600">No</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No recent deliveries</p>
                )}
              </div>

              {/* Price Comparison */}
              {vendorDetails.price_comparison?.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3">Price Comparison</h3>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase font-medium">
                        <tr>
                          <th className="px-4 py-2 text-left">Item</th>
                          <th className="px-4 py-2 text-left">Category</th>
                          <th className="px-4 py-2 text-left">Vendor Price</th>
                          <th className="px-4 py-2 text-left">Market Avg</th>
                          <th className="px-4 py-2 text-left">Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorDetails.price_comparison.map((item: any, index: number) => {
                          const diff = item.vendor_price - item.avg_market_price;
                          const diffPercent = item.avg_market_price ? (diff / item.avg_market_price) * 100 : 0;

                          return (
                            <tr key={index} className="border-t">
                              <td className="px-4 py-2">{item.item_name}</td>
                              <td className="px-4 py-2">{item.item_category}</td>
                              <td className="px-4 py-2">KES {item.vendor_price.toLocaleString()}</td>
                              <td className="px-4 py-2">KES {item.avg_market_price?.toLocaleString() || 'N/A'}</td>
                              <td className="px-4 py-2">
                                {item.avg_market_price ? (
                                  <span className={diff <= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {diff <= 0 ? '-' : '+'}{Math.abs(diffPercent).toFixed(1)}%
                                  </span>
                                ) : 'N/A'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
