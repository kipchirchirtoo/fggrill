import React, { useState } from 'react';
import { 
  User, Calendar, Search, 
  Eye, XCircle, Hotel, Utensils, FileText,
  MapPin
} from 'lucide-react';
import { cn } from '../../utils/cn';

const SAMPLE_BOOKINGS = [
  { id: '1', guest: 'KIPCHIRCHIR ALLANSAMWEL TOO', phone: '+254710944249', room: '312', date: 'Mar 21, 2026', status: 'confirmed' },
  { id: '2', guest: 'KIPCHIRCHIR ALLANSAMWEL TOO', phone: '+254710944249', room: '167', date: 'Mar 19, 2026', status: 'confirmed' },
  { id: '3', guest: 'KIPCHIRCHIR ALLANSAMWEL TOO', phone: '+254710944249', room: '123', date: 'Mar 18, 2026', status: 'checked_in' },
  { id: '4', guest: 'ALLAN TOO', phone: '0710944249', room: '412', date: 'Mar 17, 2026', status: 'confirmed' },
  { id: '5', guest: 'ALLAN TOO', phone: '0710944249', room: '406', date: 'Mar 10, 2026', status: 'confirmed' },
];

export function BookingListPage() {
  const [activeTab, setActiveTab] = useState('hotel');
  const [search, setSearch] = useState('');

  return (
    <div className="max-w-[1400px] mx-auto p-4 space-y-8 animate-in fade-in duration-500">
      
      {/* Header & Description */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-[#1a1a1a] uppercase leading-none">
          Booking Management
        </h1>
        <p className="text-sm font-medium text-gray-400">
           Manage and confirm hotel and restaurant reservations.
        </p>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/50 p-2 rounded-3xl border border-gray-100 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('hotel')}
            className={cn(
              "flex items-center gap-2 rounded-2xl px-6 py-3 text-[10px] font-black tracking-widest uppercase transition-all duration-300",
              activeTab === 'hotel' ? "bg-black text-white shadow-lg" : "text-gray-400 hover:bg-white hover:text-black"
            )}
          >
            <Hotel size={14} />
            Hotel Bookings
          </button>
          <button
            onClick={() => setActiveTab('restaurant')}
            className={cn(
              "flex items-center gap-2 rounded-2xl px-6 py-3 text-[10px] font-black tracking-widest uppercase transition-all duration-300",
              activeTab === 'restaurant' ? "bg-black text-white shadow-lg" : "text-gray-400 hover:bg-white hover:text-black"
            )}
          >
            <Utensils size={14} />
            Restaurant
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={cn(
              "flex items-center gap-2 rounded-2xl px-6 py-3 text-[10px] font-black tracking-widest uppercase transition-all duration-300",
              activeTab === 'invoices' ? "bg-black text-white shadow-lg" : "text-gray-400 hover:bg-white hover:text-black"
            )}
          >
            <FileText size={14} />
            Invoices
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search guest or room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-white rounded-2xl border border-gray-100 text-xs font-bold tracking-wider outline-none focus:ring-4 focus:ring-black/5 transition-all"
          />
        </div>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {SAMPLE_BOOKINGS.filter(b => b.guest.toLowerCase().includes(search.toLowerCase()) || b.room.includes(search)).map((booking) => (
          <div 
            key={booking.id}
            className="group flex flex-col lg:flex-row items-center justify-between gap-8 bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-xl hover:translate-x-1"
          >
            {/* Guest Info */}
            <div className="flex items-center gap-6 flex-1 min-w-0">
               <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 shadow-inner group-hover:scale-110 transition-transform duration-300">
                 <User size={24} />
               </div>
               <div className="flex flex-col min-w-0">
                 <h3 className="text-sm font-black text-[#1a1a1a] uppercase truncate tracking-tight">
                   {booking.guest}
                 </h3>
                 <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5 uppercase mt-1">
                   <span className="inline-block p-1 bg-gray-100 rounded-md">📞</span>
                   {booking.phone}
                 </p>
               </div>
            </div>

            {/* Room Info */}
            <div className="flex flex-col lg:items-center">
              <span className="text-[10px] font-black tracking-widest text-gray-300 uppercase leading-none">ROOM</span>
              <span className="text-xl font-black text-gray-600 mt-1">{booking.room}</span>
            </div>

            {/* Date Info */}
            <div className="flex flex-col lg:items-center">
              <span className="text-[10px] font-black tracking-widest text-gray-300 uppercase leading-none">CHECK-IN</span>
              <span className="text-sm font-black text-gray-600 mt-1 uppercase">{booking.date}</span>
            </div>

            {/* Status Badge */}
            <div className="flex flex-col lg:items-center">
              <span className="text-[10px] font-black tracking-widest text-gray-300 uppercase leading-none mb-2">STATUS</span>
              <span className={cn(
                "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest",
                booking.status === 'confirmed' ? "bg-green-50 text-green-600 border border-green-100" : "bg-gray-100 text-gray-600 border border-gray-200"
              )}>
                {booking.status.replace('_', ' ')}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 rounded-xl bg-blue-50 px-5 py-2.5 text-[10px] font-black tracking-widest text-blue-600 uppercase transition-all duration-300 hover:bg-blue-600 hover:text-white border border-blue-100">
                <Eye size={14} />
                View Details
              </button>
              {booking.status !== 'checked_in' && (
                <button className="flex items-center gap-2 rounded-xl bg-red-50 px-5 py-2.5 text-[10px] font-black tracking-widest text-red-600 uppercase transition-all duration-300 hover:bg-red-600 hover:text-white border border-red-100">
                  <XCircle size={14} />
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
