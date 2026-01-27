import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from typing import Optional

app = FastAPI(title="Famous Gate Gateway", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://famousgate.hirall.com",
        "https://services.hirall.com",
        "https://api.hirall.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service URLs
ROOM_SERVICE_URL = "http://localhost:8003"
REPORTING_SERVICE_URL = "http://localhost:8002"
ANALYTICS_SERVICE_URL = "http://localhost:8001"

client = httpx.AsyncClient()

async def proxy_request(url: str, request: Request):
    try:
        # Prepare headers, excluding host to avoid issues
        headers = dict(request.headers)
        headers.pop("host", None)
        headers.pop("content-length", None)  # Let httpx handle this

        # Read body
        body = await request.body()

        response = await client.request(
            method=request.method,
            url=url,
            headers=headers,
            content=body,
            params=request.query_params,
            timeout=60.0
        )

        return StreamingResponse(
            response.aiter_bytes(),
            status_code=response.status_code,
            headers=dict(response.headers)
        )
    except httpx.RequestError as exc:
        return JSONResponse(
            status_code=502,
            content={"error": f"Service unavailable: {str(exc)}"}
        )

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def gateway(path: str, request: Request):
    # Routing Logic
    
    # Room Service
    if path.startswith("api/rooms") or path.startswith("api/room-types"):
        target_url = f"{ROOM_SERVICE_URL}/{path}"
        return await proxy_request(target_url, request)
    
    # Reporting Service (Flask)
    if (path.startswith("api/reports") or 
        path.startswith("api/kpi") or 
        path.startswith("api/budget") or 
        path.startswith("api/forecasting") or
        path == "api/analytics/kpi-analysis"):
        target_url = f"{REPORTING_SERVICE_URL}/{path}"
        return await proxy_request(target_url, request)

    # Analytics Service (FastAPI)
    if (path.startswith("analytics") or 
        path.startswith("reports") or 
        path.startswith("export") or 
        path.startswith("api/analytics")):
        target_url = f"{ANALYTICS_SERVICE_URL}/{path}"
        return await proxy_request(target_url, request)

    # Default/Fallback (maybe 404 or try one of them?)
    return JSONResponse(status_code=404, content={"error": "Route not found"})

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    uvicorn.run(app, host="0.0.0.0", port=port)
