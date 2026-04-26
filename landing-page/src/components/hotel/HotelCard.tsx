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
      <div className="group bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 h-full flex flex-col">
        <Link href={`/hotels/${hotel.id}`} className="block relative h-48 w-full overflow-hidden">
          <Image
            src={hotel.primaryImage}
            alt={hotel.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </Link>

        {/* Hotel Info */}
        <div className="p-4 flex-1 flex flex-col">
          <Link href={`/hotels/${hotel.id}`} className="block">
            <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
              {hotel.name}
            </h3>
          </Link>
          
          <p className="text-sm text-gray-600 mb-3 flex items-center">
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {hotel.location}
          </p>

          <p className="text-sm text-gray-700 mb-4 line-clamp-3 flex-1">
            {hotel.shortDescription || hotel.description}
          </p>

          <div className="mt-auto flex flex-col gap-2">
            <div className="flex gap-2">
              {/* View Room Button */}
              <button
                ref={viewRoomButtonRef}
                onClick={handleViewRoom}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label={`View room photos for ${hotel.name}`}
              >
                Quick View
              </button>
              
              {/* View Details Link */}
              <Link 
                href={`/hotels/${hotel.id}`}
                className="flex-1 px-4 py-2 text-center text-blue-600 font-medium text-sm border border-blue-600 rounded-md hover:bg-blue-50 transition-colors"
              >
                View Details
              </Link>
            </div>
          </div>
        </div>
      </div>

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
