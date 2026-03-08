import React from 'react';

interface GalleryThumbnailsProps {
  images: string[];
  currentIndex: number;
  onSelectImage: (index: number) => void;
  visible: boolean;
}

export const GalleryThumbnails: React.FC<GalleryThumbnailsProps> = ({
  images,
  currentIndex,
  onSelectImage,
  visible,
}) => {
  // Component implementation will be added in subsequent tasks
  return null;
};
