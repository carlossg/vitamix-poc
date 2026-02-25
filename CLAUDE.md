# Vitamix POC - AEM Edge Delivery Services

An AI-powered content generation platform built on AEM Edge Delivery Services (aem.live) that creates personalized product pages, recipes, and support content based on user queries.

## Quick Start
- `npm i` - Install dependencies
- `aem up` - Start local dev server at http://localhost:3000
- `npm run lint` - Run ESLint

## Architecture Overview

### Core Flow
```
User Query → Recommender API (SSE) → Block Streaming → Page Decoration → DA Persistence
```

### Key Directories
- `/blocks/` - 72 custom blocks (see Block Categories below)
- `/scripts/` - Core decoration, utilities, analytics
- `/styles/` - Global CSS
- `/services/recommender/` - Recommender service (Cloud Run, Gemini 3)
- `/.claude/skills/` - Claude Code skills for development workflows

### Google Cloud Services
| Service | Type | Purpose |
|---------|------|---------|
| Recommender | Cloud Run | Main AI generation (Gemini 3) |
| Analytics | Cloud Function Gen2 | Tracking & multi-agent analysis |
| Recipe Search | Cloud Function Gen2 | Recipe vector embeddings |

## Key Files

### Entry Points
- `scripts/scripts.js` - Main orchestrator, handles generation modes
- `scripts/aem.js` - Standard EDS utilities (decoration, block loading)
- `scripts/delayed.js` - Analytics setup (loads after page)

### Utilities
- `scripts/api-config.js` - Central API endpoint configuration (Google Cloud)
- `scripts/session-context.js` - Query history in sessionStorage (max 10)
- `scripts/analytics-tracker.js` - Event tracking (respects DNT)
- `scripts/cta-utils.js` - Link classification, purchase-intent sanitization

## Block Categories

### AI/Search (Core)
`query-form`, `ingredient-search`, `quick-answer`, `reasoning`, `support-triage`

### Products
`product-cards`, `product-recommendation`, `product-hero`, `product-compare`, `product-cta`, `product-info`

### Recipes
`recipe-cards`, `recipe-hero`, `recipe-steps`, `recipe-tabs`, `recipe-filter-bar`, `recipe-grid`

### Analytics
`analytics-queries`, `analytics-last-queries`, `analytics-analysis`, `analytics-metrics`, `analytics-dashboard`

### Layout/Content
`hero`, `cards`, `columns`, `split-content`, `fragment`, `header`, `footer`, `faq`, `testimonials`

### Specialized
`accessibility-specs`, `budget-breakdown`, `engineering-specs`, `sustainability-info`, `allergen-safety`, `smart-features`

## Generation Modes

| Mode | URL Param | Service | Features |
|------|-----------|---------|----------|
| Recommender | `?q=` or `?query=` | recommender (Cloud Run) | Session context, auto-persist, journey tracking |
| Fast | `?fast=` | recommender (Cloud Run) | Two-phase (hero first), manual save |
| Standard | `?generate=` | recommender (Cloud Run) | Full streaming, progress indicators |

## AI Model Configuration

### Presets (in services/recommender)
- **production**: Gemini 3 Pro (reasoning + content)
- **fast**: Gemini 3 Flash (classification) + Gemini 3 Pro (content)

### Services Used
- **Google Vertex AI (Gemini 3)**: Intent analysis, reasoning, content generation
- **Firestore Vector Search**: Recipe semantic search

## Environment Variables (.env)
```
GOOGLE_API_KEY=AIza...
OPENAI_API_KEY=sk-proj-...
DA_IMS_TOKEN=eyJ... (Adobe IMS JWT)
FAL_API_KEY=... (optional, video generation)
```

## Conventions

### Code Style
- ESM modules (no CommonJS)
- kebab-case for CSS classes, camelCase for JS properties
- JSDoc for complex functions
- `[ModuleName]` prefix for console logging

### Block Structure
```
blocks/{block-name}/
  ├── {block-name}.js   # export default function decorate(block) {...}
  └── {block-name}.css
```

### Block JS Pattern
```javascript
export default function decorate(block) {
  const rows = [...block.children];
  // Transform DA table to presentational HTML
  block.innerHTML = '<div class="block-content">...</div>';
}
```

### Image Handling
- `data-gen-image="{id}"` for AI-generated images
- `data-original-src` stores original URL during generation
- Cache-busting: `url + '?_t=' + Date.now()`
- Use `createOptimizedPicture()` for authored images (skip for generated)

### CTA Sanitization
Purchase-intent language is auto-converted:
- "Buy Now" → "Learn More"
- "Add to Cart" → "View Details"
- "Purchase" → "Explore"

## Development Workflow

**IMPORTANT**: For ALL block development, start with the `content-driven-development` skill:
```
Using Skill: content-driven-development
```

### Available Skills (in /.claude/skills/)
- `content-driven-development` - Main development workflow
- `building-blocks` - Create/modify blocks
- `content-modeling` - Design block content models
- `block-inventory` - Survey available blocks
- `block-collection-and-party` - Reference implementations
- `testing-blocks` - Test code changes
- `page-import` - Import external pages

## Testing
- `/test-blocks/` - Visual test pages
- `/test-results/` - Test result reports
- Blocks support both authored (DA table) and AI-generated content

## Key Patterns

### SSE Streaming
```javascript
const eventSource = new EventSource(url);
eventSource.addEventListener('block-content', (e) => {
  const { html, sectionStyle, imageId } = JSON.parse(e.data);
  // Render block progressively
});
eventSource.addEventListener('image-ready', (e) => {
  const { imageId, url } = JSON.parse(e.data);
  // Replace placeholder image
});
```

### Session Context
```javascript
import { SessionContextManager } from './session-context.js';
const ctx = SessionContextManager.buildEncodedContextParam();
// Sends previous queries to recommender for conversational flow
```

### Analytics Events
- `session_start` - New session
- `query` - User search
- `page_published` - Generated page saved
- `conversion` - CTA click to vitamix.com
