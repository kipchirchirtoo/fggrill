/**
 * Centralized configuration for the frontend
 */

const normalizeUrl = (url: string | undefined, defaultUrl: string): string => {
    if (!url) return defaultUrl;

    // Remove any trailing slashes
    let normalized = url.replace(/\/$/, '');

    // If it already starts with http:// or https://, return it
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
        return normalized;
    }

    // Otherwise, assume it's a domain and add https:// (or http:// if localhost)
    const protocol = normalized.includes('localhost') || normalized.includes('127.0.0.1') ? 'http://' : 'https://';
    normalized = `${protocol}${normalized}`;

    // Final validation: ensure it starts with http:// or https://
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        console.error(`Invalid API URL after normalization: ${normalized}. Using default: ${defaultUrl}`);
        return defaultUrl;
    }

    return normalized;
};

// Detect if we are running in Electron or in a browser on localhost
const isElectron = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');
const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// In Electron app, always use localhost. In browser, check if we're on localhost
const useLocalhost = isElectron || isLocalhost;

export const API_URL = normalizeUrl(process.env.NEXT_PUBLIC_API_URL, useLocalhost ? 'http://localhost:5000' : 'https://api.hirall.com');
export const PYTHON_API_URL = normalizeUrl(process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL, useLocalhost ? 'http://localhost:8000' : 'https://services.hirall.com');
export const PYTHON_SERVICE_URL = PYTHON_API_URL; // Alias for consistency
export const ROOM_SERVICE_URL = PYTHON_API_URL; // Alias for consistency
export const REPORTS_SERVICE_URL = normalizeUrl(process.env.NEXT_PUBLIC_REPORTS_SERVICE_URL, useLocalhost ? 'http://localhost:8000' : 'https://services.hirall.com');

// Log the URLs in development for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('API Configuration:', {
        API_URL,
        PYTHON_API_URL,
        REPORTS_SERVICE_URL
    });
}

// Global log suppression for production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    console.log = () => { };
    console.info = () => { };
    console.warn = () => { };
    console.debug = () => { };
}
