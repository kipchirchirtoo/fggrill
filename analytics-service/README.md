# FamousGate Analytics Service

Python-based analytics and reporting service for FamousGate Hotels.

## Features

- Security report generation (PDF, CSV, JSON)
- Restaurant analytics
- Sales forecasting
- Menu optimization
- Inventory management

## Quick Start

### Windows

1. Install Python 3.8+ if not already installed
2. Run the startup script:
   ```bash
   start-service.bat
   ```

### Manual Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Start the service:
   ```bash
   python app.py
   ```

The service will start on **http://localhost:5001**

## API Endpoints

### Security Reports

- `POST /api/reports/generate/security-report` - Generate security report PDF

### Health Check

- `GET /health` - Service health status

## Configuration

The service is configured to:
- Run on port **5001**
- Accept CORS requests from localhost:3000, localhost:3001, localhost:5000
- Generate PDF reports using ReportLab

## Troubleshooting

### Port Already in Use

If port 5001 is already in use, you can change it in `app.py`:

```python
uvicorn.run(
    "app:app",
    host="0.0.0.0",
    port=5001,  # Change this port
    reload=True,
    log_level="info"
)
```

### Missing Dependencies

Run:
```bash
pip install -r requirements.txt
```

### CORS Errors

Ensure the frontend URL is listed in the CORS configuration in `app.py`.
