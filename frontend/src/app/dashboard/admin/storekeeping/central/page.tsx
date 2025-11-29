'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  Warehouse,
  Package,
  Send,
  Plus,
  Search,
  RefreshCw,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  Truck,
  History,
  FileText,
  ChevronDown,
  MoreVertical,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { storeAPI } from '@/lib/api';
import { motion } from 'framer-motion';
import Link from 'next/link';

// COLORS for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AdminCentralWarehousePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddStockModal, setShowAddStockModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [itemsRes, dispatchRes, catsRes] = await Promise.all([
        storeAPI.getItems().catch(() => ({ items: [] })),
        storeAPI.getDispatchHistory().catch(() => ({ dispatches: [] })),
        storeAPI.getCategories().catch(() => ({ categories: [] }))
      ]);
      setItems(itemsRes.items || itemsRes.data || []);
      setDispatches(dispatchRes.dispatches || dispatchRes.data || []);
      setCategories(catsRes.categories || catsRes.data || []);
    } catch (error) {
      toast.error('Failed to load warehouse data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Analytics
  const stats = useMemo(() => {
    const totalItems = items.length;
    const totalValue = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.cost_price || 0)), 0);
    const lowStockItems = items.filter(i => (i.quantity || 0) <= (i.reorder_level || 10));
    const pendingDispatches = dispatches.filter(d => d.status === 'pending');
    
    // Category distribution
    const categoryData = categories.map(cat => {
      const catItems = items.filter(i => i.category_id === cat.id || i.category === cat.name);
      return {
        name: cat.name,
        value: catItems.reduce((sum, i) => sum + ((i.quantity || 0) * (i.cost_price || 0)), 0)
      };
    }).filter(c => c.value > 0);

    return {
      totalItems,
      totalValue,
      lowStockCount: lowStockItems.length,
      pendingDispatchCount: pendingDispatches.length,
      categoryData
    };
  }, [items, dispatches, categories]);

  const filteredItems = items.filter(item =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockList = items.filter(i => (i.quantity || 0) <= (i.reorder_level || 10));

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Warehouse className="h-8 w-8 text-indigo-600" />
                Central Warehouse
              </h1>
              <p className="text-gray-600 mt-1">Real-time inventory tracking and logistics management</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Link href="/dashboard/admin/storekeeping/transfers">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Send className="h-4 w-4 mr-2" />
                  New Dispatch
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Inventory Value</p>
                      <h3 className="text-2xl font-bold mt-1">KES {stats.totalValue.toLocaleString()}</h3>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-l-4 border-l-purple-500 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total SKUs</p>
                      <h3 className="text-2xl font-bold mt-1">{stats.totalItems}</h3>
                    </div>
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <Package className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="border-l-4 border-l-orange-500 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Pending Dispatches</p>
                      <h3 className="text-2xl font-bold mt-1">{stats.pendingDispatchCount}</h3>
                    </div>
                    <div className="p-2 bg-orange-50 rounded-lg">
                      <Truck className="h-5 w-5 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card className="border-l-4 border-l-red-500 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Low Stock Alerts</p>
                      <h3 className="text-2xl font-bold mt-1 text-red-600">{stats.lowStockCount}</h3>
                    </div>
                    <div className="p-2 bg-red-50 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-4" onValueChange={setActiveTab}>
            <TabsList className="bg-white border">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="inventory">Inventory List</TabsTrigger>
              <TabsTrigger value="low-stock" className="text-red-600 data-[state=active]:text-red-700">
                Low Stock ({stats.lowStockCount})
              </TabsTrigger>
              <TabsTrigger value="dispatches">Dispatches</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Value by Category Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Stock Value by Category</CardTitle>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.categoryData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                        <Bar dataKey="value" fill="#4F46E5" radius={[4, 4, 0, 0]}>
                          {stats.categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Recent Activity / Dispatch Trends (Mock data for trend if API doesn't support time series) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Dispatches</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dispatches.slice(0, 5).map((dispatch) => (
                        <div key={dispatch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white border rounded-full">
                              <Send className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div>
                              <p className="font-medium">To: {dispatch.branch_name || 'Branch'}</p>
                              <p className="text-xs text-gray-500">{new Date(dispatch.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <Badge variant={dispatch.status === 'completed' ? 'secondary' : 'outline'}>
                            {dispatch.status}
                          </Badge>
                        </div>
                      ))}
                      {dispatches.length === 0 && (
                        <p className="text-center text-gray-500 py-4">No recent dispatches</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Inventory Items</CardTitle>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                      <Input
                        placeholder="Search items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Button variant="outline" size="icon">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Stock Level</TableHead>
                          <TableHead>Unit Cost</TableHead>
                          <TableHead>Total Value</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-10">
                              <div className="flex justify-center"><RefreshCw className="animate-spin h-6 w-6 text-indigo-600" /></div>
                            </TableCell>
                          </TableRow>
                        ) : filteredItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                              No items found matching your search.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>{item.sku}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{item.category?.name || item.category || 'Uncategorized'}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span>{item.quantity || 0} {item.unit}</span>
                                  {(item.quantity || 0) <= (item.reorder_level || 10) && (
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>KES {(item.cost_price || 0).toLocaleString()}</TableCell>
                              <TableCell>KES {((item.quantity || 0) * (item.cost_price || 0)).toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" className="text-indigo-600">
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="low-stock" className="space-y-4">
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Critical Stock Levels
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Current Stock</TableHead>
                          <TableHead>Reorder Level</TableHead>
                          <TableHead>Deficit</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lowStockList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-green-600">
                              <div className="flex flex-col items-center">
                                <Package className="h-8 w-8 mb-2" />
                                <p>All stock levels are healthy!</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          lowStockList.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="text-red-600 font-bold">{item.quantity || 0} {item.unit}</TableCell>
                              <TableCell>{item.reorder_level || 10}</TableCell>
                              <TableCell className="text-red-600">
                                -{((item.reorder_level || 10) - (item.quantity || 0))}
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="default" onClick={() => setShowAddStockModal(true)}>
                                  Restock
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="dispatches">
              <Card>
                <CardHeader>
                  <CardTitle>Dispatch History</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Reuse dispatch table logic or create new */}
                   <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Dispatch ID</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Items Count</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dispatches.map((dispatch) => (
                           <TableRow key={dispatch.id}>
                              <TableCell>{new Date(dispatch.created_at).toLocaleDateString()}</TableCell>
                              <TableCell>{dispatch.dispatch_number || dispatch.id.substring(0,8)}</TableCell>
                              <TableCell>{dispatch.branch_name || 'Main Branch'}</TableCell>
                              <TableCell>{dispatch.items?.length || 0} Items</TableCell>
                              <TableCell>
                                <Badge variant={
                                  dispatch.status === 'completed' ? 'default' : // 'default' usually maps to black/primary in shadcn, maybe 'success' if custom
                                  dispatch.status === 'pending' ? 'secondary' : 'outline'
                                }>
                                  {dispatch.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">View</Button>
                              </TableCell>
                           </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>

        <Dialog open={showAddStockModal} onOpenChange={setShowAddStockModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Stock</DialogTitle>
              <DialogDescription>
                Select an item to restock from the inventory list.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-500">
                To add stock, please navigate to the "Inventory List" tab, find the item, and click "View" or "Edit" to access the stock adjustment form.
                Global bulk restocking feature is coming soon.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowAddStockModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </DashboardLayout>
    </ProtectedRoute>
  );
}
