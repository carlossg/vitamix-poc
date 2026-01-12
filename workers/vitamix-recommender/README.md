# Vitamix Recommender Worker

AI-driven Cloudflare Worker that generates personalized Vitamix blender content pages using multi-model AI orchestration and vector search.

## Overview

This worker powers the Vitamix AI Recommender by:
- Processing natural language queries about Vitamix products
- Performing semantic search across product catalog and recipes using Vectorize
- Orchestrating multiple AI models (Claude, Cerebras) to generate relevant content blocks
- Streaming Server-Sent Events (SSE) for real-time generation feedback
- Persisting generated pages to Adobe Experience Manager (AEM) Document Authoring

## Architecture

### Core Components

- **Orchestrator** (`lib/orchestrator.ts`) - Coordinates the entire generation pipeline
- **AI Clients** (`ai-clients/`) - Interfaces for Claude (Anthropic) and Cerebras models
- **Content Service** (`content/content-service.ts`) - Handles semantic search via Vectorize
- **DA Client** (`lib/da-client.ts`) - Manages AEM Document Authoring integration
- **Category Classifier** (`lib/category-classifier.ts`) - Classifies intents and generates semantic slugs

### AI Models

The worker supports multiple AI model configurations:
- **Claude (Anthropic)**: Primary model for high-quality content generation
- **Cerebras**: Ultra-fast inference for rapid prototyping
- **Mixed presets**: Combine models for optimal balance

## API Endpoints

### `GET /generate`

Stream personalized page generation via Server-Sent Events.

**Query Parameters:**
- `query` (required) - User's natural language query
- `slug` (optional) - Custom URL slug for the generated page
- `ctx` (optional) - JSON-encoded session context for personalization
- `preset` (optional) - AI model preset override (e.g., `all-cerebras`)

**Response:** SSE stream with events:
- `intent` - Query classification results
- `block` - Generated content block
- `products` - Recommended products
- `recipes` - Relevant recipes
- `complete` - Generation finished
- `error` - Generation failed

**Example:**
```bash
curl "https://vitamix-recommender.workers.dev/generate?query=best%20blender%20for%20smoothies"
```

### `POST /api/persist`

Save generated page to AEM Document Authoring.

**Request Body:**
```json
{
	"query": "best blender for smoothies",
	"blocks": [
		{
			"html": "<div>...</div>",
			"sectionStyle": "highlight"
		}
	],
	"intent": {
		"intentType": "product_discovery",
		"confidence": 0.95
	},
	"title": "Best Blender for Smoothies"
}
```

**Response:**
```json
{
	"success": true,
	"path": "/discovery/best-blender-for-smoothies-abc123",
	"urls": {
		"preview": "https://main--vitamix-poc--paolomoz.aem.page/discovery/best-blender-for-smoothies-abc123",
		"live": "https://main--vitamix-poc--paolomoz.aem.live/discovery/best-blender-for-smoothies-abc123"
	}
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
	"status": "ok",
	"service": "vitamix-recommender",
	"timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Secrets

Set required API keys and credentials:

```bash
# AI Model API Keys
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put CEREBRAS_API_KEY

# AEM Document Authoring (S2S - Recommended)
wrangler secret put DA_CLIENT_ID
wrangler secret put DA_CLIENT_SECRET
wrangler secret put DA_SERVICE_TOKEN

# OR use legacy static token (fallback)
wrangler secret put DA_TOKEN
```

### 3. Create KV Namespace

```bash
wrangler kv:namespace create SESSIONS
```

Update `wrangler.toml` with the returned namespace ID.

### 4. Create Vectorize Index

```bash
wrangler vectorize create vitamix-content --dimensions=768 --metric=cosine
```

### 5. Populate Vectorize Index

Use the `embed-recipes` worker to populate the index with product and recipe embeddings.

## Development

### Run Locally

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`.

### Deploy to Staging

```bash
npm run deploy:staging
```

### Deploy to Production

```bash
npm run deploy:production
```

### View Logs

```bash
npm run tail
```

## Configuration

### Environment Variables

Set in `wrangler.toml`:

- `MODEL_PRESET` - Default AI model configuration (`production`, `fast`, `all-cerebras`)
- `DEBUG` - Enable debug logging (`true`/`false`)
- `DA_ORG` - AEM Document Authoring organization
- `DA_REPO` - AEM Document Authoring repository

### Model Presets

Defined in `ai-clients/model-factory.ts`:

- **production**: Claude Sonnet 4.5 + Haiku (balanced quality/speed)
- **fast**: Cerebras only (ultra-fast inference)
- **all-cerebras**: Multiple Cerebras models
- **all-claude**: Multiple Claude models

## Session Context

The worker supports personalized recommendations based on session history:

```typescript
interface SessionContext {
	sessionId: string;
	previousQueries: string[];
	viewedProducts?: string[];
	preferences?: {
		budget?: string;
		experience?: string;
		primaryUse?: string;
	};
}
```

Pass as `ctx` query parameter (URL-encoded JSON):

```bash
curl "https://vitamix-recommender.workers.dev/generate?query=smoothie%20recipes&ctx=%7B%22sessionId%22%3A%22abc123%22%7D"
```

## Content Generation Flow

1. **Query Reception** - Parse user query and session context
2. **Intent Classification** - Analyze query intent and journey stage
3. **Semantic Search** - Find relevant products and recipes via Vectorize
4. **Content Orchestration** - Generate personalized blocks using AI models
5. **SSE Streaming** - Stream blocks to client in real-time
6. **Page Persistence** - Save complete page to AEM on request

## Testing

### Test Query Generation

```bash
curl "http://localhost:8787/generate?query=best%20blender%20for%20smoothies"
```

### Test Page Persistence

```bash
curl -X POST http://localhost:8787/api/persist \
	-H "Content-Type: application/json" \
	-d '{
		"query": "best blender for smoothies",
		"blocks": [{"html": "<h1>Test Page</h1>"}],
		"title": "Test Page"
	}'
```

## Monitoring

- **Cloudflare Dashboard**: View request metrics, error rates, and latency
- **Wrangler Tail**: Real-time log streaming
- **Analytics Worker**: Track user interactions and conversion metrics

## Dependencies

- `@cloudflare/workers-types` - TypeScript types for Cloudflare Workers
- `typescript` - TypeScript compiler
- `wrangler` - Cloudflare Workers CLI

## License

ISC


