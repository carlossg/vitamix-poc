# Vitamix Gemini Worker (Multi-Provider AI)

AI-driven Cloudflare Worker that generates personalized Vitamix blender content pages using **multiple AI providers** (Anthropic Claude, Cerebras, Google Gemini) and vector search.

## Overview

This unified worker powers the Vitamix AI Recommender with support for multiple AI providers:
- **Anthropic Claude** (Opus, Sonnet, Haiku) - High-quality reasoning and content
- **Cerebras** (70B, 120B models) - Ultra-fast inference
- **Google Gemini Flash** (3.0 Preview, 2.5) - Latest Google models

### Key Features

- Processing natural language queries about Vitamix products
- Performing semantic search across product catalog and recipes using Vectorize
- Flexible AI model orchestration with multiple providers
- Streaming Server-Sent Events (SSE) for real-time generation feedback
- Persisting generated pages to Adobe Experience Manager (AEM) Document Authoring

## Architecture

### Core Components

- **Orchestrator** (`lib/orchestrator.ts`) - Coordinates the entire generation pipeline
- **AI Clients** (`ai-clients/`) - Multi-provider AI integration (Claude, Cerebras, Gemini)
- **Content Service** (`content/content-service.ts`) - Handles semantic search via Vectorize
- **DA Client** (`lib/da-client.ts`) - Manages AEM Document Authoring integration
- **Category Classifier** (`lib/category-classifier.ts`) - Classifies intents and generates semantic slugs

### Supported AI Providers

#### Anthropic Claude
- **claude-opus-4-5** - Highest quality reasoning
- **claude-sonnet-4-5** - Balanced performance
- **claude-haiku-4** - Fast, cost-effective

#### Cerebras
- **gpt-oss-120b** - Ultra-fast inference with good quality
- **gpt-oss-70b** - Fast inference, lower cost

#### Google Gemini
- **gemini-3-flash-preview** - Latest model with enhanced capabilities
- **gemini-2.5-flash** - Stable production model

## Model Presets

The worker includes optimized presets for different use cases:

### Original Presets (Claude + Cerebras)

**`production`** (Default - Recommended)
- Reasoning: Claude Opus 4.5 (highest quality)
- Content: Cerebras 120B (fast generation)
- Classification: Cerebras 120B
- Validation: Cerebras 120B

**`fast`**
- Reasoning: Claude Sonnet 4.5 (faster)
- Content: Cerebras 120B
- Classification: Cerebras 120B
- Validation: Cerebras 120B

**`all-cerebras`**
- All roles: Cerebras 120B (cost-optimized, ultra-fast)

### Gemini Presets

**`gemini-production`**
- Reasoning: Gemini 3.0 Flash Preview
- Content: Gemini 3.0 Flash Preview
- Classification: Gemini 2.5 Flash (stable)
- Validation: Gemini 2.5 Flash (stable)

**`gemini-3-all`**
- All roles: Gemini 3.0 Flash Preview (latest features)

**`gemini-2.5-all`**
- All roles: Gemini 2.5 Flash (stable, well-tested)

**`gemini-mixed`**
- Reasoning: Gemini 3.0 Flash Preview
- Content/Classification/Validation: Gemini 2.5 Flash

## API Endpoints

### `GET /generate`

Stream personalized page generation via Server-Sent Events.

**Query Parameters:**
- `query` (required) - User's natural language query
- `slug` (optional) - Custom URL slug for the generated page
- `ctx` (optional) - JSON-encoded session context for personalization
- `preset` (optional) - AI model preset (see presets above)
- `model` (optional) - Direct Gemini model override (e.g., `gemini-2.5-flash`)

**Response:** SSE stream with events:
- `intent` - Query classification results
- `block` - Generated content block
- `products` - Recommended products
- `recipes` - Relevant recipes
- `complete` - Generation finished
- `error` - Generation failed

**Examples:**

```bash
# Use default preset (production: Claude Opus + Cerebras)
curl "https://vitamix-gemini.workers.dev/generate?query=best%20blender%20for%20smoothies"

# Use all-Cerebras for ultra-fast response
curl "https://vitamix-gemini.workers.dev/generate?query=best%20blender%20for%20smoothies&preset=all-cerebras"

# Use Gemini 3.0 for all roles
curl "https://vitamix-gemini.workers.dev/generate?query=best%20blender%20for%20smoothies&preset=gemini-3-all"

# Use Gemini production preset
curl "https://vitamix-gemini.workers.dev/generate?query=smoothie%20recipes&preset=gemini-production"

# Override Gemini model version
curl "https://vitamix-gemini.workers.dev/generate?query=smoothie%20recipes&preset=gemini-production&model=gemini-2.5-flash"
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
	"service": "vitamix-gemini",
	"timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Setup

### 1. Install Dependencies

```bash
cd workers/vitamix-gemini
npm install
```

### 2. Configure Secrets

Set API keys for the providers you want to use:

```bash
# Anthropic Claude (for production, fast presets)
wrangler secret put ANTHROPIC_API_KEY

# Cerebras (for production, fast, all-cerebras presets)
wrangler secret put CEREBRAS_API_KEY

# Google Gemini (for gemini-* presets)
wrangler secret put GOOGLE_API_KEY

# AEM Document Authoring (S2S - Recommended)
wrangler secret put DA_CLIENT_ID
wrangler secret put DA_CLIENT_SECRET
wrangler secret put DA_SERVICE_TOKEN

# OR use legacy static token (fallback)
wrangler secret put DA_TOKEN
```

**Getting API Keys:**

- **Anthropic**: [Get key from Anthropic Console](https://console.anthropic.com/)
- **Cerebras**: [Get key from Cerebras Cloud](https://cloud.cerebras.ai/)
- **Google Gemini**: [Get key from Google AI Studio](https://makersuite.google.com/app/apikey)

**Note:** You only need to configure the API keys for the providers you plan to use. For example:
- Using `production` or `fast` preset? → Need ANTHROPIC_API_KEY and CEREBRAS_API_KEY
- Using `all-cerebras` preset? → Only need CEREBRAS_API_KEY
- Using `gemini-*` presets? → Only need GOOGLE_API_KEY

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

- `MODEL_PRESET` - Default AI model preset (default: `production`)
  - Options: `production`, `fast`, `all-cerebras`, `gemini-production`, `gemini-3-all`, `gemini-2.5-all`, `gemini-mixed`
- `GEMINI_MODEL_VERSION` - Default Gemini model (default: `gemini-3-flash-preview`)
  - Options: `gemini-3-flash-preview`, `gemini-2.5-flash`
- `DEBUG` - Enable debug logging (`true`/`false`)
- `DA_ORG` - AEM Document Authoring organization
- `DA_REPO` - AEM Document Authoring repository

### Configuration Priority

1. **Query Parameter `?model=`** - Direct Gemini model version override (only affects Gemini presets)
2. **Query Parameter `?preset=`** - Preset selection
3. **Environment Variable `GEMINI_MODEL_VERSION`** - Default Gemini model version
4. **Environment Variable `MODEL_PRESET`** - Default preset
5. **Fallback** - `production` preset (Claude Opus + Cerebras)

## Preset Selection Guide

### For Production Workloads

**Best Quality & Speed Balance:**
```bash
preset=production  # Claude Opus reasoning + Cerebras content (default)
```

**Maximum Speed:**
```bash
preset=all-cerebras  # All Cerebras - ultra-fast inference
```

**Google Gemini Production:**
```bash
preset=gemini-production  # Gemini 3.0 + 2.5 balanced
```

### For Development/Testing

**Faster Anthropic:**
```bash
preset=fast  # Claude Sonnet + Cerebras
```

**Latest Gemini:**
```bash
preset=gemini-3-all  # All Gemini 3.0 Preview
```

**Stable Gemini:**
```bash
preset=gemini-2.5-all  # All Gemini 2.5
```

### Cost Optimization

**Lowest Cost:**
```bash
preset=all-cerebras  # Fastest, most cost-effective
```

**Gemini Cost-Optimized:**
```bash
preset=gemini-2.5-all  # Stable Gemini 2.5
```

## Provider Comparison

| Provider | Speed | Quality | Cost | Best For |
|----------|-------|---------|------|----------|
| **Claude Opus** | Medium | Highest | High | Complex reasoning, high-quality content |
| **Claude Sonnet** | Fast | High | Medium | Balanced performance |
| **Cerebras** | Ultra-fast | Good | Low | Content generation, classification |
| **Gemini 3.0** | Fast | High | Medium | Latest features, good reasoning |
| **Gemini 2.5** | Fast | Good | Low | Stable production, classification |

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
curl "https://vitamix-gemini.workers.dev/generate?query=smoothie%20recipes&ctx=%7B%22sessionId%22%3A%22abc123%22%7D"
```

## Content Generation Flow

1. **Query Reception** - Parse user query and session context
2. **Intent Classification** - Analyze query intent and journey stage
3. **Semantic Search** - Find relevant products and recipes via Vectorize
4. **Content Orchestration** - Generate personalized blocks using selected AI provider(s)
5. **SSE Streaming** - Stream blocks to client in real-time
6. **Page Persistence** - Save complete page to AEM on request

## Testing

### Test with Different Providers

```bash
# Test with Claude + Cerebras (default)
curl "http://localhost:8787/generate?query=best%20blender%20for%20smoothies"

# Test with all-Cerebras
curl "http://localhost:8787/generate?query=best%20blender%20for%20smoothies&preset=all-cerebras"

# Test with Gemini 3.0
curl "http://localhost:8787/generate?query=best%20blender%20for%20smoothies&preset=gemini-3-all"

# Test with Gemini 2.5
curl "http://localhost:8787/generate?query=smoothie%20recipes&preset=gemini-2.5-all"

# Test Gemini model override
curl "http://localhost:8787/generate?query=smoothie%20recipes&preset=gemini-production&model=gemini-2.5-flash"
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

- **Cloudflare Dashboard**: View request metrics, error rates, and latency per provider
- **Wrangler Tail**: Real-time log streaming with provider-specific logs
- **Analytics Worker**: Track user interactions and conversion metrics

## API Message Format Differences

### Anthropic Claude
```json
{
	"model": "claude-opus-4-5",
	"messages": [{ "role": "user", "content": "message" }],
	"system": "System prompt",
	"max_tokens": 4096
}
```

### Cerebras
```json
{
	"model": "gpt-oss-120b",
	"messages": [
		{ "role": "system", "content": "System prompt" },
		{ "role": "user", "content": "message" }
	],
	"max_tokens": 4096
}
```

### Google Gemini
```json
{
	"contents": [{ "role": "user", "parts": [{ "text": "message" }] }],
	"systemInstruction": { "parts": [{ "text": "System prompt" }] },
	"generationConfig": { "maxOutputTokens": 8192 }
}
```

## Troubleshooting

### Common Issues

**Error: "Anthropic API error: 401"**
- Ensure `ANTHROPIC_API_KEY` is set correctly
- Using `production` or `fast` preset requires Anthropic key

**Error: "Cerebras API error: 401"**
- Ensure `CEREBRAS_API_KEY` is set correctly
- Using `production`, `fast`, or `all-cerebras` requires Cerebras key

**Error: "Google Gemini API error: 401"**
- Ensure `GOOGLE_API_KEY` is set correctly
- Using `gemini-*` presets requires Google API key

**Error: "Unknown provider"**
- Check preset name is valid
- Verify API keys are configured for the selected preset

**Slow response times:**
- Try `preset=all-cerebras` for fastest inference
- Check Vectorize index is populated
- Review query complexity

## Dependencies

- `@cloudflare/workers-types` - TypeScript types for Cloudflare Workers
- `typescript` - TypeScript compiler
- `wrangler` - Cloudflare Workers CLI

## Migration Notes

### From vitamix-recommender

This worker is now a **superset** of `vitamix-recommender` with additional Gemini support:

1. **No breaking changes** - All original presets (`production`, `fast`, `all-cerebras`) work exactly the same
2. **Additional presets** - New `gemini-*` presets available
3. **Additional configuration** - Optional `GOOGLE_API_KEY` for Gemini models
4. **API compatible** - Same endpoints and response format

**To migrate:**
```bash
# Simply point to this worker instead
# No code changes needed in frontend
# Optionally add GOOGLE_API_KEY to enable Gemini presets
```

## License

ISC
