'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Search, User, Check, AlertCircle, 
  Loader2, Building2, Briefcase, Filter
} from 'lucide-react';
import { staffAPI } from '@/lib/api';
import { StaffMember } from '@/lib/api/types';
import { toast } from 'sonner';

interface StaffDropdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (staff: StaffMember | StaffMember[]) => void;
  activeBranchId?: string | number | null;
  selectedIds?: (string | number)[];
  isMulti?: boolean;
  title?: string;
  roleFilter?: string;
}

const EMPTY_ARRAY: (string | number)[] = [];

export function StaffDropdownModal({
  isOpen,
  onClose,
  onSelect,
  activeBranchId,
  selectedIds = EMPTY_ARRAY,
  isMulti = false,
  title = "Select Staff Member",
  roleFilter
}: StaffDropdownModalProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [localSelectedIds, setLocalSelectedIds] = useState<(string | number)[]>(selectedIds);

  // Effect 1: Fetch staff data only when modal opens or branch changes
  useEffect(() => {
    if (isOpen) {
      fetchStaff();
      setSearchTerm('');
    }
  }, [isOpen, activeBranchId]);

  // Effect 2: Sync selection state when prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSelectedIds(selectedIds);
    }
  }, [isOpen, selectedIds]);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const params: any = { status: 'active' };
      if (activeBranchId) params.branch_id = activeBranchId;
      if (roleFilter) params.role = roleFilter;

      const response = await staffAPI.getStaff(params);
      if (response.success) {
        setStaff(response.data || []);
      } else {
        toast.error('Failed to load staff members');
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('An error occurred while loading staff');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const fullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
      const role = (s.role || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      return fullName.includes(search) || role.includes(search);
    });
  }, [staff, searchTerm]);

  const toggleSelection = (id: string | number) => {
    if (isMulti) {
      setLocalSelectedIds(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    } else {
      const selectedStaff = staff.find(s => s.id === id);
      if (selectedStaff) {
        onSelect(selectedStaff);
        onClose();
      }
    }
  };

  const handleConfirmMulti = () => {
    const selectedStaff = staff.filter(s => localSelectedIds.includes(s.id));
    onSelect(selectedStaff);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 mb:p-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h2>
              <p className="text-xs font-medium text-gray-500 mt-0.5 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {activeBranchId ? `Branch Isolation Active` : 'All Branches'}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-4 bg-gray-50/50">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or role..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                autoFocus
              />
            </div>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="relative">
                  <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <User className="h-4 w-4 text-indigo-400" />
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-500">Fetching personnel...</p>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-3">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                  <Filter className="h-8 w-8 text-gray-300" />
                </div>
                <div>
                  <p className="text-gray-900 font-bold">No staff found</p>
                  <p className="text-sm text-gray-500 max-w-[200px] mx-auto">Try adjusting your search or check your filter settings.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredStaff.map((person) => {
                  const isSelected = localSelectedIds.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      onClick={() => toggleSelection(person.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group ${
                        isSelected 
                          ? 'bg-indigo-50 border-indigo-200' 
                          : 'hover:bg-gray-50 border-transparent'
                      } border`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-400 group-hover:bg-white group-hover:text-indigo-600'
                      }`}>
                        <User className="h-6 w-6" />
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className={`font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                          {person.first_name} {person.last_name}
                        </p>
                        <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mt-0.5">
                          <Briefcase className="h-3 w-3" />
                          {(person.role || 'Employee').replace(/_/g, ' ')}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center shadow-md">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer - Only for multi-select */}
          {isMulti && (
            <div className="p-6 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={handleConfirmMulti}
                disabled={localSelectedIds.length === 0}
                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-3"
              >
                Confirm Selection ({localSelectedIds.length})
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
