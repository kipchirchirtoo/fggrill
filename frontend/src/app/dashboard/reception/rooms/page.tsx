'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Bed, Users, Wifi, Coffee, Utensils, Star, Crown, Sparkles,
  ChevronLeft, ChevronRight, X, Check, Calendar, Phone, Mail,
  Tv, Wind, Bath, Car, Clock, Heart, Shield, Award, MapPin,
  BedDouble, BedSingle, Sun, Moon, UtensilsCrossed, Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

// Room Images from Unsplash (hotel room images)
const roomImages = {
  deluxe: [
    'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',
    'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80'
  ],
  executive: [
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80',
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80',
    'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800&q=80',
    'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&q=80'
  ]
};

// Room Types Data
const roomCategories = [
  {
    id: 'deluxe',
    name: 'Deluxe Rooms',
    tagline: 'Comfort meets elegance',
    description: 'Our Deluxe rooms offer a perfect blend of comfort and style. Featuring modern amenities, plush bedding, and stunning views, these rooms are ideal for both business and leisure travelers.',
    icon: Bed,
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    images: roomImages.deluxe,
    occupancyTypes: [
      {
        type: 'Single Occupancy',
        icon: BedSingle,
        description: 'Perfect for solo travelers',
        maxGuests: 1,
        pricing: {
          bedAndBreakfast: 3500,
          halfBoard: 4500,
          fullBoard: 5500
        }
      },
      {
        type: 'Double Occupancy',
        icon: BedDouble,
        description: 'Ideal for couples',
        maxGuests: 2,
        pricing: {
          bedAndBreakfast: 4500,
          halfBoard: 6500,
          fullBoard: 8500
        }
      },
      {
        type: 'Twin (Two Separate Beds)',
        icon: Users,
        description: 'Great for friends or colleagues',
        maxGuests: 2,
        pricing: {
          bedAndBreakfast: 5000,
          halfBoard: 7000,
          fullBoard: 9000
        }
      }
    ],
    amenities: ['Free Wi-Fi', 'Air Conditioning', 'Flat Screen TV', 'Mini Bar', 'Work Desk', 'En-suite Bathroom', 'Room Service', 'Daily Housekeeping']
  },
  {
    id: 'executive',
    name: 'Executive Rooms',
    tagline: 'Luxury redefined',
    description: 'Experience the pinnacle of luxury in our Executive rooms. Spacious layouts, premium furnishings, and exclusive amenities create an unforgettable stay for discerning guests.',
    icon: Crown,
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    images: roomImages.executive,
    occupancyTypes: [
      {
        type: 'Single Occupancy',
        icon: BedSingle,
        description: 'Exclusive comfort for one',
        maxGuests: 1,
        pricing: {
          bedAndBreakfast: 5000,
          halfBoard: 6500,
          fullBoard: 7500
        }
      },
      {
        type: 'Double Occupancy',
        icon: BedDouble,
        description: 'Premium experience for two',
        maxGuests: 2,
        pricing: {
          bedAndBreakfast: 6500,
          halfBoard: 8500,
          fullBoard: 10000
        }
      }
    ],
    amenities: ['Free High-Speed Wi-Fi', 'Climate Control', '55" Smart TV', 'Fully Stocked Mini Bar', 'Executive Work Station', 'Luxury Bathroom', '24/7 Room Service', 'Turn-down Service', 'Complimentary Newspaper', 'Premium Toiletries']
  }
];

// Meal Plan Info
const mealPlans = [
  {
    name: 'Bed & Breakfast',
    shortName: 'B&B',
    icon: Coffee,
    description: 'Includes accommodation and a sumptuous breakfast buffet',
    color: 'text-amber-600 bg-amber-100'
  },
  {
    name: 'Half Board',
    shortName: 'HB',
    icon: UtensilsCrossed,
    description: 'Includes breakfast and dinner at our restaurant',
    color: 'text-blue-600 bg-blue-100'
  },
  {
    name: 'Full Board',
    shortName: 'FB',
    icon: Utensils,
    description: 'All meals included - breakfast, lunch, and dinner',
    color: 'text-emerald-600 bg-emerald-100'
  }
];

interface GalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  roomName: string;
}

function GalleryModal({ isOpen, onClose, images, roomName }: GalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextImage = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="relative h-[500px]">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentIndex}
                src={images[currentIndex]}
                alt={`${roomName} - Image ${currentIndex + 1}`}
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            </AnimatePresence>
            
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 rounded-full text-white hover:bg-black/70 transition"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 rounded-full text-white hover:bg-black/70 transition"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition ${idx === currentIndex ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
          </div>
          
          <div className="absolute bottom-4 right-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: typeof roomCategories[0] | null;
  occupancy: typeof roomCategories[0]['occupancyTypes'][0] | null;
}

function BookingModal({ isOpen, onClose, room, occupancy }: BookingModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'bedAndBreakfast' | 'halfBoard' | 'fullBoard'>('bedAndBreakfast');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');

  if (!room || !occupancy) return null;

  const price = occupancy.pricing[selectedPlan];

  const handleBook = () => {
    if (!checkIn || !checkOut || !guestName || !phone) {
      toast.error('Please fill in all fields');
      return;
    }
    toast.success(`Booking confirmed for ${room.name} - ${occupancy.type}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            Book {room.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="font-medium">{occupancy.type}</p>
            <p className="text-sm text-gray-500">Max {occupancy.maxGuests} guest(s)</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Meal Plan</label>
            <div className="grid grid-cols-3 gap-2">
              {(['bedAndBreakfast', 'halfBoard', 'fullBoard'] as const).map((plan) => (
                <button
                  key={plan}
                  onClick={() => setSelectedPlan(plan)}
                  className={`p-3 rounded-lg border-2 text-center transition ${
                    selectedPlan === plan
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs font-medium">
                    {plan === 'bedAndBreakfast' ? 'B&B' : plan === 'halfBoard' ? 'Half Board' : 'Full Board'}
                  </p>
                  <p className="text-lg font-bold text-indigo-600">
                    KES {occupancy.pricing[plan].toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Check-in</label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Check-out</label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Guest Name</label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter guest name"
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0700 000 000"
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleBook} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
              Confirm Booking
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ReceptionRoomsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryRoomName, setGalleryRoomName] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<typeof roomCategories[0] | null>(null);
  const [selectedOccupancy, setSelectedOccupancy] = useState<typeof roomCategories[0]['occupancyTypes'][0] | null>(null);

  const openGallery = (images: string[], roomName: string) => {
    setGalleryImages(images);
    setGalleryRoomName(roomName);
    setGalleryOpen(true);
  };

  const openBooking = (room: typeof roomCategories[0], occupancy: typeof roomCategories[0]['occupancyTypes'][0]) => {
    setSelectedRoom(room);
    setSelectedOccupancy(occupancy);
    setBookingOpen(true);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-8">
          {/* Hero Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-8 text-white">
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur">
                  <Bed className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Our Rooms & Suites</h1>
                  <p className="text-white/80">Experience comfort and luxury at Famous Gate Hotel</p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-6 mt-6">
                {[
                  { icon: Wifi, label: 'Free Wi-Fi' },
                  { icon: Utensils, label: 'Sumptuous Meals' },
                  { icon: Star, label: 'Personalized Service' },
                  { icon: Shield, label: 'Secure & Safe' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur">
                    <item.icon className="h-4 w-4" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Meal Plans Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mealPlans.map((plan, idx) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="p-5 h-full hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${plan.color}`}>
                      <plan.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Room Categories */}
          {roomCategories.map((category, catIdx) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: catIdx * 0.2 }}
              className="space-y-6"
            >
              {/* Category Header */}
              <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${category.color} p-6 text-white`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur">
                      <category.icon className="h-8 w-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{category.name}</h2>
                      <p className="text-white/80">{category.tagline}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    onClick={() => openGallery(category.images, category.name)}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    View Gallery
                  </Button>
                </div>
              </div>

              {/* Room Images Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {category.images.map((img, imgIdx) => (
                  <motion.div
                    key={imgIdx}
                    whileHover={{ scale: 1.03 }}
                    className="relative aspect-video rounded-xl overflow-hidden cursor-pointer group"
                    onClick={() => openGallery(category.images, category.name)}
                  >
                    <img
                      src={img}
                      alt={`${category.name} - ${imgIdx + 1}`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Description & Amenities */}
              <Card className={`p-6 ${category.bgColor} ${category.borderColor} border-2`}>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">About {category.name}</h3>
                    <p className="text-gray-700">{category.description}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Room Amenities</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {category.amenities.map((amenity, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                          <Check className="h-4 w-4 text-green-500" />
                          {amenity}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Pricing Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.occupancyTypes.map((occupancy, occIdx) => (
                  <motion.div
                    key={occupancy.type}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: occIdx * 0.1 }}
                  >
                    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 border-2 hover:border-indigo-300">
                      {/* Card Header */}
                      <div className={`p-5 bg-gradient-to-r ${category.color} text-white`}>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/20 rounded-lg">
                            <occupancy.icon className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{occupancy.type}</h3>
                            <p className="text-white/80 text-sm">{occupancy.description}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span className="text-sm">Max {occupancy.maxGuests} Guest{occupancy.maxGuests > 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Pricing Table */}
                      <div className="p-5 space-y-3">
                        {/* Bed & Breakfast */}
                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Coffee className="h-5 w-5 text-amber-600" />
                            <div>
                              <p className="font-medium text-sm">Bed & Breakfast</p>
                              <p className="text-xs text-gray-500">Includes breakfast</p>
                            </div>
                          </div>
                          <p className="font-bold text-lg text-amber-700">
                            KES {occupancy.pricing.bedAndBreakfast.toLocaleString()}
                          </p>
                        </div>

                        {/* Half Board */}
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="h-5 w-5 text-blue-600" />
                            <div>
                              <p className="font-medium text-sm">Half Board</p>
                              <p className="text-xs text-gray-500">Breakfast + Dinner</p>
                            </div>
                          </div>
                          <p className="font-bold text-lg text-blue-700">
                            KES {occupancy.pricing.halfBoard.toLocaleString()}
                          </p>
                        </div>

                        {/* Full Board */}
                        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Utensils className="h-5 w-5 text-emerald-600" />
                            <div>
                              <p className="font-medium text-sm">Full Board</p>
                              <p className="text-xs text-gray-500">All meals included</p>
                            </div>
                          </div>
                          <p className="font-bold text-lg text-emerald-700">
                            KES {occupancy.pricing.fullBoard.toLocaleString()}
                          </p>
                        </div>

                        {/* Book Button */}
                        <Button
                          className={`w-full mt-4 bg-gradient-to-r ${category.color} hover:opacity-90`}
                          onClick={() => openBooking(category, occupancy)}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Book Now
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}

          {/* Contact Section */}
          <Card className="p-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-400" />
                  Need Help Choosing?
                </h3>
                <p className="text-gray-300 mt-1">Our team is here to help you find the perfect room for your stay</p>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  <Phone className="h-4 w-4 mr-2" />
                  Call Reception
                </Button>
                <Button className="bg-yellow-500 text-gray-900 hover:bg-yellow-400">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Inquiry
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Gallery Modal */}
        <GalleryModal
          isOpen={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          images={galleryImages}
          roomName={galleryRoomName}
        />

        {/* Booking Modal */}
        <BookingModal
          isOpen={bookingOpen}
          onClose={() => setBookingOpen(false)}
          room={selectedRoom}
          occupancy={selectedOccupancy}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
