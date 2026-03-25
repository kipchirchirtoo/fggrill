import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppStateProvider';
import { useAuth } from '../hooks/useAuth';
import { ROLE_NAV_MAP } from '../constants/roles';
import { cn } from '../utils/cn';

export function Sidebar() {
  const { session } = useAppState();
  const { logout } = useAuth();

  const navItems = session ? (ROLE_NAV_MAP[session.role] ?? ROLE_NAV_MAP['default']) : [];

  return (
    <aside className="flex w-72 flex-col bg-white border-r border-gray-100 shadow-sm transition-all duration-300">
      {/* Logo Area */}
      <div className="flex flex-col gap-1 p-6 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 p-2 shadow-sm border border-gray-100">
             <img src="/favicon.svg" alt="FG Logo" className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-black tracking-tight text-[#1a1a1a] uppercase leading-tight">
              Famous Gates Hotels
            </h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
              Management System
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold uppercase tracking-tight transition-all duration-200',
                isActive
                  ? 'bg-[#fad59e]/20 text-[#854d0e] shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-black'
              )
            }
          >
            <span className={cn(
              "text-lg transition-transform group-hover:scale-110",
              "flex items-center justify-center w-6 h-6"
            )}>
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-gray-50 bg-gray-50/30">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm border border-gray-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 shadow-inner">
             <span className="text-xs font-black uppercase">
                {session?.email?.[0] ?? 'U'}
             </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-[#1a1a1a] uppercase truncate">
              {session?.user_id?.substring(0, 8) ?? 'Administrator'}
            </p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">
              {session?.role?.replace(/_/g, ' ') ?? 'User Role'}
            </p>
          </div>
          <button
            onClick={logout}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-200"
            title="Secure Logout"
          >
            <span className="text-lg">⏻</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
