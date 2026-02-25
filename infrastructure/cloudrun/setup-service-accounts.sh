#!/bin/bash
# Service Account Setup for Vitamix POC - Google Cloud
# All resources tagged with app=vitamix label

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
LOCATION="${GCP_LOCATION:-us-central1}"

echo "Setting up Vitamix POC service accounts in project: $PROJECT_ID"

# ============================================
# Create Service Accounts (idempotent)
# ============================================

echo "Creating service accounts..."

gcloud iam service-accounts create vitamix-recommender-sa \
	--display-name="Vitamix Recommender Service" \
	--project="$PROJECT_ID" 2>/dev/null \
	|| echo "  vitamix-recommender-sa already exists"

gcloud iam service-accounts create vitamix-analytics-sa \
	--display-name="Vitamix Analytics Service" \
	--project="$PROJECT_ID" 2>/dev/null \
	|| echo "  vitamix-analytics-sa already exists"

gcloud iam service-accounts create vitamix-embeddings-sa \
	--display-name="Vitamix Embeddings Service" \
	--project="$PROJECT_ID" 2>/dev/null \
	|| echo "  vitamix-embeddings-sa already exists"

# Helper to grant a role idempotently (suppress "already exists" noise)
grant_role() {
	local sa=$1 role=$2
	gcloud projects add-iam-policy-binding "$PROJECT_ID" \
		--member="serviceAccount:${sa}@${PROJECT_ID}.iam.gserviceaccount.com" \
		--role="$role" \
		--condition=None \
		--no-user-output-enabled 2>/dev/null || true
}

# ============================================
# Grant IAM Roles - Vitamix Recommender
# ============================================

echo "Granting IAM roles to vitamix-recommender-sa..."

grant_role vitamix-recommender-sa roles/datastore.user          # Firestore (sessions, analytics)
grant_role vitamix-recommender-sa roles/aiplatform.user          # Vertex AI (Gemini + Model Garden)
grant_role vitamix-recommender-sa roles/secretmanager.secretAccessor  # Secret Manager (DA_TOKEN)
grant_role vitamix-recommender-sa roles/storage.objectViewer     # Cloud Storage (media assets)
grant_role vitamix-recommender-sa roles/consumerprocurement.entitlementManager  # Model Garden open models (Llama)

# ============================================
# Grant IAM Roles - Vitamix Analytics
# ============================================

echo "Granting IAM roles to vitamix-analytics-sa..."

grant_role vitamix-analytics-sa roles/datastore.user     # Firestore
grant_role vitamix-analytics-sa roles/aiplatform.user     # Vertex AI (Gemini for analysis)

# ============================================
# Grant IAM Roles - Vitamix Embeddings
# ============================================

echo "Granting IAM roles to vitamix-embeddings-sa..."

grant_role vitamix-embeddings-sa roles/datastore.user     # Firestore (recipes + vectors)
grant_role vitamix-embeddings-sa roles/aiplatform.user     # Vertex AI (embeddings)
grant_role vitamix-embeddings-sa roles/storage.objectViewer # Cloud Storage (recipe JSONs)

# ============================================
# Grant Cloud Build SA permissions
# ============================================

echo "Granting Cloud Run deploy permissions to Cloud Build..."

CLOUDBUILD_SA="${PROJECT_ID}@cloudbuild.gserviceaccount.com"
grant_role "$PROJECT_ID" roles/run.admin 2>/dev/null || true
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
	--member="serviceAccount:${CLOUDBUILD_SA}" \
	--role="roles/run.admin" \
	--condition=None \
	--no-user-output-enabled 2>/dev/null || true

echo ""
echo "✅ Service accounts created and configured successfully!"
