#!/bin/bash
# Vitamix POC - Complete Deployment Script
# Deploys all services to Google Cloud with vitamix labels

set -e

echo "🚀 Vitamix POC - Google Cloud Deployment"
echo "========================================="
echo ""

# ============================================
# Configuration
# ============================================

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
LOCATION="${GCP_LOCATION:-us-central1}"
ENVIRONMENT="${DEPLOY_ENV:-staging}"

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: GCP_PROJECT_ID not set"
  echo "   Run: export GCP_PROJECT_ID='your-project-id'"
  exit 1
fi

echo "Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Location: $LOCATION"
echo "  Environment: $ENVIRONMENT"
echo ""

# Check if recipe data exists for later steps
RECIPE_COUNT=0
if [ -f "content/recipes/recipes.json" ]; then
	RECIPE_COUNT=$(grep -o '"id"' content/recipes/recipes.json | wc -l | tr -d ' ')
	echo "  Recipe data: ✓ Found ${RECIPE_COUNT} recipes"
else
	echo "  Recipe data: ⚠️  Not found (will skip RAG population)"
fi
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled"
  exit 0
fi

# ============================================
# Step 0: Enable Required APIs
# ============================================

echo ""
echo "Step 0/11: Enabling required Google Cloud APIs..."

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudfunctions.googleapis.com \
  eventarc.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  cloudcommerceconsumerprocurement.googleapis.com \
  --project="$PROJECT_ID" --quiet 2>/dev/null
echo "✓ APIs enabled"

# ============================================
# Step 1: Service Accounts & IAM
# ============================================

echo ""
echo "Step 1/11: Setting up service accounts and IAM..."

cd infrastructure/cloudrun
chmod +x setup-service-accounts.sh
./setup-service-accounts.sh
cd ../..

# ============================================
# Step 2: Firestore Setup
# ============================================

echo ""
echo "Step 2/11: Setting up Firestore..."

# Check if Firestore database exists
if ! gcloud firestore databases list --project=$PROJECT_ID 2>/dev/null | grep -q "default"; then
  echo "Creating Firestore database..."
  gcloud firestore databases create \
    --location=$LOCATION \
    --project=$PROJECT_ID \
    --type=firestore-native
fi

# Deploy indexes
if [ -f "infrastructure/firestore/indexes.json" ]; then
  echo "Deploying Firestore indexes..."
  gcloud firestore indexes composite create \
    --project="$PROJECT_ID" \
    --field-config="$(cat infrastructure/firestore/indexes.json)" \
    2>/dev/null || echo "  Indexes already exist or deployment failed"
fi

# ============================================
# Step 3: Cloud Storage
# ============================================

echo ""
echo "Step 3/11: Setting up Cloud Storage..."

BUCKET_NAME="${PROJECT_ID}-vitamix-media"

if ! gsutil ls -p "$PROJECT_ID" | grep -q "gs://${BUCKET_NAME}/"; then
  echo "Creating Cloud Storage bucket..."
  gsutil mb -p "$PROJECT_ID" -l "$LOCATION" -b on "gs://${BUCKET_NAME}"
  gsutil label ch -l app:vitamix -l component:media "gs://${BUCKET_NAME}"
fi

# ============================================
# Step 4: Secrets
# ============================================

echo ""
echo "Step 4/11: Setting up secrets..."

# DA_TOKEN: IMS Bearer token for AEM Document Authoring (required for persist)
if ! gcloud secrets describe DA_TOKEN --project=$PROJECT_ID &>/dev/null; then
  echo "Creating DA_TOKEN secret with placeholder..."
  echo -n 'placeholder_da_token' | gcloud secrets create DA_TOKEN \
    --data-file=- \
    --labels=app=vitamix \
    --project=$PROJECT_ID \
    --quiet
  echo "⚠️  Set real token: echo -n 'YOUR_IMS_TOKEN' | gcloud secrets versions add DA_TOKEN --data-file=- --project=$PROJECT_ID"
else
  echo "✓ DA_TOKEN secret exists"
fi

# Grant Cloud Run SA access to DA_TOKEN
gcloud secrets add-iam-policy-binding DA_TOKEN \
  --member="serviceAccount:vitamix-recommender-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID --quiet 2>/dev/null || true
echo "✓ Secret access granted to recommender SA"

# ============================================
# Step 5: Vertex AI Model Garden
# ============================================

echo ""
echo "Step 5/11: Checking Vertex AI Model Garden..."
cd infrastructure/vertex-ai
chmod +x setup-model-garden.sh
./setup-model-garden.sh
cd ../..

# ============================================
# Step 6: Build & Deploy to Cloud Run
# ============================================

echo ""
echo "Step 6/11: Building and deploying Cloud Run service..."

# Generate a unique build tag from timestamp
BUILD_TAG="v$(date +%Y%m%d-%H%M%S)"
echo "Using build tag: $BUILD_TAG"

# Build Docker image and deploy to Cloud Run in one step
# This handles: Docker build, push to GCR, and Cloud Run deployment
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_REGION=$LOCATION,_ENVIRONMENT=$ENVIRONMENT,_MODEL_PRESET=production,_BUILD_TAG=$BUILD_TAG \
  --project=$PROJECT_ID \
  --timeout=20m

# Get service URL
CLOUD_RUN_URL=$(gcloud run services describe vitamix-recommender \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

echo "✓ Cloud Run service deployed: $CLOUD_RUN_URL"

# ============================================
# Step 7: Verify Cloud Run Deployment
# ============================================

echo ""
echo "Step 7/11: Verifying Cloud Run deployment..."

# Wait a moment for service to be ready
sleep 5

# Check service status
SERVICE_STATUS=$(gcloud run services describe vitamix-recommender \
  --region=$LOCATION \
  --project=$PROJECT_ID \
  --format='value(status.conditions[0].status)')

if [ "$SERVICE_STATUS" = "True" ]; then
  echo "✓ Cloud Run service is ready"
else
  echo "⚠️  Cloud Run service may not be fully ready yet"
  echo "   Check logs: gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=vitamix-recommender' --limit=20 --project=$PROJECT_ID"
fi

# ============================================
# Step 7b (Optional): Deploy Gemma Endpoint
# ============================================

echo ""
echo "Step 7b/11: Gemma Vertex AI Endpoint (optional)..."
echo "  Gemma 3 models require a dedicated GPU endpoint (~\$0.84/hr)."

read -p "  Deploy a Gemma endpoint? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  read -p "  Which model size? (4b/12b) " GEMMA_SIZE
  if [[ "$GEMMA_SIZE" =~ ^(4b|12b)$ ]]; then
    cd infrastructure/vertex-ai
    chmod +x deploy-gemma.sh
    ./deploy-gemma.sh "$GEMMA_SIZE"
    cd ../..
  else
    echo "  Skipping - invalid size (must be 4b or 12b)."
  fi
else
  echo "  Skipping Gemma deployment."
  echo "  You can deploy later: ./infrastructure/vertex-ai/deploy-gemma.sh 4b|12b"
fi

# ============================================
# Step 8: Deploy Cloud Functions
# ============================================

echo ""
echo "Step 8/11: Deploying Cloud Functions..."

# Analytics function
echo "Deploying analytics function..."
cd functions/analytics
npm install --silent
gcloud functions deploy trackEvent \
  --gen2 \
  --runtime=nodejs20 \
  --region=$LOCATION \
  --source=. \
  --entry-point=trackEvent \
  --trigger-http \
  --allow-unauthenticated \
  --service-account=vitamix-analytics-sa@${PROJECT_ID}.iam.gserviceaccount.com \
  --update-labels=app=vitamix,component=analytics,environment=$ENVIRONMENT \
  --project=$PROJECT_ID \
  --quiet

cd ../embeddings
echo "Deploying embeddings functions..."
npm install --silent

# Deploy search function
gcloud functions deploy searchRecipes \
  --gen2 \
  --runtime=nodejs20 \
  --region=$LOCATION \
  --source=. \
  --entry-point=searchRecipes \
  --trigger-http \
  --allow-unauthenticated \
  --service-account=vitamix-embeddings-sa@${PROJECT_ID}.iam.gserviceaccount.com \
  --update-labels=app=vitamix,component=embeddings,environment=$ENVIRONMENT \
  --project=$PROJECT_ID \
  --quiet

# Deploy embedding generation function (for manual trigger)
gcloud functions deploy generateRecipeEmbeddings \
  --gen2 \
  --runtime=nodejs20 \
  --region=$LOCATION \
  --source=. \
  --entry-point=generateRecipeEmbeddings \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=512MB \
  --service-account=vitamix-embeddings-sa@${PROJECT_ID}.iam.gserviceaccount.com \
  --update-labels=app=vitamix,component=embeddings,environment=$ENVIRONMENT \
  --project=$PROJECT_ID \
  --quiet

# Deploy storage trigger function (for automatic embedding on upload)
gcloud functions deploy onRecipeUpload \
  --gen2 \
  --runtime=nodejs20 \
  --region=$LOCATION \
  --source=. \
  --entry-point=onRecipeUpload \
  --trigger-event-filters="type=google.cloud.storage.object.v1.finalized" \
  --trigger-event-filters="bucket=${BUCKET_NAME}" \
  --service-account=vitamix-embeddings-sa@${PROJECT_ID}.iam.gserviceaccount.com \
  --update-labels=app=vitamix,component=embeddings,environment=$ENVIRONMENT \
  --project=$PROJECT_ID \
  --quiet

cd ../..

# ============================================
# Step 9: Populate RAG with Recipe Data
# ============================================

echo ""
echo "Step 9/11: Populating RAG with recipe data..."

# Check if recipe data exists
if [ -f "content/recipes/recipes.json" ]; then
	echo "Found recipe data, uploading to Cloud Storage..."
	
	# Upload recipes to Cloud Storage (this will trigger embedding generation)
	gsutil -m cp content/recipes/*.json gs://${BUCKET_NAME}/recipes/ 2>/dev/null || echo "  Upload completed with warnings"
	
	# Wait a moment for the storage trigger to fire
	echo "Waiting for automatic embedding generation to start..."
	sleep 5
	
	# Also manually trigger embedding generation to ensure all recipes are processed
	EMBEDDINGS_URL="https://${LOCATION}-${PROJECT_ID}.cloudfunctions.net/generateRecipeEmbeddings"
	echo "Triggering manual embedding generation..."
	EMBED_RESPONSE=$(curl -s -X POST $EMBEDDINGS_URL -m 60 2>/dev/null || echo '{"error":"timeout or not available"}')
	
	if echo $EMBED_RESPONSE | grep -q "success"; then
		echo "✓ Recipe embeddings generated successfully"
		echo "  Response: $EMBED_RESPONSE"
	else
		echo "⚠️  Embedding generation in progress or failed"
		echo "  Response: $EMBED_RESPONSE"
		echo "  Check function logs: gcloud functions logs read generateRecipeEmbeddings --region=$LOCATION --limit=20 --project=$PROJECT_ID"
	fi
	
	# Verify vector search is working
	SEARCH_URL="https://${LOCATION}-${PROJECT_ID}.cloudfunctions.net/searchRecipes"
	echo "Testing vector search..."
	SEARCH_RESPONSE=$(curl -s "${SEARCH_URL}?q=smoothie&limit=3" 2>/dev/null || echo "failed")
	
	if echo $SEARCH_RESPONSE | grep -q "results"; then
		echo "✓ Vector search is working"
		RESULT_COUNT=$(echo $SEARCH_RESPONSE | grep -o '"count":[0-9]*' | cut -d':' -f2)
		echo "  Found ${RESULT_COUNT:-0} recipes for 'smoothie' query"
	else
		echo "⚠️  Vector search test failed (embeddings may still be generating)"
		echo "  This is normal for first deployment - embeddings take a few minutes"
	fi
else
	echo "⚠️  No recipe data found at content/recipes/recipes.json"
	echo "  Skipping recipe upload. You can manually upload later:"
	echo "  gsutil -m cp content/recipes/*.json gs://${BUCKET_NAME}/recipes/"
fi

# ============================================
# Step 10: Setup Monitoring
# ============================================

echo ""
echo "Step 10/11: Setting up monitoring..."
cd infrastructure/monitoring
chmod +x setup-monitoring.sh
./setup-monitoring.sh 2>/dev/null || echo "  Monitoring setup completed with warnings"
cd ../..

# ============================================
# Step 11: Verify Deployment
# ============================================

echo ""
echo "Step 11/11: Verifying deployment..."

# Test Cloud Run health
echo "Testing Cloud Run health endpoint..."
HEALTH_RESPONSE=$(curl -s -f $CLOUD_RUN_URL/health 2>/dev/null || echo "failed")
if echo $HEALTH_RESPONSE | grep -q "ok"; then
  echo "✓ Cloud Run health check passed"
  echo "  Response: $HEALTH_RESPONSE"
else
  echo "⚠️  Cloud Run health check failed"
  echo "  Response: $HEALTH_RESPONSE"
  echo "  Check logs: gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=vitamix-recommender' --limit=20 --project=$PROJECT_ID"
fi

# Test analytics function
ANALYTICS_URL="https://${LOCATION}-${PROJECT_ID}.cloudfunctions.net/trackEvent"
echo "Testing analytics function..."
ANALYTICS_RESPONSE=$(curl -s -f -X POST $ANALYTICS_URL \
  -H "Content-Type: application/json" \
  -d '{"type":"query","sessionId":"test","timestamp":1234567890,"data":{}}' 2>/dev/null || echo "failed")

if echo $ANALYTICS_RESPONSE | grep -q -E "(success|ok)"; then
  echo "✓ Analytics function working"
else
  echo "⚠️  Analytics function test failed (this is expected if Cloud Functions aren't deployed yet)"
fi

# ============================================
# Summary
# ============================================

echo ""
echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
echo ""
echo "Services deployed:"
echo "  - Cloud Run (vitamix-recommender): $CLOUD_RUN_URL"
echo "  - Analytics Function: $ANALYTICS_URL"
echo "  - Embeddings Function: https://${LOCATION}-${PROJECT_ID}.cloudfunctions.net/searchRecipes"
echo ""
echo "Container Image:"
echo "  - GCR: gcr.io/${PROJECT_ID}/vitamix-recommender:${BUILD_TAG}"
echo "  - Latest: gcr.io/${PROJECT_ID}/vitamix-recommender:latest"
echo ""
echo "Next steps:"
echo "1. Update frontend: set RECOMMENDER_URL in scripts/api-config.js to: $CLOUD_RUN_URL"
echo "2. Test presets:"
echo "   curl -N '${CLOUD_RUN_URL}/generate?query=best+blender+for+smoothies&preset=production'  # Gemini 3 Pro+Flash (~75s)"
echo "   curl -N '${CLOUD_RUN_URL}/generate?query=best+blender+for+smoothies&preset=gemini-2.0'  # Fastest (~23s)"
echo "   curl -N '${CLOUD_RUN_URL}/generate?query=best+blender+for+smoothies&preset=llama'       # Llama 3.3 70B (requires Model Garden enable)"
echo "3. Set DA token for page persist (IMS Bearer token, expires ~24h):"
echo "   echo -n 'YOUR_IMS_TOKEN' | gcloud secrets versions add DA_TOKEN --data-file=- --project=$PROJECT_ID"
echo "4. Enable Llama 3.3 (optional):"
echo "   https://console.cloud.google.com/vertex-ai/publishers/meta/model-garden/llama-3.3-70b-instruct-maas?project=$PROJECT_ID"
echo ""
if [ $RECIPE_COUNT -gt 0 ]; then
	echo "RAG Database:"
	echo "  - Recipes uploaded: ${RECIPE_COUNT}"
	echo "  - Vector search: https://${LOCATION}-${PROJECT_ID}.cloudfunctions.net/searchRecipes?q=smoothie"
	echo "  - Re-generate embeddings: curl -X POST https://${LOCATION}-${PROJECT_ID}.cloudfunctions.net/generateRecipeEmbeddings"
else
	echo "To populate RAG with recipes:"
	echo "  - Add recipes to content/recipes/recipes.json"
	echo "  - Upload: gsutil -m cp content/recipes/*.json gs://${BUCKET_NAME}/recipes/"
	echo "  - Generate embeddings: curl -X POST https://${LOCATION}-${PROJECT_ID}.cloudfunctions.net/generateRecipeEmbeddings"
fi
echo ""
echo "Monitoring & Debugging:"
echo "  - Cloud Console: https://console.cloud.google.com/run/detail/${LOCATION}/vitamix-recommender?project=$PROJECT_ID"
echo "  - Logs: gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=vitamix-recommender' --limit=50 --project=$PROJECT_ID"
echo "  - Metrics Dashboard: https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
echo "  - Cloud Build History: https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
echo ""
echo "Documentation: See DEPLOYMENT.md for detailed instructions"
