/**
 * CTA Utilities
 * Provides classification and decoration for different CTA types:
 * - External links (vitamix.com) - show external link icon
 * - AI-generated links (?q= parameter) - show AI sparkle icon
 */

/**
 * Purchase-related terms to replace
 */
const PURCHASE_REPLACEMENTS = {
  'add to cart': 'View Details',
  'buy now': 'Learn More',
  'shop now': 'View on Vitamix',
  'purchase': 'Explore',
  'checkout': 'Continue',
  'buy': 'View',
};

/**
 * Classify a link based on its href
 * @param {string} href - The link URL
 * @returns {'external' | 'ai-generated' | 'internal'}
 */
export function classifyLink(href) {
  if (!href) return 'internal';

  try {
    const url = new URL(href, window.location.origin);

    // Check for AI-generated page links (has ?q= parameter)
    if (url.searchParams.has('q')) {
      return 'ai-generated';
    }

    // Check for external vitamix.com links or other external domains
    if (href.includes('vitamix.com') || url.host !== window.location.host) {
      return 'external';
    }

    return 'internal';
  } catch {
    // If URL parsing fails, check simple patterns
    if (href.includes('?q=')) return 'ai-generated';
    if (href.includes('vitamix.com') || href.startsWith('http')) return 'external';
    return 'internal';
  }
}

/**
 * Sanitize CTA text to remove purchase-intent language
 * @param {string} text - Original CTA text
 * @returns {string} - Sanitized text
 */
export function sanitizeCTAText(text) {
  if (!text) return text;

  let sanitized = text;
  const lowerText = text.toLowerCase();

  // Check each purchase term and replace
  Object.entries(PURCHASE_REPLACEMENTS).forEach(([term, replacement]) => {
    if (lowerText.includes(term)) {
      // Create case-insensitive regex
      const regex = new RegExp(term, 'gi');
      sanitized = sanitized.replace(regex, replacement);
    }
  });

  return sanitized;
}

/**
 * Check if text contains purchase-intent language
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function hasPurchaseIntent(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return Object.keys(PURCHASE_REPLACEMENTS).some((term) => lowerText.includes(term));
}

/**
 * Create an icon element for CTA type
 * @param {'external' | 'ai-generated'} type - The CTA type
 * @returns {HTMLSpanElement}
 */
export function createCTAIcon(type) {
  const icon = document.createElement('span');
  icon.className = `cta-icon cta-icon-${type}`;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

/**
 * Decorate a link with appropriate icon based on type
 * @param {HTMLAnchorElement} link - The link element
 * @param {'external' | 'ai-generated'} type - The CTA type
 */
export function decorateLinkWithIcon(link, type) {
  // Don't add icon if already decorated
  if (link.querySelector('.cta-icon')) return;

  // Add type class to link
  link.classList.add(`cta-${type}`);

  const icon = createCTAIcon(type);

  if (type === 'external') {
    // External icon goes at the end
    link.appendChild(icon);
    // Ensure opens in new tab
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  } else if (type === 'ai-generated') {
    // AI icon goes at the beginning
    link.insertBefore(icon, link.firstChild);
  }
}

/**
 * Fully decorate a CTA link: classify, sanitize text, add icon
 * @param {HTMLAnchorElement} link - The link element
 * @returns {'external' | 'ai-generated' | 'internal'} - The classified type
 */
export function decorateCTA(link) {
  const type = classifyLink(link.href);

  // Sanitize purchase-intent text
  const textNodes = [];
  link.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push(node);
    }
  });

  textNodes.forEach((node) => {
    const sanitized = sanitizeCTAText(node.textContent);
    if (sanitized !== node.textContent) {
      node.textContent = sanitized;
    }
  });

  // Add icon for external and AI-generated links
  if (type === 'external' || type === 'ai-generated') {
    decorateLinkWithIcon(link, type);
  }

  return type;
}

export default {
  classifyLink,
  sanitizeCTAText,
  hasPurchaseIntent,
  createCTAIcon,
  decorateLinkWithIcon,
  decorateCTA,
};
