const SimpleBookingAdapter = require('./simpleBookingAdapter');

/**
 * Factory for creating site-specific adapters
 * Manages different booking site implementations
 */
class SiteAdapterFactory {
  constructor() {
    this.adapters = new Map();
    this.siteDetectionRules = [];
    this.initializeAdapters();
  }

  /**
   * Initialize all available adapters
   */
  initializeAdapters() {
    // Register SimpleBooking adapter
    this.registerAdapter('simplebooking', SimpleBookingAdapter);
    
    // Add detection rules for SimpleBooking sites
    this.addSiteDetectionRule('simplebooking', {
      urlPatterns: [
        /simplebooking\.com/i,
        /simplebooking\./i
      ],
      domPatterns: [
        '.simplebooking-container',
        '[data-simplebooking]',
        '.sb-room-card',
        'script[src*="simplebooking"]'
      ],
      metaPatterns: [
        { name: 'generator', content: /simplebooking/i },
        { name: 'booking-engine', content: /simplebooking/i }
      ]
    });

    console.log(`SiteAdapterFactory initialized with ${this.adapters.size} adapters`);
  }

  /**
   * Register a new site adapter
   */
  registerAdapter(siteKey, AdapterClass) {
    this.adapters.set(siteKey.toLowerCase(), AdapterClass);
    console.log(`Registered adapter for: ${siteKey}`);
  }

  /**
   * Add site detection rule
   */
  addSiteDetectionRule(siteKey, rules) {
    this.siteDetectionRules.push({
      siteKey: siteKey.toLowerCase(),
      ...rules
    });
  }

  /**
   * Detect which site adapter to use based on URL and page content
   */
  async detectSiteType(page) {
    const url = page.url();
    console.log(`Detecting site type for URL: ${url}`);

    for (const rule of this.siteDetectionRules) {
      // Check URL patterns
      if (rule.urlPatterns && rule.urlPatterns.some(pattern => pattern.test(url))) {
        console.log(`Site detected by URL pattern: ${rule.siteKey}`);
        return rule.siteKey;
      }

      // Check DOM patterns
      if (rule.domPatterns) {
        try {
          const domMatch = await page.evaluate((patterns) => {
            return patterns.some(pattern => {
              const elements = document.querySelectorAll(pattern);
              return elements.length > 0;
            });
          }, rule.domPatterns);

          if (domMatch) {
            console.log(`Site detected by DOM pattern: ${rule.siteKey}`);
            return rule.siteKey;
          }
        } catch (e) {
          console.warn(`Error checking DOM patterns for ${rule.siteKey}:`, e.message);
        }
      }

      // Check meta tag patterns
      if (rule.metaPatterns) {
        try {
          const metaMatch = await page.evaluate((patterns) => {
            return patterns.some(({ name, content }) => {
              const metaTags = document.querySelectorAll(`meta[name="${name}"]`);
              return Array.from(metaTags).some(tag => {
                const tagContent = tag.getAttribute('content') || '';
                return content.test(tagContent);
              });
            });
          }, rule.metaPatterns);

          if (metaMatch) {
            console.log(`Site detected by meta pattern: ${rule.siteKey}`);
            return rule.siteKey;
          }
        } catch (e) {
          console.warn(`Error checking meta patterns for ${rule.siteKey}:`, e.message);
        }
      }
    }

    console.log('No specific site adapter detected, using default');
    return 'default';
  }

  /**
   * Create adapter instance for detected site
   */
  async createAdapter(page, forceSiteType = null) {
    let siteType = forceSiteType;
    
    if (!siteType) {
      siteType = await this.detectSiteType(page);
    }

    const AdapterClass = this.adapters.get(siteType.toLowerCase());
    
    if (!AdapterClass) {
      console.warn(`No adapter found for site type: ${siteType}, using SimpleBooking as fallback`);
      return new SimpleBookingAdapter();
    }

    console.log(`Creating adapter for site type: ${siteType}`);
    return new AdapterClass();
  }

  /**
   * Get list of supported sites
   */
  getSupportedSites() {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get site detection rules for debugging
   */
  getDetectionRules() {
    return this.siteDetectionRules.map(rule => ({
      siteKey: rule.siteKey,
      hasUrlPatterns: !!(rule.urlPatterns && rule.urlPatterns.length),
      hasDomPatterns: !!(rule.domPatterns && rule.domPatterns.length),
      hasMetaPatterns: !!(rule.metaPatterns && rule.metaPatterns.length)
    }));
  }

  /**
   * Test site detection on a given page (for debugging)
   */
  async testSiteDetection(page) {
    const url = page.url();
    const results = [];

    for (const rule of this.siteDetectionRules) {
      const result = {
        siteKey: rule.siteKey,
        url: url,
        urlMatch: false,
        domMatch: false,
        metaMatch: false,
        overall: false
      };

      // Test URL patterns
      if (rule.urlPatterns) {
        result.urlMatch = rule.urlPatterns.some(pattern => pattern.test(url));
      }

      // Test DOM patterns
      if (rule.domPatterns) {
        try {
          result.domMatch = await page.evaluate((patterns) => {
            return patterns.some(pattern => {
              const elements = document.querySelectorAll(pattern);
              return elements.length > 0;
            });
          }, rule.domPatterns);
        } catch (e) {
          result.domError = e.message;
        }
      }

      // Test meta patterns
      if (rule.metaPatterns) {
        try {
          result.metaMatch = await page.evaluate((patterns) => {
            return patterns.some(({ name, content }) => {
              const metaTags = document.querySelectorAll(`meta[name="${name}"]`);
              return Array.from(metaTags).some(tag => {
                const tagContent = tag.getAttribute('content') || '';
                return content.test(tagContent);
              });
            });
          }, rule.metaPatterns);
        } catch (e) {
          result.metaError = e.message;
        }
      }

      result.overall = result.urlMatch || result.domMatch || result.metaMatch;
      results.push(result);
    }

    return results;
  }
}

// Singleton instance
const siteAdapterFactory = new SiteAdapterFactory();

module.exports = siteAdapterFactory;
