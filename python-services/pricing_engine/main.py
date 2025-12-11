from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import PricingRequest, PricingResponse
from service import PricingService
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Dynamic Pricing Engine", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Secure this in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pricing_service = PricingService()

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "pricing-engine"}

@app.post("/api/pricing/calculate", response_model=PricingResponse)
async def calculate_price(request: PricingRequest):
    try:
        result = pricing_service.calculate_rate(
            request.check_in,
            request.check_out,
            request.room_type_id,
            request.guests
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PRICING_PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
