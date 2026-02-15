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

// Detect if we're running in the C# Desktop App / Electron
const isDesktop = typeof window !== 'undefined' && (window as any).electronAPI !== undefined;

// Always use production APIs for the terminal app, unless overridden
const DEFAULT_API_URL = 'https://api.hirall.com';
const DEFAULT_PYTHON_URL = 'https://services.hirall.com';

export const API_URL = isDesktop
    ? (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')
        ? process.env.NEXT_PUBLIC_API_URL
        : DEFAULT_API_URL)
    : normalizeUrl(process.env.NEXT_PUBLIC_API_URL, DEFAULT_API_URL);

export const PYTHON_API_URL = isDesktop
    ? (process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL && !process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL.includes('localhost')
        ? process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL
        : DEFAULT_PYTHON_URL)
    : normalizeUrl(process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL, DEFAULT_PYTHON_URL);
export const PYTHON_SERVICE_URL = PYTHON_API_URL; // Alias for consistency
export const ROOM_SERVICE_URL = PYTHON_API_URL; // Alias for consistency
export const REPORTS_SERVICE_URL = normalizeUrl(process.env.NEXT_PUBLIC_REPORTS_SERVICE_URL, 'https://services.hirall.com');

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
