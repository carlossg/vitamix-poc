/**
 * Vitamix Recipe Embeddings Cloud Function (Google-Native)
 *
 * Generates embeddings for recipes using Vertex AI and stores them in Firebase Vector Search.
 * Triggered by Cloud Storage events when recipe JSONs are uploaded.
 * Passwordless authentication via Application Default Credentials.
 *
 * Exports plain HTTP/event handlers for gcloud functions deploy --gen2.
 */

import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { GoogleAuth } from 'google-auth-library';

// ============================================
// Configuration
// ============================================

function getProjectId(): string {
	return process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';
}
const LOCATION = process.env.GCP_LOCATION || 'us-central1';
const EMBEDDING_MODEL = 'text-embedding-005';
const EMBEDDING_DIMENSION = 768;

// Lazy-init clients so the module loads without project set
let _firestore: Firestore | null = null;
let _storage: Storage | null = null;
let _auth: GoogleAuth | null = null;
function getFirestore(): Firestore {
	if (!_firestore) _firestore = new Firestore(getProjectId() ? { projectId: getProjectId() } : undefined);
	return _firestore;
}
function getAuth(): GoogleAuth {
	if (!_auth) _auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
	return _auth;
}
function getStorage(): Storage {
	if (!_storage) _storage = new Storage();
	return _storage;
}

// ============================================
// Recipe Interface
// ============================================

interface Recipe {
	id: string;
	name: string;
	description: string;
	ingredients: string[];
	instructions?: string[];
	categories?: string[];
	dietaryInfo?: string[];
	/** Present when stored in Firestore with vector index */
	embedding?: number[];
}

// ============================================
// Cloud Storage Trigger (Auto-generate embeddings) - Gen2 Cloud Event
// ============================================

export async function onRecipeUpload(cloudEvent: any): Promise<void> {
	const data = cloudEvent.data || cloudEvent;
	const bucketName = data.bucket;
	const filePath = data.name;

	if (!filePath || !filePath.startsWith('recipes/') || !filePath.endsWith('.json')) {
		console.log(`Skipping non-recipe file: ${filePath}`);
		return;
	}

	try {
		console.log(`Processing recipe file: ${filePath}`);

		const bucket = getStorage().bucket(bucketName);
		const file = bucket.file(filePath);
		const [contents] = await file.download();
		const recipe: Recipe = JSON.parse(contents.toString());

		const embedding = await generateEmbedding(recipe);

		await getFirestore().collection('recipes').doc(recipe.id).set(
			{
				name: recipe.name,
				description: recipe.description,
				ingredients: recipe.ingredients,
				instructions: recipe.instructions || [],
				categories: recipe.categories || [],
				dietaryInfo: recipe.dietaryInfo || [],
				embedding,
				updatedAt: new Date(),
				source: filePath,
			},
			{ merge: true }
		);

		console.log(`✅ Successfully processed recipe: ${recipe.name}`);
	} catch (error) {
		console.error(`Error processing recipe: ${filePath}`, error);
		throw error;
	}
}

// ============================================
// CORS Helper
// ============================================

function setCors(res: any): void {
	res.set('Access-Control-Allow-Origin', '*');
	res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	res.set('Access-Control-Allow-Headers', 'Content-Type');
}

function handleCorsPreflightIfNeeded(req: any, res: any): boolean {
	if (req.method === 'OPTIONS') {
		setCors(res);
		res.status(204).send('');
		return true;
	}
	return false;
}

// ============================================
// Manual Embedding Generation Endpoint
// ============================================

export async function generateRecipeEmbeddings(req: any, res: any): Promise<void> {
	if (handleCorsPreflightIfNeeded(req, res)) return;
	setCors(res);

	try {
		// Get all recipes from Firestore
		const recipesSnapshot = await getFirestore().collection('recipes').get();

		if (recipesSnapshot.empty) {
			res.json({ success: true, message: 'No recipes found', processed: 0 });
			return;
		}

		let processed = 0;
		let errors = 0;
		const recipes = recipesSnapshot.docs;
		for (let i = 0; i < recipes.length; i += 10) {
			const batch = recipes.slice(i, i + 10);
			await Promise.all(batch.map(async (doc) => {
				try {
					const recipe = doc.data() as Recipe;
					if (recipe.embedding && recipe.embedding.length === EMBEDDING_DIMENSION) {
						const updatedAt = (recipe as any).updatedAt?.toDate();
						if (updatedAt && (Date.now() - updatedAt.getTime()) < 7 * 24 * 60 * 60 * 1000) {
							console.log(`Skipping ${recipe.name} - embedding is recent`);
							return;
						}
					}
					const embedding = await generateEmbedding(recipe);
					await doc.ref.update({ embedding, updatedAt: new Date() });
					processed++;
					console.log(`✅ Processed: ${recipe.name}`);
				} catch (error) {
					errors++;
					console.error(`Error processing recipe ${doc.id}:`, error);
				}
			}));
		}

		res.json({
			success: true,
			processed,
			errors,
			total: recipes.length,
		});
	} catch (error) {
		console.error('Error generating embeddings:', error);
		res.status(500).json({
			error: 'Failed to generate embeddings',
			message: (error as Error).message,
		});
	}
}

// ============================================
// Recipe Search Endpoint (Vector Search)
// ============================================

export async function searchRecipes(req: any, res: any): Promise<void> {
	if (handleCorsPreflightIfNeeded(req, res)) return;
	setCors(res);

	try {
		const query = req.query.q as string;
		const limit = parseInt((req.query.limit as string) || '10', 10);

		if (!query) {
			res.status(400).json({ error: 'Missing query parameter: q' });
			return;
		}

		const queryEmbedding = await generateTextEmbedding(query);

		const vectorQuery = getFirestore()
			.collection('recipes')
			.findNearest('embedding', queryEmbedding, {
				limit,
				distanceMeasure: 'COSINE',
			});

		const snapshot = await vectorQuery.get();

		const results = snapshot.docs.map(doc => {
			const data = doc.data();
			return {
				id: doc.id,
				name: data.name,
				description: data.description,
				ingredients: data.ingredients,
				categories: data.categories,
				distance: (doc as any).distance || 0,
			};
		});

		res.json({
			success: true,
			query,
			results,
			count: results.length,
		});
	} catch (error) {
		console.error('Error searching recipes:', error);
		res.status(500).json({
			error: 'Failed to search recipes',
			message: (error as Error).message,
		});
	}
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate embedding for a recipe
 */
async function generateEmbedding(recipe: Recipe): Promise<number[]> {
	// Combine recipe fields into text for embedding
	const text = [
		recipe.name,
		recipe.description,
		recipe.ingredients.join(' '),
		...(recipe.categories || []),
		...(recipe.dietaryInfo || []),
	].join(' ');

	return generateTextEmbedding(text);
}

/**
 * Generate embedding for text using Vertex AI Prediction API (REST)
 *
 * Uses the text-embedding-005 model via the Vertex AI predict endpoint
 * with Application Default Credentials.
 */
async function generateTextEmbedding(text: string): Promise<number[]> {
	const projectId = getProjectId();
	if (!projectId) throw new Error('GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT must be set');

	const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${EMBEDDING_MODEL}:predict`;

	const client = await getAuth().getClient();
	const response = await client.request({
		url,
		method: 'POST',
		data: {
			instances: [{ content: text, taskType: 'RETRIEVAL_DOCUMENT' }],
		},
	});

	const predictions = (response.data as any).predictions;
	if (!predictions || predictions.length === 0) {
		throw new Error('No predictions returned from embedding model');
	}

	const embedding: number[] = predictions[0].embeddings.values;

	if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSION) {
		throw new Error(`Expected ${EMBEDDING_DIMENSION}-dim embedding, got ${embedding.length}`);
	}

	return embedding;
}
