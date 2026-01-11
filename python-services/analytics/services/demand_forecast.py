from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, List

class DemandForecast:
    def __init__(self, supabase_client=None):
        self.supabase = supabase_client

    def forecast_pos_sales(self, periods: int = 7, branch_id: Optional[int] = None) -> Dict[str, Any]:
        """Predicts future POS revenue"""
        try:
            # Fetch last 30 days of daily totals
            since = (datetime.now() - timedelta(days=30)).isoformat()
            res = self.supabase.table('pos_transactions').select('created_at, total_amount').gte('created_at', since).execute()
            
            if not res.data or len(res.data) < 5:
                return {"forecasts": [], "message": "Insufficient data"}

            df = pd.DataFrame(res.data)
            df['date'] = pd.to_datetime(df['created_at']).dt.date
            daily = df.groupby('date')['total_amount'].sum().reset_index().sort_values('date')
            values = daily['total_amount'].values

            forecasts = []
            # Simple Linear Trend for fallback/demo
            X = np.arange(len(values)).reshape(-1, 1)
            y = values
            from sklearn.linear_model import LinearRegression
            model = LinearRegression()
            model.fit(X, y)

            for i in range(periods):
                pred = model.predict([[len(values) + i]])[0]
                forecast_date = (daily['date'].max() + timedelta(days=i+1)).strftime('%Y-%m-%d')
                forecasts.append({
                    "date": forecast_date,
                    "value": max(0, float(pred))
                })

            return {
                "forecasts": forecasts,
                "confidence": 70,
                "model": "linear_regression"
            }
        except Exception as e:
            print(f"Error in forecast: {e}")
            return {"forecasts": [], "error": str(e)}
