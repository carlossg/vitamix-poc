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

## Preset Details

| Preset | Reasoning | Content | Classification | Validation |
|--------|-----------|---------|----------------|------------|
| **production** | gemini-3-pro-preview | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview |
| **gemini-3-flash** | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview |
| **gemini-2.5** | gemini-2.5-pro | gemini-2.5-flash | gemini-2.5-flash | gemini-2.5-flash |
| **gemini-2.0** | gemini-2.0-flash | gemini-2.0-flash | gemini-2.0-flash | gemini-2.0-flash |
| **llama** | llama-3.3-70b (Model Garden) | llama-3.3-70b (Model Garden) | llama-3.3-70b (Model Garden) | llama-3.3-70b (Model Garden) |
| **development** | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview | gemini-3-flash-preview |

## Performance

| Preset | Reasoning | Blocks (5) | Total | Status |
|--------|-----------|------------|-------|--------|
| **production** | ~33s | ~42s | **~75s** | Preview |
| **gemini-3-flash** | ~15s | ~35s | ~50s | Preview |
| **gemini-2.5** | ~29s | ~44s | ~74s | Stable GA |
| **gemini-2.0** | ~8s | ~15s | **~23s** | Stable GA |
| **llama** | varies | varies | varies | Model Garden |
| **development** | ~15s | ~35s | ~50s | Preview |

## Recommendations

- **Best quality:** `production` -- Gemini 3 Pro reasoning with Flash content
- **Best speed:** `gemini-2.0` -- 3x faster than production, stable GA models
- **Balanced:** `gemini-2.5` -- Stable GA with strong Pro reasoning
- **Budget demos:** `gemini-3-flash` or `development` -- All Flash, no Pro overhead
