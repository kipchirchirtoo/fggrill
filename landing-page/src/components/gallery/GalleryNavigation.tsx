import React from 'react';

interface GalleryNavigationProps {
  currentIndex: number;
  totalImages: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

export const GalleryNavigation: React.FC<GalleryNavigationProps> = ({
  currentIndex,
  totalImages,
  onNext,
  onPrevious,
  onClose,
}) => {
  // Component implementation will be added in subsequent tasks
  return null;
};
