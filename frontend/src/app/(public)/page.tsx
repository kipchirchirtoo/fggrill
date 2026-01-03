'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Users,
  MapPin,
  Phone,
  Mail,
  Clock,
  Wifi,
  Coffee,
  Car,
  ChevronRight,
  ChevronDown,
  Search,
  Bed,
  Award,
  Sparkles,
  Shield,
  Utensils,
  ArrowRight,
  Check,
  Loader2,
  X,
  ChevronLeft,
  Eye
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';

interface RoomType {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  capacity: number;
  amenities: string[];
  images?: string[];
  imageUrl?: string;
}

interface AvailableRoom {
  id: string;
  roomNumber: string;
  type: RoomType | string;
  capacity: number;
  pricePerNight: number;
  amenities: string[];
  images?: string[];
}

export default function HomePage() {
  const router = useRouter();
  const bookingRef = useRef<HTMLDivElement>(null);
  const roomsRef = useRef<HTMLDivElement>(null);

  // Form state
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  // Results state
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Sticky booking bar
  const [isBookingSticky, setIsBookingSticky] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Room view modal state
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);
  const [roomViewOpen, setRoomViewOpen] = useState(false);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    document.body.style.overflow = 'auto';
  };

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  // Set default dates
  useEffect(() => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    setCheckIn(format(today, 'yyyy-MM-dd'));
    setCheckOut(format(tomorrow, 'yyyy-MM-dd'));
  }, []);

  // Handle sticky booking bar
  useEffect(() => {
    const handleScroll = () => {
      if (bookingRef.current) {
        const rect = bookingRef.current.getBoundingClientRect();
        setIsBookingSticky(rect.top <= 80);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Search for available rooms using Python Room Service
  const handleSearch = async () => {
    if (!checkIn || !checkOut) {
      toast.error('Please select check-in and check-out dates');
      return;
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
      toast.error('Check-out must be after check-in');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      // Use Node.js backend for room availability
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const totalGuests = adults + children;

      const response = await fetch(
        `${API_URL}/api/bookings/available?checkIn=${checkIn}&checkOut=${checkOut}&guests=${totalGuests}`
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        // Normalize room data from backend
        const normalizedRooms = data.data.map((room: any) => {
          // Handle nested room_types data from Supabase join
          const roomType = room.type || {};
          // Use price_override if set, otherwise use room type's base_price
          const price = room.price_override || roomType.base_price || 5000;
          return {
            id: room.id,
            roomNumber: room.room_number || room.roomNumber,
            type: typeof roomType === 'string' ? roomType : (roomType.name || 'Standard'),
            capacity: roomType.max_occupancy || 2,
            pricePerNight: price,
            amenities: room.amenities || [],
            floor: room.floor,
            description: roomType.description || ''
          };
        });

        setAvailableRooms(normalizedRooms);

        // Scroll to results
        setTimeout(() => {
          roomsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);

        if (normalizedRooms.length === 0) {
          toast.info('No rooms available for selected dates');
        } else {
          const nights = data.nights || Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
          toast.success(`Found ${normalizedRooms.length} room(s) for ${nights} night(s)`);
        }
      } else {
        setAvailableRooms([]);
        toast.error(data.detail || data.message || 'Failed to search rooms');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Unable to connect to server. Please try again.');
      setAvailableRooms([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBookRoom = (roomId: string) => {
    router.push(
      `/booking?roomId=${roomId}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`
    );
  };

  const handleViewRoom = (room: AvailableRoom) => {
    setSelectedRoom(room);
    setRoomViewOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeRoomView = () => {
    setRoomViewOpen(false);
    setSelectedRoom(null);
    document.body.style.overflow = 'auto';
  };

  const scrollToBooking = () => {
    bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Gallery images - All images from fggallery folder
  const galleryImages = [
    { src: '/fggallery/294216767_538857271357927_3834486940661836835_n.jpeg', title: 'Hotel Exterior' },
    { src: '/fggallery/294386773_137132852050873_6307167716710298936_n.jpeg', title: 'Welcoming Entrance' },
    { src: '/fggallery/294412609_635414954676325_6804460679564330315_n.jpeg', title: 'Lobby & Reception' },
    { src: '/fggallery/Challenge your friends to a game of skill and strategy—our pool table awaits your next great sho.jpg', title: 'Entertainment Lounge' },
    { src: '/fggallery/Come experience unmatched hospitality closer to you better than ever before in our new branch a.jpg', title: 'New Branch' },
    { src: '/fggallery/Come experience unmatched hospitality closer to you better than ever before in our new branch a (1).jpg', title: 'Elegant Interiors' },
    { src: '/fggallery/Come experience unmatched hospitality closer to you better than ever before in our new branch a (2).jpg', title: 'Premium Rooms' },
    { src: '/fggallery/Come experience unmatched hospitality closer to you better than ever before in our new branch a (3).jpg', title: 'Stunning Views' },
    { src: '/fggallery/469921840_609572294824156_6474623730433970375_n.jpeg', title: 'Cozy Rooms' },
    { src: '/fggallery/469966691_609547028160016_1972468339517341028_n.jpeg', title: 'Room Details' },
    { src: '/fggallery/469991799_609547014826684_6980244597360422172_n.jpeg', title: 'Comfort Living' },
    { src: '/fggallery/469998326_610408038073915_4109635752772804716_n.jpeg', title: 'Guest Experience' },
    { src: '/fggallery/470016279_609572161490836_2292486197575484043_n.jpeg', title: 'Relaxation Space' },
    { src: '/fggallery/470059745_609572314824154_7704524729580679991_n.jpeg', title: 'Modern Amenities' },
    { src: '/fggallery/Come experience unmatched hospitality closer to you better than ever before in our new branch a (4).jpg', title: 'Fine Dining' },
    { src: '/fggallery/Come experience unmatched hospitality closer to you better than ever before in our new branch a (5).jpg', title: 'Peaceful Environment' },
  ];

  const amenities = [
    { icon: Wifi, title: 'Free WiFi', desc: 'High-speed internet' },
    { icon: Coffee, title: 'Restaurant', desc: 'Local & international' },
    { icon: Car, title: 'Free Parking', desc: 'Secure parking' },
    { icon: Clock, title: '24/7 Service', desc: 'Always available' },
    { icon: Shield, title: 'Security', desc: 'Safe & secure' },
    { icon: Sparkles, title: 'Housekeeping', desc: 'Daily cleaning' },
  ];

  const branches = [
    { name: 'Famous Gate Bomet', location: 'Bomet Town', phone: '+254 700 000 001' },
    { name: 'Famous Gate Kericho', location: 'Kericho Town', phone: '+254 700 000 002' },
    { name: 'Famous Gate Kapsoit', location: 'Kapsoit Center', phone: '+254 700 000 003' },
    { name: 'Famous Gate Litein', location: 'Litein Town', phone: '+254 700 000 004' },
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-KE').format(price);
  };

  const getRoomTypeName = (room: AvailableRoom) => {
    if (typeof room.type === 'string') return room.type;
    return room.type?.name || 'Standard Room';
  };

  const getRoomPrice = (room: AvailableRoom) => {
    if (room.pricePerNight) return room.pricePerNight;
    if (typeof room.type === 'object' && room.type?.basePrice) return room.type.basePrice;
    return 0;
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ===================== HEADER ===================== */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/fglogo.png" alt="Logo" width={40} height={40} className="object-contain" style={{ width: 'auto', height: 'auto' }} priority />
            <div>
              <span className="font-semibold text-stone-900 text-lg">Famous Gate</span>
              <span className="text-xs text-amber-600 block -mt-1 font-medium">HOTEL</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#about" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">About</a>
            <a href="#rooms" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">Rooms</a>
            <a href="#gallery" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">Gallery</a>
            <a href="#contact" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">Contact</a>
          </nav>

          <button
            onClick={() => router.push('/login')}
            className="text-sm font-medium text-stone-700 hover:text-stone-900 transition-colors"
          >
            Staff Login →
          </button>
        </div>
      </header>

      {/* ===================== HERO SECTION ===================== */}
      <section className="relative h-screen" style={{ position: 'relative' }}>
        <Image
          src={galleryImages[0].src}
          alt="Famous Gate Hotel"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />

        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 pt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-amber-400 text-sm font-medium tracking-[0.25em] uppercase mb-4">
              Welcome to
            </p>
            <h1 className="text-5xl md:text-7xl font-dm-serif text-white mb-4 tracking-tight">
              Famous Gate <span className="italic">Hotel</span>
            </h1>
            <p className="text-xl text-white/80 max-w-xl mx-auto mb-8">
              Experience unmatched hospitality and comfort across our 6 branches in Kenya
            </p>
            <button
              onClick={scrollToBooking}
              className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-full transition-all shadow-lg shadow-amber-500/30"
            >
              Book Your Stay
              <ChevronDown className="w-4 h-4" />
            </button>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/60" />
        </div>
      </section>

      {/* ===================== BOOKING SECTION (STICKY) ===================== */}
      <div ref={bookingRef} className="relative z-20">
        <div className={`${isBookingSticky ? 'fixed top-16 left-0 right-0 shadow-xl' : ''} bg-white transition-all duration-300`}>
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex flex-col lg:flex-row items-end gap-4">
              {/* Check-in */}
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                  Check-in
                </label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full h-12 px-4 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Check-out */}
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                  Check-out
                </label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  min={checkIn || format(new Date(), 'yyyy-MM-dd')}
                  className="w-full h-12 px-4 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Adults */}
              <div className="w-full lg:w-32">
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                  Adults
                </label>
                <select
                  value={adults}
                  onChange={(e) => setAdults(parseInt(e.target.value))}
                  className="w-full h-12 px-4 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                >
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {/* Children */}
              <div className="w-full lg:w-32">
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                  Children
                </label>
                <select
                  value={children}
                  onChange={(e) => setChildren(parseInt(e.target.value))}
                  className="w-full h-12 px-4 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                >
                  {[0, 1, 2, 3, 4].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {/* Search Button */}
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="w-full lg:w-auto h-12 px-8 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Check Availability
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        {/* Spacer when sticky */}
        {isBookingSticky && <div className="h-32" />}
      </div>

      {/* ===================== AVAILABLE ROOMS SECTION ===================== */}
      <section ref={roomsRef} id="rooms" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          {hasSearched && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-[2px] bg-amber-500" />
                <span className="text-amber-600 text-sm font-semibold uppercase tracking-wider">
                  Search Results
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-dm-serif text-stone-900">
                Available <span className="italic">Rooms</span>
              </h2>
              <p className="text-stone-500 mt-2">
                {checkIn && checkOut && `${format(new Date(checkIn), 'MMM d')} - ${format(new Date(checkOut), 'MMM d, yyyy')} · ${adults + children} guest(s)`}
              </p>
            </motion.div>
          )}

          {/* Room Cards */}
          {availableRooms.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableRooms.map((room, index) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-stone-300 transition-all duration-300"
                >
                  <div className="aspect-[4/3] bg-stone-100 relative overflow-hidden">
                    {room.images && room.images.length > 0 ? (
                      <>
                        <img
                          src={room.images[0]}
                          alt={getRoomTypeName(room)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {room.images.length > 1 && (
                          <div className="absolute bottom-4 right-4 bg-black/60 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                            <span>+{room.images.length - 1} more</span>
                          </div>
                        )}
                      </>
                    ) : typeof room.type === 'object' && room.type?.images && room.type.images.length > 0 ? (
                      <>
                        <img
                          src={room.type.images[0]}
                          alt={room.type.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {room.type.images.length > 1 && (
                          <div className="absolute bottom-4 right-4 bg-black/60 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                            <span>+{room.type.images.length - 1} more</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-100 to-stone-200 flex items-center justify-center">
                        <Bed className="w-16 h-16 text-stone-400" />
                      </div>
                    )}
                    <div className="absolute top-4 left-4">
                      <button
                        onClick={() => handleViewRoom(room)}
                        className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
                        title="View room details"
                      >
                        <Eye className="w-4 h-4 text-stone-700" />
                      </button>
                    </div>
                    <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-stone-700">
                      Room {room.roomNumber || room.id.slice(-4)}
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-stone-900 mb-2">
                      {getRoomTypeName(room)}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-stone-500 mb-4">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Up to {room.capacity || 2} guests
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                      <div>
                        <span className="text-2xl font-bold text-stone-900">
                          KES {formatPrice(getRoomPrice(room))}
                        </span>
                        <span className="text-stone-500 text-sm"> /night</span>
                      </div>
                      <button
                        onClick={() => handleBookRoom(room.id)}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        Book
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : hasSearched ? (
            <div className="text-center py-16 bg-stone-50 rounded-2xl">
              <Bed className="w-16 h-16 text-stone-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-stone-700 mb-2">No Rooms Available</h3>
              <p className="text-stone-500">Try different dates or contact us directly</p>
            </div>
          ) : (
            <div className="text-center py-16 bg-gradient-to-br from-amber-50 to-stone-50 rounded-2xl border border-stone-200">
              <Search className="w-16 h-16 text-amber-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-stone-700 mb-2">Find Your Perfect Room</h3>
              <p className="text-stone-500 max-w-md mx-auto">
                Select your dates above to check availability and discover our comfortable accommodations
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ===================== ABOUT SECTION ===================== */}
      <section id="about" className="py-24 bg-stone-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-[2px] bg-amber-500" />
                <span className="text-amber-600 text-sm font-semibold uppercase tracking-wider">
                  About Us
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-dm-serif text-stone-900 mb-6">
                A Place Where <br /><span className="italic">Comfort Meets Excellence</span>
              </h2>
              <p className="text-stone-600 text-lg leading-relaxed mb-8">
                Famous Gate Hotel offers an exceptional blend of comfort, convenience, and warm Kenyan hospitality.
                With 6 branches strategically located across the region, we're always close to you.
              </p>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-white rounded-xl border border-stone-200">
                  <div className="text-3xl font-bold text-amber-500 mb-1">50+</div>
                  <div className="text-stone-600 text-sm">Luxury Rooms</div>
                </div>
                <div className="p-6 bg-white rounded-xl border border-stone-200">
                  <div className="text-3xl font-bold text-amber-500 mb-1">6</div>
                  <div className="text-stone-600 text-sm">Branches</div>
                </div>
                <div className="p-6 bg-white rounded-xl border border-stone-200">
                  <div className="text-3xl font-bold text-amber-500 mb-1">10K+</div>
                  <div className="text-stone-600 text-sm">Happy Guests</div>
                </div>
                <div className="p-6 bg-white rounded-xl border border-stone-200">
                  <div className="text-3xl font-bold text-amber-500 mb-1">4.8</div>
                  <div className="text-stone-600 text-sm">Guest Rating</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl relative">
                <Image
                  src={galleryImages[1].src}
                  alt="About Famous Gate"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 p-6 bg-white rounded-xl shadow-xl border border-stone-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                    <Award className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-stone-900">Award Winning</div>
                    <div className="text-stone-500 text-sm">Hospitality Excellence</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===================== AMENITIES SECTION ===================== */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-[2px] bg-amber-500" />
              <span className="text-amber-600 text-sm font-semibold uppercase tracking-wider">
                What We Offer
              </span>
              <div className="w-8 h-[2px] bg-amber-500" />
            </div>
            <h2 className="text-4xl font-dm-serif text-stone-900">
              Premium <span className="italic">Amenities</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {amenities.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="p-6 bg-stone-50 rounded-2xl text-center hover:bg-amber-50 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:shadow-md transition-shadow">
                  <item.icon className="w-6 h-6 text-amber-500" />
                </div>
                <div className="font-semibold text-stone-900 text-sm mb-1">{item.title}</div>
                <div className="text-stone-500 text-xs">{item.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== GALLERY SECTION ===================== */}
      <section id="gallery" className="py-32 bg-stone-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-20"
          >
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: 64 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="h-[2px] bg-amber-500 mx-auto mb-6"
            />
            <span className="text-amber-600 text-xs font-semibold uppercase tracking-[0.3em] block mb-4">
              Explore Our Spaces
            </span>
            <h2 className="text-5xl md:text-6xl font-dm-serif text-stone-900 tracking-tight">
              Gallery
            </h2>
          </motion.div>

          {/* Bento Grid Gallery */}
          <div className="grid grid-cols-12 gap-3 md:gap-4">
            {/* Large Featured Image */}
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="col-span-12 md:col-span-8 row-span-2 relative group cursor-pointer"
              onClick={() => openLightbox(0)}
            >
              <div className="relative h-[400px] md:h-[500px] rounded-3xl overflow-hidden">
                <Image
                  src={galleryImages[0].src}
                  alt={galleryImages[0].title}
                  fill
                  className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="absolute bottom-8 left-8 right-8"
                >
                  <span className="inline-block px-3 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full mb-3">
                    Featured
                  </span>
                  <h3 className="text-3xl font-dm-serif text-white mb-2">{galleryImages[0].title}</h3>
                  <p className="text-white/70 text-sm">Experience the beauty of Famous Gate Hotel</p>
                </motion.div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/10 transition-colors duration-500" />
              </div>
            </motion.div>

            {/* Side Images */}
            {galleryImages.slice(1, 3).map((img, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: 0.1 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="col-span-6 md:col-span-4 relative group cursor-pointer"
                onClick={() => openLightbox(index + 1)}
              >
                <div className="relative h-[190px] md:h-[242px] rounded-2xl overflow-hidden">
                  <Image
                    src={img.src}
                    alt={img.title}
                    fill
                    className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-1"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <p className="text-white font-medium text-sm">{img.title}</p>
                  </div>
                  {/* Corner accent */}
                  <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-white/0 group-hover:border-white/50 transition-colors duration-300 rounded-tr-lg" />
                </div>
              </motion.div>
            ))}

            {/* Middle Row - 4 images */}
            {galleryImages.slice(3, 7).map((img, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="col-span-6 md:col-span-3 relative group cursor-pointer"
                onClick={() => openLightbox(index + 3)}
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                  <Image
                    src={img.src}
                    alt={img.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {/* Animated border */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-white/0 group-hover:border-white/30 transition-colors duration-300" />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
                  {/* Label */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
                    <p className="text-white font-medium text-sm">{img.title}</p>
                  </div>
                  {/* Number badge */}
                  <div className="absolute top-3 left-3 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-xs font-bold text-stone-900">{index + 4}</span>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Wide image */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="col-span-12 md:col-span-6 relative group cursor-pointer"
              onClick={() => openLightbox(7)}
            >
              <div className="relative h-[200px] md:h-[280px] rounded-2xl overflow-hidden">
                <Image
                  src={galleryImages[7].src}
                  alt={galleryImages[7].title}
                  fill
                  className="object-cover transition-transform duration-[1s] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6">
                  <p className="text-white font-semibold text-lg">{galleryImages[7].title}</p>
                  <p className="text-white/60 text-sm">View details →</p>
                </div>
              </div>
            </motion.div>

            {/* Remaining images in smaller grid */}
            {galleryImages.slice(8, 12).map((img, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.5, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="col-span-6 md:col-span-3 lg:col-span-3 relative group cursor-pointer"
                onClick={() => openLightbox(index + 8)}
              >
                <div className="relative aspect-square rounded-xl overflow-hidden">
                  <Image
                    src={img.src}
                    alt={img.title}
                    fill
                    className="object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-110"
                  />
                  {/* Glass overlay on hover */}
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 backdrop-blur-0 group-hover:backdrop-blur-[1px] transition-all duration-300" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300">
                      <ArrowRight className="w-5 h-5 text-stone-900" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Bottom row - last 4 images */}
            {galleryImages.slice(12).map((img, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="col-span-6 md:col-span-3 relative group cursor-pointer"
                onClick={() => openLightbox(index + 12)}
              >
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-stone-200">
                  <Image
                    src={img.src}
                    alt={img.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/40 transition-colors duration-300" />
                  <div className="absolute inset-0 flex items-end p-4">
                    <p className="text-white font-medium text-sm opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                      {img.title}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Gallery footer */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="text-center mt-16"
          >
            <p className="text-stone-500 text-sm">
              {galleryImages.length} photos showcasing our beautiful spaces
            </p>
          </motion.div>
        </div>
      </section>

      {/* ===================== LOCATIONS SECTION ===================== */}
      <section id="contact" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-[2px] bg-amber-500" />
              <span className="text-amber-600 text-sm font-semibold uppercase tracking-wider">
                Find Us
              </span>
              <div className="w-8 h-[2px] bg-amber-500" />
            </div>
            <h2 className="text-4xl font-dm-serif text-stone-900">
              Our <span className="italic">Locations</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {branches.map((branch, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 bg-stone-50 rounded-2xl hover:shadow-lg hover:bg-white transition-all duration-300 border border-transparent hover:border-stone-200"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                  <MapPin className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="font-semibold text-stone-900 mb-3">{branch.name}</h3>
                <div className="space-y-2 text-sm text-stone-500">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {branch.location}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {branch.phone}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CTA SECTION ===================== */}
      <section className="py-24 bg-stone-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-dm-serif text-white mb-4">
            Ready for an <span className="italic text-amber-400">Unforgettable</span> Stay?
          </h2>
          <p className="text-stone-400 text-lg mb-8 max-w-2xl mx-auto">
            Book now and experience the warmth of Kenyan hospitality at Famous Gate Hotel
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={scrollToBooking}
              className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-full transition-all"
            >
              Book Your Stay
            </button>
            <a
              href="tel:+254700000000"
              className="px-8 py-4 border border-stone-700 text-white hover:bg-stone-800 font-medium rounded-full transition-all flex items-center gap-2"
            >
              <Phone className="w-4 h-4" />
              Call Us
            </a>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="py-12 bg-stone-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image src="/fglogo.png" alt="Logo" width={36} height={36} className="object-contain" />
              <span className="font-semibold text-white">Famous Gate Hotel</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-stone-500">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">FAQ</a>
            </div>
            <p className="text-stone-500 text-sm">
              © 2024 Famous Gate Hotel. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* ===================== LIGHTBOX MODAL ===================== */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center"
            onClick={closeLightbox}
          >
            {/* Close button */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: 0.1 }}
              onClick={closeLightbox}
              className="absolute top-6 right-6 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </motion.button>

            {/* Previous button */}
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: 0.15 }}
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute left-4 md:left-8 z-10 p-3 md:p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:scale-110"
            >
              <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
            </motion.button>

            {/* Next button */}
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.15 }}
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute right-4 md:right-8 z-10 p-3 md:p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:scale-110"
            >
              <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
            </motion.button>

            {/* Image container */}
            <motion.div
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full h-full max-w-6xl max-h-[85vh] mx-4 md:mx-16"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={galleryImages[lightboxIndex]?.src || ''}
                alt={galleryImages[lightboxIndex]?.title || ''}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 80vw"
              />
            </motion.div>

            {/* Image info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.2 }}
              className="absolute bottom-8 left-0 right-0 text-center"
            >
              <h3 className="text-xl md:text-2xl font-dm-serif text-white mb-2">
                {galleryImages[lightboxIndex]?.title}
              </h3>
              <p className="text-white/60 text-sm">
                {lightboxIndex + 1} / {galleryImages.length}
              </p>
            </motion.div>

            {/* Thumbnail strip */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ delay: 0.25 }}
              className="absolute bottom-24 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto"
            >
              {galleryImages.map((img, index) => (
                <button
                  key={index}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(index); }}
                  className={`relative w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden flex-shrink-0 transition-all duration-200 ${index === lightboxIndex
                      ? 'ring-2 ring-amber-500 scale-110'
                      : 'opacity-50 hover:opacity-100'
                    }`}
                >
                  <Image
                    src={img.src}
                    alt={img.title}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room View Modal */}
      <AnimatePresence>
        {roomViewOpen && selectedRoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={closeRoomView}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-stone-200 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-dm-serif text-stone-900">
                    {getRoomTypeName(selectedRoom)}
                  </h2>
                  <p className="text-stone-500">Room {selectedRoom.roomNumber || selectedRoom.id.slice(-4)}</p>
                </div>
                <button
                  onClick={closeRoomView}
                  className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-stone-700" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {/* Images Gallery */}
                <div className="mb-6">
                  {(() => {
                    const images = selectedRoom.images ||
                      (typeof selectedRoom.type === 'object' ? selectedRoom.type?.images : []);

                    return images && images.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {images.map((image: string, index: number) => (
                          <div key={index} className="aspect-[4/3] rounded-lg overflow-hidden">
                            <img
                              src={image}
                              alt={`${getRoomTypeName(selectedRoom)} - Image ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-gradient-to-br from-amber-100 to-stone-200 rounded-lg flex items-center justify-center">
                        <Bed className="w-16 h-16 text-stone-400" />
                      </div>
                    );
                  })()}
                </div>

                {/* Room Details */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900 mb-4">Room Details</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-amber-500" />
                        <span className="text-stone-700">Up to {selectedRoom.capacity || 2} guests</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Bed className="w-5 h-5 text-amber-500" />
                        <span className="text-stone-700">{getRoomTypeName(selectedRoom)}</span>
                      </div>
                      {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-stone-700 mb-2">Amenities</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedRoom.amenities.map((amenity: string, index: number) => (
                              <span
                                key={index}
                                className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm"
                              >
                                {amenity}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-stone-900 mb-4">Booking</h3>
                    <div className="space-y-4">
                      <div className="text-center">
                        <span className="text-3xl font-bold text-stone-900">
                          KES {formatPrice(getRoomPrice(selectedRoom))}
                        </span>
                        <span className="text-stone-500 text-sm"> /night</span>
                      </div>
                      <button
                        onClick={() => {
                          handleBookRoom(selectedRoom.id);
                          closeRoomView();
                        }}
                        className="w-full px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        Book This Room
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
