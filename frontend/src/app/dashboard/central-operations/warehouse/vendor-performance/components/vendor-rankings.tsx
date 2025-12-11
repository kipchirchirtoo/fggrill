import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Medal, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer,
  Cell
} from 'recharts';

interface VendorRankingsProps {
  vendors: any[];
  categories: string[];
  isLoading: boolean;
  onSelectCategory: (category: string | null) => void;
  selectedCategory: string | null;
}

export default function VendorRankings({ 
  vendors, 
  categories,
  isLoading, 
  onSelectCategory,
  selectedCategory
}: VendorRankingsProps) {
  // Get top 10 vendors for chart
  const topVendors = [...vendors]
    .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
    .slice(0, 10)
    .map(vendor => ({
      name: vendor.name,
      overall: vendor.overall_score || 0,
      delivery: vendor.on_time_delivery_score || 0,
      quality: vendor.quality_score || 0,
      price: vendor.price_score || 0,
    }));
  
  // Get category stats
  const getCategoryStats = () => {
    const stats: Record<string, { count: number, avg: number }> = {};
    
    vendors.forEach(vendor => {
      if (!vendor.category) return;
      
      if (!stats[vendor.category]) {
        stats[vendor.category] = { count: 0, avg: 0 };
      }
      
      stats[vendor.category].count += 1;
      stats[vendor.category].avg += (vendor.overall_score || 0);
    });
    
    // Calculate averages
    Object.keys(stats).forEach(category => {
      stats[category].avg = stats[category].avg / stats[category].count;
    });
    
    return Object.entries(stats)
      .map(([category, data]) => ({ category, count: data.count, avg: data.avg }))
      .sort((a, b) => b.avg - a.avg);
  };
  
  const categoryStats = getCategoryStats();
  
  // Calculate average scores
  const calculateAverages = () => {
    if (!vendors.length) return { overall: 0, delivery: 0, quality: 0, price: 0 };
    
    let overall = 0;
    let delivery = 0;
    let quality = 0;
    let price = 0;
    let count = 0;
    
    vendors.forEach(vendor => {
      if (selectedCategory && vendor.category !== selectedCategory) {
        return;
      }
      
      overall += (vendor.overall_score || 0);
      delivery += (vendor.on_time_delivery_score || 0);
      quality += (vendor.quality_score || 0);
      price += (vendor.price_score || 0);
      count++;
    });
    
    if (count === 0) return { overall: 0, delivery: 0, quality: 0, price: 0 };
    
    return {
      overall: overall / count,
      delivery: delivery / count,
      quality: quality / count,
      price: price / count
    };
  };
  
  const averages = calculateAverages();
  
  // Bar colors
  const getBarColor = (score: number) => {
    if (score >= 90) return '#10B981';
    if (score >= 75) return '#3B82F6';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="w-full md:w-64">
          <h3 className="text-lg font-medium mb-4">Filter by Category</h3>
          <Select
            value={selectedCategory || ''}
            onValueChange={(value) => onSelectCategory(value || null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-4">Performance by Category</h3>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-4">
                {categoryStats.map((stat, index) => (
                  <div 
                    key={stat.category}
                    className="p-4 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer"
                    onClick={() => onSelectCategory(stat.category)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        {index === 0 ? (
                          <div className="p-2 rounded-full bg-yellow-100">
                            <Medal className="h-5 w-5 text-yellow-500" />
                          </div>
                        ) : (
                          <div className="p-2 rounded-full bg-gray-100">
                            <Award className="h-5 w-5 text-gray-500" />
                          </div>
                        )}
                        <div className="ml-3">
                          <p className="font-medium">{stat.category}</p>
                          <p className="text-xs text-gray-500">{stat.count} vendors</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{stat.avg.toFixed(1)}</p>
                        <p className="text-xs text-gray-500">Avg. Score</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-1 space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Average Vendor Performance</h3>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Overall</p>
                      <p className="text-2xl font-bold">{averages.overall.toFixed(1)}</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-full h-fit">
                      <Award className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div 
                        className={`h-2 rounded-full ${
                          averages.overall >= 90 ? 'bg-green-500' :
                          averages.overall >= 75 ? 'bg-blue-500' :
                          averages.overall >= 60 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} 
                        style={{ width: `${averages.overall}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-gray-500">On-time</p>
                      <p className="text-2xl font-bold">{averages.delivery.toFixed(1)}</p>
                    </div>
                    <div className="p-2 bg-green-50 rounded-full h-fit">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div 
                        className={`h-2 rounded-full ${
                          averages.delivery >= 90 ? 'bg-green-500' :
                          averages.delivery >= 75 ? 'bg-blue-500' :
                          averages.delivery >= 60 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} 
                        style={{ width: `${averages.delivery}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Quality</p>
                      <p className="text-2xl font-bold">{averages.quality.toFixed(1)}</p>
                    </div>
                    <div className="p-2 bg-yellow-50 rounded-full h-fit">
                      <Award className="h-5 w-5 text-yellow-500" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div 
                        className={`h-2 rounded-full ${
                          averages.quality >= 90 ? 'bg-green-500' :
                          averages.quality >= 75 ? 'bg-blue-500' :
                          averages.quality >= 60 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} 
                        style={{ width: `${averages.quality}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Price</p>
                      <p className="text-2xl font-bold">{averages.price.toFixed(1)}</p>
                    </div>
                    <div className="p-2 bg-purple-50 rounded-full h-fit">
                      <TrendingDown className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div 
                        className={`h-2 rounded-full ${
                          averages.price >= 90 ? 'bg-green-500' :
                          averages.price >= 75 ? 'bg-blue-500' :
                          averages.price >= 60 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} 
                        style={{ width: `${averages.price}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-white p-6 border rounded-lg">
            <h3 className="text-lg font-medium mb-4">Top Performing Vendors</h3>
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : topVendors.length === 0 ? (
              <div className="flex justify-center py-16 text-gray-500">
                No vendor data available
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topVendors}
                    margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={150}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value) => [`${value}`, 'Score']}
                    />
                    <Legend />
                    <Bar dataKey="overall" name="Overall Score" radius={[0, 4, 4, 0]}>
                      {topVendors.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBarColor(entry.overall)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
