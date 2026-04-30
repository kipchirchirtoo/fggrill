/**
 * Centralized configuration for the frontend
 */

const normalizeUrl = (url: string | undefined, defaultUrl: string): string => {
    if (!url || typeof url !== 'string') {
        if (typeof window !== 'undefined') {
            console.warn(`API URL not provided, using default: ${defaultUrl}`);
        }
        return defaultUrl;
    }

    // Remove any trailing slashes and trim whitespace
    let normalized = url.trim().replace(/\/$/, '');

    // If empty after trimming, use default
    if (!normalized) {
        if (typeof window !== 'undefined') {
            console.warn(`Empty API URL provided, using default: ${defaultUrl}`);
        }
        return defaultUrl;
    }

    // If it's just a protocol-relative URL (starts with //), add https:
    if (normalized.startsWith('//')) {
        return `https:${normalized}`;
    }

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

    // Log the normalized URL in development for debugging
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log(`API URL normalized: ${url} → ${normalized}`);
    }

    return normalized;
};

// Detect if we're running in the C# Desktop App / Electron
const isDesktop = typeof window !== 'undefined' && (window as any).electronAPI !== undefined;

const isProduction = process.env.NODE_ENV === 'production';

// Always use localhost for development unless overridden
const DEFAULT_API_URL = isProduction ? 'https://api.hirall.com' : 'http://localhost:5000';
const DEFAULT_PYTHON_URL = isProduction ? 'https://services.hirall.com' : 'http://localhost:5001';
const DEFAULT_REPORTS_URL = isProduction ? 'https://services.hirall.com' : 'http://localhost:5001';

export const API_URL = normalizeUrl(process.env.NEXT_PUBLIC_API_URL, DEFAULT_API_URL);
export const PYTHON_API_URL = normalizeUrl(process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL, DEFAULT_PYTHON_URL);
export const PYTHON_SERVICE_URL = PYTHON_API_URL; // Alias for consistency
export const ROOM_SERVICE_URL = PYTHON_API_URL; // Alias for consistency
export const REPORTS_SERVICE_URL = normalizeUrl(process.env.NEXT_PUBLIC_REPORTS_SERVICE_URL, DEFAULT_REPORTS_URL);

// Runtime validation - ensure URLs are absolute
if (typeof window !== 'undefined') {
    const validateUrl = (url: string, name: string) => {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            console.error(`❌ ${name} is not an absolute URL: ${url}`);
            console.error('This will cause fetch requests to fail. Check your environment variables.');
        }
    };
    
    validateUrl(API_URL, 'API_URL');
    validateUrl(PYTHON_API_URL, 'PYTHON_API_URL');
    validateUrl(REPORTS_SERVICE_URL, 'REPORTS_SERVICE_URL');
}



// Global log suppression for production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    console.log = () => { };
    console.info = () => { };
    console.warn = () => { };
    console.debug = () => { };
}
