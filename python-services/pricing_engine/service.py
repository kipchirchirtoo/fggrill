from datetime import date, timedelta
import random

class PricingService:
    def calculate_rate(self, check_in: date, check_out: date, room_type_id: str, guests: int):
        # Mock logic for MVP
        # In real world: fetch occupancy forecast, competitor rates, seasonality
        
        base_rate = 100.0 # Fetch from DB normally
        multiplier = 1.0
        factors = []

        # 1. Seasonality (Mock)
        if check_in.month in [12, 7, 8]: # Peak season
            multiplier += 0.2
            factors.append("Peak Season")
        
        # 2. Weekend
        if check_in.weekday() >= 5: # Sat/Sun
            multiplier += 0.15
            factors.append("Weekend Demand")

        # 3. Lead Time
        days_in_advance = (check_in - date.today()).days
        if days_in_advance < 3:
            multiplier += 0.1 # Last minute premium
            factors.append("Last Minute")
        elif days_in_advance > 60:
            multiplier -= 0.1 # Early bird
            factors.append("Early Bird Discount")

        recommended_price = base_rate * multiplier

        return {
            "base_price": base_rate,
            "recommended_price": round(recommended_price, 2),
            "multiplier": round(multiplier, 2),
            "factors": factors
        }
