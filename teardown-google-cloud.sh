#!/bin/bash
# Vitamix POC - Complete Infrastructure Teardown
# Removes all GCP resources created by deploy-google-cloud.sh
#
# Usage:
#   ./teardown-google-cloud.sh              # Interactive (confirms each step)
#   ./teardown-google-cloud.sh --yes        # Skip confirmations (use with caution)
#   ./teardown-google-cloud.sh --dry-run    # List what would be deleted; no changes
#
# This script deletes (in order):
#   1. Gemma Vertex AI endpoints (by label: app=vitamix, component=gemma)
#   2. Cloud Run services (by label: app=vitamix)
#   3. Cloud Functions (by label: app=vitamix)
#   4. Container images (gcr.io/{project}/vitamix-recommender; image name fixed)
#   5. Cloud Storage buckets (by label: app=vitamix)
#   6. Firestore database (default; single DB, no labels)
#   7. Secrets (by label: app=vitamix)
#   8. Monitoring (alerts/dashboards/channels by displayName; log metrics by name)
#   9. Service accounts (fixed list; deploy does not set labels on SAs)
#
# What this script does NOT delete:
#   - Enabled APIs (may be used by other services in the project)
#   - Cloud Build history (read-only audit trail)
#   - IAM policy bindings on the project (removed with service accounts)

set -euo pipefail

# ============================================
# Configuration
# ============================================

AUTO_YES=""
DRY_RUN=""
for arg in "$@"; do
  case "$arg" in
    --yes)     AUTO_YES="--yes" ;;
    --dry-run) DRY_RUN="1" ;;
  esac
done

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
LOCATION="${GCP_LOCATION:-us-central1}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GCP_PROJECT_ID not set and no default project configured."
  echo "  Run: export GCP_PROJECT_ID='your-project-id'"
  exit 1
fi

confirm() {
  if [ -n "$DRY_RUN" ] || [ "$AUTO_YES" = "--yes" ]; then
    return 0
  fi
  local msg="$1"
  read -p "$msg (y/n) " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]]
}

# Track what was deleted for the summary
DELETED=()
SKIPPED=()
FAILED=()

echo "Vitamix POC - Infrastructure Teardown"
echo "======================================"
echo ""
echo "  Project:  $PROJECT_ID"
echo "  Location: $LOCATION"
if [ -n "$DRY_RUN" ]; then
  echo "  Mode:     DRY RUN (no resources will be deleted)"
  echo ""
else
  echo ""
  echo "  This will permanently delete ALL Vitamix resources in this project."
  echo ""
fi

if ! confirm "Continue?"; then
  echo "Cancelled."
  exit 0
fi

# ============================================
# Step 1: Gemma Vertex AI Endpoints
# ============================================

echo ""
echo "Step 1/9: Checking for Gemma Vertex AI endpoints..."

GEMMA_ENDPOINTS=$(gcloud ai endpoints list \
  --region="$LOCATION" \
  --project="$PROJECT_ID" \
  --filter="labels.app=vitamix AND labels.component=gemma" \
  --format="value(name.segment(-1))" \
  2>/dev/null || echo "")

if [ -n "$GEMMA_ENDPOINTS" ]; then
  echo "  Found Gemma endpoint(s): $GEMMA_ENDPOINTS"
  for EP_ID in $GEMMA_ENDPOINTS; do
    echo "  Tearing down endpoint $EP_ID..."

    # Get deployed models
    DEPLOYED_MODELS=$(gcloud ai endpoints describe "$EP_ID" \
      --region="$LOCATION" \
      --project="$PROJECT_ID" \
      --format="value(deployedModels.id)" \
      2>/dev/null || echo "")

    MODEL_NAMES=$(gcloud ai endpoints describe "$EP_ID" \
      --region="$LOCATION" \
      --project="$PROJECT_ID" \
      --format="value(deployedModels.model)" \
      2>/dev/null || echo "")

    # Undeploy models
    if [ -n "$DEPLOYED_MODELS" ]; then
      for DM_ID in $DEPLOYED_MODELS; do
        echo "    Undeploying model: $DM_ID"
        if [ -n "$DRY_RUN" ]; then
          echo "    [DRY RUN] Would undeploy model $DM_ID"
        else
          gcloud ai endpoints undeploy-model "$EP_ID" \
            --region="$LOCATION" \
            --project="$PROJECT_ID" \
            --deployed-model-id="$DM_ID" \
            --quiet 2>/dev/null || echo "    Warning: undeploy failed for $DM_ID"
        fi
      done
    fi

    # Delete endpoint
    echo "    Deleting endpoint: $EP_ID"
    if [ -n "$DRY_RUN" ]; then
      echo "    [DRY RUN] Would delete endpoint $EP_ID"
      DELETED+=("Gemma endpoint $EP_ID")
    else
      gcloud ai endpoints delete "$EP_ID" \
        --region="$LOCATION" \
        --project="$PROJECT_ID" \
        --quiet 2>/dev/null && DELETED+=("Gemma endpoint $EP_ID") || FAILED+=("Gemma endpoint $EP_ID")
    fi

    # Delete uploaded models from registry
    if [ -n "$MODEL_NAMES" ] && [ -z "$DRY_RUN" ]; then
      for MODEL_NAME in $MODEL_NAMES; do
        MODEL_ID=$(echo "$MODEL_NAME" | grep -oE '[0-9]+$' || echo "")
        if [ -n "$MODEL_ID" ]; then
          echo "    Deleting model from registry: $MODEL_ID"
          gcloud ai models delete "$MODEL_ID" \
            --region="$LOCATION" \
            --project="$PROJECT_ID" \
            --quiet 2>/dev/null || echo "    Warning: model delete failed for $MODEL_ID"
        fi
      done
    elif [ -n "$MODEL_NAMES" ] && [ -n "$DRY_RUN" ]; then
      for MODEL_NAME in $MODEL_NAMES; do
        MODEL_ID=$(echo "$MODEL_NAME" | grep -oE '[0-9]+$' || echo "")
        [ -n "$MODEL_ID" ] && echo "    [DRY RUN] Would delete model from registry: $MODEL_ID"
      done
    fi
  done
else
  echo "  No Gemma endpoints found."
  SKIPPED+=("Gemma endpoints (none found)")
fi

# ============================================
# Step 2: Cloud Run Service(s) (by label)
# ============================================

echo ""
echo "Step 2/9: Deleting Cloud Run services (label app=vitamix)..."

RUN_SERVICES=$(
  gcloud run services list \
    --region="$LOCATION" \
    --project="$PROJECT_ID" \
    --filter="metadata.labels.app=vitamix" \
    --format="value(name)" \
    2>/dev/null || echo ""
)

if [ -n "$RUN_SERVICES" ]; then
  for SVC in $RUN_SERVICES; do
    echo "  Deleting service: $SVC"
    if [ -n "$DRY_RUN" ]; then
      echo "  [DRY RUN] Would delete Cloud Run service: $SVC"
      DELETED+=("Cloud Run: $SVC")
    else
      gcloud run services delete "$SVC" \
        --region="$LOCATION" \
        --project="$PROJECT_ID" \
        --quiet && DELETED+=("Cloud Run: $SVC") || FAILED+=("Cloud Run: $SVC")
    fi
  done
else
  echo "  No Cloud Run services with label app=vitamix found."
  SKIPPED+=("Cloud Run (none with label app=vitamix)")
fi

# ============================================
# Step 3: Cloud Functions
# ============================================

echo ""
echo "Step 3/9: Deleting Cloud Functions (Gen1 and Gen2)..."

# List Gen1 functions (no flag). Note: list uses --regions (plural).
FUNCTIONS=$(
  gcloud functions list \
    --regions="$LOCATION" \
    --project="$PROJECT_ID" \
    --filter="labels.app=vitamix" \
    --format="value(name.segment(-1))" \
    2>/dev/null || echo ""
)

# List Gen2 functions (deploy uses --gen2 for all Vitamix functions)
FUNCTIONS_V2=$(
  gcloud functions list \
    --regions="$LOCATION" \
    --project="$PROJECT_ID" \
    --v2 \
    --filter="labels.app=vitamix" \
    --format="value(name.segment(-1))" \
    2>/dev/null || echo ""
)

# Merge and deduplicate (Gen2 list may overlap if both APIs return same names)
ALL_FUNCTIONS=$(echo "$FUNCTIONS" "$FUNCTIONS_V2" | tr ' ' '\n' | sort -u | sed '/^$/d')

if [ -n "$ALL_FUNCTIONS" ]; then
  for FUNC in $ALL_FUNCTIONS; do
    echo "  Deleting function: $FUNC"
    if [ -n "$DRY_RUN" ]; then
      echo "  [DRY RUN] Would delete function: $FUNC"
      DELETED+=("Function: $FUNC")
    else
      gcloud functions delete "$FUNC" \
        --region="$LOCATION" \
        --project="$PROJECT_ID" \
        --quiet && DELETED+=("Function: $FUNC") || FAILED+=("Function: $FUNC")
    fi
  done
else
  echo "  No Cloud Functions with label app=vitamix found (checked Gen1 and Gen2)."
  SKIPPED+=("Functions (none with label app=vitamix)")
fi

# ============================================
# Step 4: Container Images
# ============================================

echo ""
echo "Step 4/9: Deleting container images..."

# Allow Cloud Run deletion to propagate so image refs are released (reduces "in use" failures)
if [ -z "$DRY_RUN" ]; then
  echo "  Waiting 10s for Cloud Run refs to release image digests..."
  sleep 10
fi

# List all tags for the vitamix-recommender image
IMAGE_TAGS=$(gcloud container images list-tags "gcr.io/${PROJECT_ID}/vitamix-recommender" \
  --format="value(digest)" \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "")

if [ -n "$IMAGE_TAGS" ]; then
  TAG_COUNT=$(echo "$IMAGE_TAGS" | wc -l | tr -d ' ')
  echo "  Found $TAG_COUNT image digest(s). Deleting all..."
  if [ -n "$DRY_RUN" ]; then
    echo "  [DRY RUN] Would delete $TAG_COUNT container image digest(s)"
    DELETED+=("Container images: vitamix-recommender ($TAG_COUNT digests)")
  else
    DELETED_COUNT=0
    FAILED_DIGESTS=()
    for DIGEST in $IMAGE_TAGS; do
      if gcloud container images delete "gcr.io/${PROJECT_ID}/vitamix-recommender@${DIGEST}" \
        --force-delete-tags \
        --project="$PROJECT_ID" \
        --quiet 2>/dev/null; then
        ((DELETED_COUNT++)) || true
      else
        FAILED_DIGESTS+=("$DIGEST")
      fi
    done
    if [ ${#FAILED_DIGESTS[@]} -gt 0 ]; then
      echo "  Deleted $DELETED_COUNT digest(s); ${#FAILED_DIGESTS[@]} could not be deleted (may still be in use or rate-limited)."
      FAILED+=("Container images: ${#FAILED_DIGESTS[@]} digest(s) left for vitamix-recommender")
    fi
    if [ "$DELETED_COUNT" -gt 0 ]; then
      DELETED+=("Container images: vitamix-recommender ($DELETED_COUNT digests)")
    fi
    if [ "$DELETED_COUNT" -eq 0 ] && [ ${#FAILED_DIGESTS[@]} -gt 0 ]; then
      SKIPPED+=("Container images: all $TAG_COUNT digest(s) failed to delete")
    fi
  fi
else
  echo "  No container images found."
  SKIPPED+=("Container images (none found)")
fi

# ============================================
# Step 5: Cloud Storage Buckets (by label)
# ============================================

echo ""
echo "Step 5/9: Deleting Cloud Storage buckets (label app=vitamix)..."

BUCKETS=$(
  gcloud storage buckets list \
    --project="$PROJECT_ID" \
    --filter="labels.app=vitamix" \
    --format="value(name)" \
    2>/dev/null || echo ""
)

if [ -n "$BUCKETS" ]; then
  for BUCKET_NAME in $BUCKETS; do
    echo "  Deleting bucket: gs://${BUCKET_NAME} (and all contents)..."
    if [ -n "$DRY_RUN" ]; then
      echo "  [DRY RUN] Would delete bucket gs://${BUCKET_NAME}"
      DELETED+=("Storage: gs://${BUCKET_NAME}")
    else
      gsutil -m rm -r "gs://${BUCKET_NAME}" 2>/dev/null \
        && DELETED+=("Storage: gs://${BUCKET_NAME}") \
        || FAILED+=("Storage: gs://${BUCKET_NAME}")
    fi
  done
else
  echo "  No buckets with label app=vitamix found."
  SKIPPED+=("Storage (none with label app=vitamix)")
fi

# ============================================
# Step 6: Firestore Database
# ============================================

echo ""
echo "Step 6/9: Deleting Firestore database..."

if gcloud firestore databases list --project="$PROJECT_ID" 2>/dev/null | grep -q "default"; then
  echo "  WARNING: This deletes ALL Firestore data (sessions, analytics, recipes)."
  if confirm "  Delete Firestore database?"; then
    if [ -n "$DRY_RUN" ]; then
      echo "  [DRY RUN] Would delete Firestore (default) database"
      DELETED+=("Firestore: (default) database")
    else
      gcloud firestore databases delete --database="(default)" \
        --project="$PROJECT_ID" \
        --quiet 2>/dev/null \
        && DELETED+=("Firestore: (default) database") \
        || FAILED+=("Firestore: (default) database")
    fi
  else
    echo "  Skipping Firestore deletion."
    SKIPPED+=("Firestore: (default) database (user skipped)")
  fi
else
  echo "  No Firestore database found."
  SKIPPED+=("Firestore: (default) database (not found)")
fi

# ============================================
# Step 7: Secrets (by label)
# ============================================

echo ""
echo "Step 7/9: Deleting secrets (label app=vitamix)..."

SECRETS=$(
  gcloud secrets list \
    --project="$PROJECT_ID" \
    --filter="labels.app:vitamix" \
    --format="value(name.segment(-1))" \
    2>/dev/null || echo ""
)

if [ -n "$SECRETS" ]; then
  for SECRET in $SECRETS; do
    echo "  Deleting secret: $SECRET"
    if [ -n "$DRY_RUN" ]; then
      echo "  [DRY RUN] Would delete secret: $SECRET"
      DELETED+=("Secret: $SECRET")
    else
      gcloud secrets delete "$SECRET" \
        --project="$PROJECT_ID" \
        --quiet && DELETED+=("Secret: $SECRET") || FAILED+=("Secret: $SECRET")
    fi
  done
else
  echo "  No secrets with label app=vitamix found."
  SKIPPED+=("Secrets (none with label app=vitamix)")
fi

# ============================================
# Step 8: Monitoring Resources
# ============================================

echo ""
echo "Step 8/9: Deleting monitoring resources..."

# Alert policies
echo "  Deleting alert policies..."
ALERT_POLICIES=$(gcloud alpha monitoring policies list \
  --project="$PROJECT_ID" \
  --filter="displayName:Vitamix" \
  --format="value(name)" \
  2>/dev/null || echo "")

if [ -n "$ALERT_POLICIES" ]; then
  for POLICY in $ALERT_POLICIES; do
    POLICY_NAME=$(echo "$POLICY" | grep -oE '[0-9]+$' || echo "$POLICY")
    echo "    Deleting alert policy: $POLICY_NAME"
    if [ -n "$DRY_RUN" ]; then
      echo "    [DRY RUN] Would delete alert policy: $POLICY_NAME"
    else
      gcloud alpha monitoring policies delete "$POLICY" \
        --project="$PROJECT_ID" \
        --quiet 2>/dev/null || echo "    Warning: failed to delete policy $POLICY_NAME"
    fi
  done
  DELETED+=("Monitoring: alert policies")
else
  SKIPPED+=("Monitoring: alert policies (none found)")
fi

# Dashboard
echo "  Deleting dashboards..."
DASHBOARDS=$(gcloud monitoring dashboards list \
  --project="$PROJECT_ID" \
  --filter="displayName:'Vitamix POC'" \
  --format="value(name)" \
  2>/dev/null || echo "")

if [ -n "$DASHBOARDS" ]; then
  for DASH in $DASHBOARDS; do
    echo "    Deleting dashboard: $DASH"
    if [ -n "$DRY_RUN" ]; then
      echo "    [DRY RUN] Would delete dashboard: $DASH"
    else
      gcloud monitoring dashboards delete "$DASH" \
        --project="$PROJECT_ID" \
        --quiet 2>/dev/null || echo "    Warning: failed to delete dashboard"
    fi
  done
  DELETED+=("Monitoring: dashboard")
else
  SKIPPED+=("Monitoring: dashboard (not found)")
fi

# Log-based metrics (fixed names; no label support in Cloud Logging metrics)
echo "  Deleting log-based metrics..."
LOG_METRICS=("vitamix_ai_generation_time" "vitamix_blocks_generated")
LOG_METRICS_DELETED=0
for METRIC in "${LOG_METRICS[@]}"; do
  if gcloud logging metrics describe "$METRIC" --project="$PROJECT_ID" &>/dev/null; then
    echo "    Deleting metric: $METRIC"
    if [ -n "$DRY_RUN" ]; then
      echo "    [DRY RUN] Would delete log metric: $METRIC"
      ((LOG_METRICS_DELETED++)) || true
    elif gcloud logging metrics delete "$METRIC" \
      --project="$PROJECT_ID" \
      --quiet 2>/dev/null; then
      ((LOG_METRICS_DELETED++)) || true
    else
      echo "    Warning: failed to delete metric $METRIC"
    fi
  else
    SKIPPED+=("Log metric: $METRIC (not found)")
  fi
done
[ "$LOG_METRICS_DELETED" -gt 0 ] && DELETED+=("Monitoring: log-based metrics ($LOG_METRICS_DELETED)")

# Notification channels (match displayName from setup-monitoring.sh)
echo "  Deleting notification channels..."
CHANNELS=$(gcloud alpha monitoring channels list \
  --project="$PROJECT_ID" \
  --filter="displayName:'Vitamix Alerts Email'" \
  --format="value(name)" \
  2>/dev/null || echo "")

if [ -n "$CHANNELS" ]; then
  for CHANNEL in $CHANNELS; do
    echo "    Deleting notification channel: $CHANNEL"
    if [ -n "$DRY_RUN" ]; then
      echo "    [DRY RUN] Would delete notification channel: $CHANNEL"
    else
      gcloud alpha monitoring channels delete "$CHANNEL" \
        --project="$PROJECT_ID" \
        --force \
        --quiet 2>/dev/null || echo "    Warning: failed to delete channel"
    fi
  done
  DELETED+=("Monitoring: notification channels")
else
  SKIPPED+=("Monitoring: notification channels (none found)")
fi

# ============================================
# Step 9: Service Accounts
# ============================================

echo ""
echo "Step 9/9: Deleting service accounts..."

SERVICE_ACCOUNTS=(
  "vitamix-recommender-sa"
  "vitamix-analytics-sa"
  "vitamix-embeddings-sa"
)

for SA in "${SERVICE_ACCOUNTS[@]}"; do
  SA_EMAIL="${SA}@${PROJECT_ID}.iam.gserviceaccount.com"
  if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
    echo "  Deleting: $SA_EMAIL"
    if [ -n "$DRY_RUN" ]; then
      echo "  [DRY RUN] Would delete service account: $SA"
      DELETED+=("Service account: $SA")
    else
      gcloud iam service-accounts delete "$SA_EMAIL" \
        --project="$PROJECT_ID" \
        --quiet && DELETED+=("Service account: $SA") || FAILED+=("Service account: $SA")
    fi
  else
    echo "  $SA not found."
    SKIPPED+=("Service account: $SA (not found)")
  fi
done

# ============================================
# Summary
# ============================================

echo ""
echo "======================================"
if [ -n "$DRY_RUN" ]; then
  echo "Dry Run Complete (no resources were changed)"
else
  echo "Teardown Complete"
fi
echo "======================================"

if [ ${#DELETED[@]} -gt 0 ]; then
  echo ""
  if [ -n "$DRY_RUN" ]; then
    echo "Would be deleted (${#DELETED[@]}):"
  else
    echo "Deleted (${#DELETED[@]}):"
  fi
  for item in "${DELETED[@]}"; do
    echo "  - $item"
  done
fi

if [ ${#SKIPPED[@]} -gt 0 ]; then
  echo ""
  echo "Skipped (${#SKIPPED[@]}):"
  for item in "${SKIPPED[@]}"; do
    echo "  - $item"
  done
fi

if [ ${#FAILED[@]} -gt 0 ]; then
  echo ""
  echo "FAILED (${#FAILED[@]}):"
  for item in "${FAILED[@]}"; do
    echo "  - $item"
  done
  echo ""
  echo "Some resources failed to delete. Check errors above and retry manually."
fi

echo ""
if [ -n "$DRY_RUN" ]; then
  echo "Re-run without --dry-run to perform the actual teardown."
else
  echo "Note: Enabled APIs were NOT disabled (may be used by other services)."
  echo "To disable them manually:"
  echo "  gcloud services disable run.googleapis.com cloudfunctions.googleapis.com \\"
  echo "    aiplatform.googleapis.com firestore.googleapis.com secretmanager.googleapis.com \\"
  echo "    --project=$PROJECT_ID"
fi
echo ""
