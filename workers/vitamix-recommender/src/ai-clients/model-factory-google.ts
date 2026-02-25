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
	// Production: Gemini 3 Pro for reasoning, Gemini 3 Flash for content/classification
	production: {
		reasoning: {
			provider: 'google',
			model: 'gemini-3-pro-preview',
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

	// Gemini-only: Pro for reasoning, Flash for content
	'gemini-only': {
		reasoning: {
			provider: 'google',
			model: 'gemini-3-pro-preview',
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

	// Fast: All Gemini 3 Flash for speed
	fast: {
		reasoning: {
			provider: 'google',
			model: 'gemini-3-flash-preview',
			maxTokens: 4096,
			temperature: 0.7,
		},
		content: {
			provider: 'google',
			model: 'gemini-3-flash-preview',
			maxTokens: 4096,
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

	// Llama: Content via Model Garden Llama; reasoning/classification via Gemini 3
	llama: {
		reasoning: {
			provider: 'google',
			model: 'gemini-3-pro-preview',
			maxTokens: 8192,
			temperature: 0.7,
		},
		content: {
			provider: 'model-garden',
			model: 'llama-3-3-70b-instruct-maas',
			maxTokens: 4096,
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

	// Development: Gemini 3 Flash for fast iteration
	development: {
		reasoning: {
			provider: 'google',
			model: 'gemini-3-flash-preview',
			maxTokens: 4096,
			temperature: 0.7,
		},
		content: {
			provider: 'google',
			model: 'gemini-3-flash-preview',
			maxTokens: 4096,
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

	// Model Garden: Llama 3.3 for all tasks
	'model-garden-llama': {
		reasoning: {
			provider: 'model-garden',
			model: 'llama-3-3-70b-instruct-maas',
			maxTokens: 4096,
			temperature: 0.7,
		},
		content: {
			provider: 'model-garden',
			model: 'llama-3-3-70b-instruct-maas',
			maxTokens: 4096,
			temperature: 0.8,
		},
		classification: {
			provider: 'model-garden',
			model: 'llama-3-3-70b-instruct-maas',
			maxTokens: 1024,
			temperature: 0.3,
		},
		validation: {
			provider: 'model-garden',
			model: 'llama-3-3-70b-instruct-maas',
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
	 * Call Model Garden (Llama, Mistral) via Vertex AI (passwordless)
	 */
	private async callModelGarden(
		config: ModelConfig,
		messages: Message[]
	): Promise<ModelResponse> {
		try {
			// Convert messages to a single prompt (Model Garden typically uses single-turn)
			const systemMessage = messages.find(m => m.role === 'system');
			const userMessages = messages.filter(m => m.role === 'user');

			let prompt = '';
			if (systemMessage) {
				prompt += `${systemMessage.content}\n\n`;
			}
			for (const msg of userMessages) {
				prompt += `${msg.content}\n`;
			}

			// Call Llama 3.3 70B
			const content = await this.modelGardenClient.generateWithLlama(prompt, {
				temperature: config.temperature,
				maxTokens: config.maxTokens,
			});

			return {
				content,
				model: config.model,
				// Model Garden doesn't return token usage
				usage: undefined,
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
