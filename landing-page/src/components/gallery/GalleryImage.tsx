import React from 'react';

interface GalleryImageProps {
  src: string;
  alt: string;
  isLoading?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

export const GalleryImage: React.FC<GalleryImageProps> = () => {
  // Component implementation will be added in subsequent tasks
  return null;
};
