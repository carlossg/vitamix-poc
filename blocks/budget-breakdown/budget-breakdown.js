/**
 * Budget Breakdown Block
 * Shows transparent pricing information for budget-conscious users.
 * Includes price tiers, refurbished options, and honest value comparison.
 */

export default function decorate(block) {
  // Expected structure from AI:
  // Row 1: Title
  // Row 2+: Price tiers (tier name | products with prices)

  const rows = [...block.children];
  if (rows.length < 2) {
    console.warn('budget-breakdown: Expected at least 2 rows');
    return;
  }

  const title = rows[0]?.textContent?.trim() || 'Your Options by Budget';

  // Clear the block
  block.innerHTML = '';

  // Create header
  const header = document.createElement('div');
  header.className = 'budget-breakdown-header';

  const icon = document.createElement('div');
  icon.className = 'budget-breakdown-icon';
  icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>';
  header.appendChild(icon);

  const titleEl = document.createElement('h2');
  titleEl.className = 'budget-breakdown-title';
  titleEl.textContent = title;
  header.appendChild(titleEl);

  block.appendChild(header);

  // Create tiers container
  const tiersContainer = document.createElement('div');
  tiersContainer.className = 'budget-breakdown-tiers';

  // Process each tier row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cells = [...row.children];

    if (cells.length < 2) continue;

    const tierName = cells[0]?.textContent?.trim() || 'Price Tier';
    const tierContent = cells[1]?.innerHTML || '';

    const tier = document.createElement('div');
    tier.className = 'budget-tier';

    // Determine tier styling based on name
    let tierClass = 'standard';
    if (/under|budget|entry/i.test(tierName)) tierClass = 'budget';
    else if (/premium|pro|high/i.test(tierName)) tierClass = 'premium';
    else if (/refurb|certified/i.test(tierName)) tierClass = 'refurbished';
    tier.classList.add(`tier-${tierClass}`);

    const tierHeader = document.createElement('div');
    tierHeader.className = 'tier-header';
    tierHeader.textContent = tierName;
    tier.appendChild(tierHeader);

    const tierProducts = document.createElement('div');
    tierProducts.className = 'tier-products';
    tierProducts.innerHTML = tierContent;
    tier.appendChild(tierProducts);

    tiersContainer.appendChild(tier);
  }

  block.appendChild(tiersContainer);

  // Add value note
  const valueNote = document.createElement('div');
  valueNote.className = 'budget-breakdown-note';
  valueNote.innerHTML = `
    <div class="note-icon">💡</div>
    <div class="note-content">
      <strong>Pro tip:</strong> Vitamix blenders last 10-20+ years.
      A $400 blender used daily for 10 years costs just $0.11/day.
    </div>
  `;
  block.appendChild(valueNote);

  // Add refurbished CTA if not already in tiers
  const hasRefurbTier = [...block.querySelectorAll('.tier-header')].some(
    (h) => /refurb/i.test(h.textContent)
  );

  if (!hasRefurbTier) {
    const refurbCta = document.createElement('a');
    refurbCta.className = 'budget-breakdown-refurb-cta';
    refurbCta.href = 'https://www.vitamix.com/shop/certified-reconditioned';
    refurbCta.target = '_blank';
    refurbCta.innerHTML = `
      <span class="refurb-badge">Save Up to 40%</span>
      <span class="refurb-text">Shop Certified Reconditioned →</span>
    `;
    block.appendChild(refurbCta);
  }
}
