# Model Presets Comparison

Live demo: [main--vitamix-poc--carlossg.aem.page](https://main--vitamix-poc--carlossg.aem.page/)

## Try Each Preset

### Pure (single model for all roles)

| Preset | Link |
|--------|------|
| gemini-3-pro | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-3-pro) |
| gemini-3-flash | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-3-flash) |
| gemini-2.5-pro | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.5-pro) |
| gemini-2.5-flash | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.5-flash) |
| gemini-2.0-flash | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.0-flash) |
| gemini-2.0-flash-lite | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.0-flash-lite) |
| llama | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=llama) |

### Mixed (heavier reasoning + lighter content)

| Preset | Link |
|--------|------|
| gemini-3-mixed | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-3-mixed) |
| gemini-2.5-mixed | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.5-mixed) |
| gemini-2.0-mixed | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.0-mixed) |
| production | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=production) |

### Model Garden MaaS (serverless open models)

| Preset | Link |
|--------|------|
| llama-3.2-3b | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=llama-3.2-3b) |
| mistral-small | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=mistral-small) |

### Gemma (dedicated GPU endpoint)

Requires a running Vertex AI endpoint. See `infrastructure/vertex-ai/deploy-gemma.sh`.
Cost: ~$0.84/hr while the endpoint is active.

| Preset | Link |
|--------|------|
| gemma-3-4b | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemma-3-4b) |
| gemma-3-12b | [best blender for veggies](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemma-3-12b) |

## Model Assignments

### Pure presets

| Preset | Reasoning | Content | Classification | Validation |
|--------|-----------|---------|----------------|------------|
| **gemini-3-pro** | gemini-3-pro-preview | gemini-3-pro-preview | gemini-3-pro-preview | gemini-3-pro-preview |
| **gemini-3-flash** | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview |
| **gemini-2.5-pro** | gemini-2.5-pro | gemini-2.5-pro | gemini-2.5-pro | gemini-2.5-pro |
| **gemini-2.5-flash** | gemini-2.5-flash | gemini-2.5-flash | gemini-2.5-flash | gemini-2.5-flash |
| **gemini-2.0-flash** | gemini-2.0-flash | gemini-2.0-flash | gemini-2.0-flash | gemini-2.0-flash |
| **gemini-2.0-flash-lite** | gemini-2.0-flash-lite | gemini-2.0-flash-lite | gemini-2.0-flash-lite | gemini-2.0-flash-lite |
| **llama** | llama-3.3-70b | llama-3.3-70b | llama-3.3-70b | llama-3.3-70b |

### Mixed presets

| Preset | Reasoning | Content | Classification | Validation |
|--------|-----------|---------|----------------|------------|
| **gemini-3-mixed** | gemini-3-pro-preview | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview |
| **gemini-2.5-mixed** | gemini-2.5-pro | gemini-2.5-flash | gemini-2.5-flash | gemini-2.5-flash |
| **gemini-2.0-mixed** | gemini-2.0-flash | gemini-2.0-flash-lite | gemini-2.0-flash-lite | gemini-2.0-flash-lite |
| **production** | gemini-3-pro-preview | gemini-2.0-flash-lite | gemini-2.0-flash-lite | gemini-2.0-flash-lite |

### Model Garden MaaS presets

| Preset | Reasoning | Content | Classification | Validation |
|--------|-----------|---------|----------------|------------|
| **llama-3.2-3b** | gemini-2.0-flash | llama-3.2-3b (MaaS) | llama-3.2-3b (MaaS) | llama-3.2-3b (MaaS) |
| **mistral-small** | gemini-2.0-flash | mistral-small-2503 (MaaS) | mistral-small-2503 (MaaS) | mistral-small-2503 (MaaS) |

### Gemma presets (dedicated GPU endpoint)

Requires a running Vertex AI endpoint (`deploy-gemma.sh`). Cost: ~$0.84/hr.

| Preset | Reasoning | Content | Classification | Validation |
|--------|-----------|---------|----------------|------------|
| **gemma-3-4b** | gemini-2.0-flash | gemma-3-4b-it (endpoint) | gemini-2.0-flash-lite | gemini-2.0-flash-lite |
| **gemma-3-12b** | gemini-2.0-flash | gemma-3-12b-it (endpoint) | gemini-2.0-flash-lite | gemini-2.0-flash-lite |

## Recommendations

- **Best quality:** `gemini-3-pro` -- deepest reasoning, highest fidelity content
- **Best speed:** `gemini-2.0-flash-lite` -- fastest, stable GA
- **Best balance:** `production` -- Gemini 3 Pro reasoning + 2.0 Flash Lite speed
- **Within-family mixed:** `gemini-3-mixed`, `gemini-2.5-mixed`, `gemini-2.0-mixed`
- **Open models:** `llama` (70B, fast), `llama-3.2-3b` (tiny), `mistral-small` (24B)
- **Gemma (GPU endpoint):** `gemma-3-4b` (fast, light), `gemma-3-12b` (better quality) -- requires running endpoint
