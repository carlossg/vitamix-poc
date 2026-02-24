#!/bin/bash
# Vertex AI Model Garden Setup for Vitamix POC
# Configures Llama 3.3 70B and Mistral Large for content generation

set -e

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
LOCATION="${GCP_LOCATION:-us-central1}"

echo "Setting up Vertex AI Model Garden in project: $PROJECT_ID"
echo "Location: $LOCATION"

# ============================================
# Enable Required APIs
# ============================================

echo "Enabling required APIs..."

gcloud services enable aiplatform.googleapis.com \
	--project="$PROJECT_ID"

echo "✅ APIs enabled"

# ============================================
# Check Available Model Garden Models
# ============================================

echo ""
echo "Checking available Model Garden models..."

# Llama 3.3 70B (Meta)
LLAMA_MODEL="llama-3-3-70b-instruct-maas"
echo "Checking for $LLAMA_MODEL..."

gcloud ai models list \
	--region="$LOCATION" \
	--filter="displayName:llama" \
	--project="$PROJECT_ID" \
	|| echo "  Note: Llama models require Model Garden access"

# Mistral Large
MISTRAL_MODEL="mistral-large-2411"
echo "Checking for $MISTRAL_MODEL..."

gcloud ai models list \
	--region="$LOCATION" \
	--filter="displayName:mistral" \
	--project="$PROJECT_ID" \
	|| echo "  Note: Mistral models require Model Garden access"

# ============================================
# Model Garden Access Information
# ============================================

echo ""
echo "ℹ️  Model Garden Access:"
echo ""
echo "To use Llama 3.3 70B and Mistral Large from Vertex AI Model Garden:"
echo ""
echo "1. Visit: https://console.cloud.google.com/vertex-ai/model-garden"
echo "2. Search for 'Llama 3.3 70B' and 'Mistral Large'"
echo "3. Click 'Enable' or 'Deploy' for each model"
echo "4. Accept the terms and conditions"
echo "5. Models will be available via Vertex AI API endpoints"
echo ""
echo "Model Garden models are available on-demand (no deployment needed) at:"
echo "  - Llama 3.3: projects/$PROJECT_ID/locations/$LOCATION/publishers/meta/models/llama-3-3-70b-instruct-maas"
echo "  - Mistral: projects/$PROJECT_ID/locations/$LOCATION/publishers/mistralai/models/mistral-large-2411"
echo ""

# ============================================
# Test Model Availability
# ============================================

echo "To test model availability, try this gcloud command:"
echo ""
echo "gcloud ai endpoints list \\"
echo "  --region=$LOCATION \\"
echo "  --project=$PROJECT_ID \\"
echo "  --filter='displayName:llama OR displayName:mistral'"
echo ""

# ============================================
# Configuration Summary
# ============================================

echo "✅ Model Garden configuration complete!"
echo ""
echo "Models configured:"
echo "  - Llama 3.3 70B (Content generation - primary)"
echo "  - Mistral Large (Content generation - fallback)"
echo ""
echo "These models will be used by vitamix-recommender with passwordless auth."
echo ""
echo "Next steps:"
echo "1. Test model access with the vitamix-recommender-sa service account"
echo "2. Deploy Cloud Run service with MODEL_PRESET=production"
echo "3. Monitor token usage in Cloud Console"
