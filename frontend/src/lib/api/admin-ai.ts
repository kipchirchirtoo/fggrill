import { fetchAPI } from './core';

export interface AnomalyEvent {
  id: string;
  user_id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  description: string;
  metadata: any;
  detected_at: string;
  user?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

export const adminAiAPI = {
  getAnomalies: async (
    params?: {
      limit?: number;
      user_id?: string;
    }
  ) => {
    return fetchAPI<{ success: boolean; anomalies: AnomalyEvent[]; count: number }>('/admin-ai/anomalies', {
      method: 'GET',
      params: params as Record<string, string | number | undefined>
    });
  },

  retrainProfiles: async () => {
    return fetchAPI<{ success: boolean; message: string }>('/admin-ai/retrain', {
      method: 'POST'
    });
  }
};
