#!/bin/bash
# Set up Secret Manager secrets for AEM Document Authoring credentials
# These are the ONLY secrets needed (no AI provider API keys)

set -e

PROJECT_ID=$(gcloud config get-value project)

if [ -z "$PROJECT_ID" ]; then
	echo "Error: No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"
	exit 1
fi

echo "Setting up Secret Manager secrets for AEM Document Authoring"
echo "Project: $PROJECT_ID"
echo ""

# Create DA_CLIENT_ID secret
echo "Creating DA_CLIENT_ID secret..."
echo "Please enter your Adobe IMS Client ID:"
read -r DA_CLIENT_ID

echo -n "$DA_CLIENT_ID" | gcloud secrets create DA_CLIENT_ID \
	--data-file=- \
	--replication-policy="automatic" \
	--labels=app=vitamix,component=aem-da \
	--project="$PROJECT_ID" 2>/dev/null || \
	echo -n "$DA_CLIENT_ID" | gcloud secrets versions add DA_CLIENT_ID \
	--data-file=- \
	--project="$PROJECT_ID"

# Create DA_CLIENT_SECRET secret
echo "Creating DA_CLIENT_SECRET secret..."
echo "Please enter your Adobe IMS Client Secret:"
read -rs DA_CLIENT_SECRET

echo -n "$DA_CLIENT_SECRET" | gcloud secrets create DA_CLIENT_SECRET \
	--data-file=- \
	--replication-policy="automatic" \
	--labels=app=vitamix,component=aem-da \
	--project="$PROJECT_ID" 2>/dev/null || \
	echo -n "$DA_CLIENT_SECRET" | gcloud secrets versions add DA_CLIENT_SECRET \
	--data-file=- \
	--project="$PROJECT_ID"

echo ""
echo "✅ Secrets created successfully!"
echo ""
echo "Secrets created:"
echo "  - DA_CLIENT_ID (with label app=vitamix)"
echo "  - DA_CLIENT_SECRET (with label app=vitamix)"
echo ""
echo "These secrets are accessible by vitamix-recommender-sa service account."
echo ""
echo "Next steps:"
echo "1. Run ./setup-firestore.sh to initialize Firestore database"
