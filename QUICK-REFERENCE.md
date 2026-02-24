# Vitamix POC - Google Cloud Quick Reference

## 🚀 Deployment Commands

```bash
# Set your project
export GCP_PROJECT_ID="your-project-id"
export GCP_LOCATION="us-central1"

# Full deployment (automated)
chmod +x deploy-google-cloud.sh
./deploy-google-cloud.sh

# Manual deployment (step by step)
# See DEPLOYMENT.md for detailed steps
```

## 📋 Essential URLs

Replace `PROJECT_ID` with your actual project ID.

### Services
- **Cloud Run**: https://console.cloud.google.com/run?project=PROJECT_ID
- **Cloud Functions**: https://console.cloud.google.com/functions?project=PROJECT_ID
- **Firestore**: https://console.cloud.google.com/firestore?project=PROJECT_ID
- **Cloud Storage**: https://console.cloud.google.com/storage?project=PROJECT_ID
- **Vertex AI**: https://console.cloud.google.com/vertex-ai?project=PROJECT_ID

### Monitoring
- **Dashboard**: https://console.cloud.google.com/monitoring/dashboards?project=PROJECT_ID
- **Logs**: https://console.cloud.google.com/logs/query?project=PROJECT_ID
- **Alerts**: https://console.cloud.google.com/monitoring/alerting?project=PROJECT_ID
- **Traces**: https://console.cloud.google.com/traces?project=PROJECT_ID

### Billing
- **Cost Breakdown**: https://console.cloud.google.com/billing?project=PROJECT_ID

## 🔧 Quick Commands

### View Cloud Run Logs
```bash
gcloud run services logs read vitamix-recommender \
  --region=us-central1 \
  --project=$GCP_PROJECT_ID \
  --limit=50
```

### Test Health Endpoint
```bash
CLOUD_RUN_URL=$(gcloud run services describe vitamix-recommender \
  --region=us-central1 --project=$GCP_PROJECT_ID \
  --format='value(status.url)')
curl $CLOUD_RUN_URL/health
```

### Test SSE Streaming
```bash
curl -N "${CLOUD_RUN_URL}/generate?query=best+blender+for+smoothies"
```

### View Firestore Data
```bash
# List sessions
gcloud firestore documents list sessions --project=$GCP_PROJECT_ID --limit=10

# List recipes
gcloud firestore documents list recipes --project=$GCP_PROJECT_ID --limit=10
```

### Check Service Account Permissions
```bash
gcloud projects get-iam-policy $GCP_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:vitamix-recommender-sa"
```

## 🏷️ Resource Labels

All resources tagged with:
```yaml
app: vitamix
component: [recommender|analytics|embeddings|media]
environment: [dev|staging|production]
```

**Find all vitamix resources:**
```bash
gcloud asset search-all-resources \
  --query="labels.app=vitamix" \
  --project=$GCP_PROJECT_ID
```

## 🤖 AI Models

### Gemini (Vertex AI)
- **Flash**: `gemini-2.0-flash-001` (classification, < 300ms)
- **Pro**: `gemini-2.0-pro-001` (reasoning, ~2-4s)

### Model Garden
- **Llama 3.3 70B**: `llama-3-3-70b-instruct-maas` (content generation)

### Model Presets
- `production`: Gemini Pro + Llama 3.3 (recommended)
- `gemini-only`: Pure Gemini (Pro for all)
- `fast`: Gemini Flash only (fastest)

**Change preset:**
```bash
gcloud run services update vitamix-recommender \
  --update-env-vars MODEL_PRESET=gemini-only \
  --region=us-central1 \
  --project=$GCP_PROJECT_ID
```

## 📊 Monitoring Queries

### Recent Errors
```
resource.type="cloud_run_revision"
resource.labels.service_name="vitamix-recommender"
severity>=ERROR
```

### Slow Requests (> 5s)
```
resource.type="cloud_run_revision"
resource.labels.service_name="vitamix-recommender"
jsonPayload.latency>5000
```

### AI Generation Metrics
```
resource.type="cloud_run_revision"
jsonPayload.event="generation_complete"
```

## 💰 Cost Tracking

### View costs by label
```bash
gcloud billing accounts list
# Then in Cloud Console: Billing → Reports → Filter by label: app=vitamix
```

### Expected Monthly Costs
- Cloud Run: $5-15
- Firestore: $10-20
- Vertex AI: $30-60
- Cloud Functions: $5-10
- **Total: ~$50-110/month**

## 🔐 Secrets

### List Secrets
```bash
gcloud secrets list --filter="labels.app=vitamix" --project=$GCP_PROJECT_ID
```

### Update Secret
```bash
echo -n "NEW_VALUE" | gcloud secrets versions add SECRET_NAME \
  --data-file=- \
  --project=$GCP_PROJECT_ID
```

## 🧪 Testing Endpoints

### Cloud Run (Main API)
```bash
# Health check
curl $CLOUD_RUN_URL/health

# Generate content (SSE)
curl -N "${CLOUD_RUN_URL}/generate?query=test"

# Persist page
curl -X POST "${CLOUD_RUN_URL}/api/persist" \
  -H "Content-Type: application/json" \
  -d '{"query":"test","blocks":[{"html":"<div>Test</div>"}]}'
```

### Analytics Function
```bash
ANALYTICS_URL="https://us-central1-${GCP_PROJECT_ID}.cloudfunctions.net/trackEvent"

curl -X POST $ANALYTICS_URL \
  -H "Content-Type: application/json" \
  -d '{"type":"query","sessionId":"test-123","timestamp":1234567890,"data":{}}'
```

### Embeddings Function
```bash
EMBEDDINGS_URL="https://us-central1-${GCP_PROJECT_ID}.cloudfunctions.net/searchRecipes"

curl "${EMBEDDINGS_URL}?q=smoothie&limit=5"
```

## 🚨 Common Issues

### Issue: 503 Service Unavailable
**Cause**: Cloud Run cold start or scaling  
**Fix**: Increase min instances or wait 10-30s

### Issue: 401 Unauthorized (Vertex AI)
**Cause**: Service account lacks permissions  
**Fix**: Run `infrastructure/cloudrun/setup-service-accounts.sh`

### Issue: Firestore quota exceeded
**Cause**: Too many reads/writes  
**Fix**: Implement caching, optimize queries

### Issue: SSE stream drops
**Cause**: Timeout or network issue  
**Fix**: Check `timeoutSeconds: 3600` in Cloud Run config

## 📱 Frontend Configuration

Add to your AEM head.html:
```html
<script>
window.VITAMIX_CONFIG = {
  RECOMMENDER_URL: 'https://vitamix-recommender-HASH-uc.a.run.app',
  ANALYTICS_URL: 'https://us-central1-PROJECT_ID.cloudfunctions.net/trackEvent',
  EMBEDDINGS_URL: 'https://us-central1-PROJECT_ID.cloudfunctions.net/searchRecipes',
};
</script>
```

## 🔄 Rollback

Revert to Cloudflare Workers:
```bash
# Update frontend config to use Cloudflare URLs
# Pause Cloud Run to save costs
gcloud run services update vitamix-recommender \
  --no-traffic \
  --region=us-central1 \
  --project=$GCP_PROJECT_ID
```

## 📚 Documentation

- **Full Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Migration Summary**: [MIGRATION-SUMMARY.md](./MIGRATION-SUMMARY.md)
- **Updated README**: [README-GOOGLE-CLOUD.md](./README-GOOGLE-CLOUD.md)
- **API Config**: [scripts/api-config.js](./scripts/api-config.js)

## 👥 Support

- **GCP Console**: https://console.cloud.google.com
- **Cloud Run Docs**: https://cloud.google.com/run/docs
- **Vertex AI Docs**: https://cloud.google.com/vertex-ai/docs

---

**Last Updated**: January 2026  
**Status**: ✅ Ready for Deployment
