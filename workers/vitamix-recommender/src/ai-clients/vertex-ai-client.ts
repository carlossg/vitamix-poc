/**
 * Vertex AI Client - Google Cloud Gemini integration with passwordless auth
 *
 * Uses Application Default Credentials (ADC) for authentication.
 * Supports both Gemini models and Vertex AI Model Garden.
 */

import type { Env } from '../types';

// Message types for chat completions
export interface Message {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface VertexAIResponse {
	content: string;
	model: string;
	stopReason?: string;
	usage?: {
		inputTokens: number;
		outputTokens: number;
	};
}

/**
 * Vertex AI Client using @google-cloud/vertexai SDK
 * Authenticates via Application Default Credentials (passwordless)
 */
export class VertexAIClient {
	private projectId: string;
	private location: string;

	constructor(projectId: string, location: string = 'us-central1') {
		this.projectId = projectId;
		this.location = location;
	}

	/**
	 * Determine the correct Vertex AI location for a model.
	 * Gemini 3 models (preview) are only available in the "global" region.
	 */
	private getLocationForModel(model: string): string {
		if (model.startsWith('gemini-3')) {
			return 'global';
		}
		return this.location;
	}

	/**
	 * Generate content using Gemini models
	 */
	async generateContent(
		model: string,
		messages: Message[],
		options: {
			temperature?: number;
			maxTokens?: number;
			stream?: boolean;
		} = {}
	): Promise<VertexAIResponse> {
		const { VertexAI } = await import('@google-cloud/vertexai');

		// Gemini 3 models require the "global" endpoint; others use configured location
		const location = this.getLocationForModel(model);
		const isGlobal = location === 'global';

		// Initialize Vertex AI with ADC (no API keys)
		const vertexAI = new VertexAI({
			project: this.projectId,
			location,
			...(isGlobal ? { apiEndpoint: 'aiplatform.googleapis.com' } : {}),
		});

		// Get the generative model
		const generativeModel = vertexAI.getGenerativeModel({
			model: model,
			generationConfig: {
				temperature: options.temperature ?? 0.7,
				maxOutputTokens: options.maxTokens ?? 4096,
			},
		});

		// Convert messages to Gemini format
		const contents = this.convertMessagesToGeminiFormat(messages);

		try {
			if (options.stream) {
				// Streaming not yet implemented for SSE
				// For now, fall back to non-streaming
				const result = await generativeModel.generateContent({ contents });
				const response = result.response;
				const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

				return {
					content: text,
					model: model,
					usage: {
						inputTokens: response.usageMetadata?.promptTokenCount || 0,
						outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
					},
				};
			}

			const result = await generativeModel.generateContent({ contents });
			const response = result.response;
			const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

			return {
				content: text,
				model: model,
				usage: {
					inputTokens: response.usageMetadata?.promptTokenCount || 0,
					outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
				},
			};
		} catch (error) {
			console.error('[VertexAI] Generation error:', error);
			throw new Error(`Vertex AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Convert standard messages to Gemini format
	 * Gemini uses a different message structure than OpenAI/Anthropic
	 */
	private convertMessagesToGeminiFormat(messages: Message[]): any[] {
		// Combine system messages into the first user message
		let systemContent = '';
		const contentMessages: Message[] = [];

		for (const msg of messages) {
			if (msg.role === 'system') {
				systemContent += msg.content + '\n\n';
			} else {
				contentMessages.push(msg);
			}
		}

		// If we have system content, prepend it to the first user message
		if (systemContent && contentMessages.length > 0 && contentMessages[0].role === 'user') {
			contentMessages[0] = {
				...contentMessages[0],
				content: systemContent + contentMessages[0].content,
			};
		}

		// Convert to Gemini format
		return contentMessages.map((msg) => ({
			role: msg.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: msg.content }],
		}));
	}

	/**
	 * Generate embeddings using Vertex AI Text Embeddings API
	 * Used for recipe semantic search with Firebase Vector Search
	 */
	async generateEmbeddings(texts: string[]): Promise<number[][]> {
		const { PredictionServiceClient } = await import('@google-cloud/aiplatform');

		// Initialize client with ADC
		const client = new PredictionServiceClient({
			apiEndpoint: `${this.location}-aiplatform.googleapis.com`,
		});

		const endpoint = `projects/${this.projectId}/locations/${this.location}/publishers/google/models/text-embedding-005`;

		try {
			const instances = texts.map((text) => ({
				content: text,
			})) as any[];

			const response = await client.predict({
				endpoint,
				instances,
			});

			// Extract embeddings from predictions
			const embeddings: number[][] = [];
			const predictions = Array.isArray(response) ? response[0]?.predictions : (response as any).predictions;
			for (const prediction of predictions || []) {
				const embedding = (prediction as any).embeddings?.values || [];
				embeddings.push(embedding);
			}

			return embeddings;
		} catch (error) {
			console.error('[VertexAI] Embeddings error:', error);
			throw new Error(`Vertex AI embeddings failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}

/**
 * Create Vertex AI client instance
 * Automatically uses Application Default Credentials
 */
export function createVertexAIClient(env: Env): VertexAIClient {
	// Get project ID from environment or use default
	const projectId = env.GCP_PROJECT_ID || process.env.GCP_PROJECT_ID || 'vitamix-poc';
	const location = env.GCP_LOCATION || process.env.GCP_LOCATION || 'us-central1';

	return new VertexAIClient(projectId, location);
}
