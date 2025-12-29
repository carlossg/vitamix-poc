# Vitamix Recipe Embedding Worker

Cloudflare Worker for generating embeddings from crawled Vitamix recipes and uploading them to Vectorize for semantic search.

## Overview

This worker processes recipe data and creates vector embeddings for semantic search capabilities:
- Generates text embeddings using Workers AI (BGE-base-en-v1.5)
- Uploads recipe vectors to Cloudflare Vectorize
- Enables semantic search for recipe recommendations
- Processes recipes in configurable batches for efficiency

## Features

- **Batch Processing** - Process multiple recipes efficiently in configurable batches
- **Rich Metadata** - Store comprehensive recipe information for filtering
- **Semantic Search** - Enable natural language recipe queries
- **Testing Endpoints** - Built-in query endpoint for testing retrieval

## API Endpoints

### `POST /embed`

Process recipes from JSON body and upload to Vectorize.

**Request Body:**
```json
{
	"recipes": [
		{
			"id": "green-smoothie",
			"name": "Green Smoothie",
			"category": "Beverages",
			"subcategory": "Smoothies",
			"description": "A refreshing green smoothie packed with nutrients",
			"difficulty": "Easy",
			"ingredients": [
				{ "item": "spinach", "quantity": "2", "unit": "cups" },
				{ "item": "banana", "quantity": "1" },
				{ "item": "almond milk", "quantity": "1", "unit": "cup" }
			],
			"instructions": [
				"Add all ingredients to Vitamix container",
				"Blend on high for 30 seconds"
			],
			"tips": ["Use frozen banana for thicker texture"],
			"prepTime": "5 min",
			"blendTime": "1 min",
			"totalTime": "6 min",
			"servings": 2,
			"dietaryTags": ["vegan", "gluten-free"],
			"requiredContainer": "64 oz",
			"recommendedProgram": "Smoothie",
			"recommendedProducts": ["A3500", "E310"],
			"url": "https://vitamix.com/recipes/green-smoothie",
			"images": {
				"primary": "https://example.com/green-smoothie.jpg"
			}
		}
	],
	"count": 1
}
```

**Response:**
```json
{
	"success": true,
	"processed": 150,
	"batches": 2,
	"errors": [],
	"totalRecipes": 150
}
```

### `POST /embed-single`

Process a single recipe (for testing).

**Request Body:**
```json
{
	"id": "green-smoothie",
	"name": "Green Smoothie",
	...
}
```

**Response:**
```json
{
	"success": true,
	"id": "recipe-green-smoothie",
	"textLength": 245
}
```

### `POST /query`

Query Vectorize to test recipe retrieval.

**Request Body:**
```json
{
	"query": "healthy breakfast smoothie",
	"topK": 5
}
```

**Response:**
```json
{
	"query": "healthy breakfast smoothie",
	"results": [
		{
			"id": "recipe-green-smoothie",
			"score": 0.87,
			"title": "Green Smoothie",
			"category": "Beverages",
			"url": "https://vitamix.com/recipes/green-smoothie"
		}
	]
}
```

### `GET /status`

Check Vectorize index status.

**Response:**
```json
{
	"status": "ok",
	"vectorize": {
		"name": "vitamix-content",
		"dimensions": 768,
		"metric": "cosine",
		"count": 150
	}
}
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Vectorize Index

```bash
wrangler vectorize create vitamix-content --dimensions=768 --metric=cosine
```

Update `wrangler.toml` with the index name.

### 3. Configure Batch Size (Optional)

Edit `wrangler.toml` to adjust batch processing:

```toml
[vars]
BATCH_SIZE = "100"  # Process 100 recipes per batch
```

## Development

### Run Locally

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`.

### Deploy to Production

```bash
npm run deploy
```

## Usage

### Embed Recipes from JSON File

```bash
curl -X POST http://localhost:8787/embed \
	-H "Content-Type: application/json" \
	-d @content/recipes/recipes.json
```

### Test Recipe Search

```bash
curl -X POST http://localhost:8787/query \
	-H "Content-Type: application/json" \
	-d '{"query": "smoothie recipes", "topK": 5}'
```

### Check Index Status

```bash
curl http://localhost:8787/status
```

## Recipe Data Format

### Required Fields

- `id` - Unique recipe identifier
- `name` - Recipe name
- `category` - Primary category (e.g., "Beverages", "Desserts")
- `description` - Brief recipe description
- `difficulty` - Difficulty level (Easy, Medium, Hard)
- `ingredients` - Array of ingredient objects
- `instructions` - Array of instruction strings
- `url` - Source URL for the recipe

### Optional Fields

- `subcategory` - Recipe subcategory (e.g., "Smoothies")
- `tips` - Array of helpful tips
- `prepTime` - Preparation time (e.g., "5 min")
- `blendTime` - Blending time (e.g., "1 min")
- `totalTime` - Total time (e.g., "6 min")
- `servings` - Number of servings
- `yield` - Recipe yield description
- `nutrition` - Nutrition information object
- `dietaryTags` - Array of dietary tags (e.g., "vegan", "gluten-free")
- `requiredContainer` - Required container size (e.g., "64 oz")
- `recommendedProgram` - Recommended Vitamix program
- `blenderSpeed` - Recommended speed setting
- `recommendedProducts` - Array of product IDs
- `images.primary` - Primary recipe image URL

## Searchable Text Generation

The worker creates searchable text by combining:

1. **Recipe name** - Highest weight
2. **Description** - High weight
3. **Category and subcategory** - Medium weight
4. **Ingredients** - Medium weight (item names only)
5. **Dietary tags** - High weight for filtering
6. **Difficulty and time** - Lower weight
7. **Equipment requirements** - Lower weight

This ensures the most relevant information is prioritized in semantic search.

## Vector Metadata

Each recipe vector stores rich metadata in Vectorize:

```typescript
{
	content_type: 'recipe',
	source_url: string,           // Recipe URL
	page_title: string,           // Recipe name
	chunk_text: string,           // Searchable text (truncated to 2000 chars)
	recipe_category: string,      // Primary category
	recipe_image_url: string,     // Primary image URL
	difficulty: string,           // Difficulty level
	dietary_tags: string,         // Comma-separated tags
	servings: string,             // Number of servings
	total_time: string,           // Total time
	indexed_at: string            // ISO timestamp
}
```

## Batch Processing

The worker processes recipes in batches to:
- Stay within Workers AI rate limits
- Optimize memory usage
- Enable progress tracking
- Handle errors gracefully per batch

Default batch size is 100 recipes. Adjust in `wrangler.toml` based on your needs.

## Integration

### With Vitamix Recommender Worker

The recommender worker queries this Vectorize index for recipe recommendations:

```typescript
const results = await env.VECTORIZE.query(embedding, {
	topK: 5,
	returnMetadata: 'all',
	filter: {
		dietary_tags: { $contains: 'vegan' }
	}
});
```

### With Recipe Crawler

Use the recipe crawler in `/tools/crawler/` to generate recipe JSON:

```bash
cd tools/crawler
node crawl-recipes.js
```

Then upload the generated JSON to this worker.

## Configuration

### Environment Variables

Set in `wrangler.toml`:

- `BATCH_SIZE` - Number of recipes to process per batch (default: 100)

### Bindings

- `AI` - Workers AI binding for embeddings
- `VECTORIZE` - Vectorize index binding

## Monitoring

- **Cloudflare Dashboard** - View request metrics and error rates
- **Wrangler Logs** - Real-time logging of batch processing
- **Status Endpoint** - Check index statistics

## Testing

### Unit Test Recipe Embedding

```bash
curl -X POST http://localhost:8787/embed-single \
	-H "Content-Type: application/json" \
	-d '{
		"id": "test-recipe",
		"name": "Test Smoothie",
		"category": "Beverages",
		"description": "A test recipe",
		"difficulty": "Easy",
		"ingredients": [{"item": "banana"}],
		"instructions": ["Blend everything"],
		"url": "https://example.com/test"
	}'
```

### Test Search Quality

```bash
# Search for smoothies
curl -X POST http://localhost:8787/query \
	-H "Content-Type: application/json" \
	-d '{"query": "healthy green smoothie", "topK": 5}'

# Search by dietary requirement
curl -X POST http://localhost:8787/query \
	-H "Content-Type: application/json" \
	-d '{"query": "vegan breakfast", "topK": 5}'
```

## Dependencies

- `@cloudflare/workers-types` - TypeScript types for Cloudflare Workers
- `typescript` - TypeScript compiler
- `wrangler` - Cloudflare Workers CLI

## License

ISC

