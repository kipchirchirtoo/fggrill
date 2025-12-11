from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from enum import Enum

class MessageType(str, Enum):
    BOOKING_CONFIRMATION = "booking_confirmation"
    CHECK_IN_REMINDER = "check_in_reminder"
    CHECK_OUT_REMINDER = "check_out_reminder"
    INVOICE = "invoice"
    WELCOME = "welcome"
    THANK_YOU = "thank_you"
    PROMOTIONAL = "promotional"
    CUSTOM = "custom"

class ChannelType(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    WHATSAPP = "whatsapp"

class EmailRequest(BaseModel):
    to: EmailStr
    subject: str
    template: Optional[str] = None
    body: Optional[str] = None
    context: Optional[Dict[str, Any]] = {}
    cc: Optional[List[EmailStr]] = []
    bcc: Optional[List[EmailStr]] = []
    attachments: Optional[List[str]] = []

class SMSRequest(BaseModel):
    phone_number: str
    message: str
    sender_id: Optional[str] = "HOTEL"

class BookingConfirmationRequest(BaseModel):
    guest_email: EmailStr
    guest_name: str
    guest_phone: Optional[str] = None
    booking_id: str
    confirmation_number: str
    room_type: str
    room_number: Optional[str] = None
    check_in_date: str
    check_out_date: str
    total_amount: float
    currency: str = "KES"
    special_requests: Optional[str] = None
    send_sms: bool = False

class CheckInReminderRequest(BaseModel):
    guest_email: EmailStr
    guest_name: str
    guest_phone: Optional[str] = None
    booking_id: str
    confirmation_number: str
    check_in_date: str
    check_in_time: str = "14:00"
    room_type: str
    send_sms: bool = False

class InvoiceRequest(BaseModel):
    guest_email: EmailStr
    guest_name: str
    booking_id: str
    folio_id: str
    invoice_number: str
    items: List[Dict[str, Any]]
    subtotal: float
    tax: float
    total: float
    currency: str = "KES"
    payment_status: str = "pending"

class BulkSMSRequest(BaseModel):
    recipients: List[str]
    message: str
    sender_id: Optional[str] = "HOTEL"

class CommunicationResponse(BaseModel):
    success: bool
    message_id: Optional[str] = None
    channel: str
    recipient: str
    status: str
    error: Optional[str] = None

class BulkResponse(BaseModel):
    success: bool
    total: int
    sent: int
    failed: int
    results: List[CommunicationResponse]
