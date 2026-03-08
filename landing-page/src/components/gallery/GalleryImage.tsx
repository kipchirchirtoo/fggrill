import React from 'react';

interface GalleryImageProps {
  src: string;
  alt: string;
  isLoading?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

export const GalleryImage: React.FC<GalleryImageProps> = ({
  src,
  alt,
  isLoading = false,
  onLoad,
  onError,
}) => {
  // Component implementation will be added in subsequent tasks
  return null;
};
