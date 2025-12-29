# Vitamix AI-Powered POC

An AI-powered content generation platform built on **Adobe Experience Manager (AEM) Edge Delivery Services** that creates personalized product pages, recipes, and support content based on natural language user queries. This proof-of-concept demonstrates conversational AI integrated with AEM's composable block architecture.

## 🎯 Overview

This project showcases how AI can dynamically generate rich, contextual content for e-commerce and support experiences. Users can ask questions in natural language (e.g., "I have arthritis, which blender is easiest to use?") and receive:
- Personalized product recommendations
- Custom recipe collections
- Context-aware support content
- Dynamically assembled pages using 72+ specialized blocks

### Key Features

- **AI-Driven Content Generation**: Uses Claude (Anthropic) and Cerebras for reasoning and content generation
- **Real-time Streaming**: Server-Sent Events (SSE) for progressive page rendering
- **Session Context**: Conversational memory for multi-turn interactions
- **72+ Specialized Blocks**: Modular content components for products, recipes, analytics, accessibility, and more
- **Multi-Model Architecture**: Orchestrates Claude, Cerebras, OpenAI, and Gemini based on task requirements
- **Semantic Recipe Search**: Vector embeddings via Cloudflare Vectorize for intelligent recipe matching
- **Analytics & Tracking**: Multi-agent analysis system for query insights and user journey tracking

## 🏗️ Architecture

```
User Query → Cloudflare Worker (vitamix-recommender)
          ↓
    Claude Intent Analysis → Block Selection
          ↓
    Cerebras Content Generation → SSE Streaming
          ↓
    Frontend (scripts/stream-renderer.js) → Progressive Block Rendering
          ↓
    Page Decoration (scripts/aem.js) → AEM Document Authoring (DA) Persistence
```

### Cloudflare Workers

| Worker | Purpose |
|--------|---------|
| `vitamix-recommender` | Main AI orchestration (Claude + Cerebras) |
| `vitamix-analytics` | Query tracking & multi-agent analysis |
| `embed-recipes` | Recipe vector embeddings for semantic search |

## 📁 Project Structure

```
/blocks/              # 72 custom blocks (products, recipes, analytics, etc.)
/scripts/             # Core utilities (AEM, streaming, analytics, session management)
/styles/              # Global CSS and design tokens
/workers/             # Cloudflare Workers (recommender, analytics, embeddings)
/content/             # Structured data (products, recipes, accessories, metadata)
/.claude/skills/      # Development workflow skills for AI-assisted coding
/test-blocks/         # Visual test pages for block development
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`

### Installation

```sh
npm install
```

### Local Development

```sh
aem up
```

This starts the local development server at `http://localhost:3000`

### Linting

```sh
npm run lint          # Run all linters
npm run lint:fix      # Auto-fix issues
```

## 🎮 Usage

### Generation Modes

The platform supports multiple generation modes via URL parameters:

| Mode | URL Parameter | Description |
|------|---------------|-------------|
| **Recommender** | `?q=query` or `?query=query` | AI-powered generation with session context |
| **Fast** | `?fast=query` | Two-phase generation (hero first, then content) |
| **Standard** | `?generate=query` | Full streaming with progress indicators |

**Example:**
```
http://localhost:3000?q=best+blender+for+smoothies
```

### Sample Queries

See [`sample-queries.md`](./sample-queries.md) for 20 diverse example queries covering:
- Accessibility needs (arthritis, post-stroke)
- Budget constraints (college students)
- Professional use cases (chefs, restaurants)
- Specialized diets (keto, vegan, allergen-free)
- Technical specifications
- Sustainability concerns

## 🧱 Block Categories

72 specialized blocks organized by purpose:

### AI/Search (Core)
`query-form`, `cerebras-generated`, `ingredient-search`, `quick-answer`, `reasoning`, `support-triage`

### Products
`product-cards`, `product-recommendation`, `product-hero`, `product-compare`, `product-cta`, `product-info`

### Recipes
`recipe-cards`, `recipe-hero`, `recipe-steps`, `recipe-tabs`, `recipe-filter-bar`, `recipe-grid`

### Analytics
`analytics-queries`, `analytics-dashboard`, `analytics-metrics`, `analytics-analysis`

### Specialized
`accessibility-specs`, `budget-breakdown`, `engineering-specs`, `sustainability-info`, `allergen-safety`, `smart-features`

## 🤖 AI Model Configuration

### Models Used

- **Claude (Anthropic)**: Intent classification, reasoning, block selection
- **Cerebras**: High-speed content generation
- **OpenAI/Gemini**: Multi-agent consensus analysis (analytics)
- **Cloudflare Vectorize**: Semantic recipe search

### Presets

Configure in `vitamix-recommender` worker:
- `production`: Claude Opus + Cerebras
- `fast`: Claude Sonnet + Cerebras
- `all-cerebras`: Cost-optimized pure Cerebras stack

## 🔧 Development

### Using Claude Skills

This project includes AI-assisted development workflows in `.claude/skills/`. For block development, always start with:

```
Using Skill: content-driven-development
```

Available skills:
- `content-driven-development` - Main development workflow
- `building-blocks` - Create/modify blocks
- `content-modeling` - Design block content models
- `block-inventory` - Survey available blocks
- `testing-blocks` - Test code changes

See [`AGENTS.md`](./AGENTS.md) for full details.

### Environment Variables

Required for Cloudflare Workers (`.env`):

```sh
ANTHROPIC_API_KEY=sk-ant-...
CEREBRAS_API_KEY=csk-...
OPENAI_API_KEY=sk-proj-...
GOOGLE_API_KEY=AIza...
DA_IMS_TOKEN=eyJ...          # Adobe IMS JWT for DA persistence
FAL_API_KEY=...              # Optional: video generation
```

## 📊 Analytics

The platform includes comprehensive analytics tracking:

- **Session Tracking**: User journey through multiple queries
- **Query Analysis**: Multi-agent AI analysis of user intent
- **Conversion Tracking**: CTA clicks and user engagement
- **Analytics Dashboard**: Real-time metrics visualization

View analytics at `/analytics/`

## 📚 Documentation

### Core Files

- [`CLAUDE.md`](./CLAUDE.md) - Comprehensive technical documentation
- [`AGENTS.md`](./AGENTS.md) - AI-assisted development workflows
- [`sample-queries.md`](./sample-queries.md) - Example user queries
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) - Contribution guidelines

### AEM Resources

- [AEM Developer Tutorial](https://www.aem.live/developer/tutorial)
- [Anatomy of an AEM Project](https://www.aem.live/developer/anatomy-of-a-project)
- [Web Performance](https://www.aem.live/developer/keeping-it-100)
- [Blocks & Markup](https://www.aem.live/developer/markup-sections-blocks)

## 🧪 Testing

Visual test pages in `/test-blocks/`:
- `accessibility-specs.html`
- `engineering-specs.html`
- `support-triage.html`
- And more...

Test results in `/test-results/`

## 📝 License

Apache License 2.0

## 🤝 Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for guidelines.

---

**Note**: This is a proof-of-concept demonstrating AI-powered content generation with AEM Edge Delivery Services. The Vitamix brand and products are used for demonstration purposes.
