# Model Presets Comparison

Live demo: [main--vitamix-poc--carlossg.aem.page](https://main--vitamix-poc--carlossg.aem.page/)

## Model Assignments

### Pure presets

| Preset | Reasoning | Content | Classification | Validation | Try it |
|--------|-----------|---------|----------------|------------|--------|
| **gemini-3-pro** | gemini-3-pro-preview | gemini-3-pro-preview | gemini-3-pro-preview | gemini-3-pro-preview | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-3-pro) |
| **gemini-3-flash** | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-3-flash) |
| **gemini-2.5-pro** | gemini-2.5-pro | gemini-2.5-pro | gemini-2.5-pro | gemini-2.5-pro | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.5-pro) |
| **gemini-2.5-flash** | gemini-2.5-flash | gemini-2.5-flash | gemini-2.5-flash | gemini-2.5-flash | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.5-flash) |
| **gemini-2.0-flash** | gemini-2.0-flash | gemini-2.0-flash | gemini-2.0-flash | gemini-2.0-flash | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.0-flash) |
| **gemini-2.0-flash-lite** | gemini-2.0-flash-lite | gemini-2.0-flash-lite | gemini-2.0-flash-lite | gemini-2.0-flash-lite | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.0-flash-lite) |
| **llama** | llama-3.3-70b | llama-3.3-70b | llama-3.3-70b | llama-3.3-70b | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=llama) |

### Mixed presets

| Preset | Reasoning | Content | Classification | Validation | Try it |
|--------|-----------|---------|----------------|------------|--------|
| **gemini-3-mixed** | gemini-3-pro-preview | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-3-mixed) |
| **gemini-2.5-mixed** | gemini-2.5-pro | gemini-2.5-flash | gemini-2.5-flash | gemini-2.5-flash | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.5-mixed) |
| **gemini-2.0-mixed** | gemini-2.0-flash | gemini-2.0-flash-lite | gemini-2.0-flash-lite | gemini-2.0-flash-lite | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.0-mixed) |
| **production** | gemini-3-pro-preview | gemini-2.0-flash-lite | gemini-2.0-flash-lite | gemini-2.0-flash-lite | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=production) |

### Model Garden MaaS presets

| Preset | Reasoning | Content | Classification | Validation | Try it |
|--------|-----------|---------|----------------|------------|--------|
| **llama-3.2-3b** | gemini-2.0-flash | llama-3.2-3b (MaaS) | llama-3.2-3b (MaaS) | llama-3.2-3b (MaaS) | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=llama-3.2-3b) |
| **mistral-small** | gemini-2.0-flash | mistral-small-2503 (MaaS) | mistral-small-2503 (MaaS) | mistral-small-2503 (MaaS) | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=mistral-small) |

### Gemma presets (dedicated GPU endpoint)

Requires a running Vertex AI endpoint (`deploy-gemma.sh`). Cost: ~$0.84/hr.

| Preset | Reasoning | Content | Classification | Validation | Try it |
|--------|-----------|---------|----------------|------------|--------|
| **gemma-3-4b** | gemini-2.0-flash | gemma-3-4b-it (endpoint) | gemini-2.0-flash-lite | gemini-2.0-flash-lite | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemma-3-4b) |
| **gemma-3-12b** | gemini-2.0-flash | gemma-3-12b-it (endpoint) | gemini-2.0-flash-lite | gemini-2.0-flash-lite | [try](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemma-3-12b) |

## Benchmark Results

Tested on 2026-02-25 against the live Cloud Run deployment.
Query: "best blender for smoothies"

| Preset | Reasoning | Content | Total | Blocks | Block Types |
|--------|-----------|---------|-------|--------|-------------|
| **gemma-3-4b** | 9.7s | 0.1s | 9.8s | 5 | hero, feature-highlights, recipe-cards, product-recommendation, follow-up |
| **gemma-3-12b** | 8.6s | 2.1s | 10.7s | 5 | hero, feature-highlights, recipe-cards, product-recommendation, follow-up |
| **llama-3.2-3b** | 12.1s | 0.2s | 12.3s | 5 | hero, feature-highlights, recipe-cards, product-recommendation, follow-up |
| **mistral-small** | 12.1s | 0.2s | 12.3s | 5 | hero, feature-highlights, recipe-cards, product-recommendation, follow-up |
| **gemini-2.0** | 10.5s | 2.5s | 13.0s | 5 | hero, feature-highlights, product-recommendation, recipe-cards, follow-up |
| **llama** | 7.1s | 9.4s | 16.5s | 5 | hero, feature-highlights, product-cards, recipe-cards, follow-up |
| **gemini-3-flash** | 16.6s | 5.6s | 22.1s | 2 | product-recommendation, follow-up |
| **production** | 23.5s | 2.1s | 25.5s | 2 | product-recommendation, follow-up |
| **gemini-2.5** | 25.9s | 1.9s | 27.8s | 2 | product-recommendation, follow-up |

- **Reasoning** = time for intent classification + block selection (from `reasoning-complete` event)
- **Content** = time to generate all block HTML after reasoning
- **Total** = end-to-end server-side duration (from `generation-complete` event)
- Preset names match the currently deployed service; local code uses more granular names (e.g., `gemini-2.0-flash`, `gemini-2.5-pro`)

## Recommendations

- **Best quality:** `gemini-3-pro` -- deepest reasoning, highest fidelity content
- **Best speed:** `gemma-3-4b` (9.8s), `gemma-3-12b` (10.7s), `llama-3.2-3b` (12.3s)
- **Best balance:** `production` -- Gemini 3 Pro reasoning + 2.0 Flash Lite speed
- **Within-family mixed:** `gemini-3-mixed`, `gemini-2.5-mixed`, `gemini-2.0-mixed`
- **Open models:** `llama` (70B, 16.5s), `llama-3.2-3b` (3B, 12.3s), `mistral-small` (24B, 12.3s)
- **Gemma (GPU endpoint):** `gemma-3-4b` (9.8s), `gemma-3-12b` (10.7s) -- requires running endpoint after redeployment
