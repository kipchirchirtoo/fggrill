"""
Communication Hub Microservice
FastAPI service for handling hotel guest communications (Email, SMS, WhatsApp)
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import os
from dotenv import load_dotenv

from models import (
    EmailRequest, SMSRequest, BulkSMSRequest,
    BookingConfirmationRequest, CheckInReminderRequest, InvoiceRequest,
    CommunicationResponse, BulkResponse
)
from service import communication_service

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Hotel Communication Hub",
    description="Microservice for guest communications - Email, SMS, WhatsApp",
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


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "communication-hub",
        "version": "1.0.0"
    }


# =============================================================================
# EMAIL ENDPOINTS
# =============================================================================

@app.post("/api/communications/email", response_model=CommunicationResponse)
async def send_email(request: EmailRequest):
    """Send a single email"""
    result = await communication_service.send_email(request)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result


@app.post("/api/communications/email/booking-confirmation")
async def send_booking_confirmation(request: BookingConfirmationRequest):
    """Send booking confirmation email (and optionally SMS)"""
    results = await communication_service.send_booking_confirmation(request)
    return {
        "success": all(r.success for r in results.values()),
        "results": {k: v.dict() for k, v in results.items()}
    }


@app.post("/api/communications/email/check-in-reminder")
async def send_check_in_reminder(request: CheckInReminderRequest):
    """Send check-in reminder email (and optionally SMS)"""
    results = await communication_service.send_check_in_reminder(request)
    return {
        "success": all(r.success for r in results.values()),
        "results": {k: v.dict() for k, v in results.items()}
    }


@app.post("/api/communications/email/invoice", response_model=CommunicationResponse)
async def send_invoice(request: InvoiceRequest):
    """Send invoice email to guest"""
    result = await communication_service.send_invoice(request)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result


# =============================================================================
# SMS ENDPOINTS
# =============================================================================

@app.post("/api/communications/sms", response_model=CommunicationResponse)
async def send_sms(request: SMSRequest):
    """Send a single SMS"""
    result = await communication_service.send_sms(request)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result


@app.post("/api/communications/sms/bulk")
async def send_bulk_sms(request: BulkSMSRequest, background_tasks: BackgroundTasks):
    """Send SMS to multiple recipients"""
    # For large batches, process in background
    if len(request.recipients) > 10:
        background_tasks.add_task(
            communication_service.send_bulk_sms,
            request.recipients,
            request.message,
            request.sender_id
        )
        return {
            "success": True,
            "message": f"Bulk SMS to {len(request.recipients)} recipients queued for sending",
            "status": "processing"
        }
    
    # For small batches, send synchronously
    results = await communication_service.send_bulk_sms(
        request.recipients,
        request.message,
        request.sender_id
    )
    return results


# =============================================================================
# UTILITY ENDPOINTS
# =============================================================================

@app.get("/api/communications/log")
async def get_message_log(limit: int = 50):
    """Get recent message log"""
    return {
        "success": True,
        "messages": communication_service.get_message_log(limit)
    }


@app.get("/api/communications/templates")
async def get_available_templates():
    """Get list of available message templates"""
    from templates import TEMPLATES
    return {
        "success": True,
        "templates": list(TEMPLATES.keys())
    }


# =============================================================================
# SCHEDULED COMMUNICATIONS (for integration with scheduler)
# =============================================================================

@app.post("/api/communications/schedule/check-in-reminders")
async def trigger_check_in_reminders(background_tasks: BackgroundTasks):
    """
    Trigger check-in reminders for tomorrow's arrivals.
    This would be called by a scheduler (cron job) daily.
    """
    # In production, this would:
    # 1. Query database for tomorrow's check-ins
    # 2. Send reminder to each guest
    # For demo, return mock response
    return {
        "success": True,
        "message": "Check-in reminders scheduled",
        "status": "processing"
    }


@app.post("/api/communications/schedule/check-out-reminders")
async def trigger_check_out_reminders(background_tasks: BackgroundTasks):
    """
    Trigger check-out reminders for today's departures.
    """
    return {
        "success": True,
        "message": "Check-out reminders scheduled",
        "status": "processing"
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("COMMUNICATION_PORT", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
