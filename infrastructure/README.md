# Infrastructure Setup for Vitamix POC on Google Cloud

This directory contains scripts and configuration for deploying the Vitamix POC to Google Cloud Platform with a 100% Google-native stack.

## Prerequisites

- Google Cloud SDK (`gcloud`) installed and configured
- Active GCP project
- Billing enabled on the project
- Owner or Editor permissions

## Quick Start

Run these scripts in order:

```bash
cd infrastructure/gcloud

# 1. Set your GCP project
gcloud config set project YOUR_PROJECT_ID

# 2. Enable required APIs (Cloud Run, Firestore, Vertex AI, etc.)
chmod +x *.sh
./enable-apis.sh

# 3. Create service accounts with IAM roles
./create-service-accounts.sh

# 4. Set up Secret Manager secrets for AEM Document Authoring
./setup-secrets.sh

# 5. Initialize Firestore database and Cloud Storage
./setup-firestore.sh
```

## Architecture Overview

### Components

- **Cloud Run**: vitamix-recommender (main AI service)
- **Cloud Functions**: vitamix-analytics, vitamix-embeddings
- **Firestore**: Session management, analytics, recipe vectors
- **Vertex AI**: Gemini models + Model Garden (Llama 3.3)
- **Secret Manager**: AEM DA credentials only
- **Cloud Storage**: Media assets

### Authentication

**Passwordless (Application Default Credentials)**:
- All Google services use ADC
- Service accounts auto-attached to Cloud Run/Functions
- Local development: `gcloud auth application-default login`

**Secret Manager** (only for AEM DA):
- `DA_CLIENT_ID` - Adobe IMS client ID
- `DA_CLIENT_SECRET` - Adobe IMS client secret

### Resource Labels

All resources are labeled with:
```yaml
labels:
  app: vitamix
  component: [recommender|analytics|embeddings|aem-da|media]
  environment: [dev|staging|production]
```

## Service Accounts

Created by `create-service-accounts.sh`:

1. **vitamix-recommender-sa**
   - Roles: Firestore User, Vertex AI User, Secret Manager Accessor, Storage Admin, Log Writer
   - Used by: Cloud Run service (vitamix-recommender)

2. **vitamix-analytics-sa**
   - Roles: Firestore User, Log Writer
   - Used by: Cloud Function (vitamix-analytics)

3. **vitamix-embeddings-sa**
   - Roles: Firestore User, Vertex AI User, Storage Admin, Log Writer
   - Used by: Cloud Function (vitamix-embeddings)

## Firestore Collections

### sessions
- Session management (query history, context)
- TTL: 30 days
- Index: sessionId + sessionStart

### analytics_events
- Event tracking (queries, conversions, page views)
- BigQuery export enabled
- Index: timestamp + eventType

### analytics_sessions
- User journey tracking
- Index: sessionId + lastActivity

### recipes
- Recipe data with vector embeddings
- Vector index: 768-dim, cosine similarity
- For semantic search via Firebase Vector Search

## Cloud Storage Buckets

### {project-id}-vitamix-media
- Hero images, generated content
- CORS configured for AEM domains (*.aem.page, *.aem.live)
- Labels: app=vitamix, component=media

## APIs Enabled

- `run.googleapis.com` - Cloud Run
- `cloudfunctions.googleapis.com` - Cloud Functions gen2
- `firestore.googleapis.com` - Firestore Native
- `aiplatform.googleapis.com` - Vertex AI (Gemini + Model Garden)
- `cloudbuild.googleapis.com` - CI/CD
- `logging.googleapis.com` - Cloud Logging
- `monitoring.googleapis.com` - Cloud Monitoring
- `secretmanager.googleapis.com` - Secret Manager
- `storage.googleapis.com` - Cloud Storage
- `artifactregistry.googleapis.com` - Container Registry

## Local Development

Set up ADC for local testing:

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=your-project-id
```

Your code will automatically use ADC to access Firestore, Vertex AI, etc.

## Next Steps

After infrastructure setup:

1. Build Docker image for vitamix-recommender
2. Deploy Cloud Run service
3. Deploy Cloud Functions (analytics, embeddings)
4. Update frontend API endpoints
5. Run integration tests

See `../cloudrun/` for deployment configurations.

## Cost Estimation

Expected monthly costs (1M requests, moderate usage):

- Cloud Run: $5-15 (scale-to-zero)
- Firestore: $10-20 (read/write/storage)
- Vertex AI (Gemini + Model Garden): $30-60
- Secret Manager: $0.10
- Cloud Storage: $1-5
- Cloud Logging: $5

**Total**: ~$50-110/month (30-40% savings vs Cloudflare)

## Troubleshooting

### Permission denied errors
- Ensure service accounts have proper IAM roles
- Check that APIs are enabled
- Verify your user has permissions to grant roles

### Firestore already exists in Datastore mode
- Cannot create Firestore Native if Datastore mode exists
- Must use a different project or migrate Datastore

### Secret Manager access denied
- Ensure service account has `roles/secretmanager.secretAccessor`
- Check secret exists: `gcloud secrets list`

## Support

For issues or questions, refer to:
- Google Cloud Documentation: https://cloud.google.com/docs
- Firestore Vector Search: https://cloud.google.com/firestore/docs/vector-search
- Vertex AI: https://cloud.google.com/vertex-ai/docs
