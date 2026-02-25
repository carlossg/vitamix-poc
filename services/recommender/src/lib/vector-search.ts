import { Firestore, VectorQuery, VectorQuerySnapshot } from '@google-cloud/firestore';
import { VertexAI } from '@google-cloud/vertexai';

/**
 * Firebase Vector Search client for recipe semantic search
 * Replaces Cloudflare Vectorize
 * Uses Application Default Credentials (passwordless)
 */

export interface Recipe {
	id: string;
	name: string;
	description: string;
	ingredients: string[];
	instructions?: string[];
	categories?: string[];
	dietaryInfo?: string[];
	embedding?: number[];
}

export interface VectorSearchResult {
	recipe: Recipe;
	distance: number;
}

export class FirebaseVectorSearchClient {
	private firestore: Firestore;
	private vertexAI: VertexAI;
	private readonly EMBEDDING_MODEL = 'text-embedding-005';
	private readonly VECTOR_DIMENSION = 768;

	constructor(projectId?: string, location: string = 'us-central1') {
		// Passwordless - uses ADC
		this.firestore = new Firestore({
			projectId,
		});

		this.vertexAI = new VertexAI({
			project: projectId,
			location,
		});
	}

	/**
	 * Generate embedding for text using Vertex AI
	 */
	async generateEmbedding(text: string): Promise<number[]> {
		try {
			const model = this.vertexAI.preview.getGenerativeModel({
				model: this.EMBEDDING_MODEL,
			});

			const result = await model.generateContent({
				contents: [{ role: 'user', parts: [{ text }] }],
			});

			// Extract embedding from response
			// Note: Actual implementation may vary based on Vertex AI SDK response format
			const embedding = (result.response as any).embedding?.values || [];

			if (embedding.length !== this.VECTOR_DIMENSION) {
				throw new Error(`Expected ${this.VECTOR_DIMENSION}-dim embedding, got ${embedding.length}`);
			}

			return embedding;
		} catch (error) {
			console.error('Error generating embedding:', error);
			throw error;
		}
	}

	/**
	 * Search recipes using semantic vector search
	 */
	async searchRecipes(query: string, limit: number = 10): Promise<VectorSearchResult[]> {
		try {
			// Generate embedding for query
			const queryEmbedding = await this.generateEmbedding(query);

			// Perform vector search using Firebase Vector Search
			const vectorQuery: VectorQuery = this.firestore
				.collection('recipes')
				.findNearest('embedding', queryEmbedding, {
					limit,
					distanceMeasure: 'COSINE',
				});

			const snapshot: VectorQuerySnapshot = await vectorQuery.get();

			// Map results to Recipe objects with distance scores
			const results: VectorSearchResult[] = snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					recipe: {
						id: doc.id,
						name: data.name,
						description: data.description,
						ingredients: data.ingredients || [],
						instructions: data.instructions || [],
						categories: data.categories || [],
						dietaryInfo: data.dietaryInfo || [],
						embedding: data.embedding,
					},
					distance: (doc as any).distance || 0, // Cosine distance
				};
			});

			return results;
		} catch (error) {
			console.error('Error searching recipes:', error);
			throw error;
		}
	}

	/**
	 * Add or update recipe with embedding
	 */
	async upsertRecipe(recipe: Recipe): Promise<void> {
		try {
			// Generate embedding if not provided
			let embedding = recipe.embedding;
			if (!embedding) {
				const textToEmbed = `${recipe.name} ${recipe.description} ${recipe.ingredients.join(' ')}`;
				embedding = await this.generateEmbedding(textToEmbed);
			}

			const docRef = this.firestore.collection('recipes').doc(recipe.id);
			await docRef.set({
				name: recipe.name,
				description: recipe.description,
				ingredients: recipe.ingredients,
				instructions: recipe.instructions || [],
				categories: recipe.categories || [],
				dietaryInfo: recipe.dietaryInfo || [],
				embedding,
				updatedAt: new Date().toISOString(),
			}, { merge: true });
		} catch (error) {
			console.error('Error upserting recipe:', error);
			throw error;
		}
	}

	/**
	 * Get recipe by ID
	 */
	async getRecipe(recipeId: string): Promise<Recipe | null> {
		try {
			const docRef = this.firestore.collection('recipes').doc(recipeId);
			const doc = await docRef.get();

			if (!doc.exists) {
				return null;
			}

			const data = doc.data();
			return {
				id: doc.id,
				name: data?.name || '',
				description: data?.description || '',
				ingredients: data?.ingredients || [],
				instructions: data?.instructions || [],
				categories: data?.categories || [],
				dietaryInfo: data?.dietaryInfo || [],
				embedding: data?.embedding,
			};
		} catch (error) {
			console.error('Error getting recipe:', error);
			throw error;
		}
	}

	/**
	 * Batch upsert recipes (for initial data loading)
	 */
	async batchUpsertRecipes(recipes: Recipe[]): Promise<void> {
		try {
			const batch = this.firestore.batch();
			let count = 0;

			for (const recipe of recipes) {
				// Generate embedding if not provided
				let embedding = recipe.embedding;
				if (!embedding) {
					const textToEmbed = `${recipe.name} ${recipe.description} ${recipe.ingredients.join(' ')}`;
					embedding = await this.generateEmbedding(textToEmbed);
				}

				const docRef = this.firestore.collection('recipes').doc(recipe.id);
				batch.set(docRef, {
					name: recipe.name,
					description: recipe.description,
					ingredients: recipe.ingredients,
					instructions: recipe.instructions || [],
					categories: recipe.categories || [],
					dietaryInfo: recipe.dietaryInfo || [],
					embedding,
					updatedAt: new Date().toISOString(),
				}, { merge: true });

				count++;

				// Firestore batch limit is 500 operations
				if (count % 500 === 0) {
					await batch.commit();
					console.log(`Committed batch of ${count} recipes`);
				}
			}

			// Commit remaining operations
			if (count % 500 !== 0) {
				await batch.commit();
				console.log(`Committed final batch of ${count % 500} recipes`);
			}
		} catch (error) {
			console.error('Error batch upserting recipes:', error);
			throw error;
		}
	}
}
