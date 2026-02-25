#!/bin/bash
# Deploy Gemma 3 model to a Vertex AI Endpoint with L4 GPU
#
# Usage:
#   ./deploy-gemma.sh 4b     # Deploy Gemma 3 4B IT
#   ./deploy-gemma.sh 12b    # Deploy Gemma 3 12B IT
#
# Prerequisites:
#   - gcloud CLI authenticated with sufficient permissions
#   - Vertex AI API enabled
#   - Sufficient L4 GPU quota in the target region
#
# Cost: ~$0.84/hr (~$20/day) while the endpoint is running.
#        Vertex AI endpoints do NOT scale to zero.
#        Run delete-gemma.sh when done to avoid surprise bills.

set -euo pipefail

# ============================================
# Configuration
# ============================================

MODEL_SIZE="${1:-}"
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
LOCATION="${GCP_LOCATION:-us-central1}"

if [ -z "$MODEL_SIZE" ] || [[ ! "$MODEL_SIZE" =~ ^(4b|12b)$ ]]; then
  echo "Usage: $0 <4b|12b>"
  echo ""
  echo "  4b  - Gemma 3 4B IT  (lighter, faster)"
  echo "  12b - Gemma 3 12B IT (heavier, better quality)"
  exit 1
fi

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GCP_PROJECT_ID not set and no default project configured."
  echo "  Run: export GCP_PROJECT_ID='your-project-id'"
  exit 1
fi

# Model-specific configuration
case "$MODEL_SIZE" in
  4b)
    MODEL_ID="google/gemma-3-4b-it"
    DISPLAY_NAME="gemma-3-4b-it"
    ;;
  12b)
    MODEL_ID="google/gemma-3-12b-it"
    DISPLAY_NAME="gemma-3-12b-it"
    ;;
esac

ENDPOINT_DISPLAY_NAME="vitamix-gemma-3-${MODEL_SIZE}"
MACHINE_TYPE="g2-standard-8"
ACCELERATOR_TYPE="NVIDIA_L4"
ACCELERATOR_COUNT=1
VLLM_IMAGE="us-docker.pkg.dev/vertex-ai/vertex-vision-model-garden-dockers/pytorch-vllm-serve:20241015_0916_RC00"

echo "Deploying Gemma 3 ${MODEL_SIZE} to Vertex AI Endpoint"
echo "======================================================="
echo ""
echo "  Project:      $PROJECT_ID"
echo "  Location:     $LOCATION"
echo "  Model:        $DISPLAY_NAME"
echo "  Machine:      $MACHINE_TYPE + ${ACCELERATOR_COUNT}x $ACCELERATOR_TYPE"
echo "  Container:    vLLM (pytorch-vllm-serve)"
echo ""
echo "  WARNING: This endpoint costs ~\$0.84/hr (~\$20/day)."
echo "  It does NOT scale to zero. Run delete-gemma.sh when done."
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# ============================================
# Step 1: Upload model to Vertex AI
# ============================================

echo ""
echo "Step 1/3: Uploading model to Vertex AI Model Registry..."

MODEL_RESOURCE=$(gcloud ai models upload \
  --region="$LOCATION" \
  --project="$PROJECT_ID" \
  --display-name="$DISPLAY_NAME" \
  --container-image-uri="$VLLM_IMAGE" \
  --container-args="--model=$MODEL_ID,--tensor-parallel-size=$ACCELERATOR_COUNT,--swap-space=16,--gpu-memory-utilization=0.95,--max-model-len=8192,--disable-log-stats" \
  --container-ports=8000 \
  --container-health-route="/health" \
  --container-predict-route="/v1/chat/completions" \
  --labels="app=vitamix,component=gemma,model-size=${MODEL_SIZE}" \
  --format="value(model)" \
  2>&1)

# Extract model resource name (projects/.../models/...)
MODEL_NAME=$(echo "$MODEL_RESOURCE" | grep -oP 'projects/[^ ]+' | head -1)

if [ -z "$MODEL_NAME" ]; then
  echo "Error: Failed to upload model."
  echo "$MODEL_RESOURCE"
  exit 1
fi

echo "  Model uploaded: $MODEL_NAME"

# ============================================
# Step 2: Create endpoint
# ============================================

echo ""
echo "Step 2/3: Creating Vertex AI endpoint..."

ENDPOINT_RESOURCE=$(gcloud ai endpoints create \
  --region="$LOCATION" \
  --project="$PROJECT_ID" \
  --display-name="$ENDPOINT_DISPLAY_NAME" \
  --labels="app=vitamix,component=gemma,model-size=${MODEL_SIZE}" \
  --format="value(name)" \
  2>&1)

# Extract endpoint ID from the resource name
ENDPOINT_ID=$(echo "$ENDPOINT_RESOURCE" | grep -oP '\d+$' | head -1)

if [ -z "$ENDPOINT_ID" ]; then
  echo "Error: Failed to create endpoint."
  echo "$ENDPOINT_RESOURCE"
  exit 1
fi

echo "  Endpoint created: $ENDPOINT_ID"

# ============================================
# Step 3: Deploy model to endpoint
# ============================================

echo ""
echo "Step 3/3: Deploying model to endpoint (this may take 10-15 minutes)..."

gcloud ai endpoints deploy-model "$ENDPOINT_ID" \
  --region="$LOCATION" \
  --project="$PROJECT_ID" \
  --model="$MODEL_NAME" \
  --display-name="${DISPLAY_NAME}-deployed" \
  --machine-type="$MACHINE_TYPE" \
  --accelerator=type="$ACCELERATOR_TYPE",count="$ACCELERATOR_COUNT" \
  --min-replica-count=1 \
  --max-replica-count=1

echo ""
echo "======================================================="
echo "Deployment complete!"
echo "======================================================="
echo ""
echo "  Endpoint ID:   $ENDPOINT_ID"
echo "  Model:         $DISPLAY_NAME"
echo "  Region:        $LOCATION"
echo "  Cost:          ~\$0.84/hr (~\$20/day)"
echo ""
echo "Set the endpoint ID on your Cloud Run service:"
echo ""
echo "  gcloud run services update vitamix-recommender \\"
echo "    --region=$LOCATION \\"
echo "    --project=$PROJECT_ID \\"
echo "    --set-env-vars=GEMMA_ENDPOINT_ID=$ENDPOINT_ID"
echo ""
echo "Then use preset=gemma-3-${MODEL_SIZE} in your queries:"
echo ""
echo "  curl -N 'https://vitamix-recommender-.../generate?q=best+blender&preset=gemma-3-${MODEL_SIZE}'"
echo ""
echo "IMPORTANT: Run delete-gemma.sh when done to stop billing:"
echo ""
echo "  ./delete-gemma.sh $ENDPOINT_ID"
echo ""
