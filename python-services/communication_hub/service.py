import os
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from jinja2 import Template
import httpx

from models import (
    EmailRequest, SMSRequest, CommunicationResponse, 
    BookingConfirmationRequest, CheckInReminderRequest, InvoiceRequest
)
from templates import TEMPLATES

class CommunicationService:
    """
    Service for sending emails and SMS messages.
    In production, this would integrate with actual providers:
    - Email: SendGrid, AWS SES, Mailgun
    - SMS: Africa's Talking, Twilio, Nexmo
    """
    
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "localhost")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("FROM_EMAIL", "noreply@hotel.com")
        self.hotel_name = os.getenv("HOTEL_NAME", "Grand Hotel")
        
        # SMS Provider Config (Africa's Talking example)
        self.sms_api_key = os.getenv("SMS_API_KEY", "")
        self.sms_username = os.getenv("SMS_USERNAME", "sandbox")
        self.sms_sender_id = os.getenv("SMS_SENDER_ID", "HOTEL")
        
        # Track sent messages (in production, store in database)
        self.message_log: List[Dict] = []
    
    def _render_template(self, template_str: str, context: Dict[str, Any]) -> str:
        """Render a Jinja2 template with context"""
        context["year"] = datetime.now().year
        context["hotel_name"] = self.hotel_name
        template = Template(template_str)
        return template.render(**context)
    
    def _generate_message_id(self) -> str:
        """Generate unique message ID"""
        return f"msg_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
    
    async def send_email(self, request: EmailRequest) -> CommunicationResponse:
        """
        Send an email. In production, integrate with actual SMTP or email service.
        """
        message_id = self._generate_message_id()
        
        try:
            # Determine body content
            if request.template and request.template in TEMPLATES:
                template_data = TEMPLATES[request.template]
                if template_data.get("email"):
                    body = self._render_template(template_data["email"], request.context or {})
                else:
                    body = request.body or ""
            else:
                body = request.body or ""
            
            # In production: Use aiosmtplib or email provider API
            # For demo: Mock successful send
            print(f"[Email] Sending to {request.to}: {request.subject}")
            
            # Log the message
            self.message_log.append({
                "id": message_id,
                "channel": "email",
                "recipient": request.to,
                "subject": request.subject,
                "status": "sent",
                "timestamp": datetime.now().isoformat()
            })
            
            return CommunicationResponse(
                success=True,
                message_id=message_id,
                channel="email",
                recipient=request.to,
                status="sent"
            )
            
        except Exception as e:
            print(f"[Email] Error sending to {request.to}: {str(e)}")
            return CommunicationResponse(
                success=False,
                message_id=message_id,
                channel="email",
                recipient=request.to,
                status="failed",
                error=str(e)
            )
    
    async def send_sms(self, request: SMSRequest) -> CommunicationResponse:
        """
        Send an SMS. In production, integrate with SMS provider.
        """
        message_id = self._generate_message_id()
        
        try:
            # Validate phone number format
            phone = request.phone_number.replace(" ", "").replace("-", "")
            if not phone.startswith("+") and not phone.startswith("254"):
                phone = f"254{phone.lstrip('0')}"
            
            # In production: Call SMS provider API
            # Example with Africa's Talking:
            # async with httpx.AsyncClient() as client:
            #     response = await client.post(
            #         "https://api.africastalking.com/version1/messaging",
            #         headers={"apiKey": self.sms_api_key},
            #         data={
            #             "username": self.sms_username,
            #             "to": phone,
            #             "message": request.message,
            #             "from": request.sender_id or self.sms_sender_id
            #         }
            #     )
            
            print(f"[SMS] Sending to {phone}: {request.message[:50]}...")
            
            # Log the message
            self.message_log.append({
                "id": message_id,
                "channel": "sms",
                "recipient": phone,
                "message": request.message[:100],
                "status": "sent",
                "timestamp": datetime.now().isoformat()
            })
            
            return CommunicationResponse(
                success=True,
                message_id=message_id,
                channel="sms",
                recipient=phone,
                status="sent"
            )
            
        except Exception as e:
            print(f"[SMS] Error sending to {request.phone_number}: {str(e)}")
            return CommunicationResponse(
                success=False,
                message_id=message_id,
                channel="sms",
                recipient=request.phone_number,
                status="failed",
                error=str(e)
            )
    
    async def send_booking_confirmation(self, request: BookingConfirmationRequest) -> Dict[str, CommunicationResponse]:
        """Send booking confirmation via email and optionally SMS"""
        results = {}
        
        # Send email
        email_context = {
            "guest_name": request.guest_name,
            "confirmation_number": request.confirmation_number,
            "room_type": request.room_type,
            "room_number": request.room_number,
            "check_in_date": request.check_in_date,
            "check_out_date": request.check_out_date,
            "total_amount": f"{request.total_amount:,.0f}",
            "currency": request.currency,
            "special_requests": request.special_requests
        }
        
        email_result = await self.send_email(EmailRequest(
            to=request.guest_email,
            subject=f"Booking Confirmation - {request.confirmation_number}",
            template="booking_confirmation",
            context=email_context
        ))
        results["email"] = email_result
        
        # Send SMS if requested
        if request.send_sms and request.guest_phone:
            sms_template = TEMPLATES["booking_confirmation"]["sms"]
            sms_message = sms_template.format(
                hotel_name=self.hotel_name,
                confirmation_number=request.confirmation_number,
                check_in_date=request.check_in_date,
                room_type=request.room_type,
                currency=request.currency,
                total_amount=f"{request.total_amount:,.0f}"
            )
            
            sms_result = await self.send_sms(SMSRequest(
                phone_number=request.guest_phone,
                message=sms_message
            ))
            results["sms"] = sms_result
        
        return results
    
    async def send_check_in_reminder(self, request: CheckInReminderRequest) -> Dict[str, CommunicationResponse]:
        """Send check-in reminder via email and optionally SMS"""
        results = {}
        
        # Send email
        email_context = {
            "guest_name": request.guest_name,
            "confirmation_number": request.confirmation_number,
            "check_in_date": request.check_in_date,
            "check_in_time": request.check_in_time,
            "room_type": request.room_type
        }
        
        email_result = await self.send_email(EmailRequest(
            to=request.guest_email,
            subject=f"Check-in Reminder - Your Stay Begins Tomorrow!",
            template="check_in_reminder",
            context=email_context
        ))
        results["email"] = email_result
        
        # Send SMS if requested
        if request.send_sms and request.guest_phone:
            sms_template = TEMPLATES["check_in_reminder"]["sms"]
            sms_message = sms_template.format(
                hotel_name=self.hotel_name,
                confirmation_number=request.confirmation_number,
                check_in_time=request.check_in_time
            )
            
            sms_result = await self.send_sms(SMSRequest(
                phone_number=request.guest_phone,
                message=sms_message
            ))
            results["sms"] = sms_result
        
        return results
    
    async def send_invoice(self, request: InvoiceRequest) -> CommunicationResponse:
        """Send invoice via email"""
        email_context = {
            "guest_name": request.guest_name,
            "invoice_number": request.invoice_number,
            "items": request.items,
            "subtotal": f"{request.subtotal:,.0f}",
            "tax": f"{request.tax:,.0f}",
            "total": f"{request.total:,.0f}",
            "currency": request.currency,
            "payment_status": request.payment_status.title()
        }
        
        return await self.send_email(EmailRequest(
            to=request.guest_email,
            subject=f"Invoice #{request.invoice_number} - Hotel Stay",
            template="invoice",
            context=email_context
        ))
    
    async def send_bulk_sms(self, recipients: List[str], message: str, sender_id: Optional[str] = None) -> Dict:
        """Send SMS to multiple recipients"""
        results = []
        sent = 0
        failed = 0
        
        for phone in recipients:
            result = await self.send_sms(SMSRequest(
                phone_number=phone,
                message=message,
                sender_id=sender_id
            ))
            results.append(result)
            if result.success:
                sent += 1
            else:
                failed += 1
        
        return {
            "success": failed == 0,
            "total": len(recipients),
            "sent": sent,
            "failed": failed,
            "results": results
        }
    
    def get_message_log(self, limit: int = 50) -> List[Dict]:
        """Get recent message log"""
        return self.message_log[-limit:][::-1]


# Singleton instance
communication_service = CommunicationService()
