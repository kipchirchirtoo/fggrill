import React, { useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Hotel } from '@/types';
import { ImageGallery } from '../gallery/ImageGallery';
import { GALLERY_IMAGES } from '@/config/galleryImages';

interface HotelCardProps {
  hotel: Hotel;
}

export const HotelCard: React.FC<HotelCardProps> = ({ hotel }) => {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const viewRoomButtonRef = useRef<HTMLButtonElement>(null);

  const handleViewRoom = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setGalleryOpen(true);
  };

  const handleCloseGallery = () => {
    setGalleryOpen(false);
    // Return focus to the button that opened the gallery
    viewRoomButtonRef.current?.focus();
  };

  return (
    <>
      <Link href={`/rooms/${hotel.id}`}>
        <div className="group bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer h-full flex flex-col border border-neutral-100">
          {/* Hotel Image */}
          <div className="relative h-56 w-full overflow-hidden">
            <Image
              src={hotel.primaryImage}
              alt={`${hotel.name} - Luxury Hotel Room in ${hotel.location}, Kenya`}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            <div className="absolute top-4 right-4 bg-gold text-white px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase">
              Luxury
            </div>
          </div>

          {/* Hotel Info */}
          <div className="p-6 flex-1 flex flex-col">
            <h3 className="text-2xl font-display font-bold text-gray-900 mb-2 group-hover:text-gold transition-colors">
              {hotel.name}
            </h3>
            
            <p className="text-sm text-gray-500 mb-4 flex items-center">
              <svg className="w-4 h-4 mr-2 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {hotel.location}, Kenya
            </p>

            <p className="text-gray-600 mb-6 line-clamp-3 flex-1 leading-relaxed">
              {hotel.shortDescription || hotel.description}
            </p>

            <div className="mt-auto flex gap-3">
              <button
                ref={viewRoomButtonRef}
                onClick={handleViewRoom}
                className="flex-1 px-4 py-3 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 transition-colors font-bold text-sm tracking-wide uppercase"
                aria-label={`View photo gallery for ${hotel.name}`}
              >
                Gallery
              </button>
              
              <span className="flex-1 px-4 py-3 text-center text-gold font-bold text-sm border-2 border-gold rounded-md group-hover:bg-gold group-hover:text-white transition-all duration-300 uppercase tracking-wide">
                Details
              </span>
            </div>
          </div>
        </div>
      </Link>


      {/* Image Gallery Modal */}
      <ImageGallery
        images={GALLERY_IMAGES}
        isOpen={galleryOpen}
        onClose={handleCloseGallery}
        initialIndex={0}
      />
    </>
  );
};
