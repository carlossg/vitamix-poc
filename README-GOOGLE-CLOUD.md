# Vitamix AI-Powered POC - Google Cloud Native

An AI-powered content generation platform built on **Adobe Experience Manager (AEM) Edge Delivery Services** with **Google Cloud** backend infrastructure. Creates personalized product pages, recipes, and support content based on natural language user queries.

## 🎯 Overview

**NEW: Now 100% Google Cloud Native!**

This project demonstrates AI-driven content generation using:
- ✅ **Gemini 2.0** (Flash + Pro) for AI reasoning and classification
- ✅ **Vertex AI Model Garden** (Llama 3.3 70B) for high-speed content generation
- ✅ **Firebase Vector Search** for semantic recipe matching
- ✅ **Cloud Run** for serverless compute with SSE streaming
- ✅ **Firestore** for session management and analytics
- ✅ **Passwordless authentication** (Application Default Credentials)
- ❌ **No external AI providers** (no Claude, Cerebras, or OpenAI API keys needed)

### Key Features

- **AI-Driven Content Generation**: 100% Google Cloud AI stack (Gemini + Model Garden)
- **Real-time Streaming**: Server-Sent Events (SSE) for progressive page rendering
- **Session Context**: Conversational memory for multi-turn interactions
- **72+ Specialized Blocks**: Modular content components for products, recipes, analytics
- **Semantic Recipe Search**: Vector embeddings via Firebase Vector Search
- **Analytics & Tracking**: Gemini-powered query analysis and user journey tracking

## 🏗️ Architecture (Google Cloud)

```
Browser → Cloud Run (vitamix-recommender) → Firestore + Firebase Vector Search
                ↓
         Vertex AI (Gemini + Model Garden)
                ↓
         Cloud Functions (analytics, embeddings)
```

### Google Cloud Services

| Service | Purpose |
|---------|---------|
| **Cloud Run** | Main AI orchestration service (Gemini + Model Garden) |
| **Cloud Functions** | Analytics tracking & recipe embeddings |
| **Firestore Native** | Session storage & analytics data |
| **Firebase Vector Search** | Semantic recipe search (768-dim embeddings) |
| **Vertex AI** | Gemini 2.0 Flash/Pro + Llama 3.3 70B (Model Garden) |
| **Cloud Storage** | Media assets (hero images, generated content) |
| **Secret Manager** | AEM Document Authoring credentials (DA only) |
| **Cloud Operations** | Monitoring, logging, alerting |

**All resources tagged with `app=vitamix` label for easy filtering.**

## 📁 Project Structure

```
/blocks/                  # 72 custom blocks (products, recipes, analytics, etc.)
/scripts/                 # Core utilities (AEM, streaming, analytics, session management)
  ├── api-config.js       # NEW: Cloud Run endpoint configuration
  └── ...
/styles/                  # Global CSS and design tokens
/workers/vitamix-recommender/  # Cloud Run service (ported from Cloudflare Worker)
  ├── src/
  │   ├── index-express.ts        # NEW: Express HTTP server for Cloud Run
  │   ├── ai-clients/
  │   │   ├── vertex-ai-client.ts       # NEW: Gemini integration
  │   │   ├── model-garden-client.ts    # NEW: Llama 3.3 integration
  │   │   └── model-factory-google.ts   # NEW: Google-only model factory
  │   └── lib/
  │       ├── firestore-client.ts       # NEW: Session storage
  │       └── vector-search.ts          # NEW: Firebase Vector Search
  └── package.json          # Updated with Google Cloud dependencies
/functions/               # NEW: Cloud Functions
  ├── analytics/          # Gemini-powered analytics (no OpenAI)
  └── embeddings/         # Recipe embedding generation
/infrastructure/          # NEW: Infrastructure as Code
  ├── cloudrun/           # Cloud Run service configs + service accounts
  ├── firestore/          # Firestore indexes and security rules
  ├── vertex-ai/          # Model Garden setup scripts
  └── monitoring/         # Cloud Operations configuration
/content/                 # Structured data (products, recipes, accessories, metadata)
/.claude/skills/          # Development workflow skills for AI-assisted coding
/test-blocks/             # Visual test pages for block development
Dockerfile                # NEW: Cloud Run container
cloudbuild.yaml           # NEW: CI/CD pipeline
deploy-google-cloud.sh    # NEW: Complete deployment script
DEPLOYMENT.md             # NEW: Detailed deployment guide
```

## 🚀 Quick Start

### Prerequisites

- **Google Cloud Project** with billing enabled
- `gcloud` CLI installed and authenticated: `gcloud auth login`
- Docker installed (for local testing)
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`

### Local Development (AEM EDS only)

```sh
npm install
aem up
```

This starts the local development server at `http://localhost:3000` with AEM blocks.

### Google Cloud Deployment

**Complete automated deployment:**

```sh
# Set your project
export GCP_PROJECT_ID="your-project-id"
export GCP_LOCATION="us-central1"

# Run deployment script
chmod +x deploy-google-cloud.sh
./deploy-google-cloud.sh
```

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed step-by-step instructions.**

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

## 🤖 AI Model Configuration (Google-Only)

### Models Used

- **Gemini 2.0 Flash**: Intent classification (~200ms, cost-effective)
- **Gemini 2.0 Pro**: Deep reasoning + block selection (~2-4s)
- **Llama 3.3 70B** (Model Garden): High-speed content generation
- **Vertex AI Embeddings**: Semantic recipe search (768-dim vectors)

### Presets

Configure via `MODEL_PRESET` environment variable:

- `production`: Gemini Pro reasoning + Llama 3.3 content (recommended)
- `gemini-only`: Pure Gemini stack (Pro for all tasks)
- `fast`: Gemini Flash for all tasks (fastest, lower quality)
- `development`: Gemini Flash for development iteration

### No API Keys Required

All Google Cloud services use **Application Default Credentials (ADC)**:
- Cloud Run services use service account identity
- Local development uses `gcloud auth application-default login`
- Only exception: AEM Document Authoring credentials (stored in Secret Manager)

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

### Environment Variables (Cloud Run)

Required for Cloud Run service:

```sh
GCP_PROJECT_ID=your-project-id          # Google Cloud project
GCP_LOCATION=us-central1                # Deployment region
MODEL_PRESET=production                 # AI model preset
DA_ORG=paolomoz                         # AEM DA organization
DA_REPO=vitamix-poc                     # AEM DA repository
DA_CLIENT_ID=<from-secret-manager>      # Adobe IMS client ID
DA_CLIENT_SECRET=<from-secret-manager>  # Adobe IMS client secret
```

## 📊 Analytics

The platform includes comprehensive analytics tracking:

- **Session Tracking**: User journey through multiple queries (Firestore)
- **Query Analysis**: Gemini-powered AI analysis of user intent
- **Conversion Tracking**: CTA clicks and user engagement
- **Analytics Dashboard**: Real-time metrics visualization
- **BigQuery Export**: Optional export for advanced analytics

View analytics at `/analytics/`

## 📚 Documentation

### Core Files

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - **NEW**: Complete Google Cloud deployment guide
- [`CLAUDE.md`](./CLAUDE.md) - Comprehensive technical documentation
- [`AGENTS.md`](./AGENTS.md) - AI-assisted development workflows
- [`sample-queries.md`](./sample-queries.md) - Example user queries
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) - Contribution guidelines

### Google Cloud Resources

- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Vertex AI Docs](https://cloud.google.com/vertex-ai/docs)
- [Firestore Docs](https://cloud.google.com/firestore/docs)
- [Firebase Vector Search](https://firebase.google.com/docs/firestore/vector-search)

### AEM Resources

- [AEM Developer Tutorial](https://www.aem.live/developer/tutorial)
- [Anatomy of an AEM Project](https://www.aem.live/developer/anatomy-of-a-project)
- [Web Performance](https://www.aem.live/developer/keeping-it-100)
- [Blocks & Markup](https://www.aem.live/developer/markup-sections-blocks)

## 💰 Cost Comparison

**Previous (Cloudflare):**
- Workers: ~$5-10/month
- KV + Vectorize: ~$5-10/month
- AI APIs (Claude + Cerebras): ~$80-140/month
- **Total**: ~$90-170/month

**Current (Google Cloud):**
- Cloud Run: ~$5-15/month (scale-to-zero)
- Firestore: ~$10-20/month (includes Vector Search)
- Vertex AI (Gemini + Model Garden): ~$30-60/month
- Cloud Functions: ~$5-10/month
- **Total**: ~$50-110/month

**Expected savings: 30-40% cost reduction**

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

**Note**: This is a proof-of-concept demonstrating AI-powered content generation with AEM Edge Delivery Services and Google Cloud. The Vitamix brand and products are used for demonstration purposes.

## 🆕 Migration from Cloudflare Workers

This project was migrated from Cloudflare Workers to Google Cloud in January 2026. Key changes:

- ✅ Replaced Claude + Cerebras with Gemini + Model Garden
- ✅ Replaced Cloudflare KV with Firestore
- ✅ Replaced Cloudflare Vectorize with Firebase Vector Search
- ✅ Replaced Workers with Cloud Run + Cloud Functions
- ✅ Implemented passwordless authentication (ADC)
- ✅ All resources tagged with `app=vitamix` label

See git history for migration details or [DEPLOYMENT.md](./DEPLOYMENT.md) for current setup.
