/**
 * Model Factory (Google-Only) - Pure Google Cloud AI stack
 *
 * Uses only Gemini and Vertex AI Model Garden models.
 * NO external providers (Anthropic, Cerebras, OpenAI).
 * Passwordless authentication via Application Default Credentials.
 */

import type { Env, ModelRole, ModelConfig, ModelPreset } from '../types';
import { VertexAIClient, createVertexAIClient } from './vertex-ai-client';
import { ModelGardenClient } from './model-garden-client';

// ============================================
// Google-Only Model Presets
// ============================================

const MODEL_PRESETS: Record<string, ModelPreset> = {
	// Production: Gemini 3 Pro reasoning, Flash-Lite for content/classification (fast + quality)
	production: {
		reasoning: {
			provider: 'google',
			model: 'gemini-3-pro-preview',
			maxTokens: 2048,
			temperature: 0.7,
		},
		content: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 1536,
			temperature: 0.8,
		},
		classification: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 512,
			temperature: 0.3,
		},
		validation: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 256,
			temperature: 0.2,
		},
	},

	// Gemini 3 Flash: Gemini 3 Flash reasoning, Flash-Lite for content
	'gemini-3-flash': {
		reasoning: {
			provider: 'google',
			model: 'gemini-3-flash-preview',
			maxTokens: 2048,
			temperature: 0.7,
		},
		content: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 1536,
			temperature: 0.8,
		},
		classification: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 512,
			temperature: 0.3,
		},
		validation: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 256,
			temperature: 0.2,
		},
	},

	// Gemini 2.5: Stable GA models -- Pro for reasoning, Flash-Lite for content
	'gemini-2.5': {
		reasoning: {
			provider: 'google',
			model: 'gemini-2.5-pro',
			maxTokens: 2048,
			temperature: 0.7,
		},
		content: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 1536,
			temperature: 0.8,
		},
		classification: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 512,
			temperature: 0.3,
		},
		validation: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 256,
			temperature: 0.2,
		},
	},

	// Gemini 2.0: Fastest stable models -- Flash for reasoning, Flash-Lite for content
	'gemini-2.0': {
		reasoning: {
			provider: 'google',
			model: 'gemini-2.0-flash',
			maxTokens: 2048,
			temperature: 0.7,
		},
		content: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 1536,
			temperature: 0.8,
		},
		classification: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 512,
			temperature: 0.3,
		},
		validation: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 256,
			temperature: 0.2,
		},
	},

	// Llama 3.3 70B via Vertex AI Model Garden (all roles)
	llama: {
		reasoning: {
			provider: 'model-garden',
			model: 'llama-3.3-70b-instruct-maas',
			maxTokens: 2048,
			temperature: 0.7,
		},
		content: {
			provider: 'model-garden',
			model: 'llama-3.3-70b-instruct-maas',
			maxTokens: 1536,
			temperature: 0.8,
		},
		classification: {
			provider: 'model-garden',
			model: 'llama-3.3-70b-instruct-maas',
			maxTokens: 512,
			temperature: 0.3,
		},
		validation: {
			provider: 'model-garden',
			model: 'llama-3.3-70b-instruct-maas',
			maxTokens: 256,
			temperature: 0.2,
		},
	},

	// Development: Gemini 3 Flash reasoning, Flash-Lite for content
	development: {
		reasoning: {
			provider: 'google',
			model: 'gemini-3-flash-preview',
			maxTokens: 2048,
			temperature: 0.7,
		},
		content: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 1536,
			temperature: 0.8,
		},
		classification: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 512,
			temperature: 0.3,
		},
		validation: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 256,
			temperature: 0.2,
		},
	},

	// Model Garden: Llama 3.3 for all tasks
	'model-garden-llama': {
		reasoning: {
			provider: 'model-garden',
			model: 'llama-3.3-70b-instruct-maas',
			maxTokens: 2048,
			temperature: 0.7,
		},
		content: {
			provider: 'model-garden',
			model: 'llama-3.3-70b-instruct-maas',
			maxTokens: 1536,
			temperature: 0.8,
		},
		classification: {
			provider: 'model-garden',
			model: 'llama-3.3-70b-instruct-maas',
			maxTokens: 512,
			temperature: 0.3,
		},
		validation: {
			provider: 'model-garden',
			model: 'llama-3.3-70b-instruct-maas',
			maxTokens: 256,
			temperature: 0.2,
		},
	},

	// Gemma 3 4B: Smallest/fastest Google open model for all roles
	'gemma-3-4b': {
		reasoning: {
			provider: 'google',
			model: 'gemma-3-4b-it',
			maxTokens: 2048,
			temperature: 0.7,
		},
		content: {
			provider: 'google',
			model: 'gemma-3-4b-it',
			maxTokens: 1536,
			temperature: 0.8,
		},
		classification: {
			provider: 'google',
			model: 'gemma-3-4b-it',
			maxTokens: 512,
			temperature: 0.3,
		},
		validation: {
			provider: 'google',
			model: 'gemma-3-4b-it',
			maxTokens: 256,
			temperature: 0.2,
		},
	},

	// Gemma 3 12B: Balanced Google open model -- 12B reasoning, 4B content
	'gemma-3-12b': {
		reasoning: {
			provider: 'google',
			model: 'gemma-3-12b-it',
			maxTokens: 2048,
			temperature: 0.7,
		},
		content: {
			provider: 'google',
			model: 'gemma-3-4b-it',
			maxTokens: 1536,
			temperature: 0.8,
		},
		classification: {
			provider: 'google',
			model: 'gemma-3-4b-it',
			maxTokens: 512,
			temperature: 0.3,
		},
		validation: {
			provider: 'google',
			model: 'gemma-3-4b-it',
			maxTokens: 256,
			temperature: 0.2,
		},
	},

	// Llama 3.2 3B: Smallest Llama via Model Garden MaaS
	'llama-3.2-3b': {
		reasoning: {
			provider: 'google',
			model: 'gemini-2.0-flash',
			maxTokens: 2048,
			temperature: 0.7,
		},
		content: {
			provider: 'model-garden',
			model: 'llama-3.2-3b-instruct-maas',
			maxTokens: 1536,
			temperature: 0.8,
		},
		classification: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 512,
			temperature: 0.3,
		},
		validation: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 256,
			temperature: 0.2,
		},
	},

	// Mistral Small 3.1 24B: Fast Mistral via Model Garden MaaS
	'mistral-small': {
		reasoning: {
			provider: 'google',
			model: 'gemini-2.0-flash',
			maxTokens: 2048,
			temperature: 0.7,
		},
		content: {
			provider: 'model-garden',
			model: 'mistral-small-2503',
			maxTokens: 1536,
			temperature: 0.8,
		},
		classification: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 512,
			temperature: 0.3,
		},
		validation: {
			provider: 'google',
			model: 'gemini-2.0-flash-lite',
			maxTokens: 256,
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
// Model Factory Class (Google-Only)
// ============================================

export class GoogleModelFactory {
	private preset: ModelPreset;
	private presetName: string;
	private vertexAIClient: VertexAIClient;
	private modelGardenClient: ModelGardenClient;

	constructor(presetName: string = 'production', projectId?: string, location?: string) {
		this.presetName = presetName;
		this.preset = MODEL_PRESETS[presetName] || MODEL_PRESETS.production;

		// Initialize Google clients with passwordless auth
		const pid = projectId || process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';
		const loc = location || process.env.GCP_LOCATION || 'us-central1';

		this.vertexAIClient = new VertexAIClient(pid, loc);
		this.modelGardenClient = new ModelGardenClient(pid, loc);
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
	async call(role: ModelRole, messages: Message[]): Promise<ModelResponse> {
		const config = this.preset[role];
		const startTime = Date.now();

		let response: ModelResponse;

		switch (config.provider) {
			case 'google':
				response = await this.callGemini(config, messages);
				break;
			case 'model-garden':
				response = await this.callModelGarden(config, messages);
				break;
			default:
				throw new Error(`Unknown provider: ${config.provider}`);
		}

		response.duration = Date.now() - startTime;
		return response;
	}

	/**
	 * Call Gemini via Vertex AI (passwordless)
	 */
	private async callGemini(
		config: ModelConfig,
		messages: Message[]
	): Promise<ModelResponse> {
		try {
			const response = await this.vertexAIClient.generateContent(
				config.model,
				messages,
				{
					temperature: config.temperature,
					maxTokens: config.maxTokens,
					stream: false,
				}
			);

			return {
				content: response.content,
				model: response.model,
				usage: response.usage,
			};
		} catch (error) {
			console.error('[GoogleModelFactory] Gemini error:', error);
			throw new Error(`Gemini generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Call Model Garden (Llama MaaS) via Vertex AI generateContent API.
	 * Llama on MaaS supports the same generateContent endpoint as Gemini,
	 * routed through publishers/meta/models/{model-id}.
	 */
	private async callModelGarden(
		config: ModelConfig,
		messages: Message[]
	): Promise<ModelResponse> {
		try {
			const response = await this.vertexAIClient.generateContent(
				config.model,
				messages,
				{
					temperature: config.temperature,
					maxTokens: config.maxTokens,
					stream: false,
				}
			);

			return {
				content: response.content,
				model: response.model,
				usage: response.usage,
			};
		} catch (error) {
			console.error('[GoogleModelFactory] Model Garden error:', error);
			throw new Error(`Model Garden generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
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
 * Create a GoogleModelFactory instance
 * @param presetOverride - Optional preset override from query parameter
 */
export function createGoogleModelFactory(
	presetOverride?: string,
	projectId?: string,
	location?: string
): GoogleModelFactory {
	// Get preset from parameter or environment
	const preset = presetOverride || process.env.MODEL_PRESET || 'production';

	return new GoogleModelFactory(preset, projectId, location);
}
