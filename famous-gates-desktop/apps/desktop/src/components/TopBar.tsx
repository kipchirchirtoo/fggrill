import React from 'react';
import { useAppState } from '../state/AppStateProvider';
import { bridge } from '../bridge';
import { Bell, User, RefreshCw, Menu, Wifi, WifiOff, Database } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export function TopBar() {
  const { network, sync } = useAppState();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Command Center';
    if (path.includes('/restaurant')) return 'Restaurant Management';
    if (path.includes('/bookings')) return 'Reservation Engine';
    return 'Famous Gate Hotels';
  };

  return (
    <header className="flex h-20 items-center justify-between bg-white border-b border-gray-100 px-8 shadow-sm">
      {/* Left side: Menu toggle and indicators */}
      <div className="flex items-center gap-6">
        <button className="text-gray-400 hover:text-black transition-colors">
          <Menu size={24} />
        </button>

        <div className="flex items-center gap-4">
           {/* Sync Status Badge */}
           {sync.outbox_count > 0 && (
             <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black tracking-widest text-amber-600 uppercase border border-amber-100 animate-pulse">
               <Database size={12} />
               {sync.outbox_count} PENDING DATA
             </div>
           )}

           {/* Network Indicator */}
           <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black tracking-widest uppercase border ${
             network.is_online 
               ? 'bg-green-50 text-green-600 border-green-100' 
               : 'bg-red-50 text-red-600 border-red-100'
           }`}>
             {network.is_online ? <Wifi size={12} /> : <WifiOff size={12} />}
             {network.is_online ? 'SYNC ACTIVE' : 'OFFLINE MODE'}
           </div>
        </div>
      </div>

      {/* Center: Page Title */}
      <div className="flex flex-col items-center">
        <h1 className="text-xl font-black tracking-tight text-[#1a1a1a] uppercase leading-none">
          {getPageTitle()}
        </h1>
        <p className="mt-1 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
           {location.pathname === '/dashboard' ? 'Superadmin oversight and system control' : 'Real-time operational stream'}
        </p>
      </div>

      {/* Right side: Actions and Profile */}
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-[10px] font-black tracking-widest text-gray-600 uppercase hover:bg-black hover:text-white transition-all duration-300">
           <RefreshCw size={14} />
           <span className="hidden sm:inline">Refresh Pulse</span>
        </button>

        <div className="h-8 w-px bg-gray-100 mx-1" />

        <button 
          onClick={() => window.location.href = '/'}
          className="flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-[10px] font-black tracking-widest text-white uppercase hover:bg-stone-800 transition-all duration-300 shadow-md"
          title="Return to Native Shell Options"
        >
          <User size={14} />
          <span className="hidden sm:inline">Dashboard</span>
        </button>
      </div>
    </header>
  );
}
