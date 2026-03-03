# Restaurant Analytics Service - Main Application
# FastAPI-based analytics service for restaurant data

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date, timedelta
import uvicorn

# Import analytics routers
from maa_analytics import router as maa_router

from config.database import get_db_connection
from services.sales_analytics import SalesAnalytics
from services.demand_forecast import DemandForecast
from services.menu_optimization import MenuOptimization
from services.inventory_optimizer import InventoryOptimizer
from services.customer_segmentation import CustomerSegmentation
from reports.pdf_generator import PDFReportGenerator
from reports.excel_exporter import ExcelExporter

app = FastAPI(
    title="Restaurant Analytics Service",
    description="Advanced analytics and reporting for Kyogong Restaurant",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
sales_analytics = SalesAnalytics()
demand_forecast = DemandForecast()
menu_optimization = MenuOptimization()
inventory_optimizer = InventoryOptimizer()
customer_segmentation = CustomerSegmentation()
pdf_generator = PDFReportGenerator()
excel_exporter = ExcelExporter()

# ============ REQUEST MODELS ============

class DateRangeRequest(BaseModel):
    start_date: date
    end_date: date
    branch_id: Optional[str] = None

class ForecastRequest(BaseModel):
    days_ahead: int = 30
    branch_id: Optional[str] = None

class MenuAnalysisRequest(BaseModel):
    period_days: int = 30
    branch_id: Optional[str] = None

class ReportRequest(BaseModel):
    report_type: str  # 'daily', 'weekly', 'monthly'
    report_date: date
    branch_id: Optional[str] = None
    format: str = 'pdf'  # 'pdf' or 'excel'

# ============ HEALTH CHECK ============

@app.get("/")
async def root():
    return {
        "service": "Restaurant Analytics",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    try:
        # Test database connection
        conn = get_db_connection()
        conn.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

# ============ SALES ANALYTICS ============

@app.post("/analytics/sales/daily")
async def analyze_daily_sales(request: DateRangeRequest):
    """Analyze daily sales trends"""
    try:
        result = await sales_analytics.analyze_daily_sales(
            request.start_date,
            request.end_date,
            request.branch_id
        )
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analytics/sales/peak-hours")
async def analyze_peak_hours(request: DateRangeRequest):
    """Identify peak operating hours"""
    try:
        result = await sales_analytics.identify_peak_hours(
            request.start_date,
            request.end_date,
            request.branch_id
        )
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analytics/sales/revenue-forecast")
async def forecast_revenue(request: ForecastRequest):
    """Forecast future revenue using ML"""
    try:
        result = await demand_forecast.forecast_revenue(
            request.days_ahead,
            request.branch_id
        )
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ MENU ANALYTICS ============

@app.post("/analytics/menu/engineering")
async def menu_engineering_analysis(request: MenuAnalysisRequest):
    """Menu engineering matrix (Stars, Plowhorses, Puzzles, Dogs)"""
    try:
        result = await menu_optimization.menu_engineering_matrix(
            request.period_days,
            request.branch_id
        )
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analytics/menu/popularity")
async def item_popularity(request: MenuAnalysisRequest):
    """Analyze menu item popularity and profitability"""
    try:
        result = await menu_optimization.analyze_item_popularity(
            request.period_days,
            request.branch_id
        )
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analytics/menu/pricing-optimization")
async def pricing_optimization(request: MenuAnalysisRequest):
    """Price elasticity and optimization suggestions"""
    try:
        result = await menu_optimization.price_elasticity_analysis(
            request.period_days,
            request.branch_id
        )
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ INVENTORY ANALYTICS ============

@app.get("/analytics/inventory/optimization")
async def optimize_inventory(branch_id: Optional[str] = None):
    """Calculate optimal stock levels"""
    try:
        result = await inventory_optimizer.calculate_optimal_stock(branch_id)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analytics/inventory/waste-analysis")
async def waste_analysis(request: DateRangeRequest):
    """Analyze waste patterns and reduction opportunities"""
    try:
        result = await inventory_optimizer.analyze_waste(
            request.start_date,
            request.end_date,
            request.branch_id
        )
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/inventory/supplier-performance")
async def supplier_performance(branch_id: Optional[str] = None):
    """Evaluate supplier performance metrics"""
    try:
        result = await inventory_optimizer.supplier_performance_analysis(branch_id)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ CUSTOMER ANALYTICS ============

@app.get("/analytics/customers/segmentation")
async def segment_customers(branch_id: Optional[str] = None):
    """Customer segmentation using K-means clustering"""
    try:
        result = await customer_segmentation.cluster_customers(branch_id)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/customers/lifetime-value")
async def calculate_ltv(branch_id: Optional[str] = None):
    """Calculate customer lifetime value"""
    try:
        result = await customer_segmentation.calculate_ltv(branch_id)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/customers/churn-prediction")
async def predict_churn(branch_id: Optional[str] = None):
    """Predict at-risk customers"""
    try:
        result = await customer_segmentation.predict_churn(branch_id)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ REPORT GENERATION ============

@app.post("/reports/generate")
async def generate_report(request: ReportRequest, background_tasks: BackgroundTasks):
    """Generate PDF or Excel report"""
    try:
        if request.format == 'pdf':
            file_path = await pdf_generator.generate_report(
                request.report_type,
                request.report_date,
                request.branch_id
            )
        else:
            file_path = await excel_exporter.generate_report(
                request.report_type,
                request.report_date,
                request.branch_id
            )
        
        return FileResponse(
            file_path,
            media_type='application/pdf' if request.format == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename=f"{request.report_type}_report_{request.report_date}.{request.format}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reports/daily/{report_date}")
async def get_daily_report(report_date: date, branch_id: Optional[str] = None):
    """Get pre-generated daily report"""
    try:
        file_path = await pdf_generator.get_daily_report(report_date, branch_id)
        if file_path:
            return FileResponse(file_path, media_type='application/pdf')
        else:
            raise HTTPException(status_code=404, detail="Report not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ EXPORT ENDPOINTS ============

@app.post("/export/sales")
async def export_sales(request: DateRangeRequest):
    """Export sales data to Excel"""
    try:
        file_path = await excel_exporter.export_sales(
            request.start_date,
            request.end_date,
            request.branch_id
        )
        return FileResponse(
            file_path,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename=f"sales_{request.start_date}_{request.end_date}.xlsx"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/export/inventory")
async def export_inventory(branch_id: Optional[str] = None):
    """Export current inventory to Excel"""
    try:
        file_path = await excel_exporter.export_inventory(branch_id)
        return FileResponse(
            file_path,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename=f"inventory_{datetime.now().strftime('%Y%m%d')}.xlsx"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Register MAA Analytics Router
app.include_router(maa_router, prefix="/api/analytics", tags=["MAA Analytics"])

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
