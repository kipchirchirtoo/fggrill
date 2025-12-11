# FG Grill Report Generation Microservice

A Python Flask microservice for generating PDF and Excel reports for the FG Grill branch oversight system.

## Features

- **Performance Reports**: Generate detailed branch performance reports with revenue, orders, and satisfaction metrics
- **Staff Reports**: Generate staff overview reports with attendance and performance data
- **Compliance Reports**: Generate compliance tracking reports with critical issues and deadlines
- **Multiple Formats**: Support for both PDF and Excel (XLSX) output formats

## Prerequisites

- Python 3.9 or higher
- pip (Python package manager)

## Installation

1. Navigate to the reports service directory:
   ```bash
   cd services/reports
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Service

### Development Mode

```bash
python app.py
```

The service will start on `http://localhost:5001`

### Production Mode

```bash
gunicorn -w 4 -b 0.0.0.0:5001 app:app
```

## API Endpoints

### Health Check
```
GET /health
```
Returns service health status.

### Generate Performance Report
```
POST /api/reports/performance?format=pdf|excel&period=week|month|quarter
Content-Type: application/json

{
  "total_revenue": 4850000,
  "total_orders": 12450,
  "avg_satisfaction": 4.6,
  "best_performer": "Nairobi CBD",
  "worst_performer": "Kisumu",
  "branches": [
    {
      "branch_id": 1,
      "branch_name": "Nairobi CBD",
      "revenue": 1850000,
      "revenue_change": 12.5,
      "orders": 4850,
      "customer_satisfaction": 4.8,
      "target_achievement": 105
    }
  ]
}
```

### Generate Staff Report
```
POST /api/reports/staff?format=pdf|excel
Content-Type: application/json

{
  "total_staff": 156,
  "active_staff": 142,
  "on_leave": 14,
  "avg_performance": 85,
  "avg_attendance": 94,
  "branch_summaries": [
    {
      "branch_id": 1,
      "branch_name": "Nairobi CBD",
      "total_staff": 52,
      "active": 48,
      "on_leave": 4,
      "avg_performance": 88,
      "avg_attendance": 95
    }
  ]
}
```

### Generate Compliance Report
```
POST /api/reports/compliance?format=pdf|excel
Content-Type: application/json

{
  "total_requirements": 48,
  "compliant": 38,
  "non_compliant": 4,
  "pending": 4,
  "expired": 2,
  "overall_compliance_rate": 79,
  "branch_summaries": [...],
  "critical_issues": [...]
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 5001 | Port to run the service on |
| FLASK_DEBUG | true | Enable debug mode |
| API_BASE_URL | http://localhost:5000 | Backend API URL |

## Integration with Backend

The Node.js backend proxies report generation requests to this microservice. Ensure this service is running before attempting to generate reports from the frontend.

The backend endpoint `/api/central-operations/reports/:type` will forward requests to this service.

## Report Output

- **PDF Reports**: Professional formatted PDF documents with tables, headers, and styling
- **Excel Reports**: Multi-sheet Excel workbooks with formatted data and styling

## Dependencies

- Flask 3.0.0 - Web framework
- Flask-CORS 4.0.0 - Cross-origin resource sharing
- ReportLab 4.0.8 - PDF generation
- OpenPyXL 3.1.2 - Excel file generation
- Pandas 2.1.4 - Data manipulation
- Gunicorn 21.2.0 - Production WSGI server
