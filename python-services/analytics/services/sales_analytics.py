from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any, List
import pandas as pd

class SalesAnalytics:
    def __init__(self, supabase_client=None):
        self.supabase = supabase_client

    def analyze_pos_velocity(self, days: int = 7, branch_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Calculates item sales speed (velocity)"""
        try:
            since = (datetime.now() - timedelta(days=days)).isoformat()
            query = self.supabase.table('pos_transaction_items').select('name, qty, line_total, created_at')
            if branch_id:
                # Assuming branch_id is on pos_transactions, we might need a join or filter if stored on items
                pass 
            
            res = query.gte('created_at', since).execute()
            if not res.data: return []

            df = pd.DataFrame(res.data)
            velocity = df.groupby('name').agg({
                'qty': 'sum',
                'line_total': 'sum'
            }).reset_index().sort_values('qty', ascending=False)
            
            return velocity.to_dict('records')
        except Exception as e:
            print(f"Error in velocity: {e}")
            return []

    def get_hourly_heatmap(self, days: int = 7, branch_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Identifies peak transaction times"""
        try:
            since = (datetime.now() - timedelta(days=days)).isoformat()
            res = self.supabase.table('pos_transactions').select('created_at, total_amount').gte('created_at', since).execute()
            if not res.data: return []

            df = pd.DataFrame(res.data)
            df['hour'] = pd.to_datetime(df['created_at']).dt.hour
            heatmap = df.groupby('hour').agg({
                'total_amount': 'sum',
                'created_at': 'count'
            }).rename(columns={'created_at': 'count'}).reset_index()
            
            return heatmap.to_dict('records')
        except Exception as e:
            print(f"Error in heatmap: {e}")
            return []

    def get_payment_method_mix(self, days: int = 30, branch_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Analyzes share of Cash vs M-Pesa vs Card"""
        try:
            since = (datetime.now() - timedelta(days=days)).isoformat()
            res = self.supabase.table('pos_transactions').select('payment_method, total_amount').gte('created_at', since).execute()
            if not res.data: return []

            df = pd.DataFrame(res.data)
            mix = df.groupby('payment_method').agg({
                'total_amount': 'sum'
            }).reset_index()
            
            return mix.to_dict('records')
        except Exception as e:
            print(f"Error in mix: {e}")
            return []

    def get_stock_out_predictions(self, branch_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Predicts when items will run out based on sales velocity"""
        try:
            # 1. Get average daily velocity (Last 7 days)
            since = (datetime.now() - timedelta(days=7)).isoformat()
            res_items = self.supabase.table('pos_transaction_items').select('name, qty').gte('created_at', since).execute()
            
            if not res_items.data: return []

            df_sales = pd.DataFrame(res_items.data)
            velocity = df_sales.groupby('name')['qty'].sum() / 7.0
            velocity = velocity.reset_index().rename(columns={'qty': 'daily_velocity'})

            # 2. Get current stock levels
            # Join branch_stock with simple_items to get names
            res_stock = self.supabase.table('branch_stock').select('item_sku, quantity, reorder_level, simple_items(item_name)').execute()
            
            if not res_stock.data: return []

            # Flatten join data
            stock_data = []
            for item in res_stock.data:
                stock_data.append({
                    'sku': item['item_sku'],
                    'item_name': item['simple_items']['item_name'],
                    'current_stock': item['quantity'],
                    'reorder_level': item['reorder_level']
                })
            
            df_stock = pd.DataFrame(stock_data)

            # 3. Join and calculate days remaining
            # Join on name (Case-insensitive matching for robustness)
            df_stock['item_name_lower'] = df_stock['item_name'].str.lower()
            velocity['name_lower'] = velocity['name'].str.lower()

            merged = pd.merge(df_stock, velocity, left_on='item_name_lower', right_on='name_lower', how='inner')
            
            merged['days_remaining'] = merged['current_stock'] / merged['daily_velocity']
            merged['status'] = 'stable'
            merged.loc[merged['days_remaining'] < 3, 'status'] = 'critical'
            merged.loc[(merged['days_remaining'] >= 3) & (merged['days_remaining'] < 7), 'status'] = 'warning'

            # Sort by risk
            result = merged[['item_name', 'current_stock', 'daily_velocity', 'days_remaining', 'status']].sort_values('days_remaining')
            
            # Replace infinity/NaN (for zero velocity items)
            result = result.replace([float('inf'), -float('inf')], 999).fillna(999)

            return result.to_dict('records')
        except Exception as e:
            print(f"Error in stock prediction: {e}")
            return []
