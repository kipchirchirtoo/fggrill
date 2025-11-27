import request from 'supertest';
import { app } from '../../server';
import { Room, RoomType, RoomStatus } from '../../models/Room';
import { Booking, BookingStatus, PaymentStatus } from '../../models/Booking';
import { getTestUserWithToken } from '../../test/helpers';
import { mockEmailService, mockSMSService } from '../../test/mocks/services';
import { UserRole } from '../../models/User';

jest.mock('../../services/email.service', () => ({
  emailService: mockEmailService
}));

jest.mock('../../services/sms.service', () => ({
  smsService: mockSMSService
}));

describe('Booking Controller', () => {
  let room: any;
  const bookingData = {
    guest: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+254712345678'
    },
    roomType: RoomType.STANDARD,
    checkIn: new Date('2024-12-01'),
    checkOut: new Date('2024-12-03'),
    adults: 2,
    children: 0,
    specialRequests: 'Early check-in if possible'
  };

  beforeEach(async () => {
    // Create a test room
    room = await Room.create({
      roomNumber: '101',
      type: RoomType.STANDARD,
      floor: 1,
      status: RoomStatus.AVAILABLE,
      basePrice: 5000,
      currentPrice: 5000,
      maxOccupancy: 2,
      beds: { single: 2, double: 0, queen: 0, king: 0 },
      area: 25,
      amenities: [
        { name: 'WiFi', icon: 'wifi' },
        { name: 'TV', icon: 'tv' }
      ],
      isActive: true
    });
  });

  describe('GET /api/bookings', () => {
    it('should get all bookings for admin', async () => {
      const { token } = await getTestUserWithToken(UserRole.SUPER_ADMIN);

      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should not allow access without auth', async () => {
      const response = await request(app)
        .get('/api/bookings');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/bookings', () => {
    it('should create a new booking', async () => {
      const { token } = await getTestUserWithToken(UserRole.RECEPTIONIST);

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...bookingData,
          roomNumber: room.roomNumber
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.bookingNumber).toBeDefined();
      expect(response.body.data.status).toBe(BookingStatus.PENDING);
      expect(response.body.data.paymentStatus).toBe(PaymentStatus.PENDING);

      // Verify notifications were sent
      expect(mockEmailService.sendBookingConfirmation).toHaveBeenCalled();
      expect(mockSMSService.sendBookingConfirmation).toHaveBeenCalled();
    });

    it('should not create booking for unavailable room', async () => {
      const { token } = await getTestUserWithToken(UserRole.RECEPTIONIST);

      // Make room unavailable
      await Room.findByIdAndUpdate(room.id, {
        status: RoomStatus.OCCUPIED
      });

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...bookingData,
          roomNumber: room.roomNumber
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Room is not available for the selected dates');
    });
  });

  describe('GET /api/bookings/:id', () => {
    it('should get booking by ID', async () => {
      const { token } = await getTestUserWithToken(UserRole.RECEPTIONIST);

      // Create a booking first
      const booking = await Booking.create({
        ...bookingData,
        roomNumber: room.roomNumber,
        bookingNumber: 'BK123456',
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING
      });

      const response = await request(app)
        .get(`/api/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.bookingNumber).toBe(booking.bookingNumber);
    });

    it('should return 404 for non-existent booking', async () => {
      const { token } = await getTestUserWithToken(UserRole.RECEPTIONIST);

      const response = await request(app)
        .get('/api/bookings/nonexistentid')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/bookings/:id', () => {
    let booking: any;

    beforeEach(async () => {
      booking = await Booking.create({
        ...bookingData,
        roomNumber: room.roomNumber,
        bookingNumber: 'BK123456',
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING
      });
    });

    it('should update booking details', async () => {
      const { token } = await getTestUserWithToken(UserRole.RECEPTIONIST);

      const updateData = {
        specialRequests: 'Late check-out requested',
        adults: 1
      };

      const response = await request(app)
        .put(`/api/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.specialRequests).toBe(updateData.specialRequests);
      expect(response.body.data.adults).toBe(updateData.adults);
    });

    it('should handle check-in status update', async () => {
      const { token } = await getTestUserWithToken(UserRole.RECEPTIONIST);

      const response = await request(app)
        .put(`/api/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: BookingStatus.CHECKED_IN
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(BookingStatus.CHECKED_IN);

      // Verify room status was updated
      const updatedRoom = await Room.findById(room.id);
      expect(updatedRoom?.status).toBe(RoomStatus.OCCUPIED);
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    it('should delete booking (admin only)', async () => {
      const { token } = await getTestUserWithToken(UserRole.SUPER_ADMIN);

      const booking = await Booking.create({
        ...bookingData,
        roomNumber: room.roomNumber,
        bookingNumber: 'BK123456',
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING
      });

      const response = await request(app)
        .delete(`/api/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify booking was deleted
      const deletedBooking = await Booking.findById(booking.id);
      expect(deletedBooking).toBeNull();
    });

    it('should not allow non-admin to delete booking', async () => {
      const { token } = await getTestUserWithToken(UserRole.RECEPTIONIST);

      const booking = await Booking.create({
        ...bookingData,
        roomNumber: room.roomNumber,
        bookingNumber: 'BK123456',
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING
      });

      const response = await request(app)
        .delete(`/api/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/bookings/:id/payment', () => {
    let booking: any;

    beforeEach(async () => {
      booking = await Booking.create({
        ...bookingData,
        roomNumber: room.roomNumber,
        bookingNumber: 'BK123456',
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
        totalAmount: 15000
      });
    });

    it('should process full payment', async () => {
      const { token } = await getTestUserWithToken(UserRole.RECEPTIONIST);

      const response = await request(app)
        .post(`/api/bookings/${booking.id}/payment`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 15000,
          method: 'cash'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.paymentStatus).toBe(PaymentStatus.PAID);
      expect(response.body.data.payments).toHaveLength(1);
      expect(response.body.data.payments[0].amount).toBe(15000);
    });

    it('should process partial payment', async () => {
      const { token } = await getTestUserWithToken(UserRole.RECEPTIONIST);

      const response = await request(app)
        .post(`/api/bookings/${booking.id}/payment`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 7500,
          method: 'card'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.paymentStatus).toBe(PaymentStatus.PARTIAL);
      expect(response.body.data.payments).toHaveLength(1);
      expect(response.body.data.payments[0].amount).toBe(7500);
    });
  });
});
