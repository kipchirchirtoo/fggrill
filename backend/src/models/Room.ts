import { supabase } from '../config/database';
import crypto from 'crypto';

export enum RoomType {
  STANDARD = 'Standard',
  DELUXE = 'Deluxe',
  SUITE = 'Suite'
}

export enum RoomStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  CLEANING = 'cleaning',
  MAINTENANCE = 'maintenance',
  OUT_OF_ORDER = 'out_of_order',
  RESERVED = 'occupied' // Map reserved to occupied for now if needed, or stick to available
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
  priceOverride?: number;
  basePrice?: number;
  currentPrice?: number;
  amenities: string[];
  imageUrl?: string;
  description?: string;
  maxOccupancy: number;
  bedConfiguration: {
    single: number;
    double: number;
    queen: number;
    king: number;
  };
  beds?: {
    single: number;
    double: number;
    queen: number;
    king: number;
  };
  squareMeters: number;
  area?: number;
  view?: string;
  accessible: boolean;
  smoking: boolean;
  isActive?: boolean;
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
  priceOverride?: number;
  basePrice?: number;
  currentPrice?: number;
  amenities: string[];
  imageUrl?: string;
  description?: string;
  maxOccupancy: number;
  bedConfiguration: {
    single: number;
    double: number;
    queen: number;
    king: number;
  };
  beds?: {
    single: number;
    double: number;
    queen: number;
    king: number;
  };
  squareMeters: number;
  area?: number;
  view?: string;
  accessible: boolean;
  smoking: boolean;
  isActive?: boolean;
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
    this.priceOverride = data.priceOverride;
    this.basePrice = data.basePrice;
    this.currentPrice = data.currentPrice;
    this.amenities = data.amenities || [];
    this.imageUrl = data.imageUrl;
    this.description = data.description;
    this.maxOccupancy = data.maxOccupancy || 2;
    this.bedConfiguration = data.bedConfiguration || data.beds || { single: 0, double: 1, queen: 0, king: 0 };
    this.beds = data.beds || this.bedConfiguration;
    this.squareMeters = data.squareMeters || data.area || 25;
    this.area = data.area || this.squareMeters;
    this.view = data.view;
    this.accessible = data.accessible || false;
    this.smoking = data.smoking || false;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.maintenanceHistory = data.maintenanceHistory || [];
    this.cleaningSchedule = data.cleaningSchedule || {};
    this.occupancyHistory = data.occupancyHistory || [];
    this.ratings = data.ratings || { cleanliness: 0, comfort: 0, location: 0, services: 0, staff: 0, valueForMoney: 0, count: 0 };
    this.reviews = data.reviews || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async create(data: Partial<IRoom> | Partial<IRoom>[]): Promise<any> {
    if (Array.isArray(data)) {
      const rooms = data.map(d => new Room(d));
      return await Promise.all(rooms.map(r => r.save()));
    }
    const room = new Room(data);
    return await room.save();
  }

  static async findByIdAndUpdate(id: string, update: Partial<IRoom>): Promise<Room | null> {
    const room = await Room.findById(id);
    if (!room) return null;

    Object.assign(room, update);
    return await room.save();
  }

  static async findById(id: string): Promise<Room | null> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, type:room_types!type_id(*)')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return new Room(data);
  }

  static async findByNumber(roomNumber: string): Promise<Room | null> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, type:room_types!type_id(*)')
      .eq('room_number', roomNumber)
      .single();

    if (error || !data) return null;
    return new Room(data);
  }

  static async findByType(type: RoomType): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, type:room_types!type_id(*)')
      .eq('type:room_types.name', type);

    if (error || !data) return [];
    return (data as any[]).map(room => new Room(room));
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
          type_id: this.type, // Map enum to type_id UUID later if needed, or assume it stores UUID
          floor: this.floor,
          status: this.status,
          price_override: this.priceOverride,
          amenities: this.amenities,
          image_url: this.imageUrl,
          max_occupancy: this.maxOccupancy,
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
    this.priceOverride = newPrice;
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
