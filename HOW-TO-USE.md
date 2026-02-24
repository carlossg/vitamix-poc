# How to Use the Vitamix POC

## 1. Local development (frontend only)

Run the site locally and try the UI (no AI until you point it at a backend):

```bash
npm install
aem up
```

Open **http://localhost:3000** in your browser.

---

## 2. Point the frontend at your Google Cloud backend

The app uses **Cloud Run** (recommender) and **Cloud Functions** (analytics, embeddings). Set the URLs in one of two ways.

### Option A: Set config before scripts load (recommended)

In your **head** or **page template**, before any Vitamix scripts:

```html
<script>
  window.VITAMIX_CONFIG = {
    RECOMMENDER_URL: 'https://vitamix-recommender-okyq6gkx3a-uc.a.run.app',
    ANALYTICS_URL: 'https://trackevent-okyq6gkx3a-uc.a.run.app',
    EMBEDDINGS_URL: 'https://us-central1-YOUR_PROJECT.cloudfunctions.net/searchRecipes',
  };
</script>
```

Replace with your real URLs from deployment:

- **RECOMMENDER_URL** – Cloud Run service URL (from `deploy-google-cloud.sh` output or Cloud Console).
- **ANALYTICS_URL** – Cloud Function `trackEvent` URL (e.g. `https://trackevent-REGION-PROJECT.cloudfunctions.net/trackEvent` or the Cloud Run URL shown for the function).
- **EMBEDDINGS_URL** – Cloud Function `searchRecipes` URL.

### Option B: Edit the default in code

Edit **`scripts/api-config.js`** and set the fallback URLs:

```javascript
export const VITAMIX_RECOMMENDER_URL = window.VITAMIX_CONFIG?.RECOMMENDER_URL ||
  'https://vitamix-recommender-YOUR_HASH-uc.a.run.app';
// Update ANALYTICS_URL and EMBEDDINGS_URL similarly.
```

Then run `aem up` and open the site as above.

---

## 3. Use the AI generation

With the backend URLs set, use these **URL parameters** on the site (e.g. `http://localhost:3000` or your hosted URL):

| What you want        | URL example |
|----------------------|-------------|
| AI generation (main) | `?q=best+blender+for+smoothies` or `?query=best+blender+for+smoothies` |
| Fast mode            | `?fast=quick+recipe+ideas` |
| Standard streaming   | `?generate=vegan+breakfast+blender` |

Examples:

- **http://localhost:3000?q=best+blender+for+smoothies**
- **http://localhost:3000?query=blender+for+arthritis**
- **http://localhost:3000?fast=quick+green+smoothie**

The page will call your Cloud Run recommender, stream the response, and render blocks. Analytics (if configured) will use your Cloud Function.

---

## 4. Deploy the backend (first-time or updates)

To deploy or update the Google Cloud services:

```bash
export GCP_PROJECT_ID="your-project-id"
export GCP_LOCATION="us-central1"
chmod +x deploy-google-cloud.sh
./deploy-google-cloud.sh
```

When it finishes, it prints the **Cloud Run** and **Cloud Functions** URLs. Put those into `VITAMIX_CONFIG` or `api-config.js` as in step 2.

---

## 5. Quick reference

| Task              | Command / action |
|-------------------|------------------|
| Run site locally  | `npm i` then `aem up` → open http://localhost:3000 |
| Set backend URLs  | `window.VITAMIX_CONFIG` in HTML or edit `scripts/api-config.js` |
| Trigger AI       | Add `?q=your+query` or `?query=...` or `?fast=...` to the page URL |
| Deploy backend    | `./deploy-google-cloud.sh` (after setting `GCP_PROJECT_ID`) |

For more detail: [README-GOOGLE-CLOUD.md](./README-GOOGLE-CLOUD.md), [DEPLOYMENT.md](./DEPLOYMENT.md).
