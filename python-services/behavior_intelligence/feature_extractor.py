import os
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
try:
    from supabase import create_client, Client
except ImportError:
    create_client = None

logger = logging.getLogger(__name__)

class FeatureExtractor:
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')
        self.client = None
        if create_client and self.supabase_url and self.supabase_key:
            try:
                self.client = create_client(self.supabase_url, self.supabase_key)
            except Exception as e:
                logger.error(f"Failed to connect to Supabase in FeatureExtractor: {e}")

    def fetch_user_behavior_history(self, user_id=None):
        """Fetch historical data to compute the baseline for a specific user or all users."""
        if not self.client:
            return pd.DataFrame()

        try:
            # Query recent audit trails (last 30 days)
            thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
            
            query = self.client.table('audit_trail').select('*')\
                .gte('created_at', thirty_days_ago)

            if user_id:
                query = query.eq('user_id', user_id)
                
            response = query.execute()
            data = response.data or []
            return pd.DataFrame(data)
        except Exception as e:
            logger.error(f"Error fetching historical logs: {e}")
            return pd.DataFrame()

    def fetch_user_financial_history(self, user_id=None):
        """Fetch financial transactions (payments and voids) created by the user"""
        if not self.client:
            return pd.DataFrame()
            
        try:
            thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
            query = self.client.table('payments').select('amount, created_by, created_at, status')\
                .gte('created_at', thirty_days_ago)
                
            if user_id:
                query = query.eq('created_by', user_id)
                
            response = query.execute()
            data = response.data or []
            return pd.DataFrame(data)
        except Exception as e:
            logger.error(f"Error fetching financial history: {e}")
            return pd.DataFrame()

    def build_profiles(self):
        """Compute baseline metrics for all users and save to DB."""
        if not self.client:
            return False
            
        audit_df = self.fetch_user_behavior_history()
        finance_df = self.fetch_user_financial_history()
        
        if audit_df.empty and finance_df.empty:
            logger.warning("No data available to build behavior profiles.")
            return False
            
        users = set()
        if not audit_df.empty and 'user_id' in audit_df.columns:
            users.update(audit_df['user_id'].dropna().unique())
        if not finance_df.empty and 'created_by' in finance_df.columns:
            users.update(finance_df['created_by'].dropna().unique())
            
        profiles = []
        
        for uid in users:
            uid_str = str(uid)
            profile = {
                'user_id': uid_str,
                'avg_login_hour': 0.0,
                'login_hour_std': 0.0,
                'avg_actions_per_day': 0.0,
                'avg_transactions': 0.0,
                'common_modules': {},
                'updated_at': datetime.now().isoformat()
            }
            
            # --- Audit Stats ---
            if not audit_df.empty and 'user_id' in audit_df.columns:
                user_audit = audit_df[audit_df['user_id'] == uid_str].copy()
                if not user_audit.empty and 'created_at' in user_audit.columns:
                    # Parse dates
                    user_audit['dt'] = pd.to_datetime(user_audit['created_at'])
                    user_audit['hour'] = user_audit['dt'].dt.hour
                    user_audit['date'] = user_audit['dt'].dt.date
                    
                    # Logins calculation
                    logins = user_audit[user_audit['action'].str.contains('login|auth', case=False, na=False)]
                    if not logins.empty:
                        profile['avg_login_hour'] = float(logins['hour'].mean())
                        std_val = logins['hour'].std()
                        profile['login_hour_std'] = float(std_val) if pd.notna(std_val) else 0.0
                    else:
                        # Fallback to general action hours
                        profile['avg_login_hour'] = float(user_audit['hour'].mean())
                        std_val = user_audit['hour'].std()
                        profile['login_hour_std'] = float(std_val) if pd.notna(std_val) else 0.0

                    # Actions per day
                    actions_per_day = user_audit.groupby('date').size()
                    profile['avg_actions_per_day'] = float(actions_per_day.mean()) if not actions_per_day.empty else 0.0
                    
                    # Common modules
                    if 'module' in user_audit.columns:
                        module_counts = user_audit['module'].value_counts().head(5)
                        profile['common_modules'] = module_counts.to_dict()
                        
            # --- Financial Stats ---
            if not finance_df.empty and 'created_by' in finance_df.columns:
                user_fin = finance_df[finance_df['created_by'] == uid_str].copy()
                if not user_fin.empty and 'amount' in user_fin.columns:
                    user_fin['amount'] = pd.to_numeric(user_fin['amount'], errors='coerce')
                    mean_tx = user_fin['amount'].mean()
                    profile['avg_transactions'] = float(mean_tx) if pd.notna(mean_tx) else 0.0
            
            profiles.append(profile)
            
        # Store profiles in DB
        if profiles:
            try:
                self.client.table('user_behavior_profiles').upsert(profiles).execute()
                logger.info(f"Successfully rebuilt behavior profiles for {len(profiles)} users.")
                return True
            except Exception as e:
                logger.error(f"Failed to upsert user profiles: {e}")
                
        return False

    def get_profile(self, user_id):
        """Fetch a pre-calculated baseline profile from DB."""
        if not self.client or not user_id:
            return None
        try:
            resp = self.client.table('user_behavior_profiles').select('*').eq('user_id', user_id).execute()
            if resp.data:
                return resp.data[0]
        except Exception as e:
            logger.error(f"Failed fetching profile for {user_id}: {e}")
        return None
