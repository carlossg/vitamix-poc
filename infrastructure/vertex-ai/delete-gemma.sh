#!/bin/bash
# Delete a Gemma 3 Vertex AI Endpoint and its deployed model
#
# Usage:
#   ./delete-gemma.sh <endpoint-id>        # Delete specific endpoint
#   ./delete-gemma.sh                       # List active endpoints, then prompt
#
# This script:
#   1. Undeploys all models from the endpoint
#   2. Deletes the endpoint
#   3. Deletes the uploaded model from the Model Registry
#   4. Reminds you to unset GEMMA_ENDPOINT_ID from Cloud Run

set -euo pipefail

# ============================================
# Configuration
# ============================================

ENDPOINT_ID="${1:-${GEMMA_ENDPOINT_ID:-}}"
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
LOCATION="${GCP_LOCATION:-us-central1}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GCP_PROJECT_ID not set and no default project configured."
  echo "  Run: export GCP_PROJECT_ID='your-project-id'"
  exit 1
fi

# ============================================
# If no endpoint ID provided, list active ones
# ============================================

if [ -z "$ENDPOINT_ID" ]; then
  echo "No endpoint ID provided. Listing active Vitamix Gemma endpoints..."
  echo ""

  ENDPOINTS=$(gcloud ai endpoints list \
    --region="$LOCATION" \
    --project="$PROJECT_ID" \
    --filter="labels.app=vitamix AND labels.component=gemma" \
    --format="table(name.segment(-1), displayName, createTime.date())" \
    2>/dev/null)

  if [ -z "$ENDPOINTS" ] || echo "$ENDPOINTS" | grep -q "Listed 0 items"; then
    echo "No active Gemma endpoints found."
    exit 0
  fi

  echo "$ENDPOINTS"
  echo ""
  read -p "Enter endpoint ID to delete (or Ctrl+C to cancel): " ENDPOINT_ID

  if [ -z "$ENDPOINT_ID" ]; then
    echo "No endpoint ID provided. Exiting."
    exit 0
  fi
fi

echo ""
echo "Deleting Vertex AI Endpoint: $ENDPOINT_ID"
echo "==========================================="
echo "  Project:  $PROJECT_ID"
echo "  Location: $LOCATION"
echo ""

read -p "Are you sure? This cannot be undone. (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# ============================================
# Step 1: List deployed models
# ============================================

echo ""
echo "Step 1/3: Finding deployed models..."

DEPLOYED_MODELS=$(gcloud ai endpoints describe "$ENDPOINT_ID" \
  --region="$LOCATION" \
  --project="$PROJECT_ID" \
  --format="value(deployedModels.id)" \
  2>/dev/null || echo "")

# Also capture model resource names for cleanup
MODEL_NAMES=$(gcloud ai endpoints describe "$ENDPOINT_ID" \
  --region="$LOCATION" \
  --project="$PROJECT_ID" \
  --format="value(deployedModels.model)" \
  2>/dev/null || echo "")

if [ -z "$DEPLOYED_MODELS" ]; then
  echo "  No deployed models found (endpoint may already be empty)."
else
  echo "  Found deployed model(s): $DEPLOYED_MODELS"
fi

# ============================================
# Step 2: Undeploy all models and delete endpoint
# ============================================

echo ""
echo "Step 2/3: Undeploying models and deleting endpoint..."

if [ -n "$DEPLOYED_MODELS" ]; then
  for DEPLOYED_ID in $DEPLOYED_MODELS; do
    echo "  Undeploying model: $DEPLOYED_ID"
    gcloud ai endpoints undeploy-model "$ENDPOINT_ID" \
      --region="$LOCATION" \
      --project="$PROJECT_ID" \
      --deployed-model-id="$DEPLOYED_ID" \
      --quiet \
      2>/dev/null || echo "  Warning: undeploy failed for $DEPLOYED_ID (may already be removed)"
  done
fi

echo "  Deleting endpoint: $ENDPOINT_ID"
gcloud ai endpoints delete "$ENDPOINT_ID" \
  --region="$LOCATION" \
  --project="$PROJECT_ID" \
  --quiet

echo "  Endpoint deleted."

# ============================================
# Step 3: Delete uploaded model(s) from registry
# ============================================

echo ""
echo "Step 3/3: Cleaning up model registry..."

if [ -n "$MODEL_NAMES" ]; then
  for MODEL_NAME in $MODEL_NAMES; do
    # Extract just the model ID from the full resource path
    MODEL_ID=$(echo "$MODEL_NAME" | grep -oP '\d+$' || echo "")
    if [ -n "$MODEL_ID" ]; then
      echo "  Deleting model: $MODEL_ID"
      gcloud ai models delete "$MODEL_ID" \
        --region="$LOCATION" \
        --project="$PROJECT_ID" \
        --quiet \
        2>/dev/null || echo "  Warning: model delete failed for $MODEL_ID (may already be removed)"
    fi
  done
else
  echo "  No models to clean up."
fi

# ============================================
# Summary
# ============================================

echo ""
echo "==========================================="
echo "Endpoint $ENDPOINT_ID deleted successfully."
echo "==========================================="
echo ""
echo "Don't forget to unset the endpoint ID from Cloud Run:"
echo ""
echo "  gcloud run services update vitamix-recommender \\"
echo "    --region=$LOCATION \\"
echo "    --project=$PROJECT_ID \\"
echo "    --remove-env-vars=GEMMA_ENDPOINT_ID"
echo ""
echo "Gemma presets (gemma-3-4b, gemma-3-12b) will return an error"
echo "until a new endpoint is deployed with deploy-gemma.sh."
echo ""
