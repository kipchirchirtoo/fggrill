"""
Room Service - Business Logic
Handles room availability, occupancy, and vacancy calculations
"""
import os
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from supabase import create_client, Client
from dotenv import load_dotenv

from room_service.models import (
    Room, RoomType, AvailableRoom, OccupiedRoom, OccupancyStats,
    DailyOccupancy, VacancyForecast, RoomStatus, BookingStatus, BranchStats
)

load_dotenv()


class RoomService:
    def __init__(self):
        self._supabase: Client | None = None

    @property
    def supabase(self) -> Client:
        if self._supabase is None:
            supabase_url = os.getenv("SUPABASE_URL") or os.getenv("SUPABASE_PROJECT_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
            if not supabase_url or not supabase_key:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
            self._supabase = create_client(supabase_url, supabase_key)
        return self._supabase

    # ==================== ROOM AVAILABILITY ====================
    
    async def check_availability(
        self,
        check_in: date,
        check_out: date,
        guests: int = 1,
        room_type_id: Optional[str] = None,
        branch_id: Optional[str] = None
    ) -> List[AvailableRoom]:
        """
        Check room availability for given dates.
        Returns rooms that are not occupied during the specified period.
        """
        try:
            # Get all rooms with their types
            # Explicitly use the rooms_type_id_fkey relationship to avoid ambiguity
            query = self.supabase.table("rooms").select(
                "*, room_types!rooms_type_id_fkey(*)"
            )
            
            if room_type_id:
                query = query.eq("room_type_id", room_type_id)
            if branch_id:
                query = query.eq("branch_id", branch_id)
            
            # Exclude rooms under maintenance
            query = query.neq("status", "maintenance")
            
            rooms_result = query.execute()
            all_rooms = rooms_result.data if rooms_result.data else []
            
            if not all_rooms:
                return []
            
            # Get room IDs
            room_ids = [room["id"] for room in all_rooms]
            
            # Find bookings that overlap with requested dates
            # A booking overlaps if: booking_check_in < check_out AND booking_check_out > check_in
            bookings_query = self.supabase.table("bookings").select(
                "room_id, check_in_date, check_out_date, status"
            ).in_("room_id", room_ids).in_(
                "status", ["confirmed", "checked_in", "pending"]
            ).lt("check_in_date", check_out.isoformat()).gt(
                "check_out_date", check_in.isoformat()
            )
            
            bookings_result = bookings_query.execute()
            occupied_room_ids = set()
            
            if bookings_result.data:
                for booking in bookings_result.data:
                    occupied_room_ids.add(booking["room_id"])
            
            # Filter out occupied rooms and check capacity
            available_rooms: List[AvailableRoom] = []
            for room in all_rooms:
                if room["id"] not in occupied_room_ids:
                    room_type = room.get("room_types", {})
                    
                    # Check capacity (from room type)
                    capacity = room_type.get("capacity", 2) if room_type else 2
                    if capacity < guests:
                        continue
                        
                    available_rooms.append(AvailableRoom(
                        id=room["id"],
                        room_number=room.get("room_number", ""),
                        type=room_type if room_type else room.get("type", "Standard"),
                        capacity=capacity,
                        price_per_night=room.get("price_override") or (room_type.get("base_price", 0) if room_type else 0),
                        amenities=room.get("amenities", []) or [],
                        floor=room.get("floor")
                    ))
            
            return available_rooms
            
        except Exception as e:
            print(f"Error checking availability: {e}")
            raise

    # ==================== OCCUPANCY STATS ====================
    
    async def get_current_occupancy(
        self,
        branch_id: Optional[str] = None
    ) -> OccupancyStats:
        """
        Get current occupancy statistics.
        """
        try:
            today = date.today()
            
            # Get all rooms
            rooms_query = self.supabase.table("rooms").select("id, status, base_price")
            if branch_id:
                rooms_query = rooms_query.eq("branch_id", branch_id)
            
            rooms_result = rooms_query.execute()
            all_rooms = rooms_result.data if rooms_result.data else []
            
            total_rooms = len(all_rooms)
            maintenance_rooms = sum(1 for r in all_rooms if r.get("status") == "maintenance")
            cleaning_rooms = sum(1 for r in all_rooms if r.get("status") == "cleaning")
            
            # Get current bookings (checked in)
            room_ids = [room["id"] for room in all_rooms]
            
            bookings_query = self.supabase.table("bookings").select(
                "room_id, total_amount"
            ).in_("room_id", room_ids).eq(
                "status", "checked_in"
            ).lte("check_in_date", today.isoformat()).gte(
                "check_out_date", today.isoformat()
            )
            
            bookings_result = bookings_query.execute()
            current_bookings = bookings_result.data if bookings_result.data else []
            
            occupied_rooms = len(current_bookings)
            available_rooms = total_rooms - occupied_rooms - maintenance_rooms - cleaning_rooms
            
            # Calculate rates
            sellable_rooms = total_rooms - maintenance_rooms
            occupancy_rate = (occupied_rooms / sellable_rooms * 100) if sellable_rooms > 0 else 0
            vacancy_rate = 100 - occupancy_rate
            
            # Calculate ADR (Average Daily Rate)
            total_revenue = sum(b.get("total_amount", 0) or 0 for b in current_bookings)
            adr = total_revenue / occupied_rooms if occupied_rooms > 0 else 0
            
            # Calculate RevPAR (Revenue Per Available Room)
            revpar = total_revenue / sellable_rooms if sellable_rooms > 0 else 0
            
            return OccupancyStats(
                total_rooms=total_rooms,
                occupied_rooms=occupied_rooms,
                available_rooms=available_rooms,
                maintenance_rooms=maintenance_rooms,
                cleaning_rooms=cleaning_rooms,
                occupancy_rate=round(occupancy_rate, 2),
                vacancy_rate=round(vacancy_rate, 2),
                adr=round(adr, 2),
                revpar=round(revpar, 2)
            )
            
        except Exception as e:
            print(f"Error getting occupancy: {e}")
            raise

    async def get_occupied_rooms(
        self,
        branch_id: Optional[str] = None
    ) -> List[OccupiedRoom]:
        """
        Get list of currently occupied rooms with guest details and checkout dates.
        """
        try:
            today = date.today()
            
            # Get current bookings with room and guest details
            # Use explicit rooms_type_id_fkey relationship for room_types
            query = self.supabase.table("bookings").select(
                "id, room_id, check_in_date, check_out_date, status, "
                "rooms(id, room_number, room_types!rooms_type_id_fkey(name)), "
                "guests(id, first_name, last_name)"
            ).in_(
                "status", ["checked_in", "confirmed"]
            ).lte("check_in_date", today.isoformat()).gte(
                "check_out_date", today.isoformat()
            )
            
            result = query.execute()
            bookings = result.data if result.data else []
            
            occupied_rooms: List[OccupiedRoom] = []
            for booking in bookings:
                room = booking.get("rooms", {})
                guest = booking.get("guests", {})
                checkout = datetime.fromisoformat(booking["check_out_date"]).date()
                days_remaining = (checkout - today).days
                
                guest_name = None
                if guest:
                    first = guest.get("first_name", "")
                    last = guest.get("last_name", "")
                    guest_name = f"{first} {last}".strip() or None
                
                room_type_name = "Standard"
                if room and room.get("room_types"):
                    room_type_name = room["room_types"].get("name", "Standard")
                
                occupied_rooms.append(OccupiedRoom(
                    room_id=booking["room_id"],
                    room_number=room.get("room_number", "N/A") if room else "N/A",
                    room_type=room_type_name,
                    guest_name=guest_name,
                    check_in_date=datetime.fromisoformat(booking["check_in_date"]).date(),
                    check_out_date=checkout,
                    days_remaining=max(0, days_remaining),
                    booking_id=booking["id"],
                    booking_status=booking["status"]
                ))
            
            return occupied_rooms
            
        except Exception as e:
            print(f"Error getting occupied rooms: {e}")
            raise

    # ==================== OCCUPANCY HISTORY ====================
    
    async def get_occupancy_history(
        self,
        start_date: date,
        end_date: date,
        branch_id: Optional[str] = None
    ) -> List[DailyOccupancy]:
        """
        Get historical occupancy data for date range.
        """
        try:
            # Get total rooms
            rooms_query = self.supabase.table("rooms").select("id")
            if branch_id:
                rooms_query = rooms_query.eq("branch_id", branch_id)
            
            rooms_result = rooms_query.execute()
            room_ids = [r["id"] for r in (rooms_result.data or [])]
            total_rooms = len(room_ids)
            
            if total_rooms == 0:
                return []
            
            # Get all bookings in date range
            bookings_query = self.supabase.table("bookings").select(
                "room_id, check_in_date, check_out_date, status"
            ).in_("room_id", room_ids).in_(
                "status", ["confirmed", "checked_in", "checked_out"]
            ).lte("check_in_date", end_date.isoformat()).gte(
                "check_out_date", start_date.isoformat()
            )
            
            bookings_result = bookings_query.execute()
            bookings = bookings_result.data if bookings_result.data else []
            
            # Calculate daily occupancy
            daily_data: List[DailyOccupancy] = []
            current_date = start_date
            
            while current_date <= end_date:
                occupied = 0
                checkouts = 0
                checkins = 0
                
                for booking in bookings:
                    b_checkin = datetime.fromisoformat(booking["check_in_date"]).date()
                    b_checkout = datetime.fromisoformat(booking["check_out_date"]).date()
                    
                    # Count occupancy
                    if b_checkin <= current_date < b_checkout:
                        occupied += 1
                    
                    # Count checkouts
                    if b_checkout == current_date:
                        checkouts += 1
                    
                    # Count checkins
                    if b_checkin == current_date:
                        checkins += 1
                
                available = total_rooms - occupied
                occupancy_rate = (occupied / total_rooms * 100) if total_rooms > 0 else 0
                
                daily_data.append(DailyOccupancy(
                    date=current_date,
                    total_rooms=total_rooms,
                    occupied=occupied,
                    available=available,
                    occupancy_rate=round(occupancy_rate, 2),
                    expected_checkouts=checkouts,
                    expected_checkins=checkins
                ))
                
                current_date += timedelta(days=1)
            
            return daily_data
            
        except Exception as e:
            print(f"Error getting occupancy history: {e}")
            raise

    # ==================== VACANCY FORECAST ====================
    
    async def get_vacancy_forecast(
        self,
        days_ahead: int = 30,
        branch_id: Optional[str] = None
    ) -> List[VacancyForecast]:
        """
        Forecast vacancy for upcoming days based on reservations.
        """
        try:
            today = date.today()
            end_date = today + timedelta(days=days_ahead)
            
            # Get total rooms and average price
            # Use explicit rooms_type_id_fkey relationship for room_types
            rooms_query = self.supabase.table("rooms").select(
                "id, price_override, room_types!rooms_type_id_fkey(base_price)"
            )
            if branch_id:
                rooms_query = rooms_query.eq("branch_id", branch_id)
            
            rooms_result = rooms_query.execute()
            rooms = rooms_result.data if rooms_result.data else []
            room_ids = [r["id"] for r in rooms]
            total_rooms = len(room_ids)
            
            if total_rooms == 0:
                return []
            
            # Calculate average room price
            avg_price = 0
            for room in rooms:
                # Prefer room-specific override, then fallback to room type base_price
                price = room.get("price_override")
                if price is None:
                    if room.get("room_types"):
                        price = room["room_types"].get("base_price", 0) or 0
                    else:
                        price = 0
                avg_price += price or 0
            avg_price = avg_price / total_rooms if total_rooms > 0 else 0
            
            # Get future bookings
            bookings_query = self.supabase.table("bookings").select(
                "room_id, check_in_date, check_out_date"
            ).in_("room_id", room_ids).in_(
                "status", ["confirmed", "pending"]
            ).gte("check_out_date", today.isoformat()).lte(
                "check_in_date", end_date.isoformat()
            )
            
            bookings_result = bookings_query.execute()
            bookings = bookings_result.data if bookings_result.data else []
            
            # Calculate daily forecast
            forecast: List[VacancyForecast] = []
            current_date = today
            
            while current_date <= end_date:
                reservations = 0
                
                for booking in bookings:
                    b_checkin = datetime.fromisoformat(booking["check_in_date"]).date()
                    b_checkout = datetime.fromisoformat(booking["check_out_date"]).date()
                    
                    if b_checkin <= current_date < b_checkout:
                        reservations += 1
                
                available = total_rooms - reservations
                occupancy = (reservations / total_rooms * 100) if total_rooms > 0 else 0
                potential_revenue = available * avg_price
                
                forecast.append(VacancyForecast(
                    date=current_date,
                    available_rooms=available,
                    expected_occupancy=round(occupancy, 2),
                    reservations=reservations,
                    potential_revenue=round(potential_revenue, 2)
                ))
                
                current_date += timedelta(days=1)
            
            return forecast
            
        except Exception as e:
            print(f"Error getting vacancy forecast: {e}")
            raise

    async def update_room_status(
        self,
        room_id: str,
        status: RoomStatus,
        notes: Optional[str] = None
    ) -> bool:
        """
        Update room status.
        """
        try:
            update_data = {"status": status.value}
            if notes is not None:
                update_data["notes"] = notes
            
            result = self.supabase.table("rooms").update(
                update_data
            ).eq("id", room_id).execute()
            
            return bool(result.data)
            
        except Exception as e:
            print(f"Error updating room status: {e}")
            raise

    # ==================== BRANCH STATS ====================
    
    async def get_branch_stats(self) -> List[BranchStats]:
        """
        Get occupancy stats for all branches.
        """
        try:
            today = date.today()
            
            # Get all branches
            branches_result = self.supabase.table("branches").select("id, name").execute()
            branches = branches_result.data if branches_result.data else []
            
            stats: List[BranchStats] = []
            
            for branch in branches:
                branch_id = branch["id"]
                
                # Get rooms for this branch
                rooms_result = self.supabase.table("rooms").select("id").eq(
                    "branch_id", branch_id
                ).execute()
                room_ids = [r["id"] for r in (rooms_result.data or [])]
                total_rooms = len(room_ids)
                
                if total_rooms == 0:
                    continue
                
                # Get current occupancy
                occupied_result = self.supabase.table("bookings").select(
                    "room_id"
                ).in_("room_id", room_ids).eq(
                    "status", "checked_in"
                ).lte("check_in_date", today.isoformat()).gte(
                    "check_out_date", today.isoformat()
                ).execute()
                
                occupied = len(occupied_result.data) if occupied_result.data else 0
                
                # Get today's checkouts
                checkouts_result = self.supabase.table("bookings").select(
                    "id"
                ).in_("room_id", room_ids).eq(
                    "check_out_date", today.isoformat()
                ).in_("status", ["checked_in"]).execute()
                
                today_checkouts = len(checkouts_result.data) if checkouts_result.data else 0
                
                # Get today's checkins
                checkins_result = self.supabase.table("bookings").select(
                    "id"
                ).in_("room_id", room_ids).eq(
                    "check_in_date", today.isoformat()
                ).in_("status", ["confirmed"]).execute()
                
                today_checkins = len(checkins_result.data) if checkins_result.data else 0
                
                occupancy_rate = (occupied / total_rooms * 100) if total_rooms > 0 else 0
                
                stats.append(BranchStats(
                    branch_id=branch_id,
                    branch_name=branch.get("name", "Unknown"),
                    total_rooms=total_rooms,
                    occupied=occupied,
                    available=total_rooms - occupied,
                    occupancy_rate=round(occupancy_rate, 2),
                    today_checkouts=today_checkouts,
                    today_checkins=today_checkins
                ))
            
            return stats
            
        except Exception as e:
            print(f"Error getting branch stats: {e}")
            raise

    # ==================== ROOM TYPES ====================
    
    async def get_room_types(self) -> List[RoomType]:
        """
        Get all room types.
        """
        try:
            result = self.supabase.table("room_types").select("*").execute()
            types_data = result.data if result.data else []
            
            return [
                RoomType(
                    id=t["id"],
                    name=t.get("name", ""),
                    description=t.get("description"),
                    base_price=t.get("base_price", 0) or 0,
                    capacity=t.get("capacity", 2),
                    amenities=t.get("amenities", []) or []
                )
                for t in types_data
            ]
            
        except Exception as e:
            print(f"Error getting room types: {e}")
            raise


# Create singleton instance
room_service = RoomService()
