/**
 * Quick Answer Block
 * Provides a TL;DR response for decisive users who want direct answers
 * without overwhelming them with information.
 */

export default function decorate(block) {
  // Expected structure from AI:
  // Row 1: Product name
  // Row 2: Reason (short)
  // Row 3: Price
  // Row 4: CTA URL
  // Row 5 (optional): "Tell me more" content

  const rows = [...block.children];
  if (rows.length < 4) {
    console.warn('quick-answer: Expected at least 4 rows');
    return;
  }

  const productName = rows[0]?.textContent?.trim() || 'Vitamix';
  const reason = rows[1]?.textContent?.trim() || 'It\'s perfect for your needs.';
  const price = rows[2]?.textContent?.trim() || '';
  const ctaUrl = rows[3]?.querySelector('a')?.href || rows[3]?.textContent?.trim() || '#';
  const moreContent = rows[4]?.innerHTML || '';

  // Clear the block
  block.innerHTML = '';

  // Create the quick answer card
  const card = document.createElement('div');
  card.className = 'quick-answer-card';

  // Icon
  const icon = document.createElement('div');
  icon.className = 'quick-answer-icon';
  icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>';
  card.appendChild(icon);

  // Label
  const label = document.createElement('span');
  label.className = 'quick-answer-label';
  label.textContent = 'Quick Answer';
  card.appendChild(label);

  // Main answer
  const answer = document.createElement('div');
  answer.className = 'quick-answer-main';

  const productEl = document.createElement('h2');
  productEl.className = 'quick-answer-product';
  productEl.textContent = `Get the ${productName}.`;
  answer.appendChild(productEl);

  const reasonEl = document.createElement('p');
  reasonEl.className = 'quick-answer-reason';
  reasonEl.textContent = reason;
  answer.appendChild(reasonEl);

  card.appendChild(answer);

  // Price and CTA row
  const actions = document.createElement('div');
  actions.className = 'quick-answer-actions';

  if (price) {
    const priceEl = document.createElement('span');
    priceEl.className = 'quick-answer-price';
    priceEl.textContent = price;
    actions.appendChild(priceEl);
  }

  const cta = document.createElement('a');
  cta.className = 'quick-answer-cta button primary';
  cta.href = ctaUrl;
  cta.target = '_blank';
  cta.textContent = 'Buy Now';
  actions.appendChild(cta);

  card.appendChild(actions);

  // "Tell me more" expander (if content provided)
  if (moreContent) {
    const expander = document.createElement('div');
    expander.className = 'quick-answer-expander';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'quick-answer-toggle';
    toggleBtn.innerHTML = 'Tell me more <span class="toggle-icon">↓</span>';
    toggleBtn.setAttribute('aria-expanded', 'false');

    const moreSection = document.createElement('div');
    moreSection.className = 'quick-answer-more';
    moreSection.innerHTML = moreContent;
    moreSection.hidden = true;

    toggleBtn.addEventListener('click', () => {
      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      toggleBtn.setAttribute('aria-expanded', !isExpanded);
      moreSection.hidden = isExpanded;
      toggleBtn.querySelector('.toggle-icon').textContent = isExpanded ? '↓' : '↑';
    });

    expander.appendChild(toggleBtn);
    expander.appendChild(moreSection);
    card.appendChild(expander);
  }

  block.appendChild(card);
}
