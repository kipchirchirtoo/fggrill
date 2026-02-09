'use client';

import React, { useState, useCallback } from 'react';
import { Bed, Building2, DollarSign, Camera, Upload, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { roomsAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  floor: number;
  status: string;
  price: number;
}

interface AddRoomWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomAdded: () => void;
  branchId: string | number;
  editRoom?: Room | null;
  mode?: 'add' | 'edit';
}

interface RoomFormData {
  room_number: string;
  room_type_id: string;
  floor: number;
  base_price: number;
  max_occupancy: number;
  amenities: string[];
  description: string;
  images: File[];
}

const ROOM_TYPES = [
  { id: '1', name: 'Standard Room', description: 'Basic accommodation' },
  { id: '2', name: 'Deluxe Room', description: 'Enhanced comfort' },
  { id: '3', name: 'Suite', description: 'Premium accommodation' },
  { id: '4', name: 'Executive Suite', description: 'Luxury accommodation' },
];

const AMENITIES = [
  'WiFi', 'Air Conditioning', 'TV', 'Mini Bar', 'Safe', 'Balcony',
  'Ocean View', 'City View', 'Kitchenette', 'Jacuzzi', 'Work Desk'
];

const WIZARD_STEPS = [
  { id: 1, title: 'Basic Info', description: 'Room details' },
  { id: 2, title: 'Pricing', description: 'Price & capacity' },
  { id: 3, title: 'Amenities', description: 'Features & notes' },
  { id: 4, title: 'Photos', description: 'Room images' },
];

export function AddRoomWizard({ isOpen, onClose, onRoomAdded, branchId, editRoom, mode = 'add' }: AddRoomWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [formData, setFormData] = useState<RoomFormData>({
    room_number: '',
    room_type_id: '1',
    floor: 1,
    base_price: 0,
    max_occupancy: 2,
    amenities: [],
    description: '',
    images: []
  });

  // Initialize form data when editing
  React.useEffect(() => {
    if (mode === 'edit' && editRoom) {
      const roomTypeId = ROOM_TYPES.find(t => t.name === editRoom.room_type)?.id || '1';
      setFormData({
        room_number: editRoom.room_number,
        room_type_id: roomTypeId,
        floor: editRoom.floor,
        base_price: editRoom.price || 0,
        max_occupancy: 2, // Default since we don't have this in Room interface
        amenities: [],
        description: '',
        images: []
      });
    } else if (mode === 'add') {
      // Reset form for add mode
      setFormData({
        room_number: '',
        room_type_id: '1',
        floor: 1,
        base_price: 0,
        max_occupancy: 2,
        amenities: [],
        description: '',
        images: []
      });
    }
  }, [mode, editRoom, isOpen]);

  const handleImageUpload = useCallback((files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`);
        return false;
      }
      return true;
    });

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...validFiles].slice(0, 6)
    }));
  }, []);

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const uploadImagesToSupabase = async (roomId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (let i = 0; i < formData.images.length; i++) {
      const file = formData.images[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${roomId}_${i + 1}.${fileExt}`;
      const filePath = `rooms/${branchId}/${fileName}`;

      try {
        const { error } = await supabase.storage
          .from('room-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (error) {
          console.error('Upload error:', error);
          // Don't throw - just skip this image and continue
          toast.warning(`Could not upload ${file.name} - RLS policy restriction`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('room-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      } catch (err) {
        console.error('Upload exception:', err);
        toast.warning(`Skipped ${file.name} due to upload error`);
      }
    }

    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!(formData.room_number || '').trim()) {
      toast.error('Room number is required');
      return;
    }

    if (formData.base_price <= 0) {
      toast.error('Base price must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'edit' && editRoom) {
        // Update existing room
        const updateData = {
          room_number: formData.room_number,
          room_type: ROOM_TYPES.find(t => t.id === formData.room_type_id)?.name || 'Standard Room',
          floor: formData.floor,
          price_override: formData.base_price,
          status: 'available'
        };

        const response = await roomsAPI.updateRoom(editRoom.id, updateData);

        if (response.success) {
          toast.success('Room updated successfully');
          onRoomAdded(); // This will refresh the room list
          onClose();
        } else {
          toast.error('Failed to update room');
        }
      } else {
        // Create new room
        const roomData = {
          room_number: formData.room_number,
          room_type: ROOM_TYPES.find(t => t.id === formData.room_type_id)?.name || 'Standard Room',
          floor: formData.floor,
          rate_per_night: formData.base_price,
          capacity: {
            adults: formData.max_occupancy,
            children: Math.floor(formData.max_occupancy / 2)
          },
          amenities: formData.amenities,
          status: 'available',
          branch_id: branchId
        };

        const response = await roomsAPI.createRoom(roomData);

        if (response.success) {
          if (formData.images.length > 0) {
            setUploadingImages(true);
            try {
              const imageUrls = await uploadImagesToSupabase(response.data.id);
              await roomsAPI.updateRoom(response.data.id, { images: imageUrls });
            } catch (imageError) {
              console.error('Image upload error:', imageError);
              toast.error('Room created but some images failed to upload');
            } finally {
              setUploadingImages(false);
            }
          }

          toast.success('Room added successfully');
          onRoomAdded();
          onClose();
          resetForm();
        } else {
          throw new Error(response.error || 'Failed to add room');
        }
      }
    } catch (error: any) {
      console.error('Error adding room:', error);
      toast.error(error.message || 'Failed to add room');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      room_number: '',
      room_type_id: '1',
      floor: 1,
      base_price: 0,
      max_occupancy: 2,
      amenities: [],
      description: '',
      images: []
    });
    setCurrentStep(1);
  };

  const nextStep = () => {
    if (currentStep < WIZARD_STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleAmenity = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return (formData.room_number || '').trim() && formData.floor > 0;
      case 2:
        return formData.base_price > 0;
      case 3:
      case 4:
        return true;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Room Number *
                </label>
                <Input
                  value={formData.room_number}
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                  placeholder="e.g., 101, 201A"
                  className="h-11"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Floor *
                </label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 1 })}
                  className="h-11"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Room Type
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ROOM_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, room_type_id: type.id })}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${formData.room_type_id === type.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <div className="font-semibold text-slate-800">{type.name}</div>
                    <div className="text-sm text-slate-500">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pricing & Capacity
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Base Price (KES) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.base_price || ''}
                  onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                  placeholder="Enter price per night"
                  className="h-11"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Max Occupancy
                </label>
                <select
                  value={formData.max_occupancy}
                  onChange={(e) => setFormData({ ...formData, max_occupancy: parseInt(e.target.value) })}
                  className="w-full h-11 px-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={num}>{num} guest{num > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-800 mb-3">Price Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Base rate:</span>
                  <span className="font-medium text-slate-800">KES {formData.base_price.toLocaleString()}/night</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Capacity:</span>
                  <span className="font-medium text-slate-800">{formData.max_occupancy} guests</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Bed className="h-5 w-5" />
              Amenities & Description
            </h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Room Amenities
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {AMENITIES.map((amenity) => (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${formData.amenities.includes(amenity)
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                  >
                    {amenity}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {formData.amenities.length} amenities selected
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Room Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the room features, view, or special characteristics..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Room Photos
            </h2>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleImageUpload(e.target.files)}
                className="hidden"
                id="room-images"
              />
              <label htmlFor="room-images" className="cursor-pointer block">
                <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <p className="text-base font-medium text-slate-700 mb-1">Upload Room Photos</p>
                <p className="text-sm text-slate-500">
                  Click to select images (max 6 photos, 5MB each)
                </p>
              </label>
            </div>
            {formData.images.length > 0 && (
              <div>
                <h4 className="font-medium text-slate-700 mb-3">
                  Selected Photos ({formData.images.length}/6)
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {formData.images.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Room photo ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 border-none bg-stone-50/50 backdrop-blur-xl">
        <div className="flex flex-col h-full bg-white/90 shadow-2xl overflow-hidden rounded-2xl">
          <DialogHeader className="p-8 pb-4 bg-stone-50 border-b border-stone-100">
            <DialogTitle className="text-3xl font-sf-pro-display font-bold tracking-tight text-stone-900">
              {mode === 'edit' ? `Refine Room ${editRoom?.room_number}` : 'Onboard New Room'}
            </DialogTitle>
            <p className="text-stone-500 text-sm mt-1">Complete the steps below to {mode === 'edit' ? 'update' : 'register'} a room in the system.</p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-8 pt-6">
            <div className="relative">
              {/* Progress Stepper */}
              <div className="relative flex justify-between mb-12 px-4">
                <div className="absolute top-5 left-8 right-8 h-[2px] bg-stone-100">
                  <div
                    className="h-full bg-stone-900 transition-all duration-500 ease-in-out"
                    style={{ width: `${((currentStep - 1) / (WIZARD_STEPS.length - 1)) * 100}%` }}
                  />
                </div>

                {WIZARD_STEPS.map((step) => (
                  <div key={step.id} className="relative z-10 flex flex-col items-center group">
                    <button
                      onClick={() => setCurrentStep(step.id)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-sf-pro-display font-bold transition-all duration-300 ${currentStep > step.id
                          ? 'bg-stone-900 text-white shadow-lg'
                          : currentStep === step.id
                            ? 'bg-stone-900 text-white ring-4 ring-stone-100 shadow-lg'
                            : 'bg-white text-stone-400 border-2 border-stone-200'
                        }`}
                    >
                      {currentStep > step.id ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        step.id
                      )}
                    </button>
                    <div className="mt-4 text-center">
                      <div className={`text-[11px] font-bold uppercase tracking-widest ${currentStep >= step.id ? 'text-stone-900' : 'text-stone-400'}`}>
                        {step.title}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Step Content with Animation Placeholder (Simplified) */}
              <div className="bg-white rounded-2xl p-2 min-h-[400px]">
                {renderStep()}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-8 bg-stone-50 border-t border-stone-100 flex justify-between items-center">
            <IOSButton
              variant="secondary"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="h-12 px-8 rounded-xl font-sf-pro-text font-semibold border-stone-200"
            >
              Back
            </IOSButton>

            <div className="flex gap-4">
              <IOSButton
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting || uploadingImages}
                className="h-12 px-6 rounded-xl font-bold text-stone-500 hover:text-stone-900"
              >
                Discard
              </IOSButton>

              {currentStep === WIZARD_STEPS.length ? (
                <IOSButton
                  onClick={handleSubmit}
                  disabled={isSubmitting || uploadingImages || !canProceed()}
                  className="h-12 px-10 rounded-xl font-sf-pro-display font-bold shadow-xl shadow-stone-900/10"
                >
                  {isSubmitting ? 'Syncing...' : uploadingImages ? 'Uploading Assets...' : 'Complete Registration'}
                </IOSButton>
              ) : (
                <IOSButton
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="h-12 px-10 rounded-xl font-sf-pro-display font-bold shadow-xl shadow-stone-900/10"
                >
                  Next Step
                </IOSButton>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
