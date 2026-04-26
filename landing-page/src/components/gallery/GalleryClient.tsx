'use client';

import Image from 'next/image';
import { GALLERY_IMAGES } from '@/config/galleryImages';
import { useState } from 'react';
import { ImageGallery } from '@/components/gallery/ImageGallery';

export default function GalleryClient() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {GALLERY_IMAGES.map((img, i) => (
          <div 
            key={i} 
            className="relative h-80 rounded-xl overflow-hidden cursor-pointer group shadow-lg"
            onClick={() => {
              setCurrentIndex(i);
              setIsOpen(true);
            }}
          >
            <Image
              src={img.url}
              alt={img.alt || 'Famous Gates Hotels Gallery Image'}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          </div>
        ))}
      </div>

      <ImageGallery
        images={GALLERY_IMAGES}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialIndex={currentIndex}
      />
    </>
  );
}
