'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Calendar, Users, CheckCircle, BarChart3, User, Mail, Phone,
  CreditCard, Bed, Clock, DollarSign, FileText, Download, Upload,
  Save, AlertCircle, MapPin, Hash, Building, Briefcase, Star,
  MessageSquare, Camera, Wifi, Coffee, Car, Shield, Key, Settings,
  ChevronRight, Edit, Trash2, Eye, Plus, Search, Filter
} from 'lucide-react';
import { toast } from 'sonner';

// ============= NEW BOOKING MODAL =============
export function NewBookingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [bookingData, setBookingData] = useState({
    guestName: '', guestEmail: '', guestPhone: '', idNumber: '',
    nationality: '', roomType: 'Standard', roomNumber: '',
    checkIn: '', checkOut: '', adults: 1, children: 0,
    specialRequests: '', paymentMethod: 'cash', advancePayment: 0
  });

  const handleSubmit = () => {
    toast.success('Booking created successfully!');
    onClose();
    setStep(1);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">New Booking</h2>
            <p className="text-sm text-gray-500">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: ((step / 3) * 100) + '%' }} />
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <User className="h-5 w-5" />
              Guest Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="Full Name" className="px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="email" placeholder="Email" className="px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="tel" placeholder="Phone" className="px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="text" placeholder="ID/Passport" className="px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bed className="h-5 w-5" />
              Room Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <select className="px-3 py-2 border border-gray-300 rounded-lg">
                <option>Standard</option>
                <option>Deluxe</option>
                <option>Suite</option>
              </select>
              <input type="text" placeholder="Room Number" className="px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="date" className="px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="date" className="px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span>Total Amount</span>
                <span className="font-bold">KES 17,400</span>
              </div>
            </div>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option>Cash</option>
              <option>Card</option>
              <option>M-Pesa</option>
            </select>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-6 border-t">
          <button onClick={() => setStep(Math.max(1, step - 1))} className={'px-4 py-2 text-gray-600 ' + (step === 1 ? 'invisible' : '')}>
            Previous
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg">
              Next <ChevronRight className="inline h-4 w-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} className="px-6 py-2 bg-green-600 text-white rounded-lg">
              <CheckCircle className="inline h-4 w-4 mr-2" />
              Complete Booking
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============= ADD GUEST MODAL =============
export function AddGuestModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Guest added successfully!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Add New Guest</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="First Name" required className="px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="text" placeholder="Last Name" required className="px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="email" placeholder="Email" required className="px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="tel" placeholder="Phone" required className="px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600">Cancel</button>
            <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg">
              <Save className="inline h-4 w-4 mr-2" />Add Guest
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ============= CHECK-IN MODAL =============
export function CheckInModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const handleCheckIn = () => {
    toast.success('Guest checked in successfully!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Guest Check-In</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search by booking reference or guest name..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
          
          <div className="border rounded-lg p-4">
            <p className="font-medium">John Smith - BK001</p>
            <p className="text-sm text-gray-600">Deluxe Room • Check-in: Today</p>
            <button onClick={() => setSelectedBooking({ name: 'John Smith' })} className="mt-2 text-indigo-600">
              Select
            </button>
          </div>

          {selectedBooking && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Room Number" className="px-3 py-2 border border-gray-300 rounded-lg" />
                <input type="text" placeholder="Key Card Number" className="px-3 py-2 border border-gray-300 rounded-lg" />
                <input type="number" placeholder="Deposit Amount" className="px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <button onClick={handleCheckIn} className="w-full px-6 py-2 bg-green-600 text-white rounded-lg">
                Complete Check-In
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============= VIEW REPORTS MODAL =============
export function ViewReportsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Reports Dashboard</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
            <BarChart3 className="h-8 w-8 text-indigo-600 mb-2" />
            <h3 className="font-semibold">Revenue Report</h3>
            <p className="text-sm text-gray-600">Monthly revenue analysis</p>
          </div>
          <div className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
            <Users className="h-8 w-8 text-green-600 mb-2" />
            <h3 className="font-semibold">Occupancy Report</h3>
            <p className="text-sm text-gray-600">Room occupancy statistics</p>
          </div>
          <div className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
            <FileText className="h-8 w-8 text-blue-600 mb-2" />
            <h3 className="font-semibold">Guest Report</h3>
            <p className="text-sm text-gray-600">Guest demographics and trends</p>
          </div>
          <div className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
            <DollarSign className="h-8 w-8 text-purple-600 mb-2" />
            <h3 className="font-semibold">Financial Report</h3>
            <p className="text-sm text-gray-600">P&L and financial statements</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t flex justify-end gap-3">
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">
            <Download className="inline h-4 w-4 mr-2" />Export All
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
