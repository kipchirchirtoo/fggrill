'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Calendar,
  Users,
  MapPin,
  Star,
  CheckCircle,
  Phone,
  Mail,
  Clock,
  CreditCard,
  Wifi,
  Coffee,
  Car,
  Utensils,
  ChevronRight,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Room {
  id: string;
  roomNumber: string;
  type: string;
  capacity: number;
  pricePerNight: number;
  amenities: string[];
  imageUrl: string;
  available: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Set default dates
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    setCheckIn(format(today, 'yyyy-MM-dd'));
    setCheckOut(format(tomorrow, 'yyyy-MM-dd'));
  }, []);

  const handleSearch = async () => {
    if (!checkIn || !checkOut) {
      toast.error('Please select check-in and check-out dates');
      return;
    }

    setIsSearching(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(
        `${API_URL}/api/bookings/available?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`
      );
      const data = await response.json();
      
      if (data.success) {
        setRooms(data.data);
      } else {
        toast.error('Failed to search rooms');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search rooms');
    } finally {
      setIsSearching(false);
    }
  };

  const handleBookRoom = (roomId: string) => {
    router.push(
      `/booking?roomId=${roomId}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`
    );
  };

  const features = [
    {
      icon: Wifi,
      title: 'Free WiFi',
      description: 'High-speed internet throughout the property'
    },
    {
      icon: Coffee,
      title: 'Restaurant & Bar',
      description: 'Delicious local and international cuisine'
    },
    {
      icon: Car,
      title: 'Free Parking',
      description: 'Secure parking for all guests'
    },
    {
      icon: Clock,
      title: '24/7 Service',
      description: 'Round-the-clock front desk assistance'
    }
  ];

  const branches = [
    {
      name: 'Famous Gate Bomet (Central)',
      location: 'Bomet Town',
      phone: '+254 700 000 001',
      email: 'bomet@famousgate.co.ke'
    },
    {
      name: 'Famous Gate Kericho',
      location: 'Kericho Town',
      phone: '+254 700 000 002',
      email: 'kericho@famousgate.co.ke'
    },
    {
      name: 'Famous Gate Kapsoit',
      location: 'Kapsoit Center',
      phone: '+254 700 000 003',
      email: 'kapsoit@famousgate.co.ke'
    },
    {
      name: 'Famous Gate Litein',
      location: 'Litein Town',
      phone: '+254 700 000 004',
      email: 'litein@famousgate.co.ke'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/fglogo.png"
                alt="Famous Gate Hotel Logo"
                width={48}
                height={48}
                priority
                className="object-contain"
                style={{ width: 'auto', height: 'auto' }}
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Famous Gate Hotel</h1>
                <p className="text-sm text-gray-600">Your Home Away From Home</p>
              </div>
            </div>
            <nav className="flex items-center gap-6">
              <a href="#rooms" className="text-gray-700 hover:text-gray-900 font-medium">Rooms</a>
              <a href="#amenities" className="text-gray-700 hover:text-gray-900 font-medium">Amenities</a>
              <a href="#locations" className="text-gray-700 hover:text-gray-900 font-medium">Locations</a>
              <a href="#contact" className="text-gray-700 hover:text-gray-900 font-medium">Contact</a>
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-2 bg-gray-900 text-white rounded-ios-lg hover:bg-gray-800 transition-colors"
              >
                Staff Login
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gray-100 py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h2 className="text-5xl font-bold text-gray-900 mb-4">
              Experience Comfort & Hospitality
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Book your perfect stay at any of our 6 branches across Kenya. 
              Enjoy premium amenities and exceptional service.
            </p>
          </motion.div>

          {/* Booking Search Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg p-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline w-4 h-4 mr-2" />
                  Check-in
                </label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline w-4 h-4 mr-2" />
                  Check-out
                </label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="inline w-4 h-4 mr-2" />
                  Guests
                </label>
                <select
                  value={guests}
                  onChange={(e) => setGuests(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? 'Guest' : 'Guests'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="w-full px-6 py-3 bg-gray-900 text-white rounded-ios-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Search className="w-5 h-5" />
                  {isSearching ? 'Searching...' : 'Search Rooms'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Available Rooms */}
      {rooms.length > 0 && (
        <section id="rooms" className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Available Rooms
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {rooms.map((room) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="h-48 bg-gray-200 flex items-center justify-center">
                    <span className="text-4xl">🏨</span>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xl font-bold text-gray-900">
                        {room.type}
                      </h4>
                      <span className="text-sm text-gray-600">
                        Room {room.roomNumber}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-4">
                      <Users className="inline w-4 h-4 mr-1" />
                      Up to {room.capacity} guests
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {room.amenities?.slice(0, 3).map((amenity, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div>
                        <span className="text-2xl font-bold text-gray-900">
                          KES {room.pricePerNight.toLocaleString()}
                        </span>
                        <span className="text-gray-600 text-sm ml-2">/ night</span>
                      </div>
                      <button
                        onClick={() => handleBookRoom(room.id)}
                        className="px-6 py-2 bg-gray-900 text-white rounded-ios-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
                      >
                        Book Now
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section id="amenities" className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-gray-900 mb-12 text-center">
            Premium Amenities
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-6 rounded-xl border border-gray-200 text-center"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-8 h-8 text-gray-900" />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">
                  {feature.title}
                </h4>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Locations */}
      <section id="locations" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-gray-900 mb-12 text-center">
            Our Locations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {branches.map((branch, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white border border-gray-200 rounded-xl p-6"
              >
                <h4 className="text-lg font-bold text-gray-900 mb-4">
                  {branch.name}
                </h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{branch.location}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <a href={`tel:${branch.phone}`} className="text-gray-700 hover:text-gray-900">
                      {branch.phone}
                    </a>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <a href={`mailto:${branch.email}`} className="text-gray-700 hover:text-gray-900">
                      {branch.email}
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section id="contact" className="py-16 bg-gray-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-4">
            Ready to Book Your Stay?
          </h3>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Contact us today to make a reservation or learn more about our services.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="tel:+254700000000"
              className="px-8 py-3 bg-white text-gray-900 rounded-ios-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Call Us Now
            </a>
            <a
              href="mailto:info@famousgate.co.ke"
              className="px-8 py-3 border border-white text-white rounded-ios-lg hover:bg-white hover:text-gray-900 transition-colors font-medium"
            >
              Email Us
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <p className="text-gray-600">
                © 2024 Famous Gate Hotel. All rights reserved.
              </p>
            </div>
            <div className="flex gap-6">
              <a href="#" className="text-gray-600 hover:text-gray-900">Privacy Policy</a>
              <a href="#" className="text-gray-600 hover:text-gray-900">Terms of Service</a>
              <a href="#" className="text-gray-600 hover:text-gray-900">FAQ</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
