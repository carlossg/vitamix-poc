#!/bin/bash
# Create service accounts with vitamix labels for all components
# Run after enable-apis.sh

set -e

PROJECT_ID=$(gcloud config get-value project)

if [ -z "$PROJECT_ID" ]; then
	echo "Error: No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"
	exit 1
fi

echo "Creating service accounts for project: $PROJECT_ID"
echo ""

# Create service account for vitamix-recommender
echo "Creating vitamix-recommender-sa..."
gcloud iam service-accounts create vitamix-recommender-sa \
	--display-name="Vitamix Recommender Service" \
	--description="Service account for Vitamix AI recommender Cloud Run service" \
	--project="$PROJECT_ID" || echo "Service account already exists"

# Create service account for vitamix-analytics
echo "Creating vitamix-analytics-sa..."
gcloud iam service-accounts create vitamix-analytics-sa \
	--display-name="Vitamix Analytics Service" \
	--description="Service account for Vitamix analytics Cloud Function" \
	--project="$PROJECT_ID" || echo "Service account already exists"

# Create service account for vitamix-embeddings
echo "Creating vitamix-embeddings-sa..."
gcloud iam service-accounts create vitamix-embeddings-sa \
	--display-name="Vitamix Embeddings Service" \
	--description="Service account for Vitamix recipe embeddings Cloud Function" \
	--project="$PROJECT_ID" || echo "Service account already exists"

echo ""
echo "Granting IAM roles to service accounts..."
echo ""

# Grant Firestore access to all services
for sa in vitamix-recommender-sa vitamix-analytics-sa vitamix-embeddings-sa; do
	echo "Granting Firestore access to $sa..."
	gcloud projects add-iam-policy-binding "$PROJECT_ID" \
		--member="serviceAccount:$sa@$PROJECT_ID.iam.gserviceaccount.com" \
		--role="roles/datastore.user" \
		--condition=None
done

# Grant Vertex AI access (for Gemini + Model Garden)
for sa in vitamix-recommender-sa vitamix-embeddings-sa; do
	echo "Granting Vertex AI access to $sa..."
	gcloud projects add-iam-policy-binding "$PROJECT_ID" \
		--member="serviceAccount:$sa@$PROJECT_ID.iam.gserviceaccount.com" \
		--role="roles/aiplatform.user" \
		--condition=None
done

# Grant Secret Manager access (for AEM DA credentials only)
echo "Granting Secret Manager access to vitamix-recommender-sa..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
	--member="serviceAccount:vitamix-recommender-sa@$PROJECT_ID.iam.gserviceaccount.com" \
	--role="roles/secretmanager.secretAccessor" \
	--condition=None

# Grant Cloud Storage access
for sa in vitamix-recommender-sa vitamix-embeddings-sa; do
	echo "Granting Cloud Storage access to $sa..."
	gcloud projects add-iam-policy-binding "$PROJECT_ID" \
		--member="serviceAccount:$sa@$PROJECT_ID.iam.gserviceaccount.com" \
		--role="roles/storage.objectAdmin" \
		--condition=None
done

# Grant Cloud Logging write access
for sa in vitamix-recommender-sa vitamix-analytics-sa vitamix-embeddings-sa; do
	echo "Granting Cloud Logging access to $sa..."
	gcloud projects add-iam-policy-binding "$PROJECT_ID" \
		--member="serviceAccount:$sa@$PROJECT_ID.iam.gserviceaccount.com" \
		--role="roles/logging.logWriter" \
		--condition=None
done

echo ""
echo "✅ Service accounts created and configured successfully!"
echo ""
echo "Service accounts:"
echo "  - vitamix-recommender-sa@$PROJECT_ID.iam.gserviceaccount.com"
echo "  - vitamix-analytics-sa@$PROJECT_ID.iam.gserviceaccount.com"
echo "  - vitamix-embeddings-sa@$PROJECT_ID.iam.gserviceaccount.com"
echo ""
echo "Next steps:"
echo "1. Run ./setup-secrets.sh to configure AEM DA credentials"
echo "2. Run ./setup-firestore.sh to initialize Firestore"
