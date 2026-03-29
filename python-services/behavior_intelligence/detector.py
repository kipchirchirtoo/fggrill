import os
import logging
from datetime import datetime
try:
    from supabase import create_client
except ImportError:
    create_client = None

from behavior_intelligence.feature_extractor import FeatureExtractor

logger = logging.getLogger(__name__)

class BehaviorDetector:
    def __init__(self):
        self.extractor = FeatureExtractor()
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')
        self.client = None
        if create_client and self.supabase_url and self.supabase_key:
            try:
                self.client = create_client(self.supabase_url, self.supabase_key)
            except Exception as e:
                logger.error(f"Failed to connect to Supabase in BehaviorDetector: {e}")

    def analyze_event(self, event_data):
        """
        Analyze a real-time event against historical baseline.
        event_data format:
        {
            'user_id': str,
            'type': str (e.g., 'LOGIN', 'FINANCIAL', 'SYSTEM'),
            'amount': float (optional, if financial),
            'action': str,
            'module': str,
            'timestamp': str (ISO-8601, optional - defaults to now)
        }
        """
        user_id = event_data.get('user_id')
        if not user_id:
            return {'error': 'user_id is required'}
            
        profile = self.extractor.get_profile(user_id)
        if not profile:
            # If no profile, we can't reliably detect anomalies statistically.
            # However, we can use rule-based detection for universal rules.
            profile = {
                'avg_login_hour': 12.0,
                'login_hour_std': 4.0,
                'avg_transactions': 1000.0
            }

        anomalies = []
        event_time_str = event_data.get('timestamp', datetime.now().isoformat())
        try:
            # Safely handle various datetime string formats including "Z" suffix
            if event_time_str.endswith('Z'):
                event_time_str = event_time_str[:-1] + '+00:00'
            event_dt = datetime.fromisoformat(event_time_str)
        except Exception:
            event_dt = datetime.now()
            
        event_type = event_data.get('type', 'SYSTEM')
        
        # Rule 1: Login Time Anomaly (Z-score based)
        if event_type == 'LOGIN' or event_data.get('action', '').lower() == 'login':
            hour = event_dt.hour
            avg_hour = profile.get('avg_login_hour', 12)
            std_hour = profile.get('login_hour_std', 4) or 1.0  # Prevent division by zero
            
            # Simple standard deviation distance (circular proxy)
            # Distance from mean, adjusting for 24h wrap-around
            dist = min((hour - avg_hour) % 24, (avg_hour - hour) % 24)
            z_score = dist / std_hour
            
            if z_score > 3.0:
                anomalies.append({
                    'type': 'LOGIN_ANOMALY',
                    'severity': 'HIGH',
                    'score': float(z_score),
                    'description': f"User logged in at {hour}:00, which is highly unusual. Baseline average is {int(avg_hour)}:00."
                })
            elif z_score > 2.0:
                anomalies.append({
                    'type': 'LOGIN_ANOMALY',
                    'severity': 'MEDIUM',
                    'score': float(z_score),
                    'description': f"User logged in at {hour}:00, differing moderately from baseline."
                })

        # Rule 2: Sudden Financial Action Anomaly
        if event_type in ['FINANCIAL', 'PAYMENT', 'VOID']:
            amount = float(event_data.get('amount', 0))
            if amount > 0:
                avg_tx = profile.get('avg_transactions', 1000.0) or 1000.0
                
                # Rule based: Is transaction more than 5x their average?
                diff_ratio = amount / avg_tx
                
                if diff_ratio > 10.0:
                    anomalies.append({
                        'type': 'FINANCIAL_ANOMALY',
                        'severity': 'CRITICAL',
                        'score': float(diff_ratio),
                        'description': f"Transaction amount ({amount}) is critically high compared to user's average ({avg_tx:.2f})."
                    })
                elif diff_ratio > 5.0:
                    anomalies.append({
                        'type': 'FINANCIAL_ANOMALY',
                        'severity': 'HIGH',
                        'score': float(diff_ratio),
                        'description': f"Transaction amount ({amount}) is unusually high compared to user's average."
                    })

                # Specific Rule: Void limits
                if event_data.get('action', '').lower() == 'void':
                    # Voids are inherently risky, assign a high base score if amount is large
                    if amount > 5000:
                        anomalies.append({
                            'type': 'SYSTEM_ANOMALY',
                            'severity': 'CRITICAL',
                            'score': 5.0,
                            'description': f"Massive void executed by user worth {amount}!"
                        })
                        
        # Store anomalies if detected
        results = []
        if anomalies and self.client:
            for item in anomalies:
                doc = {
                    'user_id': user_id,
                    'type': item['type'],
                    'severity': item['severity'],
                    'score': item['score'],
                    'description': item['description'],
                    'metadata': event_data,
                    'detected_at': datetime.now().isoformat()
                }
                try:
                    res = self.client.table('anomaly_events').insert(doc).execute()
                    if res.data:
                        results.append(res.data[0])
                except Exception as e:
                    logger.error(f"Failed to save anomaly: {e}")
                    
        return {'detected': len(results) > 0, 'anomalies': results, 'event': event_data}

    def fetch_anomalies(self, filters=None):
        if not self.client:
            return []
            
        try:
            query = self.client.table('anomaly_events').select('*, users(id, first_name, last_name, role)').order('detected_at', desc=True)
            if filters and filters.get('limit'):
                query = query.limit(int(filters['limit']))
            else:
                query = query.limit(100)
                
            resp = query.execute()
            return resp.data or []
        except Exception as e:
            logger.error(f"Failed retrieving anomalies: {e}")
            return []
