import { apiClient } from './api-client';

/**
 * API Endpoints — backend/src/routes/reviews.routes.ts
 */
const ENDPOINTS = {
  REVIEWS: '/reviews',
  HELPFUL: (id: string) => `/reviews/${id}/helpful`,
};

export interface RatingBreakdown {
  cleanliness: number | null;
  service: number | null;
  comfort: number | null;
  wifi: number | null;
  location: number | null;
  value: number | null;
  food: number | null;
}

export interface GuestReview {
  id: string;
  branch_id: number | null;
  branch_label: string;
  service_type: 'hotel' | 'restaurant' | 'general';
  stay_type: 'Business' | 'Family' | 'Couple' | 'Solo' | 'Vacation' | null;
  reviewer_name: string;
  reviewer_email: string | null;
  reviewer_location: string | null;
  rating: number;
  rating_cleanliness: number | null;
  rating_service: number | null;
  rating_comfort: number | null;
  rating_wifi: number | null;
  rating_location: number | null;
  rating_value: number | null;
  rating_food: number | null;
  content: string;
  stayed_on: string | null;
  is_verified: boolean;
  status: 'published' | 'pending' | 'hidden';
  sentiment: 'Positive' | 'Neutral' | 'Negative' | null;
  sentiment_confidence: number | null;
  issues_mentioned: string[];
  helpful_count: number;
  likes_count: number;
  responded: boolean;
  response_text: string | null;
  response_by: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface SubmitReviewPayload {
  reviewer_name: string;
  reviewer_email?: string;
  reviewer_location?: string;
  branch_label: string;
  service_type: 'hotel' | 'restaurant' | 'general';
  stay_type?: string;
  rating: number;
  rating_cleanliness?: number;
  rating_service?: number;
  rating_comfort?: number;
  rating_wifi?: number;
  rating_location?: number;
  rating_value?: number;
  rating_food?: number;
  content: string;
  stayed_on?: string;
}

export const fetchReviews = async (params?: {
  branch?: string;
  type?: 'hotel' | 'restaurant';
  verified?: boolean;
  sort?: 'recent' | 'highest' | 'lowest' | 'helpful';
}): Promise<GuestReview[]> => {
  try {
    return await apiClient.get<GuestReview[]>(ENDPOINTS.REVIEWS, {
      params: {
        ...(params?.branch ? { branch: params.branch } : {}),
        ...(params?.type ? { type: params.type } : {}),
        ...(params?.verified ? { verified: 'true' } : {}),
        ...(params?.sort ? { sort: params.sort } : {}),
      },
    });
  } catch {
    return [];
  }
};

export const submitReview = async (payload: SubmitReviewPayload): Promise<GuestReview> => {
  return apiClient.post<GuestReview, SubmitReviewPayload>(ENDPOINTS.REVIEWS, payload);
};

export const markReviewHelpful = async (id: string): Promise<{ id: string; helpful_count: number }> => {
  return apiClient.patch<{ id: string; helpful_count: number }>(ENDPOINTS.HELPFUL(id));
};

export const reviewsService = {
  fetchReviews,
  submitReview,
  markReviewHelpful,
};
