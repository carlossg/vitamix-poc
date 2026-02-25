# Model Presets Comparison

Live demo: [main--vitamix-poc--carlossg.aem.page](https://main--vitamix-poc--carlossg.aem.page/)

## Try Each Preset

| Preset | Link |
|--------|------|
| production | [best blender for veggies (production)](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=production) |
| gemini-3-flash | [best blender for veggies (gemini-3-flash)](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-3-flash) |
| gemini-2.5 | [best blender for veggies (gemini-2.5)](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.5) |
| gemini-2.0 | [best blender for veggies (gemini-2.0)](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemini-2.0) |
| llama | [best blender for veggies (llama)](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=llama) |
| development | [best blender for veggies (development)](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=development) |
| gemma-3-4b | [best blender for veggies (gemma-3-4b)](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemma-3-4b) |
| gemma-3-12b | [best blender for veggies (gemma-3-12b)](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=gemma-3-12b) |
| llama-3.2-3b | [best blender for veggies (llama-3.2-3b)](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=llama-3.2-3b) |
| mistral-small | [best blender for veggies (mistral-small)](https://main--vitamix-poc--carlossg.aem.page/?q=best+blender+for+veggies&preset=mistral-small) |

## Preset Details

| Preset | Reasoning | Content | Classification | Validation |
|--------|-----------|---------|----------------|------------|
| **production** | gemini-3-pro-preview | gemini-2.0-flash-lite | gemini-2.0-flash-lite | gemini-2.0-flash-lite |
| **gemini-3-flash** | gemini-3-flash-preview | gemini-2.0-flash-lite | gemini-2.0-flash-lite | gemini-2.0-flash-lite |
| **gemini-2.5** | gemini-2.5-pro | gemini-2.0-flash-lite | gemini-2.0-flash-lite | gemini-2.0-flash-lite |
| **gemini-2.0** | gemini-2.0-flash | gemini-2.0-flash-lite | gemini-2.0-flash-lite | gemini-2.0-flash-lite |
| **llama** | llama-3.3-70b (MaaS) | llama-3.3-70b (MaaS) | llama-3.3-70b (MaaS) | llama-3.3-70b (MaaS) |
| **development** | gemini-3-flash-preview | gemini-2.0-flash-lite | gemini-2.0-flash-lite | gemini-2.0-flash-lite |
| **gemma-3-4b** | gemma-3-4b-it | gemma-3-4b-it | gemma-3-4b-it | gemma-3-4b-it |
| **gemma-3-12b** | gemma-3-12b-it | gemma-3-4b-it | gemma-3-4b-it | gemma-3-4b-it |
| **llama-3.2-3b** | gemini-2.0-flash | llama-3.2-3b (MaaS) | gemini-2.0-flash-lite | gemini-2.0-flash-lite |
| **mistral-small** | gemini-2.0-flash | mistral-small-2503 (MaaS) | gemini-2.0-flash-lite | gemini-2.0-flash-lite |

## Performance

Blocks generated in parallel. Total = reasoning + parallel block generation.

| Preset | Reasoning | Total | Blocks | Status |
|--------|-----------|-------|--------|--------|
| **gemma-3-4b** | ~1-4s | **~1-4s** | 4 | GA (Google open model) |
| **gemma-3-12b** | ~1-4s | **~1-4s** | 4 | GA (Google open model) |
| **llama** | ~5-8s | **~9-13s** | 4 | Model Garden MaaS |
| **llama-3.2-3b** | ~9-17s | **~9-17s** | 5 | MaaS + Gemini Flash |
| **mistral-small** | ~10-13s | **~10-13s** | 5 | MaaS + Gemini Flash |
| **gemini-2.0** | ~9-11s | **~17-21s** | 5 | Stable GA |
| **gemini-3-flash** | ~14-15s | **~18-23s** | 4-5 | Preview |
| **development** | ~15-16s | **~20-24s** | 5 | Preview |
| **gemini-2.5** | ~21-24s | **~26s** | 2-5 | Stable GA |
| **production** | ~28-37s | **~30-44s** | 2-5 | Preview (best quality) |

## Recommendations

- **Fastest:** `gemma-3-4b` or `gemma-3-12b` -- Under 4s total, Google open models
- **Best speed + quality:** `mistral-small` or `llama-3.2-3b` -- 10-17s, MaaS models with Gemini reasoning
- **Best Gemini speed:** `gemini-2.0` -- ~18s, stable GA Flash models
- **Best quality:** `production` -- ~30-44s, Gemini 3 Pro reasoning
- **Balanced GA:** `gemini-2.5` -- ~26s, stable Pro reasoning
- **Budget demos:** `gemini-3-flash` or `development` -- ~20s, all Flash preview

## Notes

- All presets use `gemini-2.0-flash-lite` for content/classification (except all-in-one presets like gemma/llama)
- maxTokens reduced to match actual usage: reasoning 2048, content 1536, classification 512, validation 256
- Block generation runs in parallel via `Promise.all` (blocks arrive simultaneously after reasoning)
- Gemma presets produce 4 blocks (may truncate reasoning JSON); quality varies with small models
- MaaS models (llama, mistral) route through Vertex AI Model Garden publishers
