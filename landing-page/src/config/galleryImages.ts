/**
 * Gallery Images Configuration
 * 
 * This file contains the paths to all 72 hotel and amenity images
 * located in the public/FG GRILL PHOTOS directory.
 * 
 * Images are from the FamousGates Grill photo collection (IMG_8680.JPG - IMG_8907.JPG)
 * Note: Not all numbers in the range are sequential - only valid unique images are included.
 * Duplicate files (e.g., IMG_8803~2.jpg) are excluded.
 */

/**
 * Array of all gallery image paths
 * These paths are relative to the public directory
 */
export const GALLERY_IMAGES: string[] = [
  '/FG GRILL PHOTOS/IMG_8680.JPG',
  '/FG GRILL PHOTOS/IMG_8689.JPG',
  '/FG GRILL PHOTOS/IMG_8695.JPG',
  '/FG GRILL PHOTOS/IMG_8696.JPG',
  '/FG GRILL PHOTOS/IMG_8700.JPG',
  '/FG GRILL PHOTOS/IMG_8703.JPG',
  '/FG GRILL PHOTOS/IMG_8704.JPG',
  '/FG GRILL PHOTOS/IMG_8706.JPG',
  '/FG GRILL PHOTOS/IMG_8712.JPG',
  '/FG GRILL PHOTOS/IMG_8715.JPG',
  '/FG GRILL PHOTOS/IMG_8722.JPG',
  '/FG GRILL PHOTOS/IMG_8725.JPG',
  '/FG GRILL PHOTOS/IMG_8727.JPG',
  '/FG GRILL PHOTOS/IMG_8729.JPG',
  '/FG GRILL PHOTOS/IMG_8732.JPG',
  '/FG GRILL PHOTOS/IMG_8733.JPG',
  '/FG GRILL PHOTOS/IMG_8736.JPG',
  '/FG GRILL PHOTOS/IMG_8738.JPG',
  '/FG GRILL PHOTOS/IMG_8739.JPG',
  '/FG GRILL PHOTOS/IMG_8740.JPG',
  '/FG GRILL PHOTOS/IMG_8742.JPG',
  '/FG GRILL PHOTOS/IMG_8743.JPG',
  '/FG GRILL PHOTOS/IMG_8744.JPG',
  '/FG GRILL PHOTOS/IMG_8746.JPG',
  '/FG GRILL PHOTOS/IMG_8749.JPG',
  '/FG GRILL PHOTOS/IMG_8753.JPG',
  '/FG GRILL PHOTOS/IMG_8754.JPG',
  '/FG GRILL PHOTOS/IMG_8755.JPG',
  '/FG GRILL PHOTOS/IMG_8757.JPG',
  '/FG GRILL PHOTOS/IMG_8758.JPG',
  '/FG GRILL PHOTOS/IMG_8762.JPG',
  '/FG GRILL PHOTOS/IMG_8763.JPG',
  '/FG GRILL PHOTOS/IMG_8764.JPG',
  '/FG GRILL PHOTOS/IMG_8765.JPG',
  '/FG GRILL PHOTOS/IMG_8769.JPG',
  '/FG GRILL PHOTOS/IMG_8776.JPG',
  '/FG GRILL PHOTOS/IMG_8777.JPG',
  '/FG GRILL PHOTOS/IMG_8778.JPG',
  '/FG GRILL PHOTOS/IMG_8782.JPG',
  '/FG GRILL PHOTOS/IMG_8790.JPG',
  '/FG GRILL PHOTOS/IMG_8801.JPG',
  '/FG GRILL PHOTOS/IMG_8803.JPG',
  '/FG GRILL PHOTOS/IMG_8805.jpg',
  '/FG GRILL PHOTOS/IMG_8807.JPG',
  '/FG GRILL PHOTOS/IMG_8810.JPG',
  '/FG GRILL PHOTOS/IMG_8814.JPG',
  '/FG GRILL PHOTOS/IMG_8815.JPG',
  '/FG GRILL PHOTOS/IMG_8816.JPG',
  '/FG GRILL PHOTOS/IMG_8817.JPG',
  '/FG GRILL PHOTOS/IMG_8818.JPG',
  '/FG GRILL PHOTOS/IMG_8819.JPG',
  '/FG GRILL PHOTOS/IMG_8823.JPG',
  '/FG GRILL PHOTOS/IMG_8862.JPG',
  '/FG GRILL PHOTOS/IMG_8864.JPG',
  '/FG GRILL PHOTOS/IMG_8866.JPG',
  '/FG GRILL PHOTOS/IMG_8867.JPG',
  '/FG GRILL PHOTOS/IMG_8868.JPG',
  '/FG GRILL PHOTOS/IMG_8869.JPG',
  '/FG GRILL PHOTOS/IMG_8873.JPG',
  '/FG GRILL PHOTOS/IMG_8875.JPG',
  '/FG GRILL PHOTOS/IMG_8877.JPG',
  '/FG GRILL PHOTOS/IMG_8878.JPG',
  '/FG GRILL PHOTOS/IMG_8882.JPG',
  '/FG GRILL PHOTOS/IMG_8883.JPG',
  '/FG GRILL PHOTOS/IMG_8884.JPG',
  '/FG GRILL PHOTOS/IMG_8885.JPG',
  '/FG GRILL PHOTOS/IMG_8886.JPG',
  '/FG GRILL PHOTOS/IMG_8903.JPG',
  '/FG GRILL PHOTOS/IMG_8904.JPG',
  '/FG GRILL PHOTOS/IMG_8905.JPG',
  '/FG GRILL PHOTOS/IMG_8906.JPG',
  '/FG GRILL PHOTOS/IMG_8907.JPG',
];

/**
 * Total number of gallery images
 */
export const GALLERY_IMAGE_COUNT = GALLERY_IMAGES.length;

/**
 * Helper function to get a specific image by index
 * @param index - The index of the image (0-based)
 * @returns The image path or undefined if index is out of bounds
 */
export const getGalleryImage = (index: number): string | undefined => {
  if (index < 0 || index >= GALLERY_IMAGES.length) {
    return undefined;
  }
  return GALLERY_IMAGES[index];
};

/**
 * Helper function to get a random gallery image
 * @returns A random image path from the gallery
 */
export const getRandomGalleryImage = (): string => {
  const randomIndex = Math.floor(Math.random() * GALLERY_IMAGES.length);
  return GALLERY_IMAGES[randomIndex];
};
