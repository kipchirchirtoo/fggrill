import logging
from datetime import datetime
from typing import Dict, Any, List
import random

logger = logging.getLogger(__name__)

class PaymentAnomalyDetector:
    """
    ML-based anomaly detector for payment transactions.
    Uses statistical rules and isolation forest (simulated for now) to detect suspicious patterns.
    """
    
    def __init__(self):
        # In a real scenario, we would load a trained model here
        pass

    def detect_anomaly(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze transaction for anomalies.
        Returns a risk score (0-100) and risk factors.
        """
        risk_score = 0
        risk_factors = []
        
        amount = float(transaction_data.get('amount', 0))
        currency = transaction_data.get('currency', 'KES')
        payment_method = transaction_data.get('payment_method', 'unknown')
        guest_history = transaction_data.get('guest_history', {})
        
        # 1. High Amount Check
        # Thresholds could be dynamic based on historical data
        high_amount_threshold = 100000 if currency == 'KES' else 1000
        if amount > high_amount_threshold:
            risk_score += 30
            risk_factors.append(f"High transaction amount: {amount} {currency}")
            
        # 2. Velocity Check (Simulated)
        # Check if multiple transactions from same user in short time
        # This would normally query the database
        recent_transactions_count = transaction_data.get('recent_transactions_count', 0)
        if recent_transactions_count > 3:
            risk_score += 40
            risk_factors.append(f"High velocity: {recent_transactions_count} transactions recently")

        # 3. New Guest High Value
        is_new_guest = guest_history.get('total_stays', 0) == 0
        if is_new_guest and amount > (high_amount_threshold / 2):
            risk_score += 20
            risk_factors.append("High value transaction for new guest")

        # 4. Off-hours Check (e.g., 2 AM - 5 AM)
        current_hour = datetime.now().hour
        if 2 <= current_hour <= 5:
            risk_score += 15
            risk_factors.append("Transaction during off-hours")

        # 5. ML Model Score (Simulated)
        # In production, this would be: model.predict_proba([features])[0][1]
        ml_confidence = random.uniform(0, 10) # Add some noise
        
        final_score = min(100, risk_score + ml_confidence)
        
        return {
            'risk_score': round(final_score, 2),
            'is_high_risk': final_score > 50,
            'risk_factors': risk_factors,
            'recommendation': 'reject' if final_score > 80 else ('review' if final_score > 50 else 'approve')
        }
