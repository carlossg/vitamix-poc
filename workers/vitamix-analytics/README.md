# Vitamix Analytics Worker

Cloudflare Worker for tracking user interactions, aggregating analytics data, and providing AI-powered analysis of generated content quality.

## Overview

This worker powers the analytics and insights for the Vitamix AI Recommender by:
- Tracking user sessions, queries, and conversions
- Aggregating daily statistics and engagement metrics
- Running multi-agent AI analysis to evaluate content quality
- Providing REST API for analytics dashboards
- Caching analysis results to minimize AI API costs

## Features

### Analytics Tracking

- **Session Management** - Track user sessions with 30-day retention
- **Query Tracking** - Record all queries with intent classification
- **Page Publishing** - Link queries to generated page URLs
- **Conversion Tracking** - Monitor CTA clicks and purchases
- **Daily Aggregation** - Roll up statistics for trend analysis

### AI-Powered Analysis

- **Multi-Agent Analysis** - Run parallel analysis using Claude, GPT-4, and Gemini
- **Content Scoring** - Evaluate content relevance, layout, and conversion optimization
- **Automated Synthesis** - Merge multiple AI perspectives into unified insights
- **Caching** - Rate-limit expensive analyses (1 hour for batch, 1 hour per page)
- **Actionable Suggestions** - Provide prioritized improvements with impact/effort ratings

## API Endpoints

### `POST /api/track`

Track user events (sessions, queries, conversions).

**Request Body:**
```json
{
	"events": [
		{
			"sessionId": "abc123",
			"timestamp": 1704067200000,
			"eventType": "query",
			"data": {
				"query": "best blender for smoothies",
				"intent": "product_discovery",
				"journeyStage": "exploring",
				"consecutiveQueryNumber": 1
			}
		}
	]
}
```

**Event Types:**
- `session_start` - New session initiated
- `query` - User submitted a query
- `page_published` - Generated page was saved
- `conversion` - User clicked a CTA

**Response:**
```json
{
	"success": true,
	"processed": 1
}
```

### `GET /api/analytics/summary`

Get aggregated analytics summary for the last 30 days.

**Response:**
```json
{
	"period": "30d",
	"totalSessions": 150,
	"totalQueries": 320,
	"totalConversions": 45,
	"avgQueriesPerSession": 2.13,
	"conversionRate": 30.00,
	"engagementRate": 65.33,
	"sessionsWithMultipleQueries": 98,
	"journeyStageBreakdown": {
		"exploring": 180,
		"comparing": 90,
		"deciding": 50
	},
	"topQueries": [
		{ "query": "best blender for smoothies", "count": 25 },
		{ "query": "vitamix ascent vs explorian", "count": 18 }
	],
	"dailyTrend": [...],
	"lastAnalysis": { ... }
}
```

### `GET /api/analytics/sessions`

Get detailed session information.

**Query Parameters:**
- `limit` (optional, default: 50, max: 100) - Number of sessions to return
- `offset` (optional, default: 0) - Pagination offset

**Response:**
```json
{
	"sessions": [
		{
			"sessionId": "abc123",
			"startTime": 1704067200000,
			"lastUpdated": 1704067500000,
			"queryCount": 3,
			"converted": true,
			"conversionUrl": "https://vitamix.com/ascent-a3500",
			"queries": [
				{
					"query": "best blender for smoothies",
					"intent": "product_discovery",
					"journeyStage": "exploring",
					"timestamp": 1704067200000,
					"generatedPageUrl": "https://..."
				}
			],
			"referrer": "https://google.com"
		}
	],
	"total": 150,
	"limit": 50,
	"offset": 0
}
```

### `POST /api/analytics/analyze`

Run AI analysis on recent generated pages (batch analysis).

**Query Parameters:**
- `force` (optional) - Bypass rate limiting (default: false)

**Response:**
```json
{
	"cached": false,
	"analysis": {
		"timestamp": 1704067200000,
		"overallScore": 78,
		"contentScore": 82,
		"layoutScore": 75,
		"conversionScore": 77,
		"topIssues": [
			"CTAs not prominent enough",
			"Product comparisons lack detail"
		],
		"suggestions": {
			"content": [
				{
					"text": "Add more recipe variations for each product",
					"impact": "high",
					"effort": "medium"
				}
			],
			"layout": [...],
			"conversion": [...]
		},
		"exemplaryPages": [
			{
				"url": "https://...",
				"query": "best blender for smoothies",
				"reason": "Clear product comparison with prominent CTAs"
			}
		],
		"problematicPages": [
			{
				"url": "https://...",
				"query": "vitamix troubleshooting",
				"reason": "Lacks actionable troubleshooting steps"
			}
		],
		"pagesAnalyzed": 20
	},
	"nextAvailable": "2024-01-01T12:00:00.000Z"
}
```

### `POST /api/analytics/analyze-page`

Analyze a single generated page.

**Request Body:**
```json
{
	"query": "best blender for smoothies",
	"url": "https://main--vitamix-poc--paolomoz.aem.live/discovery/best-blender-for-smoothies-abc123"
}
```

**Response:**
```json
{
	"cached": false,
	"analysis": {
		"overallScore": 85,
		"contentScore": 88,
		"layoutScore": 82,
		"conversionScore": 85,
		"summary": "Strong product recommendations with clear CTAs. Could benefit from more recipe examples.",
		"strengths": [
			"Clear product comparison table",
			"Prominent CTAs with value propositions"
		],
		"improvements": [
			"Add more recipe examples",
			"Include customer testimonials",
			"Show price comparison"
		]
	}
}
```

### `GET /api/analytics/queries/recent`

Get recent queries with cached analysis.

**Query Parameters:**
- `limit` (optional, default: 10, max: 50) - Number of queries to return

**Response:**
```json
{
	"queries": [
		{
			"query": "best blender for smoothies",
			"timestamp": 1704067200000,
			"generatedPageUrl": "https://...",
			"generatedPagePath": "/discovery/best-blender-for-smoothies-abc123",
			"intent": "product_discovery",
			"journeyStage": "exploring",
			"sessionId": "abc123",
			"analysis": {
				"overallScore": 85,
				"contentScore": 88,
				...
			}
		}
	],
	"total": 50
}
```

### `GET /api/analytics/export`

Export all analytics data (last 30 days).

**Response:**
```json
{
	"exportedAt": "2024-01-01T00:00:00.000Z",
	"dailyStats": [...],
	"sessions": [...]
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
	"status": "ok",
	"timestamp": 1704067200000
}
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create KV Namespace

```bash
wrangler kv:namespace create ANALYTICS
```

Update `wrangler.toml` with the returned namespace ID.

### 3. Configure API Keys (Optional)

For AI-powered analysis features, set API keys:

```bash
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put GOOGLE_API_KEY
```

**Note:** Analysis endpoints will return errors if API keys are not configured.

## Development

### Run Locally

```bash
npm run dev
```

The worker will be available at `http://localhost:8788`.

### Deploy to Production

```bash
npm run deploy
```

### View Logs

```bash
npm run tail
```

## Configuration

### Environment Variables

Set in `wrangler.toml`:

- `DEBUG` - Enable debug logging (`true`/`false`)

### Data Retention

- **Sessions**: 30 days (automatic TTL)
- **Daily Stats**: 90 days (automatic TTL)
- **Batch Analysis**: 7 days (automatic TTL)
- **Page Analysis**: 24 hours (automatic TTL)

## Multi-Agent Analysis

The worker uses a multi-agent architecture for robust content analysis:

1. **Parallel Analysis** - Run Claude, GPT-4, and Gemini simultaneously
2. **Independent Scoring** - Each model evaluates content independently
3. **Synthesis** - Claude merges analyses into unified insights
4. **Fallback Handling** - Works with 1-3 successful model responses

### Benefits

- **Robustness** - Analysis succeeds even if 1-2 models fail
- **Quality** - Multiple perspectives reduce bias
- **Consensus** - Synthesized results represent model agreement

## Monitoring

### Key Metrics

- **Session Count** - Total unique sessions
- **Query Volume** - Total queries submitted
- **Conversion Rate** - % of sessions with CTA clicks
- **Engagement Rate** - % of sessions with multiple queries
- **Journey Stages** - Distribution of exploring/comparing/deciding

### Analytics Dashboard

Access via the frontend analytics dashboard at `/analytics/index.html`.

## Integration

### Frontend Integration

Include the analytics tracker in your frontend:

```html
<script src="/scripts/analytics-tracker.js"></script>
```

```javascript
// Initialize tracker
AnalyticsTracker.init({
	endpoint: 'https://vitamix-analytics.workers.dev/api/track'
});

// Track query
AnalyticsTracker.trackQuery('best blender for smoothies', {
	intent: 'product_discovery',
	journeyStage: 'exploring'
});

// Track conversion
AnalyticsTracker.trackConversion({
	ctaUrl: 'https://vitamix.com/ascent-a3500',
	ctaText: 'Shop Ascent A3500'
});
```

## Testing

### Test Event Tracking

```bash
curl -X POST http://localhost:8788/api/track \
	-H "Content-Type: application/json" \
	-d '{
		"events": [
			{
				"sessionId": "test-123",
				"timestamp": '$(date +%s000)',
				"eventType": "query",
				"data": {
					"query": "best blender for smoothies",
					"intent": "product_discovery"
				}
			}
		]
	}'
```

### Test Analysis (with force flag)

```bash
curl -X POST "http://localhost:8788/api/analytics/analyze?force=true"
```

## Dependencies

- `@cloudflare/workers-types` - TypeScript types for Cloudflare Workers
- `typescript` - TypeScript compiler
- `wrangler` - Cloudflare Workers CLI

## License

ISC


