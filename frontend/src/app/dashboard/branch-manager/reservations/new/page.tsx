'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { IOSButton } from '@/components/ui/ios-button';
import { bookingsAPI, roomsAPI, guestAPI } from '@/lib/api';
import { ArrowLeft, Save, User, Calendar, Bed } from 'lucide-react';
import { toast } from 'sonner';

export default function NewReservationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    guest_id: '',
    room_id: '',
    check_in_date: new Date(),
    check_out_date: new Date(new Date().setDate(new Date().getDate() + 1)),
    adults: 1,
    children: 0,
    special_requests: '',
  });

  useEffect(() => {
    async function fetchInitialData() {
      setIsLoading(true);
      try {
        // Fetch room types
        const roomTypesResponse = await roomsAPI.getRoomTypes();
        if (roomTypesResponse.success) {
          setRoomTypes(roomTypesResponse.data || []);
        }

        // Fetch guests
        const guestsResponse = await guestAPI.getGuests();
        if (guestsResponse.success) {
          setGuests(guestsResponse.data || []);
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
        toast.error("Failed to load necessary data for booking.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchInitialData();
  }, []);

  useEffect(() => {
    // When check-in and check-out dates are set, fetch available rooms
    async function fetchAvailableRooms() {
      if (!formData.check_in_date || !formData.check_out_date) return;

      try {
        const checkInFormatted = formData.check_in_date.toISOString().split('T')[0];
        const checkOutFormatted = formData.check_out_date.toISOString().split('T')[0];

        const response = await bookingsAPI.getAvailableRooms(
          checkInFormatted,
          checkOutFormatted,
          formData.adults + formData.children
        );

        if (response.success) {
          setAvailableRooms(response.data || []);
        }
      } catch (error) {
        console.error("Error fetching available rooms:", error);
        toast.error("Failed to retrieve available rooms.");
      }
    }

    fetchAvailableRooms();
  }, [formData.check_in_date, formData.check_out_date, formData.adults, formData.children]);

  const handleSearchGuest = async () => {
    if (searchQuery.trim().length === 0) return;

    try {
      const response = await guestAPI.getGuests(searchQuery);
      if (response.success) {
        setGuests(response.data || []);
      }
    } catch (error) {
      console.error("Error searching for guests:", error);
      toast.error("Failed to search for guests.");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleDateChange = (name: string, date: Date | null) => {
    if (date) {
      setFormData({
        ...formData,
        [name]: date,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Calculate total nights
      const nights = Math.ceil(
        (formData.check_out_date.getTime() - formData.check_in_date.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get selected room price
      const selectedRoom = availableRooms.find(room => room.id === formData.room_id);
      const roomPrice = selectedRoom?.price_per_night || 0;

      // Calculate total amount
      const totalAmount = roomPrice * nights;

      // Create booking payload
      const bookingData = {
        guest_id: formData.guest_id,
        room_id: formData.room_id,
        check_in_date: formData.check_in_date.toISOString().split('T')[0],
        check_out_date: formData.check_out_date.toISOString().split('T')[0],
        adults: formData.adults,
        children: formData.children,
        special_requests: formData.special_requests,
        total_amount: totalAmount,
        nights: nights,
        status: "confirmed"
      };

      // Submit booking
      const response = await bookingsAPI.createBooking(bookingData);

      if (response.success) {
        toast.success("Reservation created successfully!");
        router.push('/dashboard/branch-manager/reservations');
      } else {
        throw new Error(response.message || "Failed to create reservation");
      }
    } catch (error: any) {
      console.error("Error creating reservation:", error);
      toast.error(error.message || "Failed to create reservation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">New Reservation</h1>
              <p className="text-gray-500">Create a new guest booking</p>
            </div>
            <IOSButton
              variant="secondary"
              onClick={() => router.push('/dashboard/branch-manager/reservations')}
              leftIcon={<ArrowLeft />}
            >
              Back to Reservations
            </IOSButton>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {/* Guest Information */}
              <IOSCard className="p-6">
                <h2 className="font-bold mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" /> Guest Information
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Search for guests by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <IOSButton type="button" onClick={handleSearchGuest}>
                      Search
                    </IOSButton>
                  </div>

                  <div>
                    <Label htmlFor="guest_id">Select Guest</Label>
                    <Select
                      value={formData.guest_id}
                      onValueChange={(value) => setFormData({ ...formData, guest_id: value })}
                      required
                    >
                      <SelectTrigger id="guest_id">
                        <SelectValue placeholder="Select a guest" />
                      </SelectTrigger>
                      <SelectContent>
                        {guests.map((guest) => (
                          <SelectItem key={guest.id} value={guest.id}>
                            {guest.firstName} {guest.lastName} - {guest.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </IOSCard>

              {/* Booking Details */}
              <IOSCard className="p-6">
                <h2 className="font-bold mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5" /> Booking Details
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="check_in_date">Check-in Date</Label>
                    <DatePicker
                      id="check_in_date"
                      selected={formData.check_in_date}
                      onChange={(date) => handleDateChange('check_in_date', date)}
                      minDate={new Date()}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="check_out_date">Check-out Date</Label>
                    <DatePicker
                      id="check_out_date"
                      selected={formData.check_out_date}
                      onChange={(date) => handleDateChange('check_out_date', date)}
                      minDate={new Date(formData.check_in_date.getTime() + 86400000)} // +1 day from check-in
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="adults">Adults</Label>
                    <Input
                      id="adults"
                      name="adults"
                      type="number"
                      min="1"
                      value={formData.adults}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="children">Children</Label>
                    <Input
                      id="children"
                      name="children"
                      type="number"
                      min="0"
                      value={formData.children}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </IOSCard>

              {/* Room Selection */}
              <IOSCard className="p-6">
                <h2 className="font-bold mb-4 flex items-center gap-2">
                  <Bed className="h-5 w-5" /> Room Selection
                </h2>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="room_id">Available Room</Label>
                    <Select
                      value={formData.room_id}
                      onValueChange={(value) => setFormData({ ...formData, room_id: value })}
                      required
                    >
                      <SelectTrigger id="room_id">
                        <SelectValue placeholder="Select a room" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRooms.map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            Room {room.room_number} - {room.room_type} (KES {room.price_per_night}/night)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {availableRooms.length === 0 && (
                      <p className="text-sm text-yellow-600 mt-1">
                        No available rooms for selected dates or criteria
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="special_requests">Special Requests</Label>
                    <textarea
                      id="special_requests"
                      name="special_requests"
                      className="w-full border border-gray-300 rounded-md p-2 resize-none"
                      rows={3}
                      value={formData.special_requests}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </IOSCard>

              {/* Form Actions */}
              <div className="flex justify-end space-x-2">
                <IOSButton
                  variant="secondary"
                  type="button"
                  onClick={() => router.push('/dashboard/branch-manager/reservations')}
                >
                  Cancel
                </IOSButton>
                <IOSButton
                  type="submit"
                  disabled={isSubmitting}
                  leftIcon={<Save />}
                >
                  {isSubmitting ? "Creating..." : "Create Reservation"}
                </IOSButton>
              </div>
            </div>
          </form>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
