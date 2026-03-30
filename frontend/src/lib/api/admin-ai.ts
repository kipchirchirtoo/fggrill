import { fetchAPI } from './core';

export interface AnomalyEvent {
  id: string;
  user_id: string | null;
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

export interface GeminiInsight {
  title: string;
  detail: string;
  category: 'FINANCIAL' | 'OPERATIONAL' | 'SECURITY' | 'COMPLIANCE';
}

export interface GeminiAnalysis {
  summary: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  insights: GeminiInsight[];
  recommendation: string;
}

export const adminAiAPI = {
  getAnomalies: (params?: { limit?: number; user_id?: string }) =>
    fetchAPI<{ success: boolean; anomalies: AnomalyEvent[]; count: number; stats: any }>(
      '/admin-ai/anomalies',
      { method: 'GET', params: params as any }
    ),

  getInsights: () =>
    fetchAPI<{ success: boolean; data: GeminiAnalysis }>('/admin-ai/insights', { method: 'GET' }),

  retrainProfiles: () =>
    fetchAPI<{ success: boolean; message: string }>('/admin-ai/retrain', { method: 'POST' }),
};
