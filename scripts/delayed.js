/**
 * Delayed functionality - loaded after critical content
 *
 * This module initializes non-critical features like analytics tracking.
 */

import { AnalyticsTracker } from './analytics-tracker.js';
import { VITAMIX_ANALYTICS_URL } from './api-config.js';

const ANALYTICS_ENDPOINT = VITAMIX_ANALYTICS_URL;

/**
 * Initialize analytics tracking
 */
function initAnalytics() {
  try {
    const tracker = new AnalyticsTracker({
      endpoint: ANALYTICS_ENDPOINT,
    });

    // Make tracker available globally
    window.analyticsTracker = tracker;

    // Initialize the tracker
    tracker.init();

    console.log('[Delayed] Analytics tracker initialized');
  } catch (e) {
    console.warn('[Delayed] Failed to initialize analytics:', e);
  }
}

// Initialize when this module loads
initAnalytics();
