# Vitamix POC - Google Cloud Deployment Guide

Complete deployment guide for migrating from Cloudflare Workers to Google Cloud Run + Functions.

## Prerequisites

- Google Cloud Project with billing enabled
- `gcloud` CLI installed and authenticated
- Docker installed (for local testing)
- Node.js 20+ installed
- Firebase CLI installed: `npm install -g firebase-tools`

## Architecture Overview

```
Browser (AEM EDS) → Cloud Run (vitamix-recommender) → Firestore + Vertex AI
                  ↓
               Cloud Functions (analytics, embeddings)
```

**Key Components:**
- ✅ Gemini 2.0 (Flash + Pro) for AI tasks
- ✅ Vertex AI Model Garden (Llama 3.3 70B) for content generation
- ✅ Firestore for sessions and analytics
- ✅ Firebase Vector Search for recipe embeddings
- ✅ Passwordless auth (Application Default Credentials)
- ✅ All resources labeled with `app=vitamix`

---

## Phase 1: Initial Setup

### 1.1 Set Environment Variables

```bash
export GCP_PROJECT_ID="your-project-id"
export GCP_LOCATION="us-central1"
export ALERT_EMAIL="your-email@example.com"

# Verify
gcloud config set project $GCP_PROJECT_ID
gcloud config get-value project
```

### 1.2 Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudfunctions.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  --project=$GCP_PROJECT_ID
```

### 1.3 Create Service Accounts

```bash
cd infrastructure/cloudrun
chmod +x setup-service-accounts.sh
./setup-service-accounts.sh
```

---

## Phase 2: Storage Setup

### 2.1 Initialize Firestore

```bash
# Create Firestore database (Native mode)
gcloud firestore databases create \
  --location=$GCP_LOCATION \
  --project=$GCP_PROJECT_ID

# Deploy Firestore indexes
firebase deploy --only firestore:indexes

# Deploy Firestore rules
firebase deploy --only firestore:rules
```

### 2.2 Create Cloud Storage Bucket

```bash
# Create bucket for media assets
gsutil mb -p $GCP_PROJECT_ID -l $GCP_LOCATION \
  -b on gs://${GCP_PROJECT_ID}-vitamix-media

# Set labels
gsutil label ch -l app:vitamix \
  -l component:media \
  gs://${GCP_PROJECT_ID}-vitamix-media

# Make bucket public (for recipe images)
gsutil iam ch allUsers:objectViewer \
  gs://${GCP_PROJECT_ID}-vitamix-media/recipes
```

---

## Phase 3: Secrets Management

### 3.1 Store AEM Document Authoring Credentials

```bash
# Create secrets with vitamix label
echo -n "YOUR_DA_CLIENT_ID" | gcloud secrets create DA_CLIENT_ID \
  --data-file=- \
  --labels=app=vitamix,component=secrets \
  --project=$GCP_PROJECT_ID

echo -n "YOUR_DA_CLIENT_SECRET" | gcloud secrets create DA_CLIENT_SECRET \
  --data-file=- \
  --labels=app=vitamix,component=secrets \
  --project=$GCP_PROJECT_ID

# Grant access to service accounts
for SA in vitamix-recommender-sa; do
  gcloud secrets add-iam-policy-binding DA_CLIENT_ID \
    --member="serviceAccount:${SA}@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$GCP_PROJECT_ID
    
  gcloud secrets add-iam-policy-binding DA_CLIENT_SECRET \
    --member="serviceAccount:${SA}@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$GCP_PROJECT_ID
done
```

---

## Phase 4: Vertex AI Model Garden Setup

### 4.1 Enable Model Garden Models

```bash
cd infrastructure/vertex-ai
chmod +x setup-model-garden.sh
./setup-model-garden.sh
```

### 4.2 Manually Enable Models (if needed)

1. Visit: https://console.cloud.google.com/vertex-ai/model-garden
2. Search for "Llama 3.3 70B" and "Mistral Large"
3. Click "Enable" for each model
4. Accept terms and conditions

---

## Phase 5: Build and Deploy Cloud Run

### 5.1 Update Configuration

Edit `infrastructure/cloudrun/vitamix-recommender.yaml`:
- Replace `PROJECT_ID` with your actual project ID
- Update `DA_ORG` and `DA_REPO` for your AEM setup

### 5.2 Build with Cloud Build

```bash
# From project root
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_REGION=$GCP_LOCATION,_ENVIRONMENT=production,_MODEL_PRESET=production \
  --project=$GCP_PROJECT_ID
```

### 5.3 Verify Deployment

```bash
# Get Cloud Run URL
CLOUD_RUN_URL=$(gcloud run services describe vitamix-recommender \
  --region=$GCP_LOCATION \
  --project=$GCP_PROJECT_ID \
  --format='value(status.url)')

echo "Cloud Run URL: $CLOUD_RUN_URL"

# Test health endpoint
curl $CLOUD_RUN_URL/health
```

---

## Phase 6: Deploy Cloud Functions

### 6.1 Deploy Analytics Function

```bash
cd functions/analytics
npm install
firebase deploy --only functions:trackEvent,functions:analyzeQueries,functions:getSessionAnalytics
```

### 6.2 Deploy Embeddings Function

```bash
cd ../embeddings
npm install
firebase deploy --only functions:onRecipeUpload,functions:generateRecipeEmbeddings,functions:searchRecipes
```

### 6.3 Test Functions

```bash
# Test analytics function
curl -X POST \
  "https://us-central1-${GCP_PROJECT_ID}.cloudfunctions.net/trackEvent" \
  -H "Content-Type: application/json" \
  -d '{"type":"query","sessionId":"test-123","timestamp":1234567890,"data":{"query":"test"}}'

# Test embeddings search
curl "https://us-central1-${GCP_PROJECT_ID}.cloudfunctions.net/searchRecipes?q=smoothie&limit=5"
```

---

## Phase 7: Update Frontend Configuration

### 7.1 Update API Endpoints

Edit your AEM head.html or page template:

```html
<script>
window.VITAMIX_CONFIG = {
  RECOMMENDER_URL: 'https://vitamix-recommender-HASH-uc.a.run.app',
  ANALYTICS_URL: 'https://us-central1-PROJECT_ID.cloudfunctions.net/trackEvent',
  EMBEDDINGS_URL: 'https://us-central1-PROJECT_ID.cloudfunctions.net/searchRecipes',
};
</script>
```

Replace:
- `HASH` with your Cloud Run service hash
- `PROJECT_ID` with your actual project ID

### 7.2 Test Frontend Integration

1. Open your AEM EDS site
2. Try a query (e.g., "best blender for smoothies")
3. Check browser console for API calls
4. Verify SSE streaming works

---

## Phase 8: Monitoring and Alerts

### 8.1 Setup Cloud Operations

```bash
cd infrastructure/monitoring
chmod +x setup-monitoring.sh
./setup-monitoring.sh
```

### 8.2 View Dashboards

- Monitoring: https://console.cloud.google.com/monitoring/dashboards
- Logs: https://console.cloud.google.com/logs/query
- Traces: https://console.cloud.google.com/traces

---

## Phase 9: Load Recipes Data

### 9.1 Upload Recipe JSONs

```bash
# Upload recipes to Cloud Storage
gsutil -m cp content/recipes/*.json \
  gs://${GCP_PROJECT_ID}-vitamix-media/recipes/

# Trigger embedding generation
curl -X POST \
  "https://us-central1-${GCP_PROJECT_ID}.cloudfunctions.net/generateRecipeEmbeddings"
```

### 9.2 Verify Vector Index

```bash
# Check Firestore recipes collection
gcloud firestore indexes composite list --project=$GCP_PROJECT_ID

# Test vector search
curl "https://us-central1-${GCP_PROJECT_ID}.cloudfunctions.net/searchRecipes?q=green+smoothie&limit=10"
```

---

## Phase 10: Testing and Validation

### 10.1 Integration Tests

```bash
# Test SSE streaming
curl -N "${CLOUD_RUN_URL}/generate?query=best+blender+for+smoothies"

# Test persistence
curl -X POST "${CLOUD_RUN_URL}/api/persist" \
  -H "Content-Type: application/json" \
  -d '{"query":"test","blocks":[{"html":"<div>Test</div>"}]}'
```

### 10.2 Performance Benchmarks

```bash
# Run load test (requires hey or ab)
hey -n 100 -c 10 "${CLOUD_RUN_URL}/health"
```

---

## Rollout Strategy

### Option A: Gradual Traffic Migration

1. Deploy to staging first
2. Run parallel testing (Cloudflare vs Google Cloud)
3. Migrate 10% traffic → 50% → 100%
4. Keep Cloudflare as backup for 1 month

### Option B: Direct Cutover

1. Deploy all services
2. Update frontend configuration
3. Monitor closely for 24 hours
4. Roll back if issues

---

## Troubleshooting

### Cloud Run Issues

```bash
# View logs
gcloud run services logs read vitamix-recommender \
  --region=$GCP_LOCATION \
  --project=$GCP_PROJECT_ID \
  --limit=50

# Check service status
gcloud run services describe vitamix-recommender \
  --region=$GCP_LOCATION \
  --project=$GCP_PROJECT_ID
```

### Firestore Issues

```bash
# Check indexes
gcloud firestore indexes composite list --project=$GCP_PROJECT_ID

# View operations
gcloud firestore operations list --project=$GCP_PROJECT_ID
```

### Vertex AI Issues

```bash
# Check model availability
gcloud ai models list --region=$GCP_LOCATION --project=$GCP_PROJECT_ID

# View quota usage
gcloud services quota list --service=aiplatform.googleapis.com --project=$GCP_PROJECT_ID
```

---

## Cost Monitoring

```bash
# View current billing
gcloud billing accounts list
gcloud billing projects describe $GCP_PROJECT_ID

# Set budget alerts
# Visit: https://console.cloud.google.com/billing/budgets
```

**Expected Monthly Costs (production):**
- Cloud Run: $5-15
- Firestore: $10-20
- Vertex AI (Gemini + Model Garden): $30-60
- Cloud Functions: $5-10
- Cloud Storage: $1-5
- **Total: ~$50-110/month**

---

## Rollback Plan

If issues occur, roll back to Cloudflare Workers:

1. Update frontend config to use Cloudflare Worker URLs
2. Pause Cloud Run service (to save costs)
3. Investigate issues
4. Redeploy when ready

```bash
# Pause Cloud Run (stop serving traffic)
gcloud run services update vitamix-recommender \
  --no-traffic \
  --region=$GCP_LOCATION \
  --project=$GCP_PROJECT_ID
```

---

## Success Criteria

- ✅ P95 latency < 5s
- ✅ Error rate < 1%
- ✅ SSE streaming works without drops
- ✅ Firestore session retrieval < 100ms
- ✅ Vector search < 200ms
- ✅ All resources labeled with `app=vitamix`
- ✅ Cost reduction of 30-40% vs Cloudflare

---

## Support and Resources

- Google Cloud Console: https://console.cloud.google.com
- Cloud Run Docs: https://cloud.google.com/run/docs
- Vertex AI Docs: https://cloud.google.com/vertex-ai/docs
- Firestore Docs: https://cloud.google.com/firestore/docs
