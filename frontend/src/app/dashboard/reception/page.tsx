'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Layout,
  Menu,
  Users,
  Calendar,
  Coffee,
  List,
  ShoppingCart,
  CreditCard,
  PlusCircle,
  Search,
  Trash2,
  CheckCircle,
  Circle,
  DollarSign,
  LogIn,
  LogOut,
  Clock,
  Bed,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { toast } from 'sonner';
import { bookingsAPI, roomsAPI } from '@/lib/api';
import {
  CheckInModal,
  CheckOutModal,
  RoomServiceModal,
  InvoiceModal,
  EventModal,
  ReservationModal
} from '@/components/modals';

// Types and Interfaces
interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface CartItem extends MenuItem {
  qty: number;
}

interface Activity {
  id: number;
  type: 'check-in' | 'check-out' | 'booking';
  guest: string;
  room: string;
  time: string;
}

interface Reservation {
  id: number;
  name: string;
  room: string;
  pax: number;
  time: string;
  status: 'Arrived' | 'Reserved' | 'No-show';
}

type TabName = 'dashboard' | 'reservations' | 'pos' | 'tables';

interface TableData {
  id: number;
  name: string;
  status: 'occupied' | 'reserved' | 'free';
}

export default function ReceptionDashboard(): JSX.Element {
  // Modal states
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showRoomServiceModal, setShowRoomServiceModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);

  // State management
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabName>('dashboard');
  const [query, setQuery] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filteredMenu, setFilteredMenu] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [todayStats, setTodayStats] = useState({
    checkInsToday: 0,
    checkOutsToday: 0,
    arrivalsExpected: 0,
    departuresExpected: 0,
    availableRooms: 0,
    occupiedRooms: 0
  });

  // Menu items for POS - would come from restaurant API
  const menuItems: MenuItem[] = useMemo(() => [
    { id: 'm1', name: 'Flat White', price: 350, category: 'Drinks' },
    { id: 'm2', name: 'Beef Burger', price: 900, category: 'Mains' },
    { id: 'm3', name: 'Caesar Salad', price: 600, category: 'Salads' },
    { id: 'm4', name: 'Pancakes', price: 450, category: 'Breakfast' }
  ], []);

  // Fetch dashboard data from API
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [bookingsRes, roomsRes] = await Promise.all([
        bookingsAPI.getBookings({ status: 'today' }).catch(() => ({ bookings: [] })),
        roomsAPI.getRooms().catch(() => ({ rooms: [] }))
      ]);

      const bookings = bookingsRes.bookings || bookingsRes || [];
      const rooms = roomsRes.rooms || roomsRes || [];

      // Calculate stats from API data
      const checkIns = Array.isArray(bookings) ? bookings.filter((b: any) => b.status === 'checked_in').length : 0;
      const checkOuts = Array.isArray(bookings) ? bookings.filter((b: any) => b.status === 'checked_out').length : 0;
      const arrivals = Array.isArray(bookings) ? bookings.filter((b: any) => b.status === 'confirmed').length : 0;
      const occupied = Array.isArray(rooms) ? rooms.filter((r: any) => r.status === 'occupied').length : 0;
      const available = Array.isArray(rooms) ? rooms.filter((r: any) => r.status === 'available').length : 0;

      setTodayStats({
        checkInsToday: checkIns,
        checkOutsToday: checkOuts,
        arrivalsExpected: arrivals,
        departuresExpected: checkOuts,
        availableRooms: available,
        occupiedRooms: occupied
      });

      // Convert bookings to reservations format
      if (Array.isArray(bookings)) {
        setReservations(bookings.slice(0, 10).map((b: any) => ({
          id: b.id,
          name: b.guest_name || 'Guest',
          room: b.room_number || '-',
          pax: b.guests || 1,
          time: b.check_in_date || new Date().toISOString(),
          status: b.status === 'checked_in' ? 'Arrived' : b.status === 'confirmed' ? 'Reserved' : 'No-show'
        })));

        // Recent activities
        setRecentActivities(bookings.slice(0, 5).map((b: any, i: number) => ({
          id: i,
          type: b.status === 'checked_in' ? 'check-in' : b.status === 'checked_out' ? 'check-out' : 'booking',
          guest: b.guest_name || 'Guest',
          room: b.room_number || '-',
          time: new Date(b.updated_at || b.created_at).toLocaleTimeString()
        })));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Effects
  useEffect(() => {
    setFilteredMenu(menuItems.filter(m => m.name.toLowerCase().includes(query.toLowerCase())));
  }, [query, menuItems]);

  // Cart functions
  function addToCart(item: MenuItem) {
    setCart(prev => {
      const found = prev.find(p => p.id === item.id);
      if (found) return prev.map(p => p.id === item.id ? { ...p, qty: p.qty + 1 } : p);
      return [{ ...item, qty: 1 }, ...prev];
    });
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(p => p.id !== id));
  }

  function changeQty(id: string, delta: number) {
    setCart(prev => prev.map(p => p.id === id ? { ...p, qty: Math.max(1, p.qty + delta) } : p));
  }

  const cartTotal = cart.reduce((s: number, i: CartItem) => s + i.price * i.qty, 0);

  // Checkout function
  function checkout() {
    if (!cart.length) return alert('Cart is empty');
    // simulate order placement
    alert(`Order placed — Total: Ksh ${cartTotal}`);
    setCart([]);
  }

  const { user } = useAuth();

  return (
    <ProtectedRoute allowedRoles={[UserRole.RECEPTIONIST, UserRole.GENERAL_MANAGER]}>
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <div className="max-w-[1400px] mx-auto p-4 grid grid-cols-12 gap-4">
          {/* SIDEBAR */}
          <aside className="col-span-12 md:col-span-3 lg:col-span-2 bg-white rounded-2xl shadow p-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white rounded-xl w-12 h-12 flex items-center justify-center font-bold">FG</div>
              <div>
                <h3 className="text-lg font-semibold">Famous Gate</h3>
                <p className="text-sm text-slate-500">Front Desk • Restaurant</p>
              </div>
            </div>

            <nav className="flex-1">
              <ul className="space-y-2">
                <li>
                  <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 ${activeTab==='dashboard'?'bg-slate-100':''}`}>
                    <Layout size={18}/> <span>Dashboard</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('reservations')} className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 ${activeTab==='reservations'?'bg-slate-100':''}`}>
                    <Calendar size={18}/> <span>Reservations</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('pos')} className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 ${activeTab==='pos'?'bg-slate-100':''}`}>
                    <ShoppingCart size={18}/> <span>Restaurant POS</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('tables')} className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 ${activeTab==='tables'?'bg-slate-100':''}`}>
                    <List size={18}/> <span>Table Map</span>
                  </button>
                </li>
              </ul>
            </nav>

            <div className="pt-2 border-t border-slate-100">
              <button 
                onClick={() => setShowReservationModal(true)}
                className="w-full flex items-center gap-2 p-2 rounded-lg bg-indigo-600 text-white justify-center"
                type="button"
              >
                <PlusCircle size={18}/> New Reservation
              </button>
            </div>
          </aside>

          {/* MAIN AREA */}
          <main className="col-span-12 md:col-span-9 lg:col-span-7 space-y-4">
            {/* TOPBAR */}
            <div className="bg-white rounded-2xl shadow p-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{activeTab === 'dashboard' ? 'Overview' : activeTab === 'reservations' ? 'Reservations' : activeTab === 'pos' ? 'Restaurant POS' : 'Table Map'}</h2>
                <span className="text-sm text-slate-500">Front desk control center</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                  <Search size={16} />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search menu..." className="bg-transparent outline-none text-sm" />
                </div>

                <button 
                  onClick={() => toast.info('Opening staff view...')}
                  className="p-2 rounded-lg hover:bg-slate-100"
                  type="button"
                >
                  <Users size={18}/>
                </button>
                <button 
                  onClick={() => toast.info('Opening payments...')}
                  className="p-2 rounded-lg hover:bg-slate-100"
                  type="button"
                >
                  <CreditCard size={18}/>
                </button>
              </div>
            </div>

            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <LogIn className="h-8 w-8 text-green-600" />
                      <span className="text-2xl font-bold">{todayStats.checkInsToday}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Check-ins Today</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <LogOut className="h-8 w-8 text-red-600" />
                      <span className="text-2xl font-bold">{todayStats.checkOutsToday}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Check-outs Today</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <Clock className="h-8 w-8 text-blue-600" />
                      <span className="text-2xl font-bold">{todayStats.arrivalsExpected}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Expected Arrivals</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <AlertCircle className="h-8 w-8 text-yellow-600" />
                      <span className="text-2xl font-bold">{todayStats.occupiedRooms}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Occupied Rooms</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-3 gap-4">
                  <button 
                    onClick={() => setShowCheckInModal(true)}
                    className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    type="button"
                  >
                    <CheckCircle className="h-6 w-6 text-green-600 mb-2 mx-auto" />
                    <span className="text-sm text-gray-700">New Check-in</span>
                  </button>
                  <button 
                    onClick={() => setShowCheckOutModal(true)}
                    className="p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    type="button"
                  >
                    <LogOut className="h-6 w-6 text-red-600 mb-2 mx-auto" />
                    <span className="text-sm text-gray-700">Check-out</span>
                  </button>
                  <button 
                    onClick={() => toast.info('Opening schedule...')}
                    className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    type="button"
                  >
                    <Calendar className="h-6 w-6 text-blue-600 mb-2 mx-auto" />
                    <span className="text-sm text-gray-700">View Schedule</span>
                  </button>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-4">
                    {recentActivities.map(activity => (
                      <div key={activity.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {activity.type === 'check-in' ? (
                            <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                              <LogIn className="h-4 w-4" />
                            </div>
                          ) : activity.type === 'check-out' ? (
                            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                              <LogOut className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                              <Calendar className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{activity.guest}</p>
                            <p className="text-xs text-gray-500">Room {activity.room}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">{activity.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* RESERVATIONS TAB */}
            {activeTab === 'reservations' && (
              <section className="bg-white rounded-2xl shadow p-4">
                <h3 className="font-semibold mb-3">Reservations</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-500 text-sm">
                        <th className="py-2">Name</th>
                        <th>Room</th>
                        <th>Party</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reservations.map((r: Reservation) => (
                        <tr key={r.id} className="py-2">
                          <td className="py-3"><div className="font-medium">{r.name}</div></td>
                          <td>{r.room}</td>
                          <td>{r.pax}</td>
                          <td>{r.time}</td>
                          <td><span className={`px-2 py-1 rounded-full text-xs ${r.status==='Arrived'?'bg-green-100 text-green-700':r.status==='Reserved'?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>{r.status}</span></td>
                          <td className="text-right">
                            <button 
                              onClick={() => setReservations((prev: Reservation[]) => prev.map(x => x.id===r.id?{...x,status:'Arrived'}:x))}
                              className="text-sm px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 mr-2"
                              type="button"
                            >
                              Mark Arrived
                            </button>
                            <button 
                              onClick={() => setReservations((prev: Reservation[]) => prev.filter(x => x.id!==r.id))}
                              className="text-sm px-3 py-1 rounded-lg bg-red-50 text-red-700"
                              type="button"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* POS TAB */}
            {activeTab === 'pos' && (
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Menu */}
                <div className="md:col-span-2 bg-white rounded-2xl shadow p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Menu</h3>
                    <div className="text-sm text-slate-400">{filteredMenu.length} items</div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredMenu.map((item: MenuItem) => (
                      <div key={item.id} className="border rounded-xl p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-slate-500">Ksh {item.price}</div>
                        </div>
                        <div className="text-xs text-slate-400">{item.category}</div>
                        <div className="mt-2 flex gap-2">
                          <button 
                            onClick={() => addToCart(item)} 
                            className="flex-1 py-2 rounded-lg bg-indigo-600 text-white"
                            type="button"
                          >
                            Add
                          </button>
                          <button 
                            onClick={() => addToCart(item)} 
                            className="py-2 rounded-lg border px-3"
                            type="button"
                          >
                            Quick
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cart */}
                <aside className="bg-white rounded-2xl shadow p-4">
                  <h3 className="font-semibold">Order Cart</h3>
                  <div className="mt-3 divide-y">
                    {cart.length===0 && <div className="text-slate-400 py-6 text-center">No items yet</div>}
                    {cart.map((item: CartItem) => (
                      <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-slate-400">Ksh {item.price} • {item.qty}x</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => changeQty(item.id, -1)} 
                            className="px-2 py-1 rounded-md border"
                            type="button"
                          >
                            -
                          </button>
                          <div className="w-6 text-center">{item.qty}</div>
                          <button 
                            onClick={() => changeQty(item.id, +1)} 
                            className="px-2 py-1 rounded-md border"
                            type="button"
                          >
                            +
                          </button>
                          <button 
                            onClick={() => removeFromCart(item.id)} 
                            className="p-2 rounded-md hover:bg-slate-100"
                            type="button"
                          >
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-slate-600">
                      <div className="text-sm">Subtotal</div>
                      <div className="font-semibold">Ksh {cartTotal}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button 
                        onClick={checkout} 
                        className="py-2 rounded-lg bg-emerald-600 text-white flex items-center justify-center gap-2"
                        type="button"
                      >
                        <CheckCircle size={16}/> Pay
                      </button>
                      <button 
                        onClick={() => setCart([])} 
                        className="py-2 rounded-lg border"
                        type="button"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </aside>
              </section>
            )}

            {/* TABLES TAB */}
            {activeTab === 'tables' && (
              <section className="bg-white rounded-2xl shadow p-4">
                <h3 className="font-semibold mb-3">Table Map</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({length:8}).map((_, i: number) => {
                    const t: TableData = { id: i+1, name: `T${i+1}`, status: i%3===0 ? 'occupied' : i%3===1 ? 'reserved' : 'free' }
                    return (
                      <div key={t.id} className="p-3 rounded-xl border flex items-center justify-between">
                        <div>
                          <div className="font-medium">{t.name}</div>
                          <div className="text-sm text-slate-400">{t.status}</div>
                        </div>
                        <div>
                          <Circle size={18} className={`${t.status==='free'?'text-green-400':t.status==='reserved'?'text-yellow-400':'text-red-400'}`}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </main>

          {/* RIGHT SIDEBAR */}
          <aside className="hidden lg:block col-span-3 bg-white rounded-2xl shadow p-4">
            <h4 className="font-semibold">Quick Actions</h4>
            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={() => setShowRoomServiceModal(true)}
                className="py-2 rounded-lg bg-indigo-50 text-indigo-700 flex items-center gap-2 justify-center"
                type="button"
              >
                <Coffee size={16}/> Room Service
              </button>
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="py-2 rounded-lg bg-emerald-50 text-emerald-700 flex items-center gap-2 justify-center"
                type="button"
              >
                <DollarSign size={16}/> Generate Invoice
              </button>
              <button
                onClick={() => setShowEventModal(true)}
                className="py-2 rounded-lg bg-yellow-50 text-yellow-700 flex items-center gap-2 justify-center"
                type="button"
              >
                <Calendar size={16}/> Add Event
              </button>
            </div>

            <div className="mt-6">
              <h4 className="text-sm text-slate-500">Active Staff</h4>
              <ul className="mt-3 space-y-2">
                <li className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Asha (Reception)</div>
                    <div className="text-xs text-slate-400">Online</div>
                  </div>
                  <div className="text-sm text-slate-400">2m</div>
                </li>
                <li className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Ken (Kitchen)</div>
                    <div className="text-xs text-slate-400">Busy</div>
                  </div>
                  <div className="text-sm text-slate-400">5m</div>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
      {/* Modals */}
      <CheckInModal
        isOpen={showCheckInModal}
        onClose={() => setShowCheckInModal(false)}
      />
      <CheckOutModal
        isOpen={showCheckOutModal}
        onClose={() => setShowCheckOutModal(false)}
      />
      <RoomServiceModal
        isOpen={showRoomServiceModal}
        onClose={() => setShowRoomServiceModal(false)}
      />
      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
      />
      <EventModal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
      />
      <ReservationModal
        isOpen={showReservationModal}
        onClose={() => setShowReservationModal(false)}
      />
    </ProtectedRoute>
  );
}
