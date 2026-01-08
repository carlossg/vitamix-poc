/**
 * Model Factory - Abstraction layer for AI model selection
 *
 * Allows easy swapping between different models for different roles:
 * - reasoning: Claude Opus for high-quality intent analysis and block selection
 * - content: Cerebras for fast content generation
 * - classification: Fast models for intent classification
 */

import type { Env, ModelRole, ModelConfig, ModelPreset } from '../types';

// ============================================
// Model Presets
// ============================================

const MODEL_PRESETS: Record<string, ModelPreset> = {
  // Production preset: Opus reasoning, Cerebras content
  production: {
    reasoning: {
      provider: 'anthropic',
      model: 'claude-opus-4-5-20251101',
      maxTokens: 4096,
      temperature: 0.7,
    },
    content: {
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      maxTokens: 4096,
      temperature: 0.8,
    },
    classification: {
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      maxTokens: 500,
      temperature: 0.3,
    },
    validation: {
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      maxTokens: 300,
      temperature: 0.2,
    },
  },

  // Fast preset: Sonnet reasoning for faster response
  fast: {
    reasoning: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      maxTokens: 2048,
      temperature: 0.7,
    },
    content: {
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      maxTokens: 4096,
      temperature: 0.8,
    },
    classification: {
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      maxTokens: 500,
      temperature: 0.3,
    },
    validation: {
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      maxTokens: 300,
      temperature: 0.2,
    },
  },

  // All-Cerebras preset for cost optimization
  'all-cerebras': {
    reasoning: {
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      maxTokens: 4096,
      temperature: 0.7,
    },
    content: {
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      maxTokens: 4096,
      temperature: 0.8,
    },
    classification: {
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      maxTokens: 500,
      temperature: 0.3,
    },
    validation: {
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      maxTokens: 300,
      temperature: 0.2,
    },
  },

  // Gemini 3.0 Flash - All roles use latest Gemini 3.0
  'gemini-3-all': {
    reasoning: {
      provider: 'google',
      model: 'gemini-3-flash-preview',
      maxTokens: 8192,
      temperature: 0.7,
    },
    content: {
      provider: 'google',
      model: 'gemini-3-flash-preview',
      maxTokens: 8192,
      temperature: 0.8,
    },
    classification: {
      provider: 'google',
      model: 'gemini-3-flash-preview',
      maxTokens: 1024,
      temperature: 0.3,
    },
    validation: {
      provider: 'google',
      model: 'gemini-3-flash-preview',
      maxTokens: 512,
      temperature: 0.2,
    },
  },

  // Gemini 2.5 Flash - All roles use stable Gemini 2.5
  'gemini-2.5-all': {
    reasoning: {
      provider: 'google',
      model: 'gemini-2.5-flash',
      maxTokens: 8192,
      temperature: 0.7,
    },
    content: {
      provider: 'google',
      model: 'gemini-2.5-flash',
      maxTokens: 8192,
      temperature: 0.8,
    },
    classification: {
      provider: 'google',
      model: 'gemini-2.5-flash',
      maxTokens: 1024,
      temperature: 0.3,
    },
    validation: {
      provider: 'google',
      model: 'gemini-2.5-flash',
      maxTokens: 512,
      temperature: 0.2,
    },
  },

  // Gemini Mixed - Use 3.0 for reasoning, 2.5 for content generation
  'gemini-mixed': {
    reasoning: {
      provider: 'google',
      model: 'gemini-3-flash-preview',
      maxTokens: 8192,
      temperature: 0.7,
    },
    content: {
      provider: 'google',
      model: 'gemini-2.5-flash',
      maxTokens: 8192,
      temperature: 0.8,
    },
    classification: {
      provider: 'google',
      model: 'gemini-2.5-flash',
      maxTokens: 1024,
      temperature: 0.3,
    },
    validation: {
      provider: 'google',
      model: 'gemini-2.5-flash',
      maxTokens: 512,
      temperature: 0.2,
    },
  },

  // Gemini Production - Balanced default configuration
  'gemini-production': {
    reasoning: {
      provider: 'google',
      model: 'gemini-3-flash-preview',
      maxTokens: 8192,
      temperature: 0.7,
    },
    content: {
      provider: 'google',
      model: 'gemini-3-flash-preview',
      maxTokens: 8192,
      temperature: 0.8,
    },
    classification: {
      provider: 'google',
      model: 'gemini-2.5-flash',
      maxTokens: 1024,
      temperature: 0.3,
    },
    validation: {
      provider: 'google',
      model: 'gemini-2.5-flash',
      maxTokens: 512,
      temperature: 0.2,
    },
  },

  // Local LMStudio - All roles use local Gemma/Llama model
  'local-gemma': {
    reasoning: {
      provider: 'lmstudio',
      model: 'gemma-2-9b-it',
      maxTokens: 8192,
      temperature: 0.7,
    },
    content: {
      provider: 'lmstudio',
      model: 'gemma-2-9b-it',
      maxTokens: 8192,
      temperature: 0.8,
    },
    classification: {
      provider: 'lmstudio',
      model: 'gemma-2-9b-it',
      maxTokens: 1024,
      temperature: 0.3,
    },
    validation: {
      provider: 'lmstudio',
      model: 'gemma-2-9b-it',
      maxTokens: 512,
      temperature: 0.2,
    },
  },

  // Local Fast - Hybrid: Cerebras reasoning + LMStudio content (cost-optimized)
  'local-fast': {
    reasoning: {
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      maxTokens: 4096,
      temperature: 0.7,
    },
    content: {
      provider: 'lmstudio',
      model: 'gemma-2-9b-it',
      maxTokens: 8192,
      temperature: 0.8,
    },
    classification: {
      provider: 'lmstudio',
      model: 'gemma-2-9b-it',
      maxTokens: 1024,
      temperature: 0.3,
    },
    validation: {
      provider: 'lmstudio',
      model: 'gemma-2-9b-it',
      maxTokens: 512,
      temperature: 0.2,
    },
  },
};

// ============================================
// Message Types
// ============================================

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  duration?: number;
}

// ============================================
// Model Factory Class
// ============================================

export class ModelFactory {
  private preset: ModelPreset;
  private presetName: string;

  constructor(presetName: string = 'production') {
    this.presetName = presetName;
    this.preset = MODEL_PRESETS[presetName] || MODEL_PRESETS['production'];
  }

  /**
   * Override all Google models in the preset with a specific model version
   * This allows runtime switching between gemini-3-flash-preview and gemini-2.5-flash
   */
  overrideGeminiModel(modelVersion: string): void {
    const roles: ModelRole[] = ['reasoning', 'content', 'classification', 'validation'];
    
    for (const role of roles) {
      if (this.preset[role].provider === 'google') {
        this.preset[role] = {
          ...this.preset[role],
          model: modelVersion,
        };
      }
    }
  }

  /**
   * Get the configuration for a specific role
   */
  getConfig(role: ModelRole): ModelConfig {
    return this.preset[role];
  }

  /**
   * Call a model for a specific role
   */
  async call(
    role: ModelRole,
    messages: Message[],
    env: Env
  ): Promise<ModelResponse> {
    const config = this.preset[role];
    const startTime = Date.now();

    let response: ModelResponse;

    switch (config.provider) {
      case 'anthropic':
        response = await this.callAnthropic(config, messages, env);
        break;
      case 'cerebras':
        response = await this.callCerebras(config, messages, env);
        break;
      case 'google':
        response = await this.callGoogle(config, messages, env);
        break;
      case 'lmstudio':
        response = await this.callLMStudio(config, messages, env);
        break;
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }

    response.duration = Date.now() - startTime;
    return response;
  }

  /**
   * Call Anthropic Claude API
   */
  private async callAnthropic(
    config: ModelConfig,
    messages: Message[],
    env: Env
  ): Promise<ModelResponse> {
    const systemMessage = messages.find((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.7,
        system: systemMessage?.content || '',
        messages: otherMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
      model: string;
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content[0]?.text || '',
      model: data.model,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
    };
  }

  /**
   * Call Cerebras API
   */
  private async callCerebras(
    config: ModelConfig,
    messages: Message[],
    env: Env
  ): Promise<ModelResponse> {
    const response = await fetch(
      'https://api.cerebras.ai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.CEREBRAS_API_KEY || env.CEREBRAS_KEY}`,
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens || 4096,
          temperature: config.temperature || 0.8,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Cerebras] API error ${response.status}:`, error);
      throw new Error(`Cerebras API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      model: string;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      },
    };
  }

  /**
   * Call Google Gemini API
   */
  private async callGoogle(
    config: ModelConfig,
    messages: Message[],
    env: Env
  ): Promise<ModelResponse> {
    // Extract system message if present
    const systemMessage = messages.find((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    // Convert messages to Gemini format
    const contents = otherMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: config.temperature || 0.7,
        maxOutputTokens: config.maxTokens || 8192,
      },
    };

    // Add system instruction if present
    if (systemMessage) {
      requestBody.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.GOOGLE_API_KEY,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Gemini] API error ${response.status}:`, error);
      throw new Error(`Google Gemini API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      candidates: {
        content: {
          parts: { text: string }[];
        };
      }[];
      usageMetadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
      };
    };

    const textContent = data.candidates[0]?.content?.parts[0]?.text || '';
    
    return {
      content: textContent,
      model: config.model,
      usage: data.usageMetadata
        ? {
            inputTokens: data.usageMetadata.promptTokenCount,
            outputTokens: data.usageMetadata.candidatesTokenCount,
          }
        : undefined,
    };
  }

  /**
   * Call LMStudio local server (OpenAI-compatible API)
   */
  private async callLMStudio(
    config: ModelConfig,
    messages: Message[],
    env: Env
  ): Promise<ModelResponse> {
    // LMStudio runs locally with OpenAI-compatible API
    const baseUrl = env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
    const model = env.LMSTUDIO_MODEL || config.model;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // LMStudio doesn't require auth for local connections
      },
      body: JSON.stringify({
        model: model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 8192,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[LMStudio] API error ${response.status}:`, error);
      throw new Error(`LMStudio API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model || model,
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }

  /**
   * Get the current preset name
   */
  getPresetName(): string {
    return this.presetName;
  }

  /**
   * Get available presets
   */
  static getAvailablePresets(): string[] {
    return Object.keys(MODEL_PRESETS);
  }
}

/**
 * Create a ModelFactory instance from environment
 * @param env - Environment bindings
 * @param presetOverride - Optional preset override from query parameter (allows runtime switching)
 * @param modelOverride - Optional model version override (e.g., 'gemini-2.5-flash')
 */
export function createModelFactory(
  env: Env,
  presetOverride?: string,
  modelOverride?: string
): ModelFactory {
  // Priority: presetOverride > env.MODEL_PRESET > default
  const preset = presetOverride || env.MODEL_PRESET || 'production';
  
  // Create factory with the selected preset
  const factory = new ModelFactory(preset);
  
  // Apply model version override if provided (only affects Google models)
  // Priority: modelOverride param > env.GEMINI_MODEL_VERSION
  const modelVersion = modelOverride || env.GEMINI_MODEL_VERSION;
  if (modelVersion) {
    factory.overrideGeminiModel(modelVersion);
  }
  
  return factory;
}
