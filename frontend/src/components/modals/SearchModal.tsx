'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Search, User, Bed, Calendar, Clock, UtensilsCrossed,
  DollarSign, FileText, Package, ChevronRight
} from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'guest' | 'room' | 'booking' | 'order' | 'payment' | 'invoice' | 'inventory';
  title: string;
  subtitle: string;
  icon: React.ElementType;
  link: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  interface Category {
    id: string;
    name: string;
    icon: React.ElementType;
  }

  const categories: Category[] = [
    { id: 'all', name: 'All', icon: Search },
    { id: 'guests', name: 'Guests', icon: User },
    { id: 'rooms', name: 'Rooms', icon: Bed },
    { id: 'bookings', name: 'Bookings', icon: Calendar },
    { id: 'orders', name: 'Orders', icon: UtensilsCrossed },
    { id: 'payments', name: 'Payments', icon: DollarSign },
    { id: 'invoices', name: 'Invoices', icon: FileText },
    { id: 'inventory', name: 'Inventory', icon: Package }
  ];

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const handleSearch = async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/search?q=${term}${selectedCategory ? `&type=${selectedCategory}` : ''}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();
    setResults(data.data);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="bg-white rounded-xl w-full max-w-2xl mt-16 overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="relative flex items-center">
            <div className="absolute left-4 flex items-center justify-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                handleSearch(e.target.value);
              }}
              placeholder="Search for anything..."
              className={`w-full h-12 pl-12 pr-12 text-base rounded-[1rem] transition-all focus:outline-none focus:ring-2 ${
                searchTerm 
                  ? 'bg-[#007AFF]/5 border-2 border-[#007AFF] text-[#141417] focus:ring-[#007AFF]/30' 
                  : 'bg-[#f5f5f7] border-0 text-[#141417] placeholder:text-gray-400 focus:ring-[#007AFF] focus:bg-white'
              }`}
              autoFocus
            />
            <button
              onClick={onClose}
              className="absolute right-3 p-2 hover:bg-gray-200 rounded-[0.75rem] transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Categories */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id === 'all' ? null : category.id)}
                className={'flex items-center gap-1 px-3 py-1.5 rounded-ios-lg text-sm ' + (((category.id === 'all' && !selectedCategory) || category.id === selectedCategory) ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-100')}
              >
                <category.icon className="h-4 w-4" />
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {searchTerm && (
          <div className="border-t max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Search className="h-8 w-8 mx-auto mb-2" />
                <p>No results found</p>
              </div>
            ) : (
              <div className="divide-y">
                {results.map((result) => (
                  <a
                    key={result.id}
                    href={result.link}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      onClose();
                      window.location.href = result.link;
                    }}
                  >
                    <div className="p-2 bg-gray-100 rounded-ios-lg">
                      <result.icon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{result.title}</p>
                      <p className="text-sm text-gray-500 truncate">{result.subtitle}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Keyboard shortcuts */}
        <div className="p-4 bg-gray-50 border-t">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="px-2 py-1 bg-white rounded shadow">↑</kbd>
                <kbd className="px-2 py-1 bg-white rounded shadow ml-1">↓</kbd>
                to navigate
              </span>
              <span>
                <kbd className="px-2 py-1 bg-white rounded shadow">Enter</kbd>
                to select
              </span>
            </div>
            <span>
              <kbd className="px-2 py-1 bg-white rounded shadow">Esc</kbd>
              to close
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
