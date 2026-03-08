import React from 'react';

export const HotelCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden h-full flex flex-col animate-pulse">
      {/* Image Skeleton */}
      <div className="h-48 w-full bg-gray-300" />

      {/* Content Skeleton */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Title Skeleton */}
        <div className="h-6 bg-gray-300 rounded mb-2 w-3/4" />
        
        {/* Location Skeleton */}
        <div className="h-4 bg-gray-200 rounded mb-3 w-1/2" />

        {/* Description Skeleton */}
        <div className="space-y-2 mb-4 flex-1">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
        </div>

        {/* Button Skeleton */}
        <div className="h-5 bg-gray-300 rounded w-1/3 mt-auto" />
      </div>
    </div>
  );
};
