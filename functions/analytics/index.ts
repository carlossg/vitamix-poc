/**
 * Vitamix Analytics Cloud Function (Google-Native)
 *
 * Gemini-only analytics service - NO OpenAI.
 * Uses Firestore for event storage and Gemini for AI analysis.
 * Passwordless authentication via Application Default Credentials.
 *
 * Exports plain HTTP handlers for gcloud functions deploy --gen2
 * (Functions Framework expects function exports, not Firebase wrapper objects).
 */

import { Firestore } from '@google-cloud/firestore';
import { VertexAI } from '@google-cloud/vertexai';

// ============================================
// Configuration
// ============================================

function getProjectId(): string {
	return process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';
}
const LOCATION = process.env.GCP_LOCATION || 'us-central1';

// Lazy-init clients so the module loads even when project is not set (e.g. framework loader)
let _firestore: Firestore | null = null;
let _vertexAI: VertexAI | null = null;
function getFirestore(): Firestore {
	if (!_firestore) {
		const projectId = getProjectId();
		_firestore = new Firestore(projectId ? { projectId } : undefined);
	}
	return _firestore;
}
function getVertexAI(): VertexAI {
	if (!_vertexAI) {
		const projectId = getProjectId();
		if (!projectId) throw new Error('GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT must be set');
		_vertexAI = new VertexAI({ project: projectId, location: LOCATION });
	}
	return _vertexAI;
}

// ============================================
// Event Types
// ============================================

interface AnalyticsEvent {
	type: 'query' | 'session_start' | 'conversion' | 'page_published';
	sessionId: string;
	timestamp: number;
	data: any;
}

// ============================================
// Track Event Handler (plain export for Functions Framework)
// ============================================

export async function trackEvent(req: any, res: any): Promise<void> {
	// CORS preflight
	if (req.method === 'OPTIONS') {
		res.set('Access-Control-Allow-Origin', '*').set('Access-Control-Allow-Methods', 'POST, OPTIONS').set('Access-Control-Allow-Headers', 'Content-Type').status(204).send('');
		return;
	}
	// Only accept POST requests
	if (req.method !== 'POST') {
		res.status(405).json({ error: 'Method not allowed' });
		return;
	}

	try {
		const event: AnalyticsEvent = req.body;

		if (!event.type || !event.sessionId) {
			res.status(400).json({ error: 'Missing required fields: type, sessionId' });
			return;
		}

		// Store event in Firestore
		await getFirestore().collection('analytics_events').add({
			...event,
			createdAt: new Date(),
			projectId: getProjectId(),
		});

		// Update session analytics
		if (event.type === 'query') {
			const { FieldValue } = await import('@google-cloud/firestore');
			await getFirestore()
				.collection('analytics_sessions')
				.doc(event.sessionId)
				.set(
					{
						sessionId: event.sessionId,
						lastActivityAt: new Date(),
						queryCount: FieldValue.increment(1),
					},
					{ merge: true }
				);
		}

		res.set('Access-Control-Allow-Origin', '*').json({ success: true, eventId: event.sessionId });
	} catch (error) {
		console.error('Error tracking event:', error);
		res.status(500).json({
			error: 'Failed to track event',
			message: (error as Error).message,
		});
	}
}

// ============================================
// Query Analysis Handler (Gemini-only)
// ============================================

export async function analyzeQueries(req: any, res: any): Promise<void> {
	try {
		// Get recent queries from Firestore
		const querySnapshot = await getFirestore()
			.collection('analytics_events')
			.where('type', '==', 'query')
			.orderBy('createdAt', 'desc')
			.limit(100)
			.get();

		const queries = querySnapshot.docs.map(doc => {
			const data = doc.data();
			return {
				query: data.data?.query || '',
				intent: data.data?.intent || {},
				timestamp: data.createdAt?.toDate() || new Date(),
			};
		});

		if (queries.length === 0) {
			res.json({
				success: true,
				analysis: 'No queries to analyze',
				insights: [],
			});
			return;
		}

		// Use Gemini to analyze query patterns
		const model = getVertexAI().getGenerativeModel({
			model: 'gemini-2.0-pro-001',
		});

		const prompt = `Analyze these ${queries.length} Vitamix product queries and provide insights:

Queries:
${queries.slice(0, 50).map((q, i) => `${i + 1}. "${q.query}" (Intent: ${q.intent.intentType || 'unknown'})`).join('\n')}

Provide analysis in the following format:
1. Top 5 most common themes or patterns
2. User intent breakdown (percentages)
3. Product interest trends
4. Recommendations for content improvements

Be concise and data-driven.`;

		const result = await model.generateContent({
			contents: [{ role: 'user', parts: [{ text: prompt }] }],
		});

		const analysis = result.response.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis generated';

		// Extract insights from the analysis
		const insights = extractInsights(analysis);

		res.json({
			success: true,
			analysis,
			insights,
			queriesAnalyzed: queries.length,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Error analyzing queries:', error);
		res.status(500).json({
			error: 'Failed to analyze queries',
			message: (error as Error).message,
		});
	}
}

// ============================================
// Session Analytics Handler
// ============================================

export async function getSessionAnalytics(req: any, res: any): Promise<void> {
	try {
		const sessionId = req.query.sessionId as string;

		if (!sessionId) {
			// Return aggregate statistics
			const sessions = await getFirestore()
				.collection('analytics_sessions')
				.orderBy('lastActivityAt', 'desc')
				.limit(100)
				.get();

			const stats = {
				totalSessions: sessions.size,
				averageQueriesPerSession: 0,
				activeSessions: 0,
			};

			let totalQueries = 0;
			sessions.forEach(doc => {
				const data = doc.data();
				totalQueries += data.queryCount || 0;

				// Consider active if last activity within 30 minutes
				const lastActivity = data.lastActivityAt?.toDate() || new Date(0);
				const isActive = (Date.now() - lastActivity.getTime()) < 30 * 60 * 1000;
				if (isActive) stats.activeSessions++;
			});

			stats.averageQueriesPerSession = totalQueries / sessions.size || 0;

			res.json({ success: true, stats });
		} else {
			// Return specific session analytics
			const sessionDoc = await getFirestore()
				.collection('analytics_sessions')
				.doc(sessionId)
				.get();

			if (!sessionDoc.exists) {
				res.status(404).json({ error: 'Session not found' });
				return;
			}

			const sessionData = sessionDoc.data();

			// Get events for this session
			const eventsSnapshot = await getFirestore()
				.collection('analytics_events')
				.where('sessionId', '==', sessionId)
				.orderBy('createdAt', 'desc')
				.limit(50)
				.get();

			const events = eventsSnapshot.docs.map(doc => doc.data());

			res.json({
				success: true,
				session: sessionData,
				events,
			});
		}
	} catch (error) {
		console.error('Error getting session analytics:', error);
		res.status(500).json({
			error: 'Failed to get session analytics',
			message: (error as Error).message,
		});
	}
}

// ============================================
// Helper Functions
// ============================================

function extractInsights(analysis: string): string[] {
	const insights: string[] = [];
	
	// Simple extraction - split by numbered lines
	const lines = analysis.split('\n');
	for (const line of lines) {
		if (/^\d+\./.test(line.trim())) {
			insights.push(line.trim());
		}
	}
	
	return insights.slice(0, 10); // Top 10 insights
}
