'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Toaster, toast } from 'sonner';

// Context for global state management
const ERPContext = createContext();

// Mock Data
const MOCK_USERS = [
  { id: 1, username: 'admin', password: 'admin123', role: 'Super Admin', name: 'John Doe' },
  { id: 2, username: 'hr', password: 'hr123', role: 'HR Manager', name: 'Jane Smith' },
  { id: 3, username: 'store', password: 'store123', role: 'Store Manager', name: 'Mike Johnson' },
  { id: 4, username: 'cashier', password: 'cash123', role: 'Cashier', name: 'Sarah Wilson' },
  { id: 5, username: 'employee', password: 'emp123', role: 'Employee', name: 'Tom Brown' },
];

const MOCK_PRODUCTS = [
  { id: 1, name: 'Burger', price: 9.99, stock: 50, image: '🍔', category: 'Food' },
  { id: 2, name: 'Pizza', price: 12.99, stock: 30, image: '🍕', category: 'Food' },
  { id: 3, name: 'Salad', price: 7.99, stock: 25, image: '🥗', category: 'Food' },
  { id: 4, name: 'Coffee', price: 3.99, stock: 100, image: '☕', category: 'Drinks' },
  { id: 5, name: 'Soda', price: 2.99, stock: 150, image: '🥤', category: 'Drinks' },
];

const MOCK_EMPLOYEES = [
  { id: 1, name: 'John Doe', role: 'Super Admin', salary: 5000, attendance: 98, performance: 95 },
  { id: 2, name: 'Jane Smith', role: 'HR Manager', salary: 4000, attendance: 96, performance: 92 },
  { id: 3, name: 'Mike Johnson', role: 'Store Manager', salary: 3500, attendance: 94, performance: 88 },
  { id: 4, name: 'Sarah Wilson', role: 'Cashier', salary: 2500, attendance: 90, performance: 85 },
  { id: 5, name: 'Tom Brown', role: 'Employee', salary: 2000, attendance: 92, performance: 87 },
];

// Utility Functions
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

const calculateTotalRevenue = (products) => {
  return products.reduce((total, product) => total + (product.price * (100 - product.stock)), 0);
};

// Main App Component
export default function ERPApp() {
  const [state, setState] = useState({
    user: null,
    currentModule: 'login',
    cart: [],
    products: MOCK_PRODUCTS,
    employees: MOCK_EMPLOYEES,
    bookings: [],
    notifications: [],
  });

  const login = (username, password) => {
    const user = MOCK_USERS.find(u => u.username === username && u.password === password);
    if (user) {
      setState(prev => ({ ...prev, user, currentModule: 'dashboard' }));
      toast.success('Login successful!');
    } else {
      toast.error('Invalid credentials!');
    }
  };

  const logout = () => {
    setState(prev => ({ ...prev, user: null, currentModule: 'login' }));
    toast.info('Logged out successfully!');
  };

  return (
    <ERPContext.Provider value={{ state, setState }}>
      <div className="min-h-screen bg-slate-100">
        <Toaster position="top-right" />
        <AnimatePresence mode="wait">
          {!state.user ? (
            <LoginPage login={login} />
          ) : (
            <Dashboard logout={logout} />
          )}
        </AnimatePresence>
      </div>
    </ERPContext.Provider>
  );
}

// Login Component
// Dashboard Component
function Dashboard({ logout }) {
  const { state, setState } = useContext(ERPContext);
  const { user, currentModule } = state;

  const getModuleAccess = (role) => {
    const access = {
      'Super Admin': ['dashboard', 'pos', 'inventory', 'hr', 'employee', 'booking'],
      'HR Manager': ['dashboard', 'hr', 'employee'],
      'Store Manager': ['dashboard', 'pos', 'inventory', 'booking'],
      'Cashier': ['dashboard', 'pos'],
      'Employee': ['dashboard', 'employee']
    };
    return access[role] || [];
  };

  const modules = [
    { id: 'dashboard', name: 'Dashboard', icon: Icons.LayoutDashboard },
    { id: 'pos', name: 'Point of Sale', icon: Icons.ShoppingCart },
    { id: 'inventory', name: 'Inventory', icon: Icons.Package },
    { id: 'hr', name: 'HR & Payroll', icon: Icons.Users },
    { id: 'employee', name: 'Employee Portal', icon: Icons.UserCircle },
    { id: 'booking', name: 'Booking Engine', icon: Icons.Calendar },
  ];

  const allowedModules = modules.filter(module => getModuleAccess(user.role).includes(module.id));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-screen bg-slate-100"
    >
      {/* Sidebar */}
      <div className="w-64 bg-slate-800 p-4 text-white">
        <div className="mb-8">
          <h2 className="text-xl font-bold">FG Grill ERP</h2>
          <p className="text-sm text-slate-400">{user.role}</p>
        </div>
        <nav className="space-y-2">
          {allowedModules.map(module => (
            <button
              key={module.id}
              onClick={() => setState(prev => ({ ...prev, currentModule: module.id }))}
              className={`flex w-full items-center space-x-2 rounded-lg px-4 py-2 text-left transition-colors ${currentModule === module.id ? 'bg-indigo-600' : 'hover:bg-slate-700'}`}
            >
              <module.icon className="h-5 w-5" />
              <span>{module.name}</span>
            </button>
          ))}
        </nav>
        <button
          onClick={logout}
          className="mt-8 flex w-full items-center space-x-2 rounded-lg px-4 py-2 text-left text-red-400 hover:bg-slate-700"
        >
          <Icons.LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8">
        <AnimatePresence mode="wait">
          {currentModule === 'dashboard' && <DashboardModule />}
          {currentModule === 'pos' && <POSModule />}
          {currentModule === 'inventory' && <InventoryModule />}
          {currentModule === 'hr' && <HRModule />}
          {currentModule === 'employee' && <EmployeeModule />}
          {currentModule === 'booking' && <BookingModule />}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Dashboard Module
function DashboardModule() {
  const { state } = useContext(ERPContext);
  const { user, products, employees } = state;

  const totalRevenue = calculateTotalRevenue(products);
  const totalEmployees = employees.length;
  const averagePerformance = employees.reduce((sum, emp) => sum + emp.performance, 0) / totalEmployees;
  const totalInventoryValue = products.reduce((sum, product) => sum + (product.price * product.stock), 0);

  const DashboardCard = ({ title, value, icon: Icon }) => (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
        </div>
        <Icon className="h-8 w-8 text-indigo-600" />
      </div>
    </div>
  );

  const renderRoleSpecificContent = () => {
    switch (user.role) {
      case 'Super Admin':
      case 'Store Manager':
        return (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <DashboardCard
                title="Total Revenue"
                value={formatCurrency(totalRevenue)}
                icon={Icons.DollarSign}
              />
              <DashboardCard
                title="Total Employees"
                value={totalEmployees}
                icon={Icons.Users}
              />
              <DashboardCard
                title="Inventory Value"
                value={formatCurrency(totalInventoryValue)}
                icon={Icons.Package}
              />
              <DashboardCard
                title="Avg Performance"
                value={`${averagePerformance.toFixed(1)}%`}
                icon={Icons.TrendingUp}
              />
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-6 shadow-md">
                <h3 className="mb-4 text-lg font-semibold">Low Stock Alerts</h3>
                <div className="space-y-4">
                  {products
                    .filter(product => product.stock < 30)
                    .map(product => (
                      <div key={product.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className="text-2xl">{product.image}</span>
                          <span>{product.name}</span>
                        </div>
                        <span className="font-semibold text-red-500">{product.stock} left</span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="rounded-lg bg-white p-6 shadow-md">
                <h3 className="mb-4 text-lg font-semibold">Top Performers</h3>
                <div className="space-y-4">
                  {[...employees]
                    .sort((a, b) => b.performance - a.performance)
                    .slice(0, 5)
                    .map(employee => (
                      <div key={employee.id} className="flex items-center justify-between">
                        <span>{employee.name}</span>
                        <div className="flex items-center space-x-2">
                          <div className="h-2 w-24 rounded-full bg-slate-200">
                            <div
                              className="h-2 rounded-full bg-green-500"
                              style={{ width: `${employee.performance}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-600">{employee.performance}%</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </>
        );
      case 'HR Manager':
        return (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <DashboardCard
                title="Total Employees"
                value={totalEmployees}
                icon={Icons.Users}
              />
              <DashboardCard
                title="Avg Performance"
                value={`${averagePerformance.toFixed(1)}%`}
                icon={Icons.TrendingUp}
              />
              <DashboardCard
                title="Pending Reviews"
                value={employees.filter(emp => emp.performance < 75).length}
                icon={Icons.AlertCircle}
              />
            </div>
            <div className="mt-8 rounded-lg bg-white p-6 shadow-md">
              <h3 className="mb-4 text-lg font-semibold">Employee Performance Overview</h3>
              <div className="space-y-4">
                {employees.map(employee => (
                  <div key={employee.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{employee.name}</p>
                      <p className="text-sm text-slate-600">{employee.role}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-sm text-slate-600">Attendance</p>
                        <p className="font-medium">{employee.attendance}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Performance</p>
                        <p className="font-medium">{employee.performance}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      default:
        return (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h3 className="mb-4 text-lg font-semibold">Your Performance</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600">Attendance Rate</p>
                  <div className="mt-2 flex items-center space-x-2">
                    <div className="h-2 w-full rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-green-500"
                        style={{ width: `${user.attendance}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{user.attendance}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Performance Score</p>
                  <div className="mt-2 flex items-center space-x-2">
                    <div className="h-2 w-full rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${user.performance}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{user.performance}%</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h3 className="mb-4 text-lg font-semibold">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                <button className="rounded-lg border border-slate-200 p-4 text-center hover:bg-slate-50">
                  <Icons.Clock className="mx-auto h-6 w-6 text-indigo-600" />
                  <span className="mt-2 block text-sm">Clock In/Out</span>
                </button>
                <button className="rounded-lg border border-slate-200 p-4 text-center hover:bg-slate-50">
                  <Icons.Calendar className="mx-auto h-6 w-6 text-indigo-600" />
                  <span className="mt-2 block text-sm">Request Leave</span>
                </button>
                <button className="rounded-lg border border-slate-200 p-4 text-center hover:bg-slate-50">
                  <Icons.FileText className="mx-auto h-6 w-6 text-indigo-600" />
                  <span className="mt-2 block text-sm">View Payslip</span>
                </button>
                <button className="rounded-lg border border-slate-200 p-4 text-center hover:bg-slate-50">
                  <Icons.MessageSquare className="mx-auto h-6 w-6 text-indigo-600" />
                  <span className="mt-2 block text-sm">Support</span>
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Welcome, {user.name}</h2>
          <p className="text-slate-600">Here's what's happening today</p>
        </div>
        <div className="flex space-x-2">
          <button className="rounded-lg bg-white p-2 text-slate-600 shadow-sm hover:text-indigo-600">
            <Icons.Bell className="h-5 w-5" />
          </button>
          <button className="rounded-lg bg-white p-2 text-slate-600 shadow-sm hover:text-indigo-600">
            <Icons.Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
      {renderRoleSpecificContent()}
    </motion.div>
  );
}

// POS Module
function POSModule() {
  const { state, setState } = useContext(ERPContext);
  const { products, cart } = state;
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const TAX_RATE = 0.1; // 10% tax

  const addToCart = (product) => {
    if (product.stock === 0) {
      toast.error('Product out of stock!');
      return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        toast.error('Not enough stock!');
        return;
      }
      setState(prev => ({
        ...prev,
        cart: prev.cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }));
    } else {
      setState(prev => ({
        ...prev,
        cart: [...prev.cart, { ...product, quantity: 1 }]
      }));
    }
    toast.success(`Added ${product.name} to cart`);
  };

  const removeFromCart = (productId) => {
    setState(prev => ({
      ...prev,
      cart: prev.cart.filter(item => item.id !== productId)
    }));
    toast.success('Item removed from cart');
  };

  const updateQuantity = (productId, delta) => {
    const item = cart.find(item => item.id === productId);
    const product = products.find(p => p.id === productId);

    if (delta > 0 && item.quantity >= product.stock) {
      toast.error('Not enough stock!');
      return;
    }

    if (item.quantity + delta === 0) {
      removeFromCart(productId);
      return;
    }

    setState(prev => ({
      ...prev,
      cart: prev.cart.map(item =>
        item.id === productId
          ? { ...item, quantity: item.quantity + delta }
          : item
      )
    }));
  };

  const clearCart = () => {
    setState(prev => ({ ...prev, cart: [] }));
    toast.info('Cart cleared');
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty!');
      return;
    }

    const { subtotal, tax, total } = calculateTotal();
    const receipt = {
      id: Date.now(),
      items: cart,
      subtotal,
      tax,
      total,
      date: new Date().toISOString(),
    };

    // Update inventory
    setState(prev => ({
      ...prev,
      products: prev.products.map(product => {
        const cartItem = cart.find(item => item.id === product.id);
        return cartItem
          ? { ...product, stock: product.stock - cartItem.quantity }
          : product;
      }),
      cart: []
    }));

    setCurrentReceipt(receipt);
    setShowReceipt(true);
    toast.success('Sale completed successfully!');
  };

  const Receipt = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Receipt</h3>
          <button
            onClick={() => setShowReceipt(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            <Icons.X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold">FG Grill</h2>
          <p className="text-sm text-slate-600">{new Date(currentReceipt.date).toLocaleString()}</p>
          <p className="text-sm text-slate-600">Receipt #{currentReceipt.id}</p>
        </div>
        <div className="mb-6 divide-y divide-slate-200">
          {currentReceipt.items.map(item => (
            <div key={item.id} className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium">{item.name}</span>
                <span className="text-sm text-slate-600"> x{item.quantity}</span>
              </div>
              <span>{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t border-slate-200 pt-4">
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span>{formatCurrency(currentReceipt.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Tax (10%)</span>
            <span>{formatCurrency(currentReceipt.tax)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatCurrency(currentReceipt.total)}</span>
          </div>
        </div>
        <button
          onClick={() => setShowReceipt(false)}
          className="mt-6 w-full rounded-lg bg-indigo-600 py-2 text-white hover:bg-indigo-700"
        >
          Close
        </button>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex h-full gap-6"
    >
      {/* Product Grid */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Point of Sale</h2>
          <div className="flex space-x-2">
            <div className="relative">
              <Icons.Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search products..."
                className="w-64 rounded-lg border-slate-200 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map(product => (
            <div
              key={product.id}
              className={`rounded-lg bg-white p-4 shadow-md transition-colors ${product.stock === 0 ? 'opacity-50' : ''}`}
            >
              <div className="mb-4 text-center text-4xl">{product.image}</div>
              <div className="mb-4 text-center">
                <h3 className="font-semibold">{product.name}</h3>
                <p className="text-lg font-bold text-indigo-600">{formatCurrency(product.price)}</p>
                <p className={`text-sm ${product.stock < 10 ? 'text-red-500' : 'text-slate-500'}`}>
                  {product.stock} in stock
                </p>
              </div>
              <button
                onClick={() => addToCart(product)}
                disabled={product.stock === 0}
                className="w-full rounded-lg bg-indigo-600 py-2 text-white transition-colors hover:bg-indigo-700 disabled:bg-slate-300"
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="w-96 space-y-6 rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Shopping Cart</h3>
          <button
            onClick={clearCart}
            className="text-sm text-red-500 hover:text-red-700"
            disabled={cart.length === 0}
          >
            Clear Cart
          </button>
        </div>

        <div className="flex-1 space-y-4">
          {cart.length === 0 ? (
            <p className="text-center text-slate-500">Cart is empty</p>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-2xl">{item.image}</span>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-slate-600">{formatCurrency(item.price)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Icons.Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Icons.Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span>{formatCurrency(calculateTotal().subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Tax (10%)</span>
              <span>{formatCurrency(calculateTotal().tax)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{formatCurrency(calculateTotal().total)}</span>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full rounded-lg bg-green-600 py-2 text-white hover:bg-green-700"
            >
              Checkout
            </button>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceipt && currentReceipt && <Receipt />}
      </AnimatePresence>
    </motion.div>
  );
}

// Inventory Module
function InventoryModule() {
  const { state, setState } = useContext(ERPContext);
  const { products } = state;
  const [editingProduct, setEditingProduct] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', ...new Set(products.map(p => p.category))];

  const filteredProducts = products
    .filter(product =>
      (selectedCategory === 'all' || product.category === selectedCategory) &&
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const handleAddProduct = (newProduct) => {
    setState(prev => ({
      ...prev,
      products: [...prev.products, { id: Date.now(), ...newProduct }]
    }));
    toast.success('Product added successfully!');
    setShowAddModal(false);
  };

  const handleUpdateProduct = (updatedProduct) => {
    setState(prev => ({
      ...prev,
      products: prev.products.map(p =>
        p.id === updatedProduct.id ? updatedProduct : p
      )
    }));
    toast.success('Product updated successfully!');
    setEditingProduct(null);
  };

  const handleDeleteProduct = (productId) => {
    setState(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== productId)
    }));
    toast.success('Product deleted successfully!');
  };

  const ProductForm = ({ product, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState(
      product || {
        name: '',
        price: '',
        stock: '',
        category: '',
        image: '🍽️'
      }
    );

    const handleSubmit = (e) => {
      e.preventDefault();
      onSubmit({
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock, 10)
      });
    };

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      >
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 className="mb-4 text-lg font-semibold">
            {product ? 'Edit Product' : 'Add New Product'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Price</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Stock</label>
              <input
                type="number"
                value={formData.stock}
                onChange={e => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Emoji</label>
              <input
                type="text"
                value={formData.image}
                onChange={e => setFormData(prev => ({ ...prev, image: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2"
                required
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex-1 rounded-md bg-indigo-600 py-2 text-white hover:bg-indigo-700"
              >
                {product ? 'Update' : 'Add'} Product
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-md border border-slate-300 py-2 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Inventory Management</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        >
          <Icons.Plus className="h-5 w-5" />
          <span>Add Product</span>
        </button>
      </div>

      <div className="flex space-x-4">
        <div className="relative flex-1">
          <Icons.Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border-slate-200 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="rounded-lg border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
        >
          {categories.map(category => (
            <option key={category} value={category}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg bg-white shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-sm font-medium text-slate-600">
                <th className="p-4">Product</th>
                <th className="p-4">Category</th>
                <th className="p-4">Price</th>
                <th className="p-4">Stock</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{product.image}</span>
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="p-4">{product.category}</td>
                  <td className="p-4">{formatCurrency(product.price)}</td>
                  <td className="p-4">{product.stock}</td>
                  <td className="p-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${product.stock === 0
                        ? 'bg-red-100 text-red-700'
                        : product.stock < 10
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                        }`}
                    >
                      {product.stock === 0
                        ? 'Out of Stock'
                        : product.stock < 10
                          ? 'Low Stock'
                          : 'In Stock'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                      >
                        <Icons.Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      >
                        <Icons.Trash className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <ProductForm
            onSubmit={handleAddProduct}
            onCancel={() => setShowAddModal(false)}
          />
        )}
        {editingProduct && (
          <ProductForm
            product={editingProduct}
            onSubmit={handleUpdateProduct}
            onCancel={() => setEditingProduct(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// HR Module
function HRModule() {
  const { state, setState } = useContext(ERPContext);
  const { employees } = state;
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const TAX_RATE = 0.2; // 20% tax rate
  const BENEFITS_RATE = 0.1; // 10% benefits

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculatePayroll = (employee) => {
    const grossPay = employee.salary;
    const taxDeduction = grossPay * TAX_RATE;
    const benefits = grossPay * BENEFITS_RATE;
    const netPay = grossPay - taxDeduction - benefits;

    return {
      grossPay,
      taxDeduction,
      benefits,
      netPay
    };
  };

  const PayrollModal = () => {
    const payroll = calculatePayroll(selectedEmployee);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      >
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Payroll Details</h3>
            <button
              onClick={() => setShowPayrollModal(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <Icons.X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold">{selectedEmployee.name}</h2>
            <p className="text-sm text-slate-600">{selectedEmployee.role}</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between rounded-lg bg-slate-50 p-4">
              <span className="font-medium">Gross Pay</span>
              <span className="font-bold text-green-600">{formatCurrency(payroll.grossPay)}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-slate-50 p-4">
              <span className="font-medium">Tax Deduction (20%)</span>
              <span className="font-bold text-red-600">{formatCurrency(payroll.taxDeduction)}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-slate-50 p-4">
              <span className="font-medium">Benefits (10%)</span>
              <span className="font-bold text-blue-600">{formatCurrency(payroll.benefits)}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-emerald-50 p-4">
              <span className="font-bold">Net Pay</span>
              <span className="font-bold text-emerald-600">{formatCurrency(payroll.netPay)}</span>
            </div>
          </div>

          <button
            onClick={() => setShowPayrollModal(false)}
            className="mt-6 w-full rounded-lg bg-indigo-600 py-2 text-white hover:bg-indigo-700"
          >
            Close
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">HR & Payroll</h2>
        <div className="relative">
          <Icons.Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-64 rounded-lg border-slate-200 pl-10 focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {filteredEmployees.map(employee => (
          <div
            key={employee.id}
            className="rounded-lg bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{employee.name}</h3>
                <p className="text-sm text-slate-600">{employee.role}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedEmployee(employee);
                  setShowPayrollModal(true);
                }}
                className="rounded-lg bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-100"
              >
                View Payroll
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-600">Base Salary</p>
                <p className="font-bold">{formatCurrency(employee.salary)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-600">Status</p>
                <p className="font-medium text-green-600">Active</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">Performance</span>
                  <span className="text-sm text-slate-600">{employee.performance}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className={`h-2 rounded-full ${employee.performance >= 90
                      ? 'bg-green-500'
                      : employee.performance >= 70
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                      }`}
                    style={{ width: `${employee.performance}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">Attendance</span>
                  <span className="text-sm text-slate-600">{employee.attendance}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${employee.attendance}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end space-x-2">
              <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
                <Icons.Mail className="h-5 w-5" />
              </button>
              <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
                <Icons.Phone className="h-5 w-5" />
              </button>
              <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
                <Icons.FileText className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showPayrollModal && selectedEmployee && <PayrollModal />}
      </AnimatePresence>
    </motion.div>
  );
}

// Employee Portal Module
function EmployeeModule() {
  const { state, setState } = useContext(ERPContext);
  const { user } = state;
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([
    { id: 1, startDate: '2025-11-25', endDate: '2025-11-27', type: 'Vacation', status: 'Pending' },
    { id: 2, startDate: '2025-12-24', endDate: '2025-12-26', type: 'Holiday', status: 'Approved' },
  ]);

  const handleClockInOut = () => {
    if (!clockedIn) {
      setClockedIn(true);
      setClockInTime(new Date());
      toast.success('Clocked in successfully!');
    } else {
      setClockedIn(false);
      setClockInTime(null);
      toast.success('Clocked out successfully!');
    }
  };

  const LeaveRequestModal = () => {
    const [formData, setFormData] = useState({
      startDate: '',
      endDate: '',
      type: 'Vacation',
      reason: ''
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      const newRequest = {
        id: Date.now(),
        ...formData,
        status: 'Pending'
      };
      setLeaveRequests(prev => [...prev, newRequest]);
      setShowLeaveModal(false);
      toast.success('Leave request submitted successfully!');
    };

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      >
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Request Leave</h3>
            <button
              onClick={() => setShowLeaveModal(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <Icons.X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={e => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Leave Type</label>
              <select
                value={formData.type}
                onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2"
              >
                <option value="Vacation">Vacation</option>
                <option value="Sick">Sick Leave</option>
                <option value="Personal">Personal</option>
                <option value="Holiday">Holiday</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Reason</label>
              <textarea
                value={formData.reason}
                onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                className="mt-1 h-24 w-full rounded-md border border-slate-300 p-2"
                required
              />
            </div>

            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex-1 rounded-md bg-indigo-600 py-2 text-white hover:bg-indigo-700"
              >
                Submit Request
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 rounded-md border border-slate-300 py-2 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Employee Portal</h2>
          <p className="text-slate-600">Welcome back, {user.name}</p>
        </div>
        <button
          onClick={handleClockInOut}
          className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-white ${clockedIn ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
        >
          {clockedIn ? (
            <>
              <Icons.LogOut className="h-5 w-5" />
              <span>Clock Out</span>
            </>
          ) : (
            <>
              <Icons.LogIn className="h-5 w-5" />
              <span>Clock In</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Time Tracking Card */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-lg font-semibold">Time Tracking</h3>
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Current Status</p>
              <p className="mt-1 font-semibold">
                {clockedIn ? (
                  <span className="text-green-600">Clocked In</span>
                ) : (
                  <span className="text-red-600">Clocked Out</span>
                )}
              </p>
              {clockedIn && clockInTime && (
                <p className="mt-2 text-sm text-slate-600">
                  Since {clockInTime.toLocaleTimeString()}
                </p>
              )}
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Today's Hours</p>
              <p className="mt-1 font-semibold">6h 30m</p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-600">This Week</p>
              <p className="mt-1 font-semibold">32h 15m</p>
            </div>
          </div>
        </div>

        {/* Performance Card */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-lg font-semibold">Your Performance</h3>
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">Overall Rating</span>
                <span className="text-sm text-slate-600">{user.performance}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div
                  className={`h-2 rounded-full ${user.performance >= 90 ? 'bg-green-500' : user.performance >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${user.performance}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">Attendance</span>
                <span className="text-sm text-slate-600">{user.attendance}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${user.attendance}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Leave Requests Card */}
        <div className="rounded-lg bg-white p-6 shadow-md lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Leave Requests</h3>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              <Icons.Plus className="h-5 w-5" />
              <span>Request Leave</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm font-medium text-slate-600">
                  <th className="pb-3 pr-4">Date Range</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {leaveRequests.map(request => (
                  <tr key={request.id}>
                    <td className="py-3 pr-4">
                      <div>
                        <p className="font-medium">
                          {new Date(request.startDate).toLocaleDateString()} -{' '}
                          {new Date(request.endDate).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-slate-600">
                          {Math.ceil(
                            (new Date(request.endDate) - new Date(request.startDate)) /
                            (1000 * 60 * 60 * 24)
                          )}{' '}
                          days
                        </p>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-sm font-medium text-slate-600">
                        {request.type}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-1 text-sm font-medium ${request.status === 'Approved'
                          ? 'bg-green-100 text-green-700'
                          : request.status === 'Rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                          }`}
                      >
                        {request.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showLeaveModal && <LeaveRequestModal />}
      </AnimatePresence>
    </motion.div>
  );
}

// Booking Module
function BookingModule() {
  const { state, setState } = useContext(ERPContext);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookings, setBookings] = useState([
    {
      id: 1,
      customerName: 'Alice Johnson',
      date: '2025-11-23',
      time: '18:00',
      guests: 4,
      status: 'Confirmed',
      notes: 'Birthday celebration'
    },
    {
      id: 2,
      customerName: 'Bob Smith',
      date: '2025-11-23',
      time: '19:30',
      guests: 2,
      status: 'Pending',
      notes: 'Window seat preferred'
    }
  ]);

  const timeSlots = [
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30'
  ];

  const isTimeSlotAvailable = (date, time) => {
    const existingBooking = bookings.find(
      booking => booking.date === date && booking.time === time
    );
    return !existingBooking;
  };

  const handleStatusChange = (bookingId, newStatus) => {
    setBookings(prev =>
      prev.map(booking =>
        booking.id === bookingId
          ? { ...booking, status: newStatus }
          : booking
      )
    );
    toast.success(`Booking status updated to ${newStatus}`);
  };

  const BookingModal = () => {
    const [formData, setFormData] = useState({
      customerName: '',
      date: selectedDate.toISOString().split('T')[0],
      time: '',
      guests: 2,
      notes: ''
    });

    const handleSubmit = (e) => {
      e.preventDefault();

      if (!isTimeSlotAvailable(formData.date, formData.time)) {
        toast.error('This time slot is already booked!');
        return;
      }

      const newBooking = {
        id: Date.now(),
        ...formData,
        status: 'Pending'
      };

      setBookings(prev => [...prev, newBooking]);
      setShowBookingModal(false);
      toast.success('Booking created successfully!');
    };

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      >
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold">New Booking</h3>
            <button
              onClick={() => setShowBookingModal(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <Icons.X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Customer Name</label>
              <input
                type="text"
                value={formData.customerName}
                onChange={e => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Time</label>
              <select
                value={formData.time}
                onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2"
                required
              >
                <option value="">Select a time</option>
                {timeSlots.map(time => (
                  <option
                    key={time}
                    value={time}
                    disabled={!isTimeSlotAvailable(formData.date, time)}
                  >
                    {time}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Number of Guests</label>
              <input
                type="number"
                min="1"
                max="20"
                value={formData.guests}
                onChange={e => setFormData(prev => ({ ...prev, guests: parseInt(e.target.value, 10) }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="mt-1 h-24 w-full rounded-md border border-slate-300 p-2"
              />
            </div>

            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex-1 rounded-md bg-indigo-600 py-2 text-white hover:bg-indigo-700"
              >
                Create Booking
              </button>
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="flex-1 rounded-md border border-slate-300 py-2 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Booking Engine</h2>
          <p className="text-slate-600">
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <button
          onClick={() => setShowBookingModal(true)}
          className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        >
          <Icons.Plus className="h-5 w-5" />
          <span>New Booking</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar View */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="space-y-4">
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={e => setSelectedDate(new Date(e.target.value))}
              className="w-full rounded-lg border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
            />

            <div className="space-y-2">
              {timeSlots.map(time => {
                const isAvailable = isTimeSlotAvailable(
                  selectedDate.toISOString().split('T')[0],
                  time
                );
                return (
                  <div
                    key={time}
                    className={`flex items-center justify-between rounded-lg p-2 ${isAvailable ? 'bg-slate-50' : 'bg-red-50'}`}
                  >
                    <span className="font-medium">{time}</span>
                    <span
                      className={`text-sm ${isAvailable ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {isAvailable ? 'Available' : 'Booked'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            {bookings
              .filter(booking => booking.date === selectedDate.toISOString().split('T')[0])
              .sort((a, b) => a.time.localeCompare(b.time))
              .map(booking => (
                <div
                  key={booking.id}
                  className="rounded-lg bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{booking.customerName}</h3>
                      <p className="text-sm text-slate-600">
                        {booking.time} · {booking.guests} guests
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <select
                        value={booking.status}
                        onChange={e => handleStatusChange(booking.id, e.target.value)}
                        className={`rounded-full px-3 py-1 text-sm font-medium ${booking.status === 'Confirmed'
                          ? 'bg-green-100 text-green-700'
                          : booking.status === 'Cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                          }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  {booking.notes && (
                    <p className="mt-2 text-sm text-slate-600">{booking.notes}</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showBookingModal && <BookingModal />}
      </AnimatePresence>
    </motion.div>
  );
}

function LoginPage({ login }) {
  const [formData, setFormData] = useState({ username: '', password: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    login(formData.username, formData.password);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex min-h-screen items-center justify-center bg-slate-100"
    >
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900">Welcome to ERP</h2>
          <p className="mt-2 text-sm text-slate-600">Please sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
            />
            <input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none"
          >
            Sign In
          </button>
        </form>
      </div>
    </motion.div>
  );
}
