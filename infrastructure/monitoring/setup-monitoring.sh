#!/bin/bash
# Google Cloud Operations Setup - Monitoring, Logging, Alerts
# For Vitamix POC with app=vitamix label

set -e

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
LOCATION="${GCP_LOCATION:-us-central1}"
NOTIFICATION_EMAIL="${ALERT_EMAIL:-devops@example.com}"

echo "Setting up Cloud Operations for project: $PROJECT_ID"

# ============================================
# Create Notification Channel
# ============================================

echo "Creating notification channel for alerts..."

# Create email notification channel
CHANNEL_ID=$(gcloud alpha monitoring channels create \
	--display-name="Vitamix Alerts Email" \
	--type=email \
	--channel-labels=email_address="$NOTIFICATION_EMAIL" \
	--project="$PROJECT_ID" \
	--format="value(name)" 2>/dev/null || echo "")

if [ -z "$CHANNEL_ID" ]; then
	echo "  Using existing notification channel..."
	CHANNEL_ID=$(gcloud alpha monitoring channels list \
		--filter="displayName:'Vitamix Alerts Email'" \
		--project="$PROJECT_ID" \
		--format="value(name)" \
		--limit=1)
fi

echo "  Notification channel: $CHANNEL_ID"

# ============================================
# Create Alert Policies
# ============================================

echo ""
echo "Creating alert policies..."

# Alert 1: High Error Rate (> 1%)
cat > /tmp/alert-error-rate.yaml <<EOF
displayName: 'Vitamix - High Error Rate'
conditions:
  - displayName: 'Error rate > 1%'
    conditionThreshold:
      filter: |
        resource.type="cloud_run_revision"
        resource.labels.service_name="vitamix-recommender"
        metric.type="run.googleapis.com/request_count"
        metric.labels.response_code_class="5xx"
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_RATE
      comparison: COMPARISON_GT
      thresholdValue: 0.01
      duration: 60s
documentation:
  content: 'Error rate for vitamix-recommender exceeds 1%. Check Cloud Run logs.'
  mimeType: text/markdown
notificationChannels:
  - ${CHANNEL_ID}
alertStrategy:
  autoClose: 604800s
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/alert-error-rate.yaml \
	--project="$PROJECT_ID" 2>/dev/null || echo "  Error rate alert already exists"

# Alert 2: High Latency (> 5s P95)
cat > /tmp/alert-latency.yaml <<EOF
displayName: 'Vitamix - High Latency'
conditions:
  - displayName: 'P95 latency > 5s'
    conditionThreshold:
      filter: |
        resource.type="cloud_run_revision"
        resource.labels.service_name="vitamix-recommender"
        metric.type="run.googleapis.com/request_latencies"
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_DELTA
          crossSeriesReducer: REDUCE_PERCENTILE_95
          groupByFields:
            - resource.service_name
      comparison: COMPARISON_GT
      thresholdValue: 5000
      duration: 120s
documentation:
  content: 'P95 latency for vitamix-recommender exceeds 5 seconds. Check for performance issues.'
  mimeType: text/markdown
notificationChannels:
  - ${CHANNEL_ID}
alertStrategy:
  autoClose: 604800s
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/alert-latency.yaml \
	--project="$PROJECT_ID" 2>/dev/null || echo "  Latency alert already exists"

# Alert 3: Firestore Quota Limits
cat > /tmp/alert-firestore-quota.yaml <<EOF
displayName: 'Vitamix - Firestore Quota Warning'
conditions:
  - displayName: 'Firestore read quota > 80%'
    conditionThreshold:
      filter: |
        resource.type="firestore_instance"
        metric.type="firestore.googleapis.com/document/read_count"
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_RATE
      comparison: COMPARISON_GT
      thresholdValue: 10000
      duration: 300s
documentation:
  content: 'Firestore read rate is high. Consider implementing caching or optimizing queries.'
  mimeType: text/markdown
notificationChannels:
  - ${CHANNEL_ID}
alertStrategy:
  autoClose: 604800s
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/alert-firestore-quota.yaml \
	--project="$PROJECT_ID" 2>/dev/null || echo "  Firestore quota alert already exists"

# Alert 4: Vertex AI Rate Limits
cat > /tmp/alert-vertex-ai-quota.yaml <<EOF
displayName: 'Vitamix - Vertex AI Rate Limit'
conditions:
  - displayName: 'Vertex AI quota errors'
    conditionThreshold:
      filter: |
        resource.type="aiplatform.googleapis.com/Endpoint"
        metric.type="aiplatform.googleapis.com/prediction/error_count"
        metric.labels.error_type="QUOTA_EXCEEDED"
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_RATE
      comparison: COMPARISON_GT
      thresholdValue: 1
      duration: 60s
documentation:
  content: 'Vertex AI quota exceeded. Implement exponential backoff or request quota increase.'
  mimeType: text/markdown
notificationChannels:
  - ${CHANNEL_ID}
alertStrategy:
  autoClose: 604800s
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/alert-vertex-ai-quota.yaml \
	--project="$PROJECT_ID" 2>/dev/null || echo "  Vertex AI quota alert already exists"

# ============================================
# Create Custom Dashboard
# ============================================

echo ""
echo "Creating Cloud Monitoring dashboard..."

cat > /tmp/dashboard.json <<EOF
{
  "displayName": "Vitamix POC - Google Cloud Metrics",
  "dashboardFilters": [
    {
      "filterType": "RESOURCE_LABEL",
      "labelKey": "service_name",
      "stringValue": "vitamix-recommender"
    }
  ],
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Cloud Run - Request Count",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"vitamix-recommender\" metric.type=\"run.googleapis.com/request_count\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_RATE"
                    }
                  }
                }
              }
            ]
          }
        }
      },
      {
        "xPos": 6,
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Cloud Run - Error Rate",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"vitamix-recommender\" metric.type=\"run.googleapis.com/request_count\" metric.labels.response_code_class=\"5xx\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_RATE"
                    }
                  }
                }
              }
            ]
          }
        }
      },
      {
        "yPos": 4,
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Cloud Run - Latency (P50, P95, P99)",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"vitamix-recommender\" metric.type=\"run.googleapis.com/request_latencies\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_DELTA",
                      "crossSeriesReducer": "REDUCE_PERCENTILE_50"
                    }
                  }
                }
              }
            ]
          }
        }
      },
      {
        "xPos": 6,
        "yPos": 4,
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Firestore - Read/Write Operations",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"firestore_instance\" metric.type=\"firestore.googleapis.com/document/read_count\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_RATE"
                    }
                  }
                }
              }
            ]
          }
        }
      },
      {
        "yPos": 8,
        "width": 12,
        "height": 4,
        "widget": {
          "title": "Vertex AI - Prediction Count",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"aiplatform.googleapis.com/Endpoint\" metric.type=\"aiplatform.googleapis.com/prediction/count\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_RATE"
                    }
                  }
                }
              }
            ]
          }
        }
      }
    ]
  }
}
EOF

gcloud monitoring dashboards create --config-from-file=/tmp/dashboard.json \
	--project="$PROJECT_ID" 2>/dev/null || echo "  Dashboard already exists"

# ============================================
# Setup Log-based Metrics
# ============================================

echo ""
echo "Creating log-based metrics..."

# Custom metric for AI generation time
gcloud logging metrics create vitamix_ai_generation_time \
	--description="Time taken for AI content generation" \
	--log-filter='resource.type="cloud_run_revision"
resource.labels.service_name="vitamix-recommender"
jsonPayload.event="generation_complete"' \
	--value-extractor='EXTRACT(jsonPayload.duration)' \
	--project="$PROJECT_ID" 2>/dev/null || echo "  AI generation time metric already exists"

# Custom metric for block generation count
gcloud logging metrics create vitamix_blocks_generated \
	--description="Number of blocks generated per request" \
	--log-filter='resource.type="cloud_run_revision"
resource.labels.service_name="vitamix-recommender"
jsonPayload.event="block_complete"' \
	--project="$PROJECT_ID" 2>/dev/null || echo "  Blocks generated metric already exists"

# ============================================
# Cleanup
# ============================================

rm -f /tmp/alert-*.yaml /tmp/dashboard.json

# ============================================
# Summary
# ============================================

echo ""
echo "✅ Cloud Operations setup complete!"
echo ""
echo "Configured:"
echo "  - Email notifications to: $NOTIFICATION_EMAIL"
echo "  - Alert policies: Error rate, Latency, Firestore quota, Vertex AI quota"
echo "  - Custom dashboard: Vitamix POC metrics"
echo "  - Log-based metrics: AI generation time, Blocks generated"
echo ""
echo "View dashboards: https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
echo "View alerts: https://console.cloud.google.com/monitoring/alerting?project=$PROJECT_ID"
echo "View logs: https://console.cloud.google.com/logs/query?project=$PROJECT_ID"
