import axios from 'axios';
import { logger } from '../utils/logger';

const PRICING_SERVICE_URL = process.env.PRICING_SERVICE_URL || 'http://localhost:8001';

export interface PricingRequest {
  check_in: string;
  check_out: string;
  room_type_id: string;
  guests: number;
}

export interface PricingResponse {
  base_price: number;
  recommended_price: number;
  multiplier: number;
  factors: string[];
}

export const calculateDynamicRate = async (data: PricingRequest): Promise<PricingResponse | null> => {
  try {
    const response = await axios.post(`${PRICING_SERVICE_URL}/api/pricing/calculate`, data);
    return response.data;
  } catch (error) {
    logger.error('Error calling pricing service:', error);
    return null;
  }
};
