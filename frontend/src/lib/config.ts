/**
 * Centralized configuration for the frontend
 */

const normalizeUrl = (url: string | undefined, defaultUrl: string): string => {
    if (!url) return defaultUrl;

    // If it starts with http:// or https://, it's already normalized
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url.replace(/\/$/, ''); // Remove trailing slash
    }

    // Otherwise, assume it's a domain and add https:// (or http:// if localhost)
    const protocol = url.includes('localhost') || url.includes('127.0.0.1') ? 'http://' : 'https://';
    return `${protocol}${url.replace(/\/$/, '')}`;
};

export const API_URL = normalizeUrl(process.env.NEXT_PUBLIC_API_URL, 'https://api.hirall.com');
export const PYTHON_API_URL = normalizeUrl(process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL, 'https://services.hirall.com');
export const PYTHON_SERVICE_URL = PYTHON_API_URL; // Alias for consistency
export const ROOM_SERVICE_URL = PYTHON_API_URL; // Alias for consistency
export const REPORTS_SERVICE_URL = normalizeUrl(process.env.NEXT_PUBLIC_REPORTS_SERVICE_URL, 'https://services.hirall.com');
