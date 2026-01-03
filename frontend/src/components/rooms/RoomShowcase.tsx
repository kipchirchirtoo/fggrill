'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Users, Bed, Wifi, Car, Coffee, Tv, Shield, Eye, MapPin } from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  floor: number;
  base_price: number;
  max_occupancy: number;
  amenities: string[];
  description: string;
  images: string[];
  status: string;
}

interface RoomShowcaseProps {
  rooms: Room[];
  onSelectRoom?: (room: Room) => void;
  showPricing?: boolean;
  className?: string;
}

const AMENITY_ICONS: Record<string, any> = {
  'WiFi': Wifi,
  'TV': Tv,
  'Safe': Shield,
  'Ocean View': Eye,
  'City View': MapPin,
  'Mini Bar': Coffee,
  'Air Conditioning': Car,
};

export function RoomShowcase({ rooms, onSelectRoom, showPricing = true, className }: RoomShowcaseProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<Record<string, number>>({});

  const nextImage = (roomId: string, totalImages: number) => {
    setSelectedImageIndex(prev => ({
      ...prev,
      [roomId]: ((prev[roomId] || 0) + 1) % totalImages
    }));
  };

  const prevImage = (roomId: string, totalImages: number) => {
    setSelectedImageIndex(prev => ({
      ...prev,
      [roomId]: ((prev[roomId] || 0) - 1 + totalImages) % totalImages
    }));
  };

  const availableRooms = rooms.filter(room => room.status === 'available');

  if (availableRooms.length === 0) {
    return (
      <div className="text-center py-12">
        <Bed className="h-12 w-12 text-[#8E8E93] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[#3C3C43] mb-2">No Available Rooms</h3>
        <p className="text-[#8E8E93]">All rooms are currently occupied or under maintenance.</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {availableRooms.map((room) => {
        const currentImageIndex = selectedImageIndex[room.id] || 0;
        const hasImages = room.images && room.images.length > 0;
        
        return (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <IOSCard className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Image Gallery */}
              <div className="relative h-48 bg-[#F2F2F7]">
                {hasImages ? (
                  <>
                    <img
                      src={room.images[currentImageIndex]}
                      alt={`${room.room_type} - Image ${currentImageIndex + 1}`}
                      className="w-full h-full object-cover"
                    />
                    
                    {room.images.length > 1 && (
                      <>
                        <button
                          onClick={() => prevImage(room.id, room.images.length)}
                          className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => nextImage(room.id, room.images.length)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        
                        {/* Image Indicators */}
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                          {room.images.map((_, index) => (
                            <div
                              key={index}
                              className={`w-2 h-2 rounded-full transition-colors ${
                                index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Bed className="h-12 w-12 text-[#8E8E93]" />
                  </div>
                )}
                
                {/* Room Number Badge */}
                <div className="absolute top-3 left-3 bg-[#3C3C43] text-white px-2 py-1 rounded-md text-sm font-medium">
                  Room {room.room_number}
                </div>
              </div>

              {/* Room Details */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-[#3C3C43]">{room.room_type}</h3>
                  {showPricing && (
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#3C3C43]">
                        KES {room.base_price.toLocaleString()}
                      </div>
                      <div className="text-xs text-[#8E8E93]">per night</div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-3 text-sm text-[#8E8E93]">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{room.max_occupancy} guests</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>Floor {room.floor}</span>
                  </div>
                </div>

                {room.description && (
                  <p className="text-sm text-[#8E8E93] mb-3 line-clamp-2">
                    {room.description}
                  </p>
                )}

                {/* Amenities */}
                {room.amenities && room.amenities.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {room.amenities.slice(0, 6).map((amenity) => {
                        const IconComponent = AMENITY_ICONS[amenity];
                        return (
                          <div
                            key={amenity}
                            className="flex items-center gap-1 bg-[#F2F2F7] px-2 py-1 rounded-md text-xs text-[#3C3C43]"
                          >
                            {IconComponent && <IconComponent className="h-3 w-3" />}
                            <span>{amenity}</span>
                          </div>
                        );
                      })}
                      {room.amenities.length > 6 && (
                        <div className="bg-[#F2F2F7] px-2 py-1 rounded-md text-xs text-[#8E8E93]">
                          +{room.amenities.length - 6} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                {onSelectRoom && (
                  <IOSButton
                    onClick={() => onSelectRoom(room)}
                    className="w-full bg-[#3C3C43] hover:bg-[#000000] text-white"
                  >
                    Select Room
                  </IOSButton>
                )}
              </div>
            </IOSCard>
          </motion.div>
        );
      })}
    </div>
  );
}
