# Gemma Endpoint Reminder

## Description

Reminds the user about active Gemma Vertex AI endpoints and their ongoing cost. Use this skill after any interaction involving gemma presets (gemma-3-4b, gemma-3-12b) or Vertex AI endpoint deployment.

## When to trigger

- After a user tests or uses a `gemma-3-*` preset
- After running `deploy-gemma.sh`
- When discussing Gemma model performance or benchmarks
- When the user asks about costs or billing

## Reminder content

### Active Gemma Endpoint Warning

Vertex AI endpoints with dedicated GPUs do **not** scale to zero. If a Gemma endpoint is running, it costs approximately:

- **~$0.84/hour** (g2-standard-8 + 1x NVIDIA L4)
- **~$20/day**
- **~$605/month** if left running

### Check for active endpoints

```bash
gcloud ai endpoints list \
  --region="${GCP_LOCATION:-us-central1}" \
  --project="${GCP_PROJECT_ID}" \
  --filter="labels.app=vitamix AND labels.component=gemma" \
  --format="table(name.segment(-1), displayName, createTime.date())"
```

### Delete when done

```bash
./infrastructure/vertex-ai/delete-gemma.sh <endpoint-id>
```

Or, if `GEMMA_ENDPOINT_ID` is set in the environment:

```bash
./infrastructure/vertex-ai/delete-gemma.sh
```

### After deletion

Unset the environment variable from Cloud Run:

```bash
gcloud run services update vitamix-recommender \
  --region="${GCP_LOCATION:-us-central1}" \
  --project="${GCP_PROJECT_ID}" \
  --remove-env-vars=GEMMA_ENDPOINT_ID
```

## Key facts

- Gemma 3 models (4B, 12B) are **not** available as serverless API on Vertex AI
- They require dedicated GPU deployment via Vertex AI Endpoints
- The deploy/delete scripts are in `infrastructure/vertex-ai/`
- The endpoint ID is passed to the recommender service via `GEMMA_ENDPOINT_ID` env var
- Without a running endpoint, gemma presets will return a clear error
