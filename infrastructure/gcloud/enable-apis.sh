#!/bin/bash
# Enable required Google Cloud APIs for Vitamix POC
# Run this script after setting your GCP project with: gcloud config set project YOUR_PROJECT_ID

set -e

PROJECT_ID=$(gcloud config get-value project)

if [ -z "$PROJECT_ID" ]; then
	echo "Error: No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"
	exit 1
fi

echo "Enabling APIs for project: $PROJECT_ID"

# Enable required APIs
apis=(
	"run.googleapis.com"                    # Cloud Run
	"cloudfunctions.googleapis.com"         # Cloud Functions gen2
	"firestore.googleapis.com"              # Firestore Native
	"aiplatform.googleapis.com"             # Vertex AI for Gemini + Model Garden
	"cloudbuild.googleapis.com"             # CI/CD
	"logging.googleapis.com"                # Cloud Logging
	"monitoring.googleapis.com"             # Cloud Monitoring
	"secretmanager.googleapis.com"          # Secret Manager (for AEM DA only)
	"storage.googleapis.com"                # Cloud Storage
	"artifactregistry.googleapis.com"       # Artifact Registry for containers
	"cloudresourcemanager.googleapis.com"   # Resource Manager
)

for api in "${apis[@]}"; do
	echo "Enabling $api..."
	gcloud services enable "$api" --project="$PROJECT_ID"
done

echo ""
echo "✅ All required APIs enabled successfully!"
echo ""
echo "Next steps:"
echo "1. Run ./create-service-accounts.sh to set up service accounts"
echo "2. Run ./setup-secrets.sh to configure AEM DA credentials"
