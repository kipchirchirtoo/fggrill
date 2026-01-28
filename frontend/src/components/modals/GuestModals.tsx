'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, User, Mail, Phone, MapPin, Hash, Building,
  Briefcase, Star, MessageSquare, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { guestAPI } from '@/lib/api';

interface GuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  mode?: 'create' | 'edit';
}

export function GuestModal({ isOpen, onClose, initialData, mode = 'create' }: GuestModalProps): JSX.Element | null {
  const [step, setStep] = useState(1);
  const [guestData, setGuestData] = useState(initialData || {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    idNumber: '',
    nationality: '',
    address: '',
    company: '',
    vipStatus: false,
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setGuestData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        first_name: guestData.firstName,
        last_name: guestData.lastName,
        email: guestData.email,
        phone_number: guestData.phone,
        id_number: guestData.idNumber,
        nationality: guestData.nationality,
        address: guestData.address,
        company: guestData.company,
        vip_status: guestData.vipStatus,
        notes: guestData.notes
      };
      if (mode === 'edit' && initialData?.id) {
        await guestAPI.updateGuest(initialData.id, payload);
      } else {
        await guestAPI.createGuest(payload);
      }
      toast.success('Guest ' + (mode === 'create' ? 'created' : 'updated') + ' successfully!');
      onClose();
      setStep(1);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save guest');
    }
  };

  if (!isOpen) return null;

  const steps = [
    { title: 'Personal Info', icon: <User className="h-4 w-4" /> },
    { title: 'Documents', icon: <Hash className="h-4 w-4" /> },
    { title: 'Additional', icon: <MapPin className="h-4 w-4" /> }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 font-sf-pro-display">
              {mode === 'create' ? 'Add New Guest' : 'Edit Guest'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${i + 1 <= step ? 'w-8 bg-indigo-600' : 'w-4 bg-gray-200'}`}
                />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-[280px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-2">
                  <User className="h-5 w-5" />
                  <span>Personal Information</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={guestData.firstName}
                      onChange={handleChange}
                      placeholder="e.g. John"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={guestData.lastName}
                      onChange={handleChange}
                      placeholder="e.g. Doe"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 ml-1">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={guestData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 ml-1">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={guestData.phone}
                    onChange={handleChange}
                    placeholder="+254..."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-2">
                  <Hash className="h-5 w-5" />
                  <span>Documents & Origin</span>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 ml-1">ID/Passport Number</label>
                  <input
                    type="text"
                    name="idNumber"
                    value={guestData.idNumber}
                    onChange={handleChange}
                    placeholder="Enter ID number"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 ml-1">Nationality</label>
                  <input
                    type="text"
                    name="nationality"
                    value={guestData.nationality}
                    onChange={handleChange}
                    placeholder="e.g. Kenyan"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 ml-1">Company (Optional)</label>
                  <input
                    type="text"
                    name="company"
                    value={guestData.company}
                    onChange={handleChange}
                    placeholder="Company name"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-2">
                  <MapPin className="h-5 w-5" />
                  <span>Additional Details</span>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 ml-1">Full Address</label>
                  <textarea
                    name="address"
                    value={guestData.address}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Enter residential address"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 ml-1">Notes</label>
                  <textarea
                    name="notes"
                    value={guestData.notes}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Preferences, requirements, etc."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
                  <input
                    type="checkbox"
                    id="vipStatus"
                    name="vipStatus"
                    checked={guestData.vipStatus}
                    onChange={handleChange}
                    className="h-5 w-5 text-indigo-600 rounded-lg border-gray-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="vipStatus" className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                    <Star className="h-4 w-4 fill-indigo-600" />
                    Mark as VIP Guest
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold transition-all"
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex-1 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex-1 px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              {mode === 'create' ? 'Add Guest' : 'Save Changes'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
