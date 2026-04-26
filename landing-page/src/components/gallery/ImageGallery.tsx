import React, { useState, useCallback, useEffect, useMemo } from 'react';

interface ImageGalleryProps {
  images: { url: string; alt: string }[];
  initialIndex?: number;
  onClose: () => void;
  isOpen: boolean;
}

// Image preloading utility
const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    const img = new globalThis.Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  initialIndex = 0,
  onClose,
  isOpen,
}) => {
  // State management
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set([initialIndex]));
  const [isLoading, setIsLoading] = useState(false);
  const [thumbnailsVisible, setThumbnailsVisible] = useState(true);

  // Memoize images array to prevent unnecessary re-renders
  const galleryImages = useMemo(() => images, [images]);

  // Navigation handlers
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % galleryImages.length);
  }, [galleryImages.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  }, [galleryImages.length]);

  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < galleryImages.length) {
      setCurrentIndex(index);
    }
  }, [galleryImages.length]);

  // Preload adjacent images when currentIndex changes
  useEffect(() => {
    if (!isOpen) return;

    const preloadAdjacent = async () => {
      const prevIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
      const nextIndex = (currentIndex + 1) % galleryImages.length;

      const toPreload = [prevIndex, nextIndex].filter(
        (idx) => !loadedImages.has(idx)
      );

      if (toPreload.length === 0) return;

      setIsLoading(true);

      try {
        await Promise.all(toPreload.map((idx) => preloadImage(galleryImages[idx].url)));

        setLoadedImages((prev) => {
          const updated = new Set(prev);
          toPreload.forEach((idx) => updated.add(idx));
          return updated;
        });
      } catch (error) {
        console.error('Failed to preload images:', error);
      } finally {
        setIsLoading(false);
      }
    };

    preloadAdjacent();
  }, [currentIndex, galleryImages, loadedImages, isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setLoadedImages(new Set([initialIndex]));
      setThumbnailsVisible(true);
    }
  }, [isOpen, initialIndex]);

  // Keyboard event handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevious();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Home':
          e.preventDefault();
          goToIndex(0);
          break;
        case 'End':
          e.preventDefault();
          goToIndex(galleryImages.length - 1);
          break;
        case 't':
        case 'T':
          e.preventDefault();
          setThumbnailsVisible((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNext, goToPrevious, onClose, goToIndex, galleryImages.length]);

  // Body scroll lock when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-95"
      role="dialog"
      aria-modal="true"
      aria-label="Image Gallery"
    >
      {/* Hidden instructions for screen readers */}
      <div id="gallery-instructions" className="sr-only">
        Use arrow keys to navigate between images. Press Escape to close the gallery.
        Press T to toggle thumbnails.
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-75 text-white transition-all"
        aria-label="Close gallery"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Previous button */}
      <button
        onClick={goToPrevious}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-50 hover:bg-opacity-75 text-white transition-all"
        aria-label="Previous image"
      >
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      {/* Next button */}
      <button
        onClick={goToNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-50 hover:bg-opacity-75 text-white transition-all"
        aria-label="Next image"
      >
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {/* Image counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black bg-opacity-50 text-white text-sm">
        {currentIndex + 1} / {galleryImages.length}
      </div>

      {/* Main image display */}
      <div className="flex items-center justify-center h-full w-full p-4">
        <img
          src={galleryImages[currentIndex].url}
          alt={galleryImages[currentIndex].alt}
          className="max-w-full max-h-[80vh] object-contain"
          loading="eager"
        />
      </div>


      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}

      {/* Thumbnail strip */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 transition-transform duration-300 ${
          thumbnailsVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex gap-2 p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {galleryImages.map((image, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              className={`flex-shrink-0 w-20 h-20 rounded overflow-hidden border-2 transition-all ${
                index === currentIndex
                  ? 'border-white scale-110'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
              aria-label={`Go to image ${index + 1}`}
              aria-current={index === currentIndex ? 'true' : 'false'}
            >
              <img
                src={image.url}
                alt={`Thumbnail: ${image.alt}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>

          ))}
        </div>
      </div>
    </div>
  );
};
