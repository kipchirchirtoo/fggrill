"""
Email and SMS templates for hotel communications
"""

BOOKING_CONFIRMATION_EMAIL = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a365d; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Booking Confirmation</h1>
        </div>
        <div class="content">
            <p>Dear {{ guest_name }},</p>
            <p>Thank you for your reservation. Your booking has been confirmed!</p>
            
            <div class="details">
                <h3>Reservation Details</h3>
                <div class="detail-row">
                    <span>Confirmation Number:</span>
                    <strong>{{ confirmation_number }}</strong>
                </div>
                <div class="detail-row">
                    <span>Room Type:</span>
                    <span>{{ room_type }}</span>
                </div>
                {% if room_number %}
                <div class="detail-row">
                    <span>Room Number:</span>
                    <span>{{ room_number }}</span>
                </div>
                {% endif %}
                <div class="detail-row">
                    <span>Check-in:</span>
                    <span>{{ check_in_date }} (from 14:00)</span>
                </div>
                <div class="detail-row">
                    <span>Check-out:</span>
                    <span>{{ check_out_date }} (by 11:00)</span>
                </div>
                <div class="detail-row">
                    <span>Total Amount:</span>
                    <strong>{{ currency }} {{ total_amount }}</strong>
                </div>
            </div>
            
            {% if special_requests %}
            <div class="details">
                <h3>Special Requests</h3>
                <p>{{ special_requests }}</p>
            </div>
            {% endif %}
            
            <p>We look forward to welcoming you!</p>
        </div>
        <div class="footer">
            <p>If you have any questions, please contact us.</p>
            <p>&copy; {{ year }} Hotel Management System</p>
        </div>
    </div>
</body>
</html>
"""

CHECK_IN_REMINDER_EMAIL = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #059669; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .highlight { background: #ecfdf5; padding: 15px; border-radius: 8px; border-left: 4px solid #059669; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Check-in Reminder</h1>
        </div>
        <div class="content">
            <p>Dear {{ guest_name }},</p>
            <p>This is a friendly reminder that your stay begins tomorrow!</p>
            
            <div class="highlight">
                <p><strong>Check-in Date:</strong> {{ check_in_date }}</p>
                <p><strong>Check-in Time:</strong> From {{ check_in_time }}</p>
                <p><strong>Confirmation Number:</strong> {{ confirmation_number }}</p>
                <p><strong>Room Type:</strong> {{ room_type }}</p>
            </div>
            
            <h3>What to bring:</h3>
            <ul>
                <li>Valid photo ID (passport or national ID)</li>
                <li>Booking confirmation</li>
                <li>Credit card for incidentals (if applicable)</li>
            </ul>
            
            <p>We're excited to welcome you!</p>
        </div>
        <div class="footer">
            <p>&copy; {{ year }} Hotel Management System</p>
        </div>
    </div>
</body>
</html>
"""

INVOICE_EMAIL = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .invoice-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .invoice-table th, .invoice-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        .invoice-table th { background: #f3f4f6; }
        .total-row { font-weight: bold; background: #f3e8ff; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Invoice</h1>
            <p>Invoice #{{ invoice_number }}</p>
        </div>
        <div class="content">
            <p>Dear {{ guest_name }},</p>
            <p>Please find your invoice details below:</p>
            
            <table class="invoice-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {% for item in items %}
                    <tr>
                        <td>{{ item.description }}</td>
                        <td>{{ item.quantity }}</td>
                        <td>{{ currency }} {{ item.amount }}</td>
                    </tr>
                    {% endfor %}
                    <tr>
                        <td colspan="2">Subtotal</td>
                        <td>{{ currency }} {{ subtotal }}</td>
                    </tr>
                    <tr>
                        <td colspan="2">Tax</td>
                        <td>{{ currency }} {{ tax }}</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="2">Total</td>
                        <td>{{ currency }} {{ total }}</td>
                    </tr>
                </tbody>
            </table>
            
            <p><strong>Payment Status:</strong> {{ payment_status }}</p>
            
            <p>Thank you for staying with us!</p>
        </div>
        <div class="footer">
            <p>&copy; {{ year }} Hotel Management System</p>
        </div>
    </div>
</body>
</html>
"""

# SMS Templates
BOOKING_CONFIRMATION_SMS = """Your booking at {hotel_name} is confirmed! Conf#: {confirmation_number}. Check-in: {check_in_date}. Room: {room_type}. Total: {currency} {total_amount}"""

CHECK_IN_REMINDER_SMS = """Reminder: Your stay at {hotel_name} begins tomorrow! Check-in from {check_in_time}. Conf#: {confirmation_number}. See you soon!"""

THANK_YOU_SMS = """Thank you for staying with {hotel_name}! We hope you enjoyed your visit. We look forward to welcoming you again."""

TEMPLATES = {
    "booking_confirmation": {
        "email": BOOKING_CONFIRMATION_EMAIL,
        "sms": BOOKING_CONFIRMATION_SMS
    },
    "check_in_reminder": {
        "email": CHECK_IN_REMINDER_EMAIL,
        "sms": CHECK_IN_REMINDER_SMS
    },
    "invoice": {
        "email": INVOICE_EMAIL,
        "sms": None
    }
}
