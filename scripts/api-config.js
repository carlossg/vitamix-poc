/**
 * Vitamix POC - API Configuration (Google Cloud)
 *
 * Central configuration for all API endpoints.
 * Updated to use Cloud Run and Cloud Functions instead of Cloudflare Workers.
 */

// ============================================
// Google Cloud Run Endpoints
// ============================================

// Google Cloud project ID (from infrastructure/cloudrun; override via window.VITAMIX_CONFIG?.GCP_PROJECT_ID)
export const GCP_PROJECT_ID = window.VITAMIX_CONFIG?.GCP_PROJECT_ID || 'api-project-642841493686';

// Main recommender service (Cloud Run)
export const VITAMIX_RECOMMENDER_URL = window.VITAMIX_CONFIG?.RECOMMENDER_URL ||
	'https://vitamix-recommender-okyq6gkx3a-uc.a.run.app';

// Analytics service (Cloud Function Gen2)
export const VITAMIX_ANALYTICS_URL = window.VITAMIX_CONFIG?.ANALYTICS_URL ||
	`https://us-central1-${GCP_PROJECT_ID}.cloudfunctions.net/trackEvent`;

// Recipe embeddings service (Cloud Function Gen2)
export const VITAMIX_EMBEDDINGS_URL = window.VITAMIX_CONFIG?.EMBEDDINGS_URL ||
	`https://us-central1-${GCP_PROJECT_ID}.cloudfunctions.net/searchRecipes`;

// ============================================
// Legacy Endpoints (Backward Compatibility)
// ============================================

// These will be replaced by Cloud Run/Functions
export const GENERATIVE_WORKER_URL = VITAMIX_RECOMMENDER_URL;
export const FAST_WORKER_URL = VITAMIX_RECOMMENDER_URL;

// ============================================
// Environment Detection
// ============================================

export const IS_PRODUCTION = !window.location.hostname.includes('localhost') && 
	!window.location.hostname.includes('preview');

export const IS_LOCAL = window.location.hostname.includes('localhost');

// ============================================
// Configuration Helper
// ============================================

/**
 * Get the appropriate API endpoint for the current environment
 */
export function getAPIEndpoint(service = 'recommender') {
	// Allow override via window.VITAMIX_CONFIG
	if (window.VITAMIX_CONFIG) {
		switch (service) {
			case 'recommender':
				return window.VITAMIX_CONFIG.RECOMMENDER_URL || VITAMIX_RECOMMENDER_URL;
			case 'analytics':
				return window.VITAMIX_CONFIG.ANALYTICS_URL || VITAMIX_ANALYTICS_URL;
			case 'embeddings':
				return window.VITAMIX_CONFIG.EMBEDDINGS_URL || VITAMIX_EMBEDDINGS_URL;
		}
	}

	// Return default endpoints
	switch (service) {
		case 'recommender':
			return VITAMIX_RECOMMENDER_URL;
		case 'analytics':
			return VITAMIX_ANALYTICS_URL;
		case 'embeddings':
			return VITAMIX_EMBEDDINGS_URL;
		default:
			return VITAMIX_RECOMMENDER_URL;
	}
}

/**
 * Log API configuration on page load
 */
if (IS_LOCAL) {
	console.log('[Vitamix POC] API Configuration (Google Cloud):', {
		recommender: VITAMIX_RECOMMENDER_URL,
		analytics: VITAMIX_ANALYTICS_URL,
		embeddings: VITAMIX_EMBEDDINGS_URL,
		environment: IS_PRODUCTION ? 'production' : 'development',
	});
}

/**
 * Configuration instructions for deployment
 */
window.VITAMIX_CONFIG_HELP = `
To configure API endpoints for your deployment:

1. Defaults use project api-project-642841493686. Override URLs or project:
   window.VITAMIX_CONFIG = {
     GCP_PROJECT_ID: 'your-project-id',
     RECOMMENDER_URL: 'https://vitamix-recommender-xxx-uc.a.run.app',
     ANALYTICS_URL: 'https://us-central1-YOUR_PROJECT.cloudfunctions.net/trackEvent',
     EMBEDDINGS_URL: 'https://us-central1-YOUR_PROJECT.cloudfunctions.net/searchRecipes',
   };

2. Add this to your head.html or page template before loading scripts.

3. For local development with Cloud Run:
   window.VITAMIX_CONFIG = { RECOMMENDER_URL: 'http://localhost:8080' };
`;
