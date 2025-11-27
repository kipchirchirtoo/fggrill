import { supabase } from '../config/database';
import crypto from 'crypto';

export enum RoomType {
  STANDARD = 'standard',
  DELUXE = 'deluxe',
  SUITE = 'suite',
  EXECUTIVE = 'executive',
  FAMILY = 'family'
}

export enum RoomStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  CLEANING = 'cleaning',
  MAINTENANCE = 'maintenance',
  OUT_OF_ORDER = 'out-of-order',
  RESERVED = 'reserved'
}

export interface IMaintenanceRecord {
  id: string;
  issue: string;
  reportedAt: Date;
  reportedBy: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  cost?: number;
  notes?: string;
  status: 'pending' | 'in-progress' | 'resolved';
}

export interface IRoom {
  id: string;
  roomNumber: string;
  type: RoomType;
  floor: number;
  status: RoomStatus;
  currentGuest?: string;
  checkIn?: Date;
  checkOut?: Date;
  basePrice: number;
  currentPrice: number;
  description?: string;
  amenities: string[];
  photos?: string[];
  maxOccupancy: number;
  bedConfiguration: {
    single: number;
    double: number;
    queen: number;
    king: number;
  };
  squareMeters: number;
  view?: string;
  accessible: boolean;
  smoking: boolean;
  maintenanceHistory: IMaintenanceRecord[];
  cleaningSchedule: {
    lastCleaned?: Date;
    nextCleaning?: Date;
  };
  occupancyHistory: {
    checkIn: Date;
    checkOut: Date;
    guestId: string;
    bookingId: string;
  }[];
  ratings: {
    cleanliness: number;
    comfort: number;
    location: number;
    services: number;
    staff: number;
    valueForMoney: number;
    count: number;
  };
  reviews: Array<{
    guest: string;
    rating: number;
    comment: string;
    date: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export class Room implements IRoom {
  id: string;
  roomNumber: string;
  type: RoomType;
  floor: number;
  status: RoomStatus;
  currentGuest?: string;
  checkIn?: Date;
  checkOut?: Date;
  basePrice: number;
  currentPrice: number;
  description?: string;
  amenities: string[];
  photos?: string[];
  maxOccupancy: number;
  bedConfiguration: {
    single: number;
    double: number;
    queen: number;
    king: number;
  };
  squareMeters: number;
  view?: string;
  accessible: boolean;
  smoking: boolean;
  maintenanceHistory: IMaintenanceRecord[];
  cleaningSchedule: {
    lastCleaned?: Date;
    nextCleaning?: Date;
  };
  occupancyHistory: {
    checkIn: Date;
    checkOut: Date;
    guestId: string;
    bookingId: string;
  }[];
  ratings: {
    cleanliness: number;
    comfort: number;
    location: number;
    services: number;
    staff: number;
    valueForMoney: number;
    count: number;
  };
  reviews: Array<{
    guest: string;
    rating: number;
    comment: string;
    date: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<IRoom>) {
    this.id = data.id || crypto.randomUUID();
    this.roomNumber = data.roomNumber || '';
    this.type = data.type || RoomType.STANDARD;
    this.floor = data.floor || 1;
    this.status = data.status || RoomStatus.AVAILABLE;
    this.currentGuest = data.currentGuest;
    this.checkIn = data.checkIn;
    this.checkOut = data.checkOut;
    this.basePrice = data.basePrice || 0;
    this.currentPrice = data.currentPrice || 0;
    this.description = data.description;
    this.amenities = data.amenities || [];
    this.photos = data.photos;
    this.maxOccupancy = data.maxOccupancy || 2;
    this.bedConfiguration = data.bedConfiguration || { single: 0, double: 1, queen: 0, king: 0 };
    this.squareMeters = data.squareMeters || 25;
    this.view = data.view;
    this.accessible = data.accessible || false;
    this.smoking = data.smoking || false;
    this.maintenanceHistory = data.maintenanceHistory || [];
    this.cleaningSchedule = data.cleaningSchedule || {};
    this.occupancyHistory = data.occupancyHistory || [];
    this.ratings = data.ratings || { cleanliness: 0, comfort: 0, location: 0, services: 0, staff: 0, valueForMoney: 0, count: 0 };
    this.reviews = data.reviews || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async findById(id: string): Promise<Room | null> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return new Room(data);
  }

  static async findByNumber(roomNumber: string): Promise<Room | null> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_number', roomNumber)
      .single();

    if (error || !data) return null;
    return new Room(data);
  }

  static async findByType(type: RoomType): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('type', type);

    if (error || !data) return [];
    return data.map(room => new Room(room));
  }

  static async findByStatus(status: RoomStatus): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', status);

    if (error || !data) return [];
    return data.map(room => new Room(room));
  }

  static async findAvailable(): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', RoomStatus.AVAILABLE);

    if (error || !data) return [];
    return data.map(room => new Room(room));
  }

  async save(): Promise<Room> {
    const { data, error } = await supabase
      .from('rooms')
      .upsert([
        {
          id: this.id,
          room_number: this.roomNumber,
          type: this.type,
          floor: this.floor,
          status: this.status,
          current_guest: this.currentGuest,
          check_in: this.checkIn,
          check_out: this.checkOut,
          base_price: this.basePrice,
          current_price: this.currentPrice,
          description: this.description,
          amenities: this.amenities,
          photos: this.photos,
          max_occupancy: this.maxOccupancy,
          bed_configuration: this.bedConfiguration,
          square_meters: this.squareMeters,
          view: this.view,
          accessible: this.accessible,
          smoking: this.smoking,
          maintenance_history: this.maintenanceHistory,
          cleaning_schedule: this.cleaningSchedule,
          occupancy_history: this.occupancyHistory,
          ratings: this.ratings,
          reviews: this.reviews,
          updated_at: new Date()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return new Room(data);
  }

  async delete(): Promise<void> {
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', this.id);

    if (error) throw error;
  }

  async performCheckIn(guestId: string, bookingId: string): Promise<void> {
    this.status = RoomStatus.OCCUPIED;
    this.currentGuest = guestId;
    const checkInDate = new Date();
    this.checkIn = checkInDate;
    this.occupancyHistory = [
      ...(this.occupancyHistory || []),
      {
        checkIn: checkInDate,
        checkOut: this.checkOut || new Date(),
        guestId,
        bookingId
      }
    ];
    await this.save();
  }

  async performCheckOut(): Promise<void> {
    this.status = RoomStatus.CLEANING;
    this.currentGuest = undefined;
    this.checkIn = undefined;
    this.checkOut = undefined;
    if (this.occupancyHistory?.length) {
      this.occupancyHistory[this.occupancyHistory.length - 1].checkOut = new Date();
    }
    await this.save();
  }

  async addMaintenance(record: Omit<IMaintenanceRecord, 'id'>): Promise<void> {
    const newRecord = { ...record, id: crypto.randomUUID() };
    this.maintenanceHistory = [...(this.maintenanceHistory || []), newRecord];
    await this.save();
  }

  async updateMaintenance(recordId: string, updates: Partial<IMaintenanceRecord>): Promise<void> {
    this.maintenanceHistory = (this.maintenanceHistory || []).map(record =>
      record.id === recordId ? { ...record, ...updates } : record
    );
    await this.save();
  }

  async addReview(review: Omit<Room['reviews'][0], 'date'>): Promise<void> {
    this.reviews = [...(this.reviews || []), { ...review, date: new Date() }];
    
    // Update ratings
    const totalRatings = this.reviews.length;
    const sumRatings = this.reviews.reduce((acc, curr) => acc + curr.rating, 0);
    const avgRating = sumRatings / totalRatings;

    this.ratings = {
      ...this.ratings,
      valueForMoney: avgRating,
      count: totalRatings
    };

    await this.save();
  }

  async updatePrice(newPrice: number): Promise<void> {
    this.currentPrice = newPrice;
    await this.save();
  }

  async setStatus(status: RoomStatus): Promise<void> {
    this.status = status;
    await this.save();
  }

  async updateCleaning(cleaned: boolean = true): Promise<void> {
    const now = new Date();
    this.cleaningSchedule = {
      lastCleaned: cleaned ? now : this.cleaningSchedule?.lastCleaned,
      nextCleaning: cleaned ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : now
    };
    if (cleaned) {
      this.status = RoomStatus.AVAILABLE;
    }
    await this.save();
  }
}
