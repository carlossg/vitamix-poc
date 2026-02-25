# Vitamix POC -- Technical Specification

## 1. Overview

The Vitamix POC is an AI-powered content generation platform built on **AEM Edge Delivery Services** (aem.live) with a **Google Cloud** backend. It takes natural-language user queries (e.g. "best blender for smoothies") and generates personalized product pages, recipes, and support content in real time using Server-Sent Events (SSE).

### Core Flow

```
Browser (AEM EDS)  ──?q=...──▶  Cloud Run (recommender)
                                   │
                  SSE stream ◀─────┤   Gemini 3 Pro   (reasoning + content)
                                   │   Gemini 3 Flash (classification)
                                   │
                  POST /persist ──▶│── DA API ──▶ aem.live
```

---

## 2. Infrastructure

| Component | Service | Region | Labels |
|-----------|---------|--------|--------|
| Recommender API | **Cloud Run** | us-central1 | `app=vitamix, component=recommender` |
| Analytics | **Cloud Function Gen2** (trackEvent) | us-central1 | `app=vitamix, component=analytics` |
| Recipe Search | **Cloud Function Gen2** (searchRecipes) | us-central1 | `app=vitamix, component=embeddings` |
| Embedding Gen | **Cloud Function Gen2** (generateRecipeEmbeddings) | us-central1 | `app=vitamix, component=embeddings` |
| Recipe Upload | **Cloud Function Gen2** (onRecipeUpload, storage trigger) | us-central1 | `app=vitamix, component=embeddings` |
| Session & Events | **Firestore** (native mode) | us-central1 | |
| Recipe Vectors | **Firestore Vector Search** (768-dim, COSINE) | us-central1 | |
| Media Storage | **Cloud Storage** (`{project}-vitamix-media`) | us-central1 | |
| Secrets | **Secret Manager** (DA_TOKEN) | | |
| Build/Deploy | **Cloud Build** → Container Registry → Cloud Run | | |
| Monitoring | **Cloud Operations** (logging, alerting) | | |

**Google Cloud Project:** `api-project-642841493686`

### Authentication

| Layer | Method |
|-------|--------|
| Google Cloud services (Vertex AI, Firestore, Storage) | Application Default Credentials (passwordless) |
| Cloud Run → internet | `--allow-unauthenticated` |
| AEM Document Authoring | IMS Bearer token (`DA_TOKEN` from Secret Manager) |

---

## 3. Services

### 3.1 Recommender (Cloud Run)

**URL:** `https://vitamix-recommender-okyq6gkx3a-uc.a.run.app`

**Container:** `node:20-slim`, TypeScript compiled to JS, Express server on port 8080.

**Resources:** 2 vCPU, 2 GiB RAM, 0-10 instances, 3600s timeout.

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/generate?query=...&slug=...&preset=...&ctx=...` | Stream AI-generated page via SSE |
| `POST` | `/api/persist` | Save generated page to AEM DA and publish |
| `GET` | `/health` | Health check (JSON) |
| `GET` | `/healthz` | Liveness probe |

#### GET /generate

Query parameters:

| Param | Required | Description |
|-------|----------|-------------|
| `query` | yes | Natural-language user query |
| `slug` | no | URL slug for the page |
| `preset` | no | Model preset name (default: `production`) |
| `ctx` | no | Base64-encoded session context |

Response: `text/event-stream` (SSE). Event types:

| Event | Payload | Description |
|-------|---------|-------------|
| `generation-start` | `{query, estimatedBlocks}` | Stream opened |
| `reasoning-start` | `{model, preset}` | Reasoning phase begins |
| `reasoning-step` | `{stage, title, content}` | Understanding → Assessment → Decision |
| `reasoning-complete` | `{confidence, duration}` | Reasoning done |
| `block-start` | `{blockType, index}` | Block generation begins |
| `block-content` | `{html, sectionStyle?, imageId?}` | Block HTML content |
| `block-rationale` | `{blockType, rationale}` | Why this block was chosen |
| `image-ready` | `{imageId, url}` | Generated image available |
| `generation-complete` | `{totalBlocks, duration, intent, reasoning, recommendations}` | Stream done |
| `complete` | `{message}` | Connection closing |

#### POST /api/persist

Request body:

```json
{
  "query": "blender for smoothies",
  "blocks": [{"type": "hero", "html": "<div>...</div>", "sectionStyle": "dark"}],
  "intent": {"intentType": "discovery", "confidence": 0.9, "entities": {...}},
  "title": "Optional page title"
}
```

Response:

```json
{
  "success": true,
  "path": "/smoothies/blender-smoothies-6stn8y",
  "urls": {
    "preview": "https://main--vitamix-poc--carlossg.aem.page/smoothies/...",
    "live": "https://main--vitamix-poc--carlossg.aem.live/smoothies/..."
  }
}
```

Persist flow: Create page in DA → Preview → Wait for preview → Publish → Purge CDN cache.

### 3.2 Analytics (Cloud Function Gen2)

**Entry point:** `trackEvent`

Accepts POST requests with analytics events (`session_start`, `query`, `page_published`, `conversion`). Stores events in Firestore `analytics_events` collection and updates session aggregates in `analytics_sessions`.

### 3.3 Embeddings (Cloud Function Gen2)

Three functions from one source:

| Function | Trigger | Description |
|----------|---------|-------------|
| `searchRecipes` | HTTP | Vector search: embed query → Firestore `findNearest` (COSINE) |
| `generateRecipeEmbeddings` | HTTP | Batch-embed all recipes in Firestore |
| `onRecipeUpload` | Cloud Storage event | Auto-embed when recipe JSON uploaded |

Embedding model: `text-embedding-005` (768 dimensions).

---

## 4. AI Models

### Gemini 3 (Preview)

All AI calls go through Vertex AI using the **global** endpoint (`aiplatform.googleapis.com`, location `global`). Gemini 3 models require this; the Vertex AI client detects `gemini-3*` model names and routes accordingly.

### Model Presets

| Preset | Reasoning | Content | Classification | Validation |
|--------|-----------|---------|----------------|------------|
| **production** | gemini-3-pro-preview (t=0.7) | gemini-3-pro-preview (t=0.8) | gemini-3-flash-preview (t=0.3) | gemini-3-flash-preview (t=0.2) |
| **gemini-only** | gemini-3-pro-preview | gemini-3-pro-preview | gemini-3-flash-preview | gemini-3-flash-preview |
| **fast** | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview |
| **development** | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview |
| **llama** | gemini-3-pro-preview | llama-3.3-70b (Model Garden) | gemini-3-flash-preview | gemini-3-flash-preview |
| **model-garden-llama** | llama-3.3-70b | llama-3.3-70b | llama-3.3-70b | llama-3.3-70b |

### Model Roles

| Role | Purpose | Typical latency |
|------|---------|-----------------|
| **reasoning** | Intent analysis, block selection, journey reasoning | 10-30s |
| **content** | HTML block generation (hero, product-cards, recipes, etc.) | 5-15s per block |
| **classification** | Fast intent type detection, category classification | 1-3s |
| **validation** | Output validation, content safety checks | <1s |

---

## 5. AEM Integration

### Document Authoring (DA)

| Setting | Value |
|---------|-------|
| DA Org | `carlossg` |
| DA Repo | `vitamix-poc` |
| DA API | `https://admin.da.live` |
| Admin API | `https://admin.hlx.page` |
| Auth | IMS Bearer token (Secret Manager: `DA_TOKEN`) |

### Published URLs

- **Preview:** `https://main--vitamix-poc--carlossg.aem.page/{path}`
- **Live:** `https://main--vitamix-poc--carlossg.aem.live/{path}`

### URL Category Paths

Pages are auto-categorized by intent:

| Intent | Path prefix | Example |
|--------|------------|---------|
| smoothie queries | `/smoothies/` | `/smoothies/blender-smoothies-6stn8y` |
| recipe queries | `/recipes/` | `/recipes/vegan-soup-recipe-a3b2c1` |
| product queries | `/products/` | `/products/compare-ascent-5200-x4d9f2` |
| comparison | `/compare/` | |
| tips/how-to | `/tips/` | |
| general | `/discover/` | |

---

## 6. Frontend

### Stack

- **AEM Edge Delivery Services** (aem.live) -- static site with 72 custom blocks
- **Local dev:** `npm i && aem up` → `http://localhost:3000`

### Generation Modes

| Mode | URL Parameter | Description |
|------|---------------|-------------|
| Recommender | `?q=` or `?query=` | Full AI pipeline with session context |
| Fast | `?fast=` | Two-phase (hero first, then content) |
| Standard | `?generate=` | Full streaming with progress indicators |

### API Configuration

Endpoints are centralized in `scripts/api-config.js`. Defaults:

```javascript
VITAMIX_RECOMMENDER_URL = 'https://vitamix-recommender-okyq6gkx3a-uc.a.run.app'
VITAMIX_ANALYTICS_URL   = 'https://us-central1-api-project-642841493686.cloudfunctions.net/trackEvent'
VITAMIX_EMBEDDINGS_URL  = 'https://us-central1-api-project-642841493686.cloudfunctions.net/searchRecipes'
```

Override at runtime via `window.VITAMIX_CONFIG` before scripts load.

---

## 7. Block Inventory (72 blocks)

### AI / Search
`query-form`, `ingredient-search`, `quick-answer`, `reasoning`, `support-triage`

### Products
`product-cards`, `product-recommendation`, `product-hero`, `product-compare`, `product-cta`, `product-info`

### Recipes
`recipe-cards`, `recipe-hero`, `recipe-steps`, `recipe-tabs`, `recipe-filter-bar`, `recipe-grid`

### Analytics
`analytics-queries`, `analytics-last-queries`, `analytics-analysis`, `analytics-metrics`, `analytics-dashboard`

### Layout / Content
`hero`, `cards`, `columns`, `split-content`, `fragment`, `header`, `footer`, `faq`, `testimonials`

### Specialized
`accessibility-specs`, `budget-breakdown`, `engineering-specs`, `sustainability-info`, `allergen-safety`, `smart-features`, `feature-highlights`, `follow-up`

---

## 8. Environment Variables

### Cloud Run (set via cloudbuild.yaml + Secret Manager)

| Variable | Source | Value |
|----------|--------|-------|
| `NODE_ENV` | env var | `production` |
| `GCP_PROJECT_ID` | env var | `api-project-642841493686` |
| `GCP_LOCATION` | env var | `us-central1` |
| `MODEL_PRESET` | env var | `production` |
| `DA_ORG` | env var | `carlossg` |
| `DA_REPO` | env var | `vitamix-poc` |
| `DA_TOKEN` | Secret Manager | IMS access token (rotates ~24h) |

### Cloud Functions

Cloud Functions use ADC for Google Cloud services. No additional env vars required beyond what the runtime provides (`GOOGLE_CLOUD_PROJECT`, `FUNCTION_TARGET`).

---

## 9. Build & Deploy

### CI/CD Pipeline (Cloud Build)

```
cloudbuild.yaml:
  1. docker build → gcr.io/{project}/vitamix-recommender:{tag}
  2. docker push
  3. gcloud run deploy (with env vars + secrets)
```

**Machine type:** E2_HIGHCPU_8. **Timeout:** 20 minutes. **Typical build:** ~3 minutes.

### Deploy Script

`deploy-google-cloud.sh` runs the full stack (11 steps):

1. Service accounts & IAM
2. Firestore setup + indexes
3. Cloud Storage bucket
4. Secret Manager secrets
5. Vertex AI / Model Garden setup
6. Cloud Build → Cloud Run deploy
7. Verify Cloud Run
8. Deploy Cloud Functions (analytics + embeddings)
9. Populate recipe data (if available)
10. Monitoring / alerting
11. Summary

### Manual Deploy (recommender only)

```bash
BUILD_TAG="v$(date +%Y%m%d-%H%M%S)"
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_BUILD_TAG="$BUILD_TAG" \
  --project=api-project-642841493686 --quiet
```

---

## 10. Performance Characteristics

| Metric | Value |
|--------|-------|
| Health check response | < 100ms |
| Intent classification (Gemini 3 Flash) | 1-3s |
| Reasoning phase (Gemini 3 Pro) | 10-30s |
| Per-block content generation | 5-15s |
| Full page generation (4-5 blocks) | 60-150s |
| Persist + publish to aem.live | 10-20s |
| Cold start (Cloud Run) | ~5s |

---

## 11. Security

- **No API keys in code.** Google Cloud services use ADC; AEM DA uses a token from Secret Manager.
- **CTA sanitization.** Purchase-intent language ("Buy Now", "Add to Cart") is auto-converted to safer alternatives ("Learn More", "View Details") via `scripts/cta-utils.js`.
- **Do Not Track.** Analytics respects `navigator.doNotTrack`.
- **CORS.** Cloud Run and Cloud Functions allow all origins (POC scope).
- **Secret rotation.** `DA_TOKEN` expires ~24h. Refresh via:
  ```bash
  echo -n "NEW_TOKEN" | gcloud secrets versions add DA_TOKEN \
    --data-file=- --project=api-project-642841493686
  ```

---

## 12. Key Files

| File | Purpose |
|------|---------|
| `scripts/scripts.js` | Frontend orchestrator, SSE handling, generation modes |
| `scripts/api-config.js` | API endpoint configuration |
| `scripts/session-context.js` | Query history (sessionStorage, max 10) |
| `scripts/analytics-tracker.js` | Client-side event tracking |
| `scripts/cta-utils.js` | Link classification, CTA sanitization |
| `services/recommender/src/index-express.ts` | Cloud Run Express server |
| `services/recommender/src/lib/orchestrator.ts` | AI pipeline: intent → reasoning → block generation |
| `services/recommender/src/ai-clients/model-factory-google.ts` | Model presets and routing |
| `services/recommender/src/ai-clients/vertex-ai-client.ts` | Gemini API calls (global endpoint for Gemini 3) |
| `services/recommender/src/lib/da-client.ts` | AEM DA create/preview/publish |
| `services/recommender/src/lib/da-token-service.ts` | IMS token management |
| `services/recommender/src/lib/category-classifier.ts` | URL path categorization |
| `functions/analytics/index.ts` | Analytics Cloud Function |
| `functions/embeddings/index.ts` | Embeddings Cloud Function |
| `Dockerfile` | Cloud Run container definition |
| `cloudbuild.yaml` | CI/CD pipeline |
| `deploy-google-cloud.sh` | Full deployment script |
