// Service to interact with the centralized Hotel System Backend Email API
import { apiClient } from './api-client';

export interface EmailConfirmationRequest {
    email: string;
    firstName: string;
    lastName: string;
    branchName?: string;
    checkInDate: string;
    checkOutDate: string;
    confirmationNumber: string;
    roomType?: string;
    guests?: number;
    totalAmount?: number;
    hotelName?: string;
    hotelAddress?: string;
    hotelPhone?: string;
    hotelEmail?: string;
}

export interface ReservationRequest {
    email: string;
    firstName: string;
    lastName: string;
    branchName?: string;
    checkInDate: string;
    checkOutDate: string;
    reservationId: string;
    roomType?: string;
    guests?: number;
    totalAmount?: number;
    paymentLink: string;
    hotelName?: string;
    hotelAddress?: string;
    hotelPhone?: string;
    hotelEmail?: string;
}

export interface NewsletterRequest {
    recipients: Array<{ email: string; name: string }>;
    newsletterTitle?: string;
    issueDate?: string;
    featuredArticle?: any;
    secondaryArticles?: any[];
    bookingLink?: string;
    hotelName?: string;
    hotelAddress?: string;
    hotelPhone?: string;
}

export interface PromotionRequest {
    recipients: Array<{ email: string; name: string }>;
    promoTitle?: string;
    promoHeadline?: string;
    promoDescription?: string;
    promoCode?: string;
    discountPercentage?: string;
    validUntil?: string;
    bookingLink?: string;
    hotelName?: string;
    hotelAddress?: string;
    heroImageUrl?: string;
}

export const sendBookingConfirmation = async (data: EmailConfirmationRequest): Promise<void> => {
    try {
        await apiClient.post('/landing-email/confirmation', data);
    } catch (error) {
        console.error('Failed to send booking confirmation email:', error);
    }
};

export const sendReservationRequest = async (data: ReservationRequest): Promise<void> => {
    try {
        await apiClient.post('/landing-email/reservation', data);
    } catch (error) {
        console.error('Failed to send reservation request email:', error);
    }
};

export const sendNewsletter = async (data: NewsletterRequest): Promise<void> => {
    try {
        await apiClient.post('/landing-email/newsletter', data);
    } catch (error) {
        console.error('Failed to send newsletter:', error);
    }
};

export const sendPromotion = async (data: PromotionRequest): Promise<void> => {
    try {
        await apiClient.post('/landing-email/promotion', data);
    } catch (error) {
        console.error('Failed to send promotion:', error);
    }
};

export const emailService = {
    sendBookingConfirmation,
    sendReservationRequest,
    sendNewsletter,
    sendPromotion,
};
