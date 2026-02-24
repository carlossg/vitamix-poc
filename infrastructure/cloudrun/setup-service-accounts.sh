#!/bin/bash
# Service Account Setup for Vitamix POC - Google Cloud
# All resources tagged with app=vitamix label

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
LOCATION="${GCP_LOCATION:-us-central1}"

echo "Setting up Vitamix POC service accounts in project: $PROJECT_ID"

# ============================================
# Create Service Accounts with vitamix labels
# ============================================

echo "Creating service accounts..."

# Vitamix Recommender Service Account
gcloud iam service-accounts create vitamix-recommender-sa \
	--display-name="Vitamix Recommender Service" \
	--project="$PROJECT_ID" \
	|| echo "Service account vitamix-recommender-sa already exists"

# Vitamix Analytics Service Account
gcloud iam service-accounts create vitamix-analytics-sa \
	--display-name="Vitamix Analytics Service" \
	--project="$PROJECT_ID" \
	|| echo "Service account vitamix-analytics-sa already exists"

# Vitamix Embeddings Service Account
gcloud iam service-accounts create vitamix-embeddings-sa \
	--display-name="Vitamix Embeddings Service" \
	--project="$PROJECT_ID" \
	|| echo "Service account vitamix-embeddings-sa already exists"

# ============================================
# Grant IAM Roles - Vitamix Recommender
# ============================================

echo "Granting IAM roles to vitamix-recommender-sa..."

# Firestore access (sessions, analytics)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
	--member="serviceAccount:vitamix-recommender-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
	--role="roles/datastore.user" \
	--condition=None

# Vertex AI access (Gemini + Model Garden)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
	--member="serviceAccount:vitamix-recommender-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
	--role="roles/aiplatform.user" \
	--condition=None

# Secret Manager access (AEM DA credentials only)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
	--member="serviceAccount:vitamix-recommender-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
	--role="roles/secretmanager.secretAccessor" \
	--condition=None

# Cloud Storage access (media assets)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
	--member="serviceAccount:vitamix-recommender-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
	--role="roles/storage.objectViewer" \
	--condition=None

# ============================================
# Grant IAM Roles - Vitamix Analytics
# ============================================

echo "Granting IAM roles to vitamix-analytics-sa..."

# Firestore access
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
	--member="serviceAccount:vitamix-analytics-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
	--role="roles/datastore.user" \
	--condition=None

# Vertex AI access (Gemini for analysis)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
	--member="serviceAccount:vitamix-analytics-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
	--role="roles/aiplatform.user" \
	--condition=None

# BigQuery access (analytics export)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
	--member="serviceAccount:vitamix-analytics-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
	--role="roles/bigquery.dataEditor" \
	--condition=None

# ============================================
# Grant IAM Roles - Vitamix Embeddings
# ============================================

echo "Granting IAM roles to vitamix-embeddings-sa..."

# Firestore access (recipes collection with vectors)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
	--member="serviceAccount:vitamix-embeddings-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
	--role="roles/datastore.user" \
	--condition=None

# Vertex AI access (embeddings generation)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
	--member="serviceAccount:vitamix-embeddings-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
	--role="roles/aiplatform.user" \
	--condition=None

# Cloud Storage access (recipe JSONs)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
	--member="serviceAccount:vitamix-embeddings-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
	--role="roles/storage.objectViewer" \
	--condition=None

echo ""
echo "✅ Service accounts created and configured successfully!"
echo ""
echo "Next steps:"
echo "1. Store AEM DA credentials in Secret Manager:"
echo "   gcloud secrets create DA_CLIENT_ID --data-file=- --labels=app=vitamix"
echo "   gcloud secrets create DA_CLIENT_SECRET --data-file=- --labels=app=vitamix"
echo ""
echo "2. Deploy Cloud Run service:"
echo "   gcloud run deploy vitamix-recommender \\"
echo "     --image=gcr.io/$PROJECT_ID/vitamix-recommender:latest \\"
echo "     --service-account=vitamix-recommender-sa@${PROJECT_ID}.iam.gserviceaccount.com \\"
echo "     --region=$LOCATION \\"
echo "     --labels=app=vitamix,component=recommender,environment=production"
