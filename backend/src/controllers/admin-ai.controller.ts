import { Request, Response } from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5001';

export const getBehaviorAnomalies = async (req: Request, res: Response) => {
  try {
    const { limit, user_id } = req.query;
    let url = `${PYTHON_SERVICE_URL}/api/behavior/`;
    
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit as string);
    if (user_id) params.append('user_id', user_id as string);
    
    if (params.toString()) {
        url += `?${params.toString()}`;
    }

    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error: any) {
    logger.error('Error fetching behavior anomalies from Python service:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch AI insights' });
  }
};

export const rebuildProfiles = async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/api/behavior/retrain`);
    res.status(200).json(response.data);
  } catch (error: any) {
    logger.error('Error retraining models in Python service:', error.message);
    res.status(500).json({ success: false, message: 'Failed to retrain models' });
  }
};

export const triggerEventAnalysis = async (eventData: any) => {
    // This function is meant to be called asynchronously by other controllers (e.g. login, payment)
    // It shouldn't block the main Node process.
    try {
        await axios.post(`${PYTHON_SERVICE_URL}/api/behavior/analyze`, eventData);
    } catch (error: any) {
        logger.error('Failed to dispatch behavior event to AI service:', error.message);
    }
};
