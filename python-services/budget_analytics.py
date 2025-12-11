"""
Famous Gate Hotel - Budget Analytics Module
Advanced budget analytics and forecasting for the branch operations module
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from supabase import create_client, Client
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from statsmodels.tsa.arima.model import ARIMA
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO
import base64

logger = logging.getLogger(__name__)

class BudgetAnalytics:
    """Budget analytics and forecasting service"""
    
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL', 'https://utsvlihpudfraxzcmtle.supabase.co')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY', os.getenv('SUPABASE_ANON_KEY', ''))
        self.client: Optional[Client] = None
        self._connect()
    
    def _connect(self):
        """Establish database connection"""
        try:
            if self.supabase_url and self.supabase_key:
                self.client = create_client(self.supabase_url, self.supabase_key)
                logger.info("Connected to Supabase database")
            else:
                logger.warning("Supabase credentials not configured")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            self.client = None
    
    def get_budget_data(self, branch_id: str, fiscal_year: str = None, category: str = None) -> pd.DataFrame:
        """Fetch budget data for analysis"""
        try:
            if not self.client:
                logger.error("No database connection")
                return pd.DataFrame()
            
            # Build the query
            query = self.client.table('budget_analysis').select('*')
            query = query.eq('branch_id', branch_id)
            
            if fiscal_year:
                query = query.eq('fiscal_year', fiscal_year)
            
            if category:
                query = query.eq('category', category)
            
            # Execute the query
            result = query.execute()
            
            if not result.data:
                logger.warning(f"No budget data found for branch {branch_id}")
                return pd.DataFrame()
            
            # Convert to DataFrame
            df = pd.DataFrame(result.data)
            
            # Convert date columns to datetime
            date_columns = ['start_date', 'end_date', 'created_at', 'updated_at']
            for col in date_columns:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col])
            
            # Convert numeric columns
            numeric_columns = ['allocated_amount', 'spent_amount', 'remaining_amount', 'percentage_used']
            for col in numeric_columns:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            return df
        
        except Exception as e:
            logger.error(f"Error fetching budget data: {e}")
            return pd.DataFrame()
    
    def get_expense_data(self, branch_id: str, start_date: str = None, end_date: str = None) -> pd.DataFrame:
        """Fetch expense data for analysis"""
        try:
            if not self.client:
                logger.error("No database connection")
                return pd.DataFrame()
            
            # Determine date range if not provided
            if not start_date:
                start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
            
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
            
            # Build the query
            query = self.client.table('expenses').select('*')
            query = query.eq('branch_id', branch_id)
            query = query.gte('date', start_date)
            query = query.lte('date', end_date)
            
            # Execute the query
            result = query.execute()
            
            if not result.data:
                logger.warning(f"No expense data found for branch {branch_id}")
                return pd.DataFrame()
            
            # Convert to DataFrame
            df = pd.DataFrame(result.data)
            
            # Convert date columns to datetime
            date_columns = ['date', 'created_at']
            for col in date_columns:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col])
            
            # Convert amount to numeric
            if 'amount' in df.columns:
                df['amount'] = pd.to_numeric(df['amount'], errors='coerce')
            
            return df
        
        except Exception as e:
            logger.error(f"Error fetching expense data: {e}")
            return pd.DataFrame()
    
    def analyze_budget_performance(self, branch_id: str, fiscal_year: str = None) -> Dict[str, Any]:
        """Analyze budget performance against actuals"""
        budget_df = self.get_budget_data(branch_id, fiscal_year)
        
        if budget_df.empty:
            return {
                'success': False,
                'message': 'No budget data available',
                'data': {}
            }
        
        # Calculate overall performance
        total_allocated = budget_df['allocated_amount'].sum()
        total_spent = budget_df['spent_amount'].sum()
        total_remaining = budget_df['remaining_amount'].sum()
        
        overall_percentage = 0
        if total_allocated > 0:
            overall_percentage = (total_spent / total_allocated) * 100
        
        # Calculate performance by category
        category_performance = []
        for category, group in budget_df.groupby('category'):
            cat_allocated = group['allocated_amount'].sum()
            cat_spent = group['spent_amount'].sum()
            cat_remaining = cat_allocated - cat_spent
            cat_percentage = (cat_spent / cat_allocated * 100) if cat_allocated > 0 else 0
            
            category_performance.append({
                'category': category,
                'allocated': cat_allocated,
                'spent': cat_spent,
                'remaining': cat_remaining,
                'percentage': cat_percentage,
                'status': 'over_budget' if cat_percentage > 100 else 
                          'warning' if cat_percentage > 80 else 
                          'good'
            })
        
        # Calculate month-by-month analysis if there's enough data
        monthly_analysis = []
        try:
            if 'fiscal_month' in budget_df.columns and 'fiscal_year' in budget_df.columns:
                for month, month_group in budget_df.groupby(['fiscal_month']):
                    month_allocated = month_group['allocated_amount'].sum()
                    month_spent = month_group['spent_amount'].sum()
                    month_percentage = (month_spent / month_allocated * 100) if month_allocated > 0 else 0
                    
                    monthly_analysis.append({
                        'month': month,
                        'allocated': month_allocated,
                        'spent': month_spent,
                        'percentage': month_percentage
                    })
        except Exception as e:
            logger.error(f"Error calculating monthly analysis: {e}")
        
        return {
            'success': True,
            'message': 'Budget performance analysis completed',
            'data': {
                'overall': {
                    'allocated': total_allocated,
                    'spent': total_spent,
                    'remaining': total_remaining,
                    'percentage': overall_percentage,
                    'status': 'over_budget' if overall_percentage > 100 else 
                              'warning' if overall_percentage > 80 else 
                              'good'
                },
                'categories': category_performance,
                'monthly': monthly_analysis,
                'analyzed_at': datetime.now().isoformat(),
                'fiscal_year': fiscal_year
            }
        }
    
    def forecast_budget(self, branch_id: str, category: str = None, periods: int = 3) -> Dict[str, Any]:
        """Forecast budget needs for future periods based on historical expense data"""
        # Get historical expense data for the past 2 years
        start_date = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d')
        expense_df = self.get_expense_data(branch_id, start_date)
        
        if expense_df.empty:
            return {
                'success': False,
                'message': 'Insufficient expense data for forecasting',
                'data': {}
            }
        
        forecasts = {}
        forecast_plots = {}
        
        try:
            # Filter by category if provided
            if category:
                category_df = expense_df[expense_df['category'] == category]
                if not category_df.empty:
                    expense_df = category_df
            
            # Aggregate expenses by month
            expense_df['month'] = expense_df['date'].dt.to_period('M')
            monthly_expenses = expense_df.groupby('month')['amount'].sum().reset_index()
            monthly_expenses['month'] = monthly_expenses['month'].dt.to_timestamp()
            
            # Ensure we have enough data points
            if len(monthly_expenses) < 12:
                return {
                    'success': False,
                    'message': 'Insufficient monthly data points for forecasting (need at least 12 months)',
                    'data': {}
                }
            
            # Create time series
            time_series = monthly_expenses.set_index('month')['amount']
            
            # Try ARIMA forecasting
            try:
                # Fit ARIMA model
                model = ARIMA(time_series, order=(1, 1, 1))
                model_fit = model.fit()
                
                # Generate forecast
                forecast = model_fit.forecast(steps=periods)
                
                # Create forecast dataframe
                last_date = time_series.index[-1]
                forecast_dates = pd.date_range(start=last_date + pd.DateOffset(months=1), periods=periods, freq='MS')
                forecast_df = pd.DataFrame({
                    'date': forecast_dates,
                    'forecasted_amount': forecast.values
                })
                
                # Generate plot
                plt.figure(figsize=(10, 6))
                plt.plot(time_series.index, time_series.values, label='Historical')
                plt.plot(forecast_df['date'], forecast_df['forecasted_amount'], label='Forecast', color='red')
                plt.title('Budget Forecast')
                plt.xlabel('Date')
                plt.ylabel('Amount')
                plt.legend()
                plt.grid(True)
                
                # Save plot to base64
                buffer = BytesIO()
                plt.savefig(buffer, format='png')
                buffer.seek(0)
                plot_data = base64.b64encode(buffer.read()).decode('utf-8')
                plt.close()
                
                # Build forecast results
                forecasts = {
                    'method': 'ARIMA',
                    'periods': periods,
                    'forecast': [
                        {
                            'period': date.strftime('%Y-%m'),
                            'amount': float(amount),
                            'lower_bound': float(amount * 0.85),  # Simple bound estimate
                            'upper_bound': float(amount * 1.15)   # Simple bound estimate
                        }
                        for date, amount in zip(forecast_df['date'], forecast_df['forecasted_amount'])
                    ]
                }
                forecast_plots = {
                    'time_series': plot_data
                }
                
            except Exception as e:
                logger.error(f"ARIMA forecasting failed: {e}")
                
                # Fall back to simple linear regression
                X = np.array(range(len(time_series))).reshape(-1, 1)
                y = time_series.values
                
                model = LinearRegression()
                model.fit(X, y)
                
                # Generate forecast
                X_forecast = np.array(range(len(time_series), len(time_series) + periods)).reshape(-1, 1)
                y_forecast = model.predict(X_forecast)
                
                # Create forecast dataframe
                last_date = time_series.index[-1]
                forecast_dates = pd.date_range(start=last_date + pd.DateOffset(months=1), periods=periods, freq='MS')
                
                forecasts = {
                    'method': 'Linear Regression',
                    'periods': periods,
                    'forecast': [
                        {
                            'period': date.strftime('%Y-%m'),
                            'amount': float(amount),
                            'lower_bound': float(amount * 0.85),  # Simple bound estimate
                            'upper_bound': float(amount * 1.15)   # Simple bound estimate
                        }
                        for date, amount in zip(forecast_dates, y_forecast)
                    ]
                }
        
        except Exception as e:
            logger.error(f"Budget forecasting failed: {e}")
            return {
                'success': False,
                'message': f'Forecasting failed: {str(e)}',
                'data': {}
            }
        
        return {
            'success': True,
            'message': 'Budget forecast completed',
            'data': {
                'category': category or 'all',
                'forecast_generated_at': datetime.now().isoformat(),
                'forecasts': forecasts,
                'plots': forecast_plots
            }
        }
    
    def generate_budget_variance_report(self, branch_id: str, fiscal_year: str = None) -> Dict[str, Any]:
        """Generate a detailed budget variance report"""
        budget_df = self.get_budget_data(branch_id, fiscal_year)
        
        if budget_df.empty:
            return {
                'success': False,
                'message': 'No budget data available',
                'data': {}
            }
        
        # Calculate variance metrics
        budget_df['variance'] = budget_df['allocated_amount'] - budget_df['spent_amount']
        budget_df['variance_percentage'] = budget_df.apply(
            lambda row: (row['variance'] / row['allocated_amount']) * 100 if row['allocated_amount'] > 0 else 0, 
            axis=1
        )
        
        # Categorize variances
        budget_df['variance_category'] = budget_df['variance_percentage'].apply(
            lambda x: 'Significant Underspending' if x > 20 else
                      'Underspending' if x > 5 else
                      'On Target' if x >= -5 else
                      'Overspending' if x >= -20 else
                      'Significant Overspending'
        )
        
        # Generate summary by category
        category_variance = []
        for category, group in budget_df.groupby('category'):
            allocated = group['allocated_amount'].sum()
            spent = group['spent_amount'].sum()
            variance = allocated - spent
            variance_pct = (variance / allocated * 100) if allocated > 0 else 0
            
            category_variance.append({
                'category': category,
                'allocated': allocated,
                'spent': spent,
                'variance': variance,
                'variance_percentage': variance_pct,
                'variance_category': 'Significant Underspending' if variance_pct > 20 else
                                    'Underspending' if variance_pct > 5 else
                                    'On Target' if variance_pct >= -5 else
                                    'Overspending' if variance_pct >= -20 else
                                    'Significant Overspending'
            })
        
        # Generate detailed variance items
        variance_items = []
        for _, row in budget_df.iterrows():
            variance_items.append({
                'name': row['name'],
                'category': row['category'],
                'allocated': row['allocated_amount'],
                'spent': row['spent_amount'],
                'variance': row['variance'],
                'variance_percentage': row['variance_percentage'],
                'variance_category': row['variance_category']
            })
        
        # Generate plot
        try:
            plt.figure(figsize=(12, 8))
            
            # Plot 1: Budget vs Actual by Category
            categories = [item['category'] for item in category_variance]
            allocated = [item['allocated'] for item in category_variance]
            spent = [item['spent'] for item in category_variance]
            
            x = np.arange(len(categories))
            width = 0.35
            
            plt.subplot(2, 1, 1)
            plt.bar(x - width/2, allocated, width, label='Budget')
            plt.bar(x + width/2, spent, width, label='Actual')
            plt.xlabel('Category')
            plt.ylabel('Amount')
            plt.title('Budget vs Actual by Category')
            plt.xticks(x, categories, rotation=45, ha='right')
            plt.legend()
            plt.tight_layout()
            
            # Plot 2: Variance by Category
            variance_pct = [item['variance_percentage'] for item in category_variance]
            colors = ['red' if v < 0 else 'green' for v in variance_pct]
            
            plt.subplot(2, 1, 2)
            plt.bar(categories, variance_pct, color=colors)
            plt.axhline(y=0, color='black', linestyle='-', alpha=0.3)
            plt.xlabel('Category')
            plt.ylabel('Variance %')
            plt.title('Budget Variance by Category (%)')
            plt.xticks(rotation=45, ha='right')
            plt.tight_layout()
            
            # Save plot to base64
            buffer = BytesIO()
            plt.savefig(buffer, format='png')
            buffer.seek(0)
            plot_data = base64.b64encode(buffer.read()).decode('utf-8')
            plt.close()
            
            variance_plot = plot_data
        except Exception as e:
            logger.error(f"Error generating variance plot: {e}")
            variance_plot = None
        
        return {
            'success': True,
            'message': 'Budget variance report generated',
            'data': {
                'summary': {
                    'total_allocated': budget_df['allocated_amount'].sum(),
                    'total_spent': budget_df['spent_amount'].sum(),
                    'total_variance': budget_df['variance'].sum(),
                    'average_variance_percentage': budget_df['variance_percentage'].mean()
                },
                'category_variance': category_variance,
                'variance_items': variance_items,
                'fiscal_year': fiscal_year,
                'generated_at': datetime.now().isoformat(),
                'plot': variance_plot
            }
        }
    
    def recommend_budget_adjustments(self, branch_id: str, fiscal_year: str = None) -> Dict[str, Any]:
        """Recommend budget adjustments based on performance and forecasts"""
        # Get current budget performance
        performance = self.analyze_budget_performance(branch_id, fiscal_year)
        
        if not performance['success']:
            return {
                'success': False,
                'message': 'Could not retrieve budget performance',
                'data': {}
            }
        
        # Generate forecasts
        forecast_result = self.forecast_budget(branch_id, periods=3)
        forecasted_needs = 0
        if forecast_result['success']:
            # Use the first forecasted period as reference
            forecasts = forecast_result['data']['forecasts']['forecast']
            if forecasts and len(forecasts) > 0:
                forecasted_needs = forecasts[0]['amount']
        
        recommendations = []
        
        # Analyze each category
        for category in performance['data']['categories']:
            category_name = category['category']
            allocated = category['allocated']
            spent = category['spent']
            remaining = category['remaining']
            percentage = category['percentage']
            
            recommendation = {
                'category': category_name,
                'current_allocated': allocated,
                'current_spent': spent,
                'current_remaining': remaining,
                'usage_percentage': percentage,
                'recommendation_type': None,
                'recommended_adjustment': 0,
                'rationale': '',
                'priority': 'medium'
            }
            
            # Generate recommendations based on performance
            if percentage > 100:  # Over budget
                recommendation['recommendation_type'] = 'increase'
                recommendation['recommended_adjustment'] = round((spent - allocated) * 1.1, 2)  # 10% buffer
                recommendation['rationale'] = 'Category is over budget. Increase allocation to cover current and projected expenses.'
                recommendation['priority'] = 'high'
            
            elif percentage > 90:  # Near budget limit
                recommendation['recommendation_type'] = 'increase'
                recommendation['recommended_adjustment'] = round(allocated * 0.15, 2)  # 15% increase
                recommendation['rationale'] = 'Category is nearing budget limit. Consider increasing allocation for the remainder of the period.'
                recommendation['priority'] = 'medium'
            
            elif percentage < 50 and remaining > 10000:  # Significant underspending
                recommendation['recommendation_type'] = 'decrease'
                recommendation['recommended_adjustment'] = round(remaining * 0.5, 2)  # Reduce by 50% of remaining
                recommendation['rationale'] = 'Category shows significant underspending. Consider reallocating funds to more critical areas.'
                recommendation['priority'] = 'medium'
            
            elif percentage < 20:  # Extreme underspending
                recommendation['recommendation_type'] = 'decrease'
                recommendation['recommended_adjustment'] = round(remaining * 0.7, 2)  # Reduce by 70% of remaining
                recommendation['rationale'] = 'Category shows extreme underspending. Funds could be better utilized elsewhere.'
                recommendation['priority'] = 'high'
            
            else:  # On track
                recommendation['recommendation_type'] = 'maintain'
                recommendation['recommended_adjustment'] = 0
                recommendation['rationale'] = 'Category is on track with budget utilization. No adjustment needed at this time.'
                recommendation['priority'] = 'low'
            
            recommendations.append(recommendation)
        
        # Sort recommendations by priority
        priority_map = {'high': 3, 'medium': 2, 'low': 1}
        recommendations.sort(key=lambda x: priority_map.get(x['priority'], 0), reverse=True)
        
        return {
            'success': True,
            'message': 'Budget adjustment recommendations generated',
            'data': {
                'recommendations': recommendations,
                'summary': {
                    'total_current_allocated': sum(r['current_allocated'] for r in recommendations),
                    'total_recommended_adjustments': sum(
                        r['recommended_adjustment'] if r['recommendation_type'] == 'increase' else -r['recommended_adjustment'] 
                        for r in recommendations if r['recommendation_type'] != 'maintain'
                    ),
                    'high_priority_count': sum(1 for r in recommendations if r['priority'] == 'high'),
                    'generated_at': datetime.now().isoformat()
                }
            }
        }
