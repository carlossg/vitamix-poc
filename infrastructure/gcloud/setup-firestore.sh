#!/bin/bash
# Initialize Firestore database in Native mode
# Must be run before deploying services

set -e

PROJECT_ID=$(gcloud config get-value project)

if [ -z "$PROJECT_ID" ]; then
	echo "Error: No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"
	exit 1
fi

echo "Initializing Firestore for project: $PROJECT_ID"
echo ""

# Check if Firestore is already enabled
if gcloud firestore databases describe --project="$PROJECT_ID" 2>/dev/null; then
	echo "✅ Firestore database already exists"
else
	echo "Creating Firestore database in Native mode..."
	echo "Location: us-central1 (choose your preferred region if different)"
	
	gcloud firestore databases create \
		--location=us-central1 \
		--type=firestore-native \
		--project="$PROJECT_ID"
	
	echo "✅ Firestore database created successfully!"
fi

echo ""
echo "Creating Firestore indexes..."
echo ""

# Deploy indexes from indexes.json
if [ -f "../firestore/indexes.json" ]; then
	gcloud firestore indexes composite create \
		--field-config=../firestore/indexes.json \
		--project="$PROJECT_ID" || echo "Some indexes may already exist"
else
	echo "Warning: firestore/indexes.json not found. Skipping index creation."
	echo "Run this script again after creating the indexes.json file."
fi

echo ""
echo "Creating Cloud Storage bucket for media assets..."
BUCKET_NAME="${PROJECT_ID}-vitamix-media"

gsutil mb -p "$PROJECT_ID" -c STANDARD -l us-central1 "gs://$BUCKET_NAME" 2>/dev/null || \
	echo "Bucket already exists"

# Add labels to bucket
gsutil label ch -l app:vitamix -l component:media "gs://$BUCKET_NAME"

# Set CORS policy for AEM domains
cat > /tmp/cors.json <<EOF
[
	{
		"origin": ["https://*.aem.page", "https://*.aem.live", "http://localhost:3000"],
		"method": ["GET", "HEAD"],
		"responseHeader": ["Content-Type"],
		"maxAgeSeconds": 3600
	}
]
EOF

gsutil cors set /tmp/cors.json "gs://$BUCKET_NAME"
rm /tmp/cors.json

echo ""
echo "✅ Firestore and Cloud Storage configured successfully!"
echo ""
echo "Resources created:"
echo "  - Firestore database (Native mode, us-central1)"
echo "  - Cloud Storage bucket: gs://$BUCKET_NAME"
echo ""
echo "Next steps:"
echo "1. Build and deploy Cloud Run services"
echo "2. Deploy Cloud Functions"
