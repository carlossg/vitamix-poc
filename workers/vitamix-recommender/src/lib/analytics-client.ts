import { Firestore, Timestamp } from '@google-cloud/firestore';

/**
 * Firestore client for analytics tracking
 * Replaces Cloudflare KV for analytics storage
 * Uses Application Default Credentials (passwordless)
 */

export interface AnalyticsEvent {
	eventId: string;
	eventType: 'session_start' | 'query' | 'page_published' | 'conversion' | 'error';
	sessionId: string;
	timestamp: number;
	data: Record<string, any>;
}

export interface AnalyticsSession {
	sessionId: string;
	startTime: number;
	lastActivity: number;
	queries: string[];
	conversions: number;
	pagesGenerated: number;
	userAgent?: string;
}

export class FirestoreAnalyticsClient {
	private firestore: Firestore;

	constructor(projectId?: string) {
		// Passwordless - uses ADC
		this.firestore = new Firestore({
			projectId,
		});
	}

	/**
	 * Track an analytics event
	 */
	async trackEvent(event: AnalyticsEvent): Promise<void> {
		try {
			await this.firestore.collection('analytics_events').doc(event.eventId).set({
				eventType: event.eventType,
				sessionId: event.sessionId,
				timestamp: Timestamp.fromMillis(event.timestamp),
				data: event.data,
				createdAt: Timestamp.now(),
			});

			// Update session tracking
			await this.updateSessionActivity(event.sessionId, event.eventType);
		} catch (error) {
			console.error('Error tracking event:', error);
			throw error;
		}
	}

	/**
	 * Update session activity
	 */
	private async updateSessionActivity(sessionId: string, eventType: string): Promise<void> {
		try {
			const sessionRef = this.firestore.collection('analytics_sessions').doc(sessionId);
			const doc = await sessionRef.get();

			const now = Date.now();

			if (!doc.exists) {
				// Create new session
				await sessionRef.set({
					sessionId,
					startTime: Timestamp.fromMillis(now),
					lastActivity: Timestamp.fromMillis(now),
					queries: [],
					conversions: 0,
					pagesGenerated: 0,
				});
			} else {
				// Update existing session
				const updates: any = {
					lastActivity: Timestamp.fromMillis(now),
				};

				if (eventType === 'query') {
					updates.queries = [...(doc.data()?.queries || []), now];
				} else if (eventType === 'conversion') {
					updates.conversions = (doc.data()?.conversions || 0) + 1;
				} else if (eventType === 'page_published') {
					updates.pagesGenerated = (doc.data()?.pagesGenerated || 0) + 1;
				}

				await sessionRef.update(updates);
			}
		} catch (error) {
			console.error('Error updating session activity:', error);
			// Don't throw - analytics tracking should not break the main flow
		}
	}

	/**
	 * Get events for a session
	 */
	async getSessionEvents(sessionId: string, limit: number = 100): Promise<AnalyticsEvent[]> {
		try {
			const snapshot = await this.firestore
				.collection('analytics_events')
				.where('sessionId', '==', sessionId)
				.orderBy('timestamp', 'desc')
				.limit(limit)
				.get();

			return snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					eventId: doc.id,
					eventType: data.eventType,
					sessionId: data.sessionId,
					timestamp: data.timestamp.toMillis(),
					data: data.data || {},
				};
			});
		} catch (error) {
			console.error('Error getting session events:', error);
			throw error;
		}
	}

	/**
	 * Get session summary
	 */
	async getSessionSummary(sessionId: string): Promise<AnalyticsSession | null> {
		try {
			const doc = await this.firestore.collection('analytics_sessions').doc(sessionId).get();

			if (!doc.exists) {
				return null;
			}

			const data = doc.data();
			return {
				sessionId: doc.id,
				startTime: data?.startTime?.toMillis() || 0,
				lastActivity: data?.lastActivity?.toMillis() || 0,
				queries: data?.queries || [],
				conversions: data?.conversions || 0,
				pagesGenerated: data?.pagesGenerated || 0,
				userAgent: data?.userAgent,
			};
		} catch (error) {
			console.error('Error getting session summary:', error);
			throw error;
		}
	}

	/**
	 * Get recent events (for analytics dashboard)
	 */
	async getRecentEvents(eventType?: string, limit: number = 100): Promise<AnalyticsEvent[]> {
		try {
			let query = this.firestore
				.collection('analytics_events')
				.orderBy('timestamp', 'desc')
				.limit(limit);

			if (eventType) {
				query = query.where('eventType', '==', eventType) as any;
			}

			const snapshot = await query.get();

			return snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					eventId: doc.id,
					eventType: data.eventType,
					sessionId: data.sessionId,
					timestamp: data.timestamp.toMillis(),
					data: data.data || {},
				};
			});
		} catch (error) {
			console.error('Error getting recent events:', error);
			throw error;
		}
	}

	/**
	 * Get active sessions (last activity within X minutes)
	 */
	async getActiveSessions(minutesAgo: number = 30): Promise<AnalyticsSession[]> {
		try {
			const cutoffTime = Timestamp.fromMillis(Date.now() - minutesAgo * 60 * 1000);

			const snapshot = await this.firestore
				.collection('analytics_sessions')
				.where('lastActivity', '>=', cutoffTime)
				.orderBy('lastActivity', 'desc')
				.get();

			return snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					sessionId: doc.id,
					startTime: data?.startTime?.toMillis() || 0,
					lastActivity: data?.lastActivity?.toMillis() || 0,
					queries: data?.queries || [],
					conversions: data?.conversions || 0,
					pagesGenerated: data?.pagesGenerated || 0,
					userAgent: data?.userAgent,
				};
			});
		} catch (error) {
			console.error('Error getting active sessions:', error);
			throw error;
		}
	}
}
