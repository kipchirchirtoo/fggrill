import { logger } from '../utils/logger';

/**
 * Validates and retrieves the Python Service URL from environment variables.
 * Ensures the URL is a valid absolute URL and provides a consistent fallback.
 */
function getPythonServiceUrl(): string {
    const rawUrl = process.env.PYTHON_SERVICE_URL;

    // Updated default URL as per user request
    const DEFAULT_URL = 'https://services.hirall.com';

    // 1. Check if it's explicitly set
    if (!rawUrl || rawUrl === 'undefined' || rawUrl === 'null' || rawUrl.trim() === '') {
        logger.warn(`PYTHON_SERVICE_URL not set or invalid. Falling back to: ${DEFAULT_URL}`);
        return DEFAULT_URL;
    }

    let url = rawUrl.trim();

    // 2. Ensure it has a protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        // If it looks like a hostname:port, prepend http://
        if (url.includes(':') || url === 'localhost') {
            url = `http://${url}`;
        } else {
            logger.error(`PYTHON_SERVICE_URL is malformed: ${url}. Falling back to: ${DEFAULT_URL}`);
            return DEFAULT_URL;
        }
    }

    // 3. Final validation with URL constructor
    try {
        new URL(url);
        return url;
    } catch (e) {
        logger.error(`PYTHON_SERVICE_URL is not a valid URL: ${url}. Falling back to: ${DEFAULT_URL}`);
        return DEFAULT_URL;
    }
}

export const PYTHON_SERVICE_URL = getPythonServiceUrl();

logger.info(`Python Service URL configured as: ${PYTHON_SERVICE_URL}`);
