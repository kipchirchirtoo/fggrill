'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Briefcase, ChevronRight, Loader2, LogOut } from 'lucide-react';
import { useAuth, UserRoleAssignment } from '@/lib/auth-context';

// Human-readable labels for common roles
const ROLE_LABELS: Record<string, string> = {
  accountant: 'Accountant',
  branch_accountant: 'Branch Accountant',
  branch_manager: 'Branch Manager',
  cashier: 'Cashier',
  receptionist: 'Receptionist',
  waiter: 'Waiter',
  waitress: 'Waitress',
  head_waiter: 'Head Waiter',
  bartender: 'Bartender',
  barman: 'Barman',
  barmaid: 'Barmaid',
  bar_manager: 'Bar Manager',
  chef: 'Chef',
  head_chef: 'Head Chef',
  cook: 'Cook',
  kitchen: 'Kitchen Staff',
  housekeeping: 'Housekeeping',
  housekeeping_supervisor: 'Housekeeping Supervisor',
  maintenance: 'Maintenance',
  procurement: 'Procurement',
  storekeeper: 'Storekeeper',
  branch_storekeeper: 'Branch Storekeeper',
  hr_manager: 'HR Manager',
  employee: 'Employee',
  driver: 'Driver',
};

const roleLabel = (role: string) =>
  ROLE_LABELS[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

interface ContextSelectorModalProps {
  allRoles: UserRoleAssignment[];
  userName: string;
}

export function ContextSelectorModal({ allRoles, userName }: ContextSelectorModalProps) {
  const { selectContext, logout } = useAuth();
  const [selected, setSelected] = useState<{ role: string; branch_id: number | null } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = async (role: string, branchId: number | null) => {
    setSelected({ role, branch_id: branchId });
    setIsLoading(true);
    try {
      await selectContext(role, branchId);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative w-full max-w-md z-10"
      >
        {/* Card */}
        <div className="bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/30 overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-5 bg-stone-900 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Welcome back</p>
                <h2 className="text-lg font-black text-white leading-tight">{userName}</h2>
              </div>
            </div>
            <p className="text-sm font-semibold text-white/70 leading-relaxed">
              You have multiple role assignments. Select where you want to enter.
            </p>
          </div>

          {/* Role list */}
          <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
            <AnimatePresence>
              {allRoles.map((assignment, idx) => {
                const isSelected =
                  selected?.role === assignment.role &&
                  selected?.branch_id === assignment.branch_id;
                const branchName = assignment.branches?.name || (assignment.branch_id ? `Branch #${assignment.branch_id}` : 'All Branches');

                return (
                  <motion.button
                    key={`${assignment.role}-${assignment.branch_id}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleSelect(assignment.role, assignment.branch_id)}
                    disabled={isLoading}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-100 bg-stone-50 hover:border-stone-300 hover:bg-white text-stone-900'
                    } ${isLoading && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-white/15' : 'bg-white border border-stone-200'
                    }`}>
                      {isSelected && isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                      ) : (
                        <Building2 className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-stone-600'}`} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                        {roleLabel(assignment.role)}
                      </p>
                      <p className={`text-xs font-semibold mt-0.5 ${isSelected ? 'text-white/70' : 'text-stone-500'}`}>
                        {branchName}
                      </p>
                      {assignment.is_primary && (
                        <span className={`inline-block text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                        }`}>
                          Primary
                        </span>
                      )}
                    </div>

                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-stone-400'}`} />
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-stone-50 border-t border-stone-100">
            <button
              onClick={() => logout('/login')}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-stone-400 hover:text-stone-600 transition-colors py-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out and use a different account
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
