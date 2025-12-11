"""
Room Service - FastAPI Application
Microservice for room availability, occupancy, and vacancy management
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import date, timedelta
from typing import Optional, List

from models import (
    AvailabilityRequest, RoomSearchRequest, OccupancyRequest,
    VacancyForecastRequest, RoomStatusUpdate, RoomAvailabilityResponse,
    OccupancyResponse, VacancyForecastResponse, Room, RoomType,
    OccupancyStats, OccupiedRoom, DailyOccupancy, BranchStats, RoomStatus
)
from service import room_service

app = FastAPI(
    title="Room Service API",
    description="Microservice for room availability, occupancy tracking, and vacancy forecasting",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== HEALTH CHECK ====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "room-service", "version": "1.0.0"}


# ==================== AVAILABILITY ENDPOINTS ====================

@app.get("/api/rooms/availability", response_model=RoomAvailabilityResponse)
async def check_availability(
    check_in: date = Query(..., description="Check-in date"),
    check_out: date = Query(..., description="Check-out date"),
    guests: int = Query(1, ge=1, description="Number of guests"),
    room_type_id: Optional[str] = Query(None, description="Filter by room type"),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
):
    """
    Check room availability for given dates.
    Returns list of available rooms that can accommodate the specified number of guests.
    """
    try:
        if check_out <= check_in:
            raise HTTPException(
                status_code=400,
                detail="Check-out date must be after check-in date"
            )
        
        available_rooms = await room_service.check_availability(
            check_in=check_in,
            check_out=check_out,
            guests=guests,
            room_type_id=room_type_id,
            branch_id=branch_id
        )
        
        nights = (check_out - check_in).days
        
        return RoomAvailabilityResponse(
            success=True,
            data=available_rooms,
            total_available=len(available_rooms),
            check_in=check_in,
            check_out=check_out,
            nights=nights,
            message=f"Found {len(available_rooms)} available room(s)"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rooms/availability/check", response_model=RoomAvailabilityResponse)
async def check_availability_post(request: AvailabilityRequest):
    """
    Check room availability (POST version for complex queries).
    """
    try:
        if request.check_out <= request.check_in:
            raise HTTPException(
                status_code=400,
                detail="Check-out date must be after check-in date"
            )
        
        available_rooms = await room_service.check_availability(
            check_in=request.check_in,
            check_out=request.check_out,
            guests=request.guests,
            room_type_id=request.room_type_id,
            branch_id=request.branch_id
        )
        
        nights = (request.check_out - request.check_in).days
        
        return RoomAvailabilityResponse(
            success=True,
            data=available_rooms,
            total_available=len(available_rooms),
            check_in=request.check_in,
            check_out=request.check_out,
            nights=nights,
            message=f"Found {len(available_rooms)} available room(s)"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== OCCUPANCY ENDPOINTS ====================

@app.get("/api/rooms/occupancy", response_model=OccupancyResponse)
async def get_current_occupancy(
    branch_id: Optional[str] = Query(None, description="Filter by branch")
):
    """
    Get current occupancy statistics including:
    - Total, occupied, available rooms
    - Occupancy and vacancy rates
    - ADR (Average Daily Rate)
    - RevPAR (Revenue Per Available Room)
    """
    try:
        stats = await room_service.get_current_occupancy(branch_id)
        occupied_rooms = await room_service.get_occupied_rooms(branch_id)
        
        return OccupancyResponse(
            success=True,
            data=stats,
            occupied_rooms=occupied_rooms,
            message=f"Occupancy rate: {stats.occupancy_rate}%"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rooms/occupied", response_model=List[OccupiedRoom])
async def get_occupied_rooms(
    branch_id: Optional[str] = Query(None, description="Filter by branch")
):
    """
    Get list of currently occupied rooms with:
    - Guest name
    - Check-in/Check-out dates
    - Days remaining
    - Booking status
    """
    try:
        return await room_service.get_occupied_rooms(branch_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rooms/occupancy/history", response_model=List[DailyOccupancy])
async def get_occupancy_history(
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
):
    """
    Get historical occupancy data for a date range.
    Includes daily occupancy, checkouts, and checkins.
    """
    try:
        if end_date < start_date:
            raise HTTPException(
                status_code=400,
                detail="End date must be after start date"
            )
        
        return await room_service.get_occupancy_history(start_date, end_date, branch_id)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== VACANCY FORECAST ====================

@app.get("/api/rooms/vacancy/forecast", response_model=VacancyForecastResponse)
async def get_vacancy_forecast(
    days_ahead: int = Query(30, ge=1, le=365, description="Days to forecast"),
    branch_id: Optional[str] = Query(None, description="Filter by branch")
):
    """
    Get vacancy forecast for upcoming days.
    Includes:
    - Available rooms per day
    - Expected occupancy
    - Potential revenue from vacant rooms
    """
    try:
        forecast = await room_service.get_vacancy_forecast(days_ahead, branch_id)
        
        # Calculate summary
        total_available = sum(f.available_rooms for f in forecast)
        avg_occupancy = sum(f.expected_occupancy for f in forecast) / len(forecast) if forecast else 0
        total_potential_revenue = sum(f.potential_revenue for f in forecast)
        
        summary = {
            "days_forecasted": len(forecast),
            "total_room_nights_available": total_available,
            "average_expected_occupancy": round(avg_occupancy, 2),
            "total_potential_revenue": round(total_potential_revenue, 2),
            "low_occupancy_days": sum(1 for f in forecast if f.expected_occupancy < 50),
            "high_occupancy_days": sum(1 for f in forecast if f.expected_occupancy >= 80)
        }
        
        return VacancyForecastResponse(
            success=True,
            data=forecast,
            summary=summary,
            message=f"Forecast generated for {days_ahead} days"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ROOM MANAGEMENT ====================

@app.get("/api/rooms", response_model=List[Room])
async def get_all_rooms(
    branch_id: Optional[str] = Query(None, description="Filter by branch"),
    status: Optional[RoomStatus] = Query(None, description="Filter by status")
):
    """
    Get all rooms with their current status and details.
    """
    try:
        status_str = status.value if status else None
        return await room_service.get_all_rooms(branch_id, status_str)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/rooms/{room_id}/status")
async def update_room_status(room_id: str, update: RoomStatusUpdate):
    """
    Update room status (available, occupied, maintenance, cleaning).
    """
    try:
        success = await room_service.update_room_status(
            room_id=room_id,
            status=update.status,
            notes=update.notes
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Room not found")
        
        return {"success": True, "message": f"Room status updated to {update.status.value}"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ROOM TYPES ====================

@app.get("/api/room-types", response_model=List[RoomType])
async def get_room_types():
    """
    Get all available room types.
    """
    try:
        return await room_service.get_room_types()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== BRANCH STATS ====================

@app.get("/api/rooms/branches/stats", response_model=List[BranchStats])
async def get_branch_stats():
    """
    Get occupancy statistics for all branches.
    """
    try:
        return await room_service.get_branch_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== QUICK STATS ====================

@app.get("/api/rooms/stats/today")
async def get_today_stats(
    branch_id: Optional[str] = Query(None, description="Filter by branch")
):
    """
    Get quick stats for today including:
    - Current occupancy
    - Today's checkouts
    - Today's expected checkins
    - Available rooms
    """
    try:
        stats = await room_service.get_current_occupancy(branch_id)
        occupied = await room_service.get_occupied_rooms(branch_id)
        
        today = date.today()
        today_checkouts = [r for r in occupied if r.check_out_date == today]
        
        # Get today's expected checkins from forecast
        forecast = await room_service.get_vacancy_forecast(1, branch_id)
        today_forecast = forecast[0] if forecast else None
        
        return {
            "success": True,
            "date": today.isoformat(),
            "stats": {
                "total_rooms": stats.total_rooms,
                "occupied": stats.occupied_rooms,
                "available": stats.available_rooms,
                "occupancy_rate": stats.occupancy_rate,
                "vacancy_rate": stats.vacancy_rate,
                "adr": stats.adr,
                "revpar": stats.revpar
            },
            "today": {
                "checkouts": len(today_checkouts),
                "checkout_rooms": [r.room_number for r in today_checkouts],
                "expected_checkins": today_forecast.reservations if today_forecast else 0
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STARTUP ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
