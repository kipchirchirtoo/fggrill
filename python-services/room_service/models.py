"""
Pydantic models for Room Service
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime, date
from enum import Enum


class RoomStatus(str, Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"
    CLEANING = "cleaning"
    RESERVED = "reserved"


class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


# Request Models
class AvailabilityRequest(BaseModel):
    check_in: date
    check_out: date
    guests: int = Field(default=1, ge=1)
    room_type_id: Optional[str] = None
    branch_id: Optional[str] = None


class RoomSearchRequest(BaseModel):
    branch_id: Optional[str] = None
    room_type_id: Optional[str] = None
    status: Optional[RoomStatus] = None
    floor: Optional[int] = None
    min_capacity: Optional[int] = None


class OccupancyRequest(BaseModel):
    branch_id: Optional[str] = None
    start_date: date
    end_date: date


class VacancyForecastRequest(BaseModel):
    branch_id: Optional[str] = None
    days_ahead: int = Field(default=30, ge=1, le=365)


# Response Models
class RoomType(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    base_price: float
    capacity: int
    amenities: Optional[List[str]] = []


class Room(BaseModel):
    id: str
    room_number: str
    room_type_id: Optional[str] = None
    room_type: Optional[RoomType] = None
    floor: Optional[int] = None
    status: RoomStatus = RoomStatus.AVAILABLE
    capacity: int = 2
    base_price: float = 0
    branch_id: Optional[str] = None
    amenities: Optional[List[str]] = []
    notes: Optional[str] = None


class AvailableRoom(BaseModel):
    id: str
    room_number: str
    type: Any  # Can be string or RoomType object
    capacity: int
    price_per_night: float
    amenities: List[str] = []
    floor: Optional[int] = None


class OccupiedRoom(BaseModel):
    room_id: str
    room_number: str
    room_type: str
    guest_name: Optional[str] = None
    check_in_date: date
    check_out_date: date
    days_remaining: int
    booking_id: str
    booking_status: str


class OccupancyStats(BaseModel):
    total_rooms: int
    occupied_rooms: int
    available_rooms: int
    maintenance_rooms: int
    cleaning_rooms: int
    occupancy_rate: float
    vacancy_rate: float
    adr: float = 0  # Average Daily Rate
    revpar: float = 0  # Revenue Per Available Room


class DailyOccupancy(BaseModel):
    date: date
    total_rooms: int
    occupied: int
    available: int
    occupancy_rate: float
    expected_checkouts: int
    expected_checkins: int


class VacancyForecast(BaseModel):
    date: date
    available_rooms: int
    expected_occupancy: float
    reservations: int
    potential_revenue: float


class RoomAvailabilityResponse(BaseModel):
    success: bool
    data: List[AvailableRoom]
    total_available: int
    check_in: date
    check_out: date
    nights: int
    message: Optional[str] = None


class OccupancyResponse(BaseModel):
    success: bool
    data: OccupancyStats
    occupied_rooms: List[OccupiedRoom]
    message: Optional[str] = None


class VacancyForecastResponse(BaseModel):
    success: bool
    data: List[VacancyForecast]
    summary: dict
    message: Optional[str] = None


class RoomStatusUpdate(BaseModel):
    room_id: str
    status: RoomStatus
    notes: Optional[str] = None


class BranchStats(BaseModel):
    branch_id: str
    branch_name: str
    total_rooms: int
    occupied: int
    available: int
    occupancy_rate: float
    today_checkouts: int
    today_checkins: int
