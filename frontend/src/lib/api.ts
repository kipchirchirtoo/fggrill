/**
 * FamousGate API - Modular Bridge
 * This file re-exports everything from the new modular API structure in ./api
 * to maintain backward compatibility with existing imports.
 */

export * from './api/index';
import api from './api/index';
export default api;
