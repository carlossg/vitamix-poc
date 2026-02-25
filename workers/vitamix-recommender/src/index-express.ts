/**
 * Vitamix Recommender - Cloud Run Service (Google-Native)
 *
 * Express HTTP server that powers AI-driven Vitamix recommendations.
 * Uses Gemini + Vertex AI Model Garden with passwordless authentication.
 *
 * Endpoints:
 * - GET /generate?query=...&slug=...&ctx=... - Stream page generation via SSE
 * - POST /api/persist - Persist generated pages to AEM DA
 * - GET /health - Health check
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import type { SessionContext, SSEEvent, IntentClassification } from './types';
import { orchestrate } from './lib/orchestrator';
import { persistAndPublish, buildPageHtml, unescapeHtml } from './lib/da-client';
import { classifyCategory, generateSemanticSlug, buildCategorizedPath } from './lib/category-classifier';

// ============================================
// Configuration
// ============================================

const PORT = parseInt(process.env.PORT || '8080', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// DA (Document Authoring) env for persist operations
const daEnv = {
	DA_ORG: process.env.DA_ORG || 'carlossg',
	DA_REPO: process.env.DA_REPO || 'vitamix-poc',
	DA_TOKEN: process.env.DA_TOKEN || process.env.TOKEN || '',
	DA_CLIENT_ID: process.env.DA_CLIENT_ID,
	DA_CLIENT_SECRET: process.env.DA_CLIENT_SECRET,
	DA_SERVICE_TOKEN: process.env.DA_SERVICE_TOKEN,
};

// ============================================
// Express App Setup
// ============================================

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
	next();
});

// ============================================
// SSE Helper Functions
// ============================================

function setupSSE(res: Response): (event: SSEEvent) => void {
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
	res.flushHeaders();

	return (event: SSEEvent) => {
		const data = JSON.stringify(event.data);
		res.write(`event: ${event.event}\ndata: ${data}\n\n`);
	};
}

// ============================================
// Generate Endpoint (SSE Streaming)
// ============================================

app.get('/generate', async (req: Request, res: Response) => {
	const query = req.query.query as string;
	const slug = req.query.slug as string;
	const ctxParam = req.query.ctx as string;
	const preset = req.query.preset as string | undefined;
	const model = req.query.model as string | undefined;

	if (!query) {
		return res.status(400).json({ error: 'Missing query parameter' });
	}

	// Parse session context if provided
	let sessionContext: SessionContext | undefined;
	if (ctxParam) {
		try {
			sessionContext = JSON.parse(ctxParam);
		} catch (e) {
			console.error('Failed to parse session context:', e);
		}
	}

	// Setup SSE stream
	const write = setupSSE(res);

	try {
		// Start orchestration
		await orchestrate(
			query,
			slug || generateSlug(query),
			{} as any, // env object not needed with passwordless auth
			write,
			sessionContext,
			preset,
			model
		);

		// Send completion event
		write({
			event: 'complete',
			data: { message: 'Generation complete' },
		});
	} catch (error) {
		console.error('Orchestration error:', error);
		write({
			event: 'error',
			data: { message: (error as Error).message || 'Generation failed' },
		});
	} finally {
		res.end();
	}
});

// ============================================
// Persist Endpoint
// ============================================

interface PersistRequest {
	query: string;
	blocks: Array<{ html: string; sectionStyle?: string }>;
	intent?: IntentClassification;
	title?: string;
}

app.post('/api/persist', async (req: Request, res: Response) => {
	try {
		const body: PersistRequest = req.body;
		const { query, blocks, intent, title } = body;

		if (!query || !blocks || blocks.length === 0) {
			return res.status(400).json({ 
				success: false, 
				error: 'Missing query or blocks' 
			});
		}

		// Ensure a fully populated intent (callers may pass partial objects)
		const effectiveIntent: IntentClassification = {
			intentType: intent?.intentType || 'discovery',
			confidence: intent?.confidence ?? 0.5,
			entities: {
				products: intent?.entities?.products || [],
				useCases: intent?.entities?.useCases || [],
				features: intent?.entities?.features || [],
			},
			journeyStage: intent?.journeyStage || 'exploring',
		};

		// Classify category and generate slug
		const category = classifyCategory(effectiveIntent, query);
		const slug = generateSemanticSlug(query, effectiveIntent);
		const path = buildCategorizedPath(category, slug);

		// Build page title
		let pageTitle = title || 'Your Vitamix Experience';
		if (!title) {
			for (const block of blocks) {
				const h1Match = block.html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
				if (h1Match) {
					pageTitle = unescapeHtml(h1Match[1]);
					break;
				}
			}
		}

		// Build page description from query
		const pageDescription = `Personalized Vitamix content for: ${query}`;

		// Build the HTML page
		const html = buildPageHtml(pageTitle, pageDescription, blocks);

		// Persist and publish
		console.log(`[Persist] Saving page to ${path}`);
		const result = await persistAndPublish(path, html, daEnv as any);

		if (!result.success) {
			console.error(`[Persist] Failed: ${result.error}`);
			return res.status(500).json({ 
				success: false, 
				error: result.error 
			});
		}

		console.log(`[Persist] Success: ${result.urls?.live}`);
		return res.json({
			success: true,
			path,
			urls: result.urls,
		});
	} catch (error) {
		console.error('[Persist] Error:', error);
		return res.status(500).json({ 
			success: false, 
			error: (error as Error).message 
		});
	}
});

// ============================================
// Health Check Endpoints
// ============================================

app.get('/health', (req: Request, res: Response) => {
	res.json({
		status: 'ok',
		service: 'vitamix-recommender',
		environment: NODE_ENV,
		timestamp: new Date().toISOString(),
		version: '2.0.0-google-native',
	});
});

app.get('/healthz', (req: Request, res: Response) => {
	res.json({ status: 'ok' });
});

// ============================================
// Utility Functions
// ============================================

function generateSlug(query: string): string {
	let slug = query
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.substring(0, 80);

	const hash = Math.abs(
		query.split('').reduce((acc, char) => {
			const code = char.charCodeAt(0);
			return ((acc << 5) - acc) + code;
		}, 0)
	)
		.toString(36)
		.slice(0, 6);

	return `${slug}-${hash}`;
}

// ============================================
// Error Handlers
// ============================================

app.use((err: Error, req: Request, res: Response, next: Function) => {
	console.error('Unhandled error:', err);
	res.status(500).json({ 
		error: 'Internal server error',
		message: NODE_ENV === 'development' ? err.message : undefined,
	});
});

// 404 handler
app.use((req: Request, res: Response) => {
	res.status(404).json({ error: 'Not Found' });
});

// ============================================
// Start Server
// ============================================

const server = app.listen(PORT, '0.0.0.0', () => {
	console.log(`✅ Vitamix Recommender (Google-Native) listening on port ${PORT}`);
	console.log(`   Environment: ${NODE_ENV}`);
	console.log(`   Project: ${process.env.GCP_PROJECT_ID || 'not set'}`);
	console.log(`   Region: ${process.env.GCP_LOCATION || 'us-central1'}`);
	console.log(`   Model Preset: ${process.env.MODEL_PRESET || 'production'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('SIGTERM received, shutting down gracefully...');
	server.close(() => {
		console.log('Server closed');
		process.exit(0);
	});
});

process.on('SIGINT', () => {
	console.log('SIGINT received, shutting down gracefully...');
	server.close(() => {
		console.log('Server closed');
		process.exit(0);
	});
});

export default app;
