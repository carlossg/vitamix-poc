"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackEvent = trackEvent;
exports.analyzeQueries = analyzeQueries;
exports.getSessionAnalytics = getSessionAnalytics;
const firestore_1 = require("@google-cloud/firestore");
const vertexai_1 = require("@google-cloud/vertexai");
// ============================================
// Configuration
// ============================================
function getProjectId() {
    return process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';
}
const LOCATION = process.env.GCP_LOCATION || 'us-central1';
// Lazy-init clients so the module loads even when project is not set (e.g. framework loader)
let _firestore = null;
let _vertexAI = null;
function getFirestore() {
    if (!_firestore) {
        const projectId = getProjectId();
        _firestore = new firestore_1.Firestore(projectId ? { projectId } : undefined);
    }
    return _firestore;
}
function getVertexAI() {
    if (!_vertexAI) {
        const projectId = getProjectId();
        if (!projectId)
            throw new Error('GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT must be set');
        _vertexAI = new vertexai_1.VertexAI({ project: projectId, location: LOCATION });
    }
    return _vertexAI;
}
// ============================================
// Track Event Handler (plain export for Functions Framework)
// ============================================
async function trackEvent(req, res) {
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
        const event = req.body;
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
            const { FieldValue } = await Promise.resolve().then(() => __importStar(require('@google-cloud/firestore')));
            await getFirestore()
                .collection('analytics_sessions')
                .doc(event.sessionId)
                .set({
                sessionId: event.sessionId,
                lastActivityAt: new Date(),
                queryCount: FieldValue.increment(1),
            }, { merge: true });
        }
        res.set('Access-Control-Allow-Origin', '*').json({ success: true, eventId: event.sessionId });
    }
    catch (error) {
        console.error('Error tracking event:', error);
        res.status(500).json({
            error: 'Failed to track event',
            message: error.message,
        });
    }
}
// ============================================
// Query Analysis Handler (Gemini-only)
// ============================================
async function analyzeQueries(req, res) {
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
    }
    catch (error) {
        console.error('Error analyzing queries:', error);
        res.status(500).json({
            error: 'Failed to analyze queries',
            message: error.message,
        });
    }
}
// ============================================
// Session Analytics Handler
// ============================================
async function getSessionAnalytics(req, res) {
    try {
        const sessionId = req.query.sessionId;
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
                if (isActive)
                    stats.activeSessions++;
            });
            stats.averageQueriesPerSession = totalQueries / sessions.size || 0;
            res.json({ success: true, stats });
        }
        else {
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
    }
    catch (error) {
        console.error('Error getting session analytics:', error);
        res.status(500).json({
            error: 'Failed to get session analytics',
            message: error.message,
        });
    }
}
// ============================================
// Helper Functions
// ============================================
function extractInsights(analysis) {
    const insights = [];
    // Simple extraction - split by numbered lines
    const lines = analysis.split('\n');
    for (const line of lines) {
        if (/^\d+\./.test(line.trim())) {
            insights.push(line.trim());
        }
    }
    return insights.slice(0, 10); // Top 10 insights
}
//# sourceMappingURL=index.js.map