import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, BarChart3, PieChart, LineChart } from 'lucide-react';
import {
  LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart,
  Pie, Cell, BarChart as RechartsBarChart, Bar
} from 'recharts';

interface VendorMetricsProps {
  vendors: any[];
  categories: string[];
  isLoading: boolean;
}

// Colors for charts
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const RATING_COLORS = {
  excellent: '#10B981',
  good: '#3B82F6',
  average: '#F59E0B',
  poor: '#EF4444'
};

export default function VendorMetrics({ vendors, categories, isLoading }: VendorMetricsProps) {
  const [selectedMetric, setSelectedMetric] = useState('overall_score');
  const [selectedChart, setSelectedChart] = useState('bar');
  
  // Prepare data for category distribution
  const getCategoryData = () => {
    const categoryCount: Record<string, number> = {};
    
    vendors.forEach(vendor => {
      const category = vendor.category || 'Uncategorized';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    
    return Object.entries(categoryCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };
  
  // Prepare data for performance distribution
  const getPerformanceData = () => {
    const ratings = {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0
    };
    
    vendors.forEach(vendor => {
      const score = vendor[selectedMetric] || 0;
      
      if (score >= 90) {
        ratings.excellent += 1;
      } else if (score >= 75) {
        ratings.good += 1;
      } else if (score >= 60) {
        ratings.average += 1;
      } else {
        ratings.poor += 1;
      }
    });
    
    return Object.entries(ratings)
      .map(([name, value]) => ({ name, value }));
  };
  
  // Prepare data for comparison bar chart
  const getComparisonData = () => {
    const categoryScores: Record<string, { 
      count: number; 
      overall: number;
      ontime: number;
      quality: number;
      price: number;
    }> = {};
    
    vendors.forEach(vendor => {
      const category = vendor.category || 'Uncategorized';
      
      if (!categoryScores[category]) {
        categoryScores[category] = { 
          count: 0, 
          overall: 0,
          ontime: 0,
          quality: 0,
          price: 0
        };
      }
      
      categoryScores[category].count += 1;
      categoryScores[category].overall += (vendor.overall_score || 0);
      categoryScores[category].ontime += (vendor.on_time_delivery_score || 0);
      categoryScores[category].quality += (vendor.quality_score || 0);
      categoryScores[category].price += (vendor.price_score || 0);
    });
    
    return Object.entries(categoryScores)
      .map(([name, data]) => ({
        name,
        overall: data.count ? +(data.overall / data.count).toFixed(1) : 0,
        ontime: data.count ? +(data.ontime / data.count).toFixed(1) : 0,
        quality: data.count ? +(data.quality / data.count).toFixed(1) : 0,
        price: data.count ? +(data.price / data.count).toFixed(1) : 0
      }))
      .sort((a, b) => b.overall - a.overall);
  };
  
  const categoryData = getCategoryData();
  const performanceData = getPerformanceData();
  const comparisonData = getComparisonData();
  
  // Get label for metric
  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case 'overall_score': return 'Overall Score';
      case 'on_time_delivery_score': return 'On-time Delivery';
      case 'quality_score': return 'Quality';
      case 'price_score': return 'Price';
      case 'responsiveness_score': return 'Responsiveness';
      case 'compliance_score': return 'Compliance';
      default: return metric;
    }
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <h3 className="text-lg font-medium">Vendor Performance Metrics</h3>
        
        <div className="flex items-center gap-4">
          <div className="w-48">
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger>
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall_score">Overall Score</SelectItem>
                <SelectItem value="on_time_delivery_score">On-time Delivery</SelectItem>
                <SelectItem value="quality_score">Quality</SelectItem>
                <SelectItem value="price_score">Price</SelectItem>
                <SelectItem value="responsiveness_score">Responsiveness</SelectItem>
                <SelectItem value="compliance_score">Compliance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            <button 
              className={`p-2 rounded-md ${selectedChart === 'bar' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              onClick={() => setSelectedChart('bar')}
              title="Bar Chart"
            >
              <BarChart3 className="h-5 w-5" />
            </button>
            <button 
              className={`p-2 rounded-md ${selectedChart === 'pie' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              onClick={() => setSelectedChart('pie')}
              title="Pie Chart"
            >
              <PieChart className="h-5 w-5" />
            </button>
            <button 
              className={`p-2 rounded-md ${selectedChart === 'line' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              onClick={() => setSelectedChart('line')}
              title="Line Chart"
            >
              <LineChart className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-white p-4 rounded-lg border h-80">
          <h4 className="font-medium mb-4">Category Distribution</h4>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : categoryData.length === 0 ? (
            <div className="flex justify-center items-center h-64 text-gray-500">
              No vendor data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="90%">
              <RechartsPieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Vendors']} />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          )}
        </div>
        
        {/* Performance Distribution */}
        <div className="bg-white p-4 rounded-lg border h-80">
          <h4 className="font-medium mb-4">{getMetricLabel(selectedMetric)} Distribution</h4>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : vendors.length === 0 ? (
            <div className="flex justify-center items-center h-64 text-gray-500">
              No vendor data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="90%">
              <RechartsPieChart>
                <Pie
                  data={performanceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  <Cell name="Excellent" fill={RATING_COLORS.excellent} />
                  <Cell name="Good" fill={RATING_COLORS.good} />
                  <Cell name="Average" fill={RATING_COLORS.average} />
                  <Cell name="Poor" fill={RATING_COLORS.poor} />
                </Pie>
                <Tooltip formatter={(value) => [value, 'Vendors']} />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      
      {/* Comparison Chart */}
      <div className="bg-white p-4 rounded-lg border">
        <h4 className="font-medium mb-4">Performance Comparison by Category</h4>
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : comparisonData.length === 0 ? (
          <div className="flex justify-center items-center py-16 text-gray-500">
            No vendor data available
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {selectedChart === 'bar' ? (
                <RechartsBarChart
                  data={comparisonData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end"
                    height={70}
                    interval={0}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="overall" name="Overall" fill="#3B82F6" />
                  <Bar dataKey="ontime" name="On-time" fill="#10B981" />
                  <Bar dataKey="quality" name="Quality" fill="#F59E0B" />
                  <Bar dataKey="price" name="Price" fill="#8B5CF6" />
                </RechartsBarChart>
              ) : selectedChart === 'line' ? (
                <RechartsLineChart
                  data={comparisonData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end"
                    height={70}
                    interval={0}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="overall" 
                    name="Overall" 
                    stroke="#3B82F6"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ontime" 
                    name="On-time" 
                    stroke="#10B981" 
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="quality" 
                    name="Quality" 
                    stroke="#F59E0B" 
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    name="Price" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                  />
                </RechartsLineChart>
              ) : (
                <RechartsBarChart
                  data={comparisonData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={150}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="overall" name="Overall" fill="#3B82F6" />
                  <Bar dataKey="ontime" name="On-time" fill="#10B981" />
                  <Bar dataKey="quality" name="Quality" fill="#F59E0B" />
                  <Bar dataKey="price" name="Price" fill="#8B5CF6" />
                </RechartsBarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
      
      {/* Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="text-gray-500 text-sm">Total Vendors</h4>
          <p className="text-3xl font-bold mt-2">{vendors.length}</p>
          <div className="mt-2 text-sm text-gray-500">
            {categories.length} categories
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="text-gray-500 text-sm">Top Performers</h4>
          <p className="text-3xl font-bold mt-2">
            {vendors.filter(v => (v.overall_score || 0) >= 90).length}
          </p>
          <div className="mt-2 text-sm text-green-500">
            {vendors.length ? `${((vendors.filter(v => (v.overall_score || 0) >= 90).length / vendors.length) * 100).toFixed(1)}%` : '0%'} of vendors
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="text-gray-500 text-sm">Needs Improvement</h4>
          <p className="text-3xl font-bold mt-2">
            {vendors.filter(v => (v.overall_score || 0) < 60).length}
          </p>
          <div className="mt-2 text-sm text-red-500">
            {vendors.length ? `${((vendors.filter(v => (v.overall_score || 0) < 60).length / vendors.length) * 100).toFixed(1)}%` : '0%'} of vendors
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="text-gray-500 text-sm">Average Score</h4>
          <p className="text-3xl font-bold mt-2">
            {vendors.length 
              ? (vendors.reduce((sum, v) => sum + (v.overall_score || 0), 0) / vendors.length).toFixed(1)
              : '0.0'}
          </p>
          <div className="mt-2 text-sm text-blue-500">
            Across all vendors
          </div>
        </div>
      </div>
    </div>
  );
}
