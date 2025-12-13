/**
 * Vitamix Analytics Worker
 *
 * Handles analytics tracking, aggregation, and AI-powered analysis.
 */

interface Env {
  ANALYTICS: KVNamespace;
  ANTHROPIC_API_KEY?: string;
  DEBUG?: string;
}

interface TrackingEvent {
  sessionId: string;
  timestamp: number;
  eventType: 'session_start' | 'query' | 'page_published' | 'conversion';
  data: {
    query?: string;
    intent?: string;
    journeyStage?: string;
    consecutiveQueryNumber?: number;
    generatedPageUrl?: string;
    generatedPagePath?: string;
    ctaUrl?: string;
    ctaText?: string;
    sourceQuery?: string;
    queryCountAtConversion?: number;
    referrer?: string;
    userAgent?: string;
    url?: string;
  };
}

interface SessionData {
  sessionId: string;
  startTime: number;
  lastUpdated: number;
  queryCount: number;
  converted: boolean;
  conversionUrl?: string;
  queries: {
    query: string;
    intent?: string;
    journeyStage?: string;
    timestamp: number;
    generatedPageUrl?: string;
    generatedPagePath?: string;
  }[];
  referrer?: string;
}

interface DailyStats {
  date: string;
  sessions: number;
  queries: number;
  conversions: number;
  sessionIds: string[];
}

interface AnalysisResult {
  timestamp: number;
  overallScore: number;
  contentScore: number;
  layoutScore: number;
  conversionScore: number;
  topIssues: string[];
  suggestions: {
    content: string[];
    layout: string[];
    conversion: string[];
  };
  exemplaryPages: { url: string; query: string; reason: string }[];
  problematicPages: { url: string; query: string; reason: string }[];
  pagesAnalyzed: number;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route requests
      if (url.pathname === '/api/track' && request.method === 'POST') {
        return handleTrack(request, env);
      }

      if (url.pathname === '/api/analytics/summary' && request.method === 'GET') {
        return handleSummary(env);
      }

      if (url.pathname === '/api/analytics/sessions' && request.method === 'GET') {
        return handleSessions(env, url);
      }

      if (url.pathname === '/api/analytics/export' && request.method === 'GET') {
        return handleExport(env);
      }

      if (url.pathname === '/api/analytics/analyze' && request.method === 'POST') {
        return handleAnalyze(env);
      }

      // Health check
      if (url.pathname === '/health') {
        return jsonResponse({ status: 'ok', timestamp: Date.now() });
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },
};

/**
 * Handle tracking events from the client
 */
async function handleTrack(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { events: TrackingEvent[] };
  const { events } = body;

  if (!events || !Array.isArray(events)) {
    return jsonResponse({ error: 'Invalid events array' }, 400);
  }

  const today = new Date().toISOString().split('T')[0];

  for (const event of events) {
    await processEvent(event, env, today);
  }

  return jsonResponse({ success: true, processed: events.length });
}

/**
 * Process a single tracking event
 */
async function processEvent(event: TrackingEvent, env: Env, today: string): Promise<void> {
  const { sessionId, eventType, timestamp, data } = event;

  // Get or create session
  const sessionKey = `sessions:${sessionId}`;
  let session: SessionData | null = await env.ANALYTICS.get(sessionKey, 'json');

  if (!session) {
    session = {
      sessionId,
      startTime: timestamp,
      lastUpdated: timestamp,
      queryCount: 0,
      converted: false,
      queries: [],
      referrer: data.referrer,
    };
  }

  session.lastUpdated = timestamp;

  // Process event by type
  switch (eventType) {
    case 'session_start':
      // Session already created above
      break;

    case 'query':
      session.queryCount = data.consecutiveQueryNumber || session.queryCount + 1;
      session.queries.push({
        query: data.query || '',
        intent: data.intent,
        journeyStage: data.journeyStage,
        timestamp,
      });
      // Keep only last 20 queries per session
      if (session.queries.length > 20) {
        session.queries = session.queries.slice(-20);
      }
      break;

    case 'page_published':
      // Update the last query with the generated page URL
      if (session.queries.length > 0) {
        const lastQuery = session.queries[session.queries.length - 1];
        lastQuery.generatedPageUrl = data.generatedPageUrl;
        lastQuery.generatedPagePath = data.generatedPagePath;
      }
      break;

    case 'conversion':
      session.converted = true;
      session.conversionUrl = data.ctaUrl;
      break;
  }

  // Save session with 30-day TTL
  await env.ANALYTICS.put(sessionKey, JSON.stringify(session), {
    expirationTtl: 30 * 24 * 60 * 60,
  });

  // Update daily stats
  await updateDailyStats(env, today, sessionId, eventType);
}

/**
 * Update daily aggregate statistics
 */
async function updateDailyStats(
  env: Env,
  date: string,
  sessionId: string,
  eventType: string
): Promise<void> {
  const dailyKey = `daily:${date}`;
  let daily: DailyStats | null = await env.ANALYTICS.get(dailyKey, 'json');

  if (!daily) {
    daily = {
      date,
      sessions: 0,
      queries: 0,
      conversions: 0,
      sessionIds: [],
    };
  }

  // Track unique sessions
  if (!daily.sessionIds.includes(sessionId)) {
    daily.sessionIds.push(sessionId);
    daily.sessions = daily.sessionIds.length;
  }

  // Update counts
  if (eventType === 'query') {
    daily.queries += 1;
  } else if (eventType === 'conversion') {
    daily.conversions += 1;
  }

  // Keep only last 1000 session IDs to avoid value size limits
  if (daily.sessionIds.length > 1000) {
    daily.sessionIds = daily.sessionIds.slice(-1000);
  }

  // Save with 90-day TTL
  await env.ANALYTICS.put(dailyKey, JSON.stringify(daily), {
    expirationTtl: 90 * 24 * 60 * 60,
  });
}

/**
 * Get analytics summary
 */
async function handleSummary(env: Env): Promise<Response> {
  // Get last 30 days of stats
  const days: DailyStats[] = [];
  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dailyKey = `daily:${dateStr}`;
    const daily: DailyStats | null = await env.ANALYTICS.get(dailyKey, 'json');
    if (daily) {
      days.push(daily);
    }
  }

  // Calculate aggregates
  const totalSessions = days.reduce((sum, d) => sum + d.sessions, 0);
  const totalQueries = days.reduce((sum, d) => sum + d.queries, 0);
  const totalConversions = days.reduce((sum, d) => sum + d.conversions, 0);

  const avgQueriesPerSession = totalSessions > 0 ? totalQueries / totalSessions : 0;
  const conversionRate = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;

  // Get session details for engagement metrics
  let sessionsWithMultipleQueries = 0;
  let journeyStageBreakdown: Record<string, number> = {
    exploring: 0,
    comparing: 0,
    deciding: 0,
  };

  // Sample recent sessions for detailed metrics (last 100)
  const allSessionIds = days.flatMap((d) => d.sessionIds).slice(0, 100);
  for (const sessionId of allSessionIds) {
    const session: SessionData | null = await env.ANALYTICS.get(`sessions:${sessionId}`, 'json');
    if (session) {
      if (session.queryCount >= 2) {
        sessionsWithMultipleQueries++;
      }
      // Count journey stages from queries
      for (const query of session.queries) {
        if (query.journeyStage && journeyStageBreakdown[query.journeyStage] !== undefined) {
          journeyStageBreakdown[query.journeyStage]++;
        }
      }
    }
  }

  const engagementRate = allSessionIds.length > 0
    ? (sessionsWithMultipleQueries / allSessionIds.length) * 100
    : 0;

  // Get top queries
  const queryFrequency: Record<string, number> = {};
  for (const sessionId of allSessionIds) {
    const session: SessionData | null = await env.ANALYTICS.get(`sessions:${sessionId}`, 'json');
    if (session) {
      for (const q of session.queries) {
        const normalized = q.query.toLowerCase().trim();
        queryFrequency[normalized] = (queryFrequency[normalized] || 0) + 1;
      }
    }
  }

  const topQueries = Object.entries(queryFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));

  // Get last analysis result
  const lastAnalysis: AnalysisResult | null = await env.ANALYTICS.get('analysis:latest', 'json');

  return jsonResponse({
    period: '30d',
    totalSessions,
    totalQueries,
    totalConversions,
    avgQueriesPerSession: Number(avgQueriesPerSession.toFixed(2)),
    conversionRate: Number(conversionRate.toFixed(2)),
    engagementRate: Number(engagementRate.toFixed(2)),
    sessionsWithMultipleQueries,
    journeyStageBreakdown,
    topQueries,
    dailyTrend: days.slice(0, 7).reverse(),
    lastAnalysis: lastAnalysis ? {
      timestamp: lastAnalysis.timestamp,
      overallScore: lastAnalysis.overallScore,
      pagesAnalyzed: lastAnalysis.pagesAnalyzed,
    } : null,
  });
}

/**
 * Get list of recent sessions
 */
async function handleSessions(env: Env, url: URL): Promise<Response> {
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  // Get recent daily stats to find session IDs
  const now = new Date();
  const allSessionIds: string[] = [];

  for (let i = 0; i < 7 && allSessionIds.length < limit + offset; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const daily: DailyStats | null = await env.ANALYTICS.get(`daily:${dateStr}`, 'json');
    if (daily) {
      allSessionIds.push(...daily.sessionIds);
    }
  }

  // Get session details
  const sessions: SessionData[] = [];
  const targetIds = allSessionIds.slice(offset, offset + limit);

  for (const sessionId of targetIds) {
    const session: SessionData | null = await env.ANALYTICS.get(`sessions:${sessionId}`, 'json');
    if (session) {
      sessions.push(session);
    }
  }

  // Sort by lastUpdated descending
  sessions.sort((a, b) => b.lastUpdated - a.lastUpdated);

  return jsonResponse({
    sessions,
    total: allSessionIds.length,
    limit,
    offset,
  });
}

/**
 * Export all analytics data
 */
async function handleExport(env: Env): Promise<Response> {
  const days: DailyStats[] = [];
  const sessions: SessionData[] = [];
  const now = new Date();

  // Get 30 days of data
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const daily: DailyStats | null = await env.ANALYTICS.get(`daily:${dateStr}`, 'json');
    if (daily) {
      days.push(daily);
      // Get sessions for this day
      for (const sessionId of daily.sessionIds.slice(0, 50)) {
        const session: SessionData | null = await env.ANALYTICS.get(`sessions:${sessionId}`, 'json');
        if (session) {
          sessions.push(session);
        }
      }
    }
  }

  return jsonResponse({
    exportedAt: new Date().toISOString(),
    dailyStats: days,
    sessions,
  });
}

/**
 * Run AI analysis on recent queries and generated pages
 */
async function handleAnalyze(env: Env): Promise<Response> {
  // Check rate limiting - only allow once per hour
  const lastAnalysis: AnalysisResult | null = await env.ANALYTICS.get('analysis:latest', 'json');
  if (lastAnalysis && Date.now() - lastAnalysis.timestamp < 60 * 60 * 1000) {
    return jsonResponse({
      cached: true,
      analysis: lastAnalysis,
      nextAvailable: new Date(lastAnalysis.timestamp + 60 * 60 * 1000).toISOString(),
    });
  }

  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  // Collect queries with page URLs
  const queriesWithPages: { query: string; url: string; intent?: string }[] = [];
  const now = new Date();

  for (let i = 0; i < 7 && queriesWithPages.length < 100; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const daily: DailyStats | null = await env.ANALYTICS.get(`daily:${dateStr}`, 'json');

    if (daily) {
      for (const sessionId of daily.sessionIds) {
        if (queriesWithPages.length >= 100) break;

        const session: SessionData | null = await env.ANALYTICS.get(`sessions:${sessionId}`, 'json');
        if (session) {
          for (const q of session.queries) {
            if (q.generatedPageUrl && queriesWithPages.length < 100) {
              queriesWithPages.push({
                query: q.query,
                url: q.generatedPageUrl,
                intent: q.intent,
              });
            }
          }
        }
      }
    }
  }

  if (queriesWithPages.length === 0) {
    return jsonResponse({
      error: 'No pages with URLs found for analysis',
      suggestion: 'Generate some pages first to build up analytics data',
    }, 400);
  }

  // Fetch page content (sample up to 20 pages to stay within limits)
  const sampled = queriesWithPages.slice(0, 20);
  const pageContents: { query: string; url: string; content: string }[] = [];

  for (const item of sampled) {
    try {
      const response = await fetch(item.url, {
        headers: { 'User-Agent': 'Vitamix-Analytics/1.0' },
      });
      if (response.ok) {
        const html = await response.text();
        // Extract main content, strip scripts/styles
        const content = extractMainContent(html);
        pageContents.push({
          query: item.query,
          url: item.url,
          content: content.slice(0, 5000), // Limit content size
        });
      }
    } catch (e) {
      console.error('Failed to fetch page:', item.url, e);
    }
  }

  if (pageContents.length === 0) {
    return jsonResponse({
      error: 'Could not fetch any page content for analysis',
    }, 500);
  }

  // Build analysis prompt
  const pagesDescription = pageContents
    .map((p, i) => `Page ${i + 1}:\nQuery: "${p.query}"\nURL: ${p.url}\nContent:\n${p.content}\n---`)
    .join('\n\n');

  const analysisPrompt = `Analyze these ${pageContents.length} generated pages from a Vitamix AI recommender application.

For each page, you have:
- The user's original query
- The generated page content (HTML stripped to text)

Provide a summary assessment and actionable suggestions for:

A. CONTENT IMPROVEMENTS
- Is the content relevant to the query?
- Are product recommendations appropriate?
- Are recipes/use cases helpful?
- What content gaps exist?

B. LAYOUT IMPROVEMENTS
- Is the information hierarchy clear?
- Are CTAs prominently placed?
- Is the page easy to scan?
- What layout patterns work well/poorly?

C. CONVERSION OPTIMIZATION
- Are links to vitamix.com visible and compelling?
- Do CTAs have clear value propositions?
- Is there a clear path to purchase?
- What friction points exist?

${pagesDescription}

Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "overallScore": <0-100>,
  "contentScore": <0-100>,
  "layoutScore": <0-100>,
  "conversionScore": <0-100>,
  "topIssues": ["issue1", "issue2", "issue3"],
  "suggestions": {
    "content": ["suggestion1", "suggestion2"],
    "layout": ["suggestion1", "suggestion2"],
    "conversion": ["suggestion1", "suggestion2"]
  },
  "exemplaryPages": [{"url": "...", "query": "...", "reason": "..."}],
  "problematicPages": [{"url": "...", "query": "...", "reason": "..."}]
}`;

  // Call Claude API
  const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
    }),
  });

  if (!claudeResponse.ok) {
    const error = await claudeResponse.text();
    console.error('Claude API error:', error);
    return jsonResponse({ error: 'AI analysis failed' }, 500);
  }

  const claudeResult = await claudeResponse.json() as {
    content: { type: string; text: string }[];
  };

  const analysisText = claudeResult.content[0]?.text || '';

  // Parse JSON response
  let analysis: Omit<AnalysisResult, 'timestamp' | 'pagesAnalyzed'>;
  try {
    // Try to extract JSON from the response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (e) {
    console.error('Failed to parse analysis:', e, analysisText);
    return jsonResponse({
      error: 'Failed to parse AI analysis response',
      raw: analysisText,
    }, 500);
  }

  // Store result
  const result: AnalysisResult = {
    ...analysis,
    timestamp: Date.now(),
    pagesAnalyzed: pageContents.length,
  };

  await env.ANALYTICS.put('analysis:latest', JSON.stringify(result), {
    expirationTtl: 7 * 24 * 60 * 60, // 7 days
  });

  return jsonResponse({
    cached: false,
    analysis: result,
    nextAvailable: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
}

/**
 * Extract main content from HTML, removing scripts, styles, and nav
 */
function extractMainContent(html: string): string {
  // Remove script tags
  let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove style tags
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Remove nav, header, footer
  content = content.replace(/<(nav|header|footer)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove HTML tags
  content = content.replace(/<[^>]+>/g, ' ');
  // Clean up whitespace
  content = content.replace(/\s+/g, ' ').trim();
  return content;
}

/**
 * Helper to create JSON responses with CORS headers
 */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}
