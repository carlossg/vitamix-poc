/**
 * Analytics Last Queries Block
 *
 * Displays the last 10 queries with individual page analysis capability.
 */

const ANALYTICS_ENDPOINT = 'https://vitamix-analytics.paolo-moz.workers.dev';

/**
 * Format a timestamp as relative time
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

/**
 * Create a score badge element
 */
function createScoreBadge(score, label) {
  const badge = document.createElement('span');
  badge.className = 'score-badge';
  const color = score >= 70 ? 'good' : score >= 40 ? 'medium' : 'poor';
  badge.classList.add(`score-${color}`);
  badge.innerHTML = `<span class="score-value">${score}</span><span class="score-label">${label}</span>`;
  return badge;
}

/**
 * Create the analysis results HTML
 */
function createAnalysisResults(analysis) {
  const container = document.createElement('div');
  container.className = 'analysis-results';

  // Scores row
  const scoresRow = document.createElement('div');
  scoresRow.className = 'scores-row';
  scoresRow.appendChild(createScoreBadge(analysis.overallScore, 'Overall'));
  scoresRow.appendChild(createScoreBadge(analysis.contentScore, 'Content'));
  scoresRow.appendChild(createScoreBadge(analysis.layoutScore, 'Layout'));
  scoresRow.appendChild(createScoreBadge(analysis.conversionScore, 'Conversion'));
  container.appendChild(scoresRow);

  // Summary
  if (analysis.summary) {
    const summary = document.createElement('p');
    summary.className = 'analysis-summary';
    summary.textContent = analysis.summary;
    container.appendChild(summary);
  }

  // Strengths and Improvements in columns
  const columns = document.createElement('div');
  columns.className = 'analysis-columns';

  if (analysis.strengths && analysis.strengths.length > 0) {
    const strengthsDiv = document.createElement('div');
    strengthsDiv.className = 'analysis-column strengths';
    strengthsDiv.innerHTML = `
      <h5>Strengths</h5>
      <ul>${analysis.strengths.map((s) => `<li>${s}</li>`).join('')}</ul>
    `;
    columns.appendChild(strengthsDiv);
  }

  if (analysis.improvements && analysis.improvements.length > 0) {
    const improvementsDiv = document.createElement('div');
    improvementsDiv.className = 'analysis-column improvements';
    improvementsDiv.innerHTML = `
      <h5>Improvements</h5>
      <ul>${analysis.improvements.map((s) => `<li>${s}</li>`).join('')}</ul>
    `;
    columns.appendChild(improvementsDiv);
  }

  container.appendChild(columns);

  return container;
}

/**
 * Analyze a single page
 */
async function analyzePage(query, url, resultsContainer, button) {
  button.disabled = true;
  button.textContent = 'Analyzing...';
  resultsContainer.innerHTML = '<div class="loading">Analyzing page content...</div>';
  resultsContainer.classList.add('expanded');

  try {
    const response = await fetch(`${ANALYTICS_ENDPOINT}/api/analytics/analyze-page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, url }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analysis failed');
    }

    const data = await response.json();
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(createAnalysisResults(data.analysis));

    if (data.cached) {
      const cacheNote = document.createElement('p');
      cacheNote.className = 'cache-note';
      cacheNote.textContent = 'Results from cache';
      resultsContainer.appendChild(cacheNote);
    }

    button.textContent = 'Analyzed';
    button.classList.add('analyzed');
  } catch (error) {
    console.error('[Analytics] Page analysis failed:', error);
    resultsContainer.innerHTML = `
      <div class="error-message">
        <p>Analysis failed: ${error.message}</p>
      </div>
    `;
    button.textContent = 'Retry';
    button.disabled = false;
  }
}

/**
 * Create a query row element
 */
function createQueryRow(queryData) {
  const row = document.createElement('div');
  row.className = 'query-row';

  const mainContent = document.createElement('div');
  mainContent.className = 'query-main';

  // Query info
  const queryInfo = document.createElement('div');
  queryInfo.className = 'query-info';

  const queryText = document.createElement('div');
  queryText.className = 'query-text';
  queryText.textContent = queryData.query;
  queryInfo.appendChild(queryText);

  const queryMeta = document.createElement('div');
  queryMeta.className = 'query-meta';

  if (queryData.timestamp) {
    const time = document.createElement('span');
    time.className = 'query-time';
    time.textContent = formatRelativeTime(queryData.timestamp);
    queryMeta.appendChild(time);
  }

  if (queryData.intent) {
    const intent = document.createElement('span');
    intent.className = 'query-intent';
    intent.textContent = queryData.intent;
    queryMeta.appendChild(intent);
  }

  if (queryData.generatedPageUrl) {
    const link = document.createElement('a');
    link.href = queryData.generatedPageUrl;
    link.target = '_blank';
    link.className = 'query-link';
    link.textContent = 'View Page';
    queryMeta.appendChild(link);
  }

  queryInfo.appendChild(queryMeta);
  mainContent.appendChild(queryInfo);

  // Analyse button
  const actions = document.createElement('div');
  actions.className = 'query-actions';

  if (queryData.generatedPageUrl) {
    const analyzeBtn = document.createElement('button');
    analyzeBtn.className = 'analyze-btn';

    // Results container (expandable)
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'query-results';

    // Check if analysis already exists (persisted)
    if (queryData.analysis) {
      analyzeBtn.textContent = 'Analyzed';
      analyzeBtn.classList.add('analyzed');
      resultsContainer.appendChild(createAnalysisResults(queryData.analysis));
      resultsContainer.classList.add('expanded');
    } else {
      analyzeBtn.textContent = 'Analyse';
    }

    analyzeBtn.addEventListener('click', () => {
      if (analyzeBtn.classList.contains('analyzed')) {
        // Toggle visibility if already analyzed
        resultsContainer.classList.toggle('expanded');
      } else {
        analyzePage(queryData.query, queryData.generatedPageUrl, resultsContainer, analyzeBtn);
      }
    });

    actions.appendChild(analyzeBtn);
    row.appendChild(mainContent);
    row.appendChild(actions);
    row.appendChild(resultsContainer);
  } else {
    const noPage = document.createElement('span');
    noPage.className = 'no-page';
    noPage.textContent = 'No page generated';
    actions.appendChild(noPage);
    row.appendChild(mainContent);
    row.appendChild(actions);
  }

  return row;
}

/**
 * Load and display recent queries
 */
async function loadQueries(block) {
  const container = block.querySelector('.queries-list');

  try {
    const response = await fetch(`${ANALYTICS_ENDPOINT}/api/analytics/queries/recent?limit=10`);
    if (!response.ok) throw new Error('Failed to load queries');

    const data = await response.json();

    if (data.queries && data.queries.length > 0) {
      container.innerHTML = '';
      data.queries.forEach((q) => {
        container.appendChild(createQueryRow(q));
      });
    } else {
      container.innerHTML = '<p class="no-data">No queries yet</p>';
    }
  } catch (error) {
    console.error('[Analytics] Failed to load queries:', error);
    container.innerHTML = `
      <div class="error-message">
        <p>Failed to load query data.</p>
      </div>
    `;
  }
}

/**
 * Main block decoration function
 */
export default async function decorate(block) {
  block.innerHTML = `
    <h3>Last Queries</h3>
    <p class="block-description">Recent queries with individual page analysis</p>
    <div class="queries-list">
      <div class="loading">Loading recent queries...</div>
    </div>
  `;

  await loadQueries(block);
}
