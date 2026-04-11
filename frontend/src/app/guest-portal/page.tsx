'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Bed, UtensilsCrossed, Sparkles, Wrench, Clock, Calendar,
  Phone, Mail, MapPin, Star, Coffee, Wifi, Car, Sun, Moon,
  ChevronRight, Check, X, Loader2, Bell, Heart, MessageSquare,
  CreditCard, FileText, LogOut, User, Settings, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface GuestSession {
  room_number: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  booking_id: string;
}

interface ServiceRequest {
  id: string;
  type: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  description?: string;
}

const QUICK_SERVICES = [
  { id: 'housekeeping', icon: Sparkles, label: 'Housekeeping', description: 'Room cleaning & turndown' },
  { id: 'room_service', icon: UtensilsCrossed, label: 'Room Service', description: 'Food & beverages' },
  { id: 'maintenance', icon: Wrench, label: 'Maintenance', description: 'Report an issue' },
  { id: 'concierge', icon: Bell, label: 'Concierge', description: 'Tours & reservations' },
  { id: 'laundry', icon: Sparkles, label: 'Laundry', description: 'Pickup & delivery' },
  { id: 'transport', icon: Car, label: 'Transport', description: 'Airport & taxi' }
];

const HOUSEKEEPING_OPTIONS = [
  { id: 'clean_now', label: 'Clean My Room Now', icon: Sparkles },
  { id: 'turndown', label: 'Turndown Service', icon: Moon },
  { id: 'extra_towels', label: 'Extra Towels', icon: Home },
  { id: 'extra_pillows', label: 'Extra Pillows', icon: Bed },
  { id: 'dnd', label: 'Do Not Disturb', icon: X },
  { id: 'make_up', label: 'Make Up Room', icon: Sun }
];

export default function GuestPortal() {
  const [session, setSession] = useState<GuestSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  
  // Login form
  const [roomNumber, setRoomNumber] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Service modals
  const [activeService, setActiveService] = useState<string | null>(null);
  const [serviceNote, setServiceNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Check for existing session
    const savedSession = localStorage.getItem('guest_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setSession(parsed);
        setIsAuthenticated(true);
        fetchRequests(parsed.room_number);
      } catch {
        localStorage.removeItem('guest_session');
      }
    }
    setIsLoading(false);
  }, []);

  const handleLogin = async () => {
    if (!roomNumber || !lastName) {
      toast.error('Please enter your room number and last name');
      return;
    }

    setIsLoggingIn(true);
    try {
      // In production, this would verify against the booking system
      // For demo, we'll simulate a successful login
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockSession: GuestSession = {
        room_number: roomNumber,
        guest_name: lastName,
        check_in: new Date().toISOString(),
        check_out: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        booking_id: `BK-${Date.now()}`
      };

      localStorage.setItem('guest_session', JSON.stringify(mockSession));
      setSession(mockSession);
      setIsAuthenticated(true);
      toast.success(`Welcome, ${lastName}!`);
    } catch (error) {
      toast.error('Invalid room number or name');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('guest_session');
    setSession(null);
    setIsAuthenticated(false);
    setRoomNumber('');
    setLastName('');
  };

  const fetchRequests = async (room: string) => {
    try {
      // In production, fetch from API
      // Mock data for demo
      setRequests([
        { id: '1', type: 'housekeeping', status: 'completed', created_at: new Date(Date.now() - 3600000).toISOString(), description: 'Room cleaning' },
        { id: '2', type: 'room_service', status: 'in_progress', created_at: new Date(Date.now() - 1800000).toISOString(), description: 'Breakfast order' }
      ]);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const submitServiceRequest = async (serviceType: string, details?: string) => {
    setIsSubmitting(true);
    try {
      // In production, this would call the API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newRequest: ServiceRequest = {
        id: Date.now().toString(),
        type: serviceType,
        status: 'pending',
        created_at: new Date().toISOString(),
        description: details
      };

      setRequests(prev => [newRequest, ...prev]);
      toast.success('Request submitted! We\'ll be there shortly.');
      setActiveService(null);
      setServiceNote('');
    } catch (error) {
      toast.error('Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-2xl flex items-center justify-center shadow-xl">
              <Home className="h-10 w-10 text-gray-800" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Guest Portal</h1>
            <p className="text-gray-400">Famous Gates Hotels & Lounge</p>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-xl font-semibold font-sf-pro-display mb-4 text-center">Welcome Back</h2>
            <p className="text-gray-500 text-center mb-6">
              Enter your room number and last name to access services
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Room Number</label>
                <Input
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g., 101"
                  className="text-center text-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Last Name</label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Your last name"
                  className="text-center"
                />
              </div>
              <IOSButton
                className="w-full bg-gray-900 hover:bg-black text-white py-3"
                onClick={handleLogin}
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <User className="h-5 w-5 mr-2" />
                    Access My Room
                  </>
                )}
              </IOSButton>
            </div>

            <p className="text-xs text-gray-400 text-center mt-4">
              Need help? Call reception at ext. 0
            </p>
          </IOSCard>
        </motion.div>
      </div>
    );
  }

  // Main Portal
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">Room {session?.room_number}</h1>
            <p className="text-sm text-gray-500">Welcome, {session?.guest_name}</p>
          </div>
          <IOSButton variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
          </IOSButton>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Stay Info */}
        <IOSCard className="p-4 bg-gradient-to-br from-gray-800 to-gray-900 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-gray-400 text-sm">Your Stay</p>
              <p className="text-2xl font-bold">Room {session?.room_number}</p>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <Bed className="h-6 w-6" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-xs">Check-in</p>
              <p className="font-medium">{session?.check_in ? new Date(session.check_in).toLocaleDateString() : '-'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Check-out</p>
              <p className="font-medium">{session?.check_out ? new Date(session.check_out).toLocaleDateString() : '-'}</p>
            </div>
          </div>
        </IOSCard>

        {/* Quick Actions */}
        <div>
          <h2 className="font-semibold font-sf-pro-display text-gray-900 mb-3">Quick Services</h2>
          <div className="grid grid-cols-3 gap-3">
            {QUICK_SERVICES.map(service => (
              <motion.button
                key={service.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveService(service.id)}
                className="p-4 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 mx-auto mb-2 bg-gray-100 rounded-xl flex items-center justify-center">
                  <service.icon className="h-6 w-6 text-gray-700" />
                </div>
                <p className="font-medium text-sm text-gray-900">{service.label}</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Active Requests */}
        {requests.length > 0 && (
          <div>
            <h2 className="font-semibold font-sf-pro-display text-gray-900 mb-3">Your Requests</h2>
            <IOSCard className="divide-y">
              {requests.map(request => (
                <div key={request.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getStatusColor(request.status)}`}>
                      {request.status === 'completed' ? (
                        <Check className="h-5 w-5" />
                      ) : request.status === 'in_progress' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{request.type.replace('_', ' ')}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <IOSBadge className={getStatusColor(request.status)}>
                    {request.status.replace('_', ' ')}
                  </IOSBadge>
                </div>
              ))}
            </IOSCard>
          </div>
        )}

        {/* Hotel Info */}
        <IOSCard className="p-4">
          <h3 className="font-semibold font-sf-pro-display mb-3">Hotel Information</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-gray-400" />
              <span>Reception: Dial 0</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Wifi className="h-4 w-4 text-gray-400" />
              <span>WiFi: kyogong_Guest</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <UtensilsCrossed className="h-4 w-4 text-gray-400" />
              <span>Restaurant: 7AM - 10PM</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Coffee className="h-4 w-4 text-gray-400" />
              <span>Room Service: 24 Hours</span>
            </div>
          </div>
        </IOSCard>

        {/* Feedback */}
        <IOSCard className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Star className="h-6 w-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold font-sf-pro-display text-amber-900">How's your stay?</p>
              <p className="text-sm text-amber-700">Share your feedback with us</p>
            </div>
            <ChevronRight className="h-5 w-5 text-amber-600" />
          </div>
        </IOSCard>
      </div>

      {/* Service Modal */}
      <Dialog open={!!activeService} onOpenChange={() => setActiveService(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {activeService?.replace('_', ' ')} Request
            </DialogTitle>
          </DialogHeader>

          {activeService === 'housekeeping' && (
            <div className="space-y-3">
              {HOUSEKEEPING_OPTIONS.map(option => (
                <button
                  key={option.id}
                  onClick={() => submitServiceRequest('housekeeping', option.label)}
                  disabled={isSubmitting}
                  className="w-full p-4 bg-gray-50 rounded-xl flex items-center gap-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-10 h-10 bg-white rounded-ios-lg flex items-center justify-center shadow-sm">
                    <option.icon className="h-5 w-5 text-gray-700" />
                  </div>
                  <span className="font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          )}

          {activeService !== 'housekeeping' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  How can we help?
                </label>
                <textarea
                  value={serviceNote}
                  onChange={(e) => setServiceNote(e.target.value)}
                  placeholder="Describe your request..."
                  className="w-full px-3 py-2 border rounded-ios-lg resize-none"
                  rows={4}
                />
              </div>
              <IOSButton
                className="w-full bg-gray-900"
                onClick={() => submitServiceRequest(activeService!, serviceNote)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    Submit Request
                  </>
                )}
              </IOSButton>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
