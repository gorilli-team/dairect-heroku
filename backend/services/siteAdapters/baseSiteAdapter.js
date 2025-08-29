/**
 * Base adapter for hotel booking sites
 * Provides a common interface for different booking platforms
 */

class BaseSiteAdapter {
  constructor(siteConfig) {
    this.siteConfig = siteConfig;
    this.selectors = siteConfig.selectors;
    this.patterns = siteConfig.patterns;
  }

  /**
   * Extract rooms from search results page
   * @param {Page} page - Playwright page object
   * @returns {Promise<Array>} Array of room objects
   */
  async extractRooms(page) {
    throw new Error('extractRooms must be implemented by site-specific adapter');
  }

  /**
   * Select a specific room and rate option
   * @param {Page} page - Playwright page object
   * @param {string} roomId - Room identifier
   * @param {string} optionId - Rate option identifier
   * @returns {Promise<Object>} Selection result
   */
  async selectRoomAndOption(page, roomId, optionId) {
    throw new Error('selectRoomAndOption must be implemented by site-specific adapter');
  }

  /**
   * Verify that the correct option was selected
   * @param {Page} page - Playwright page object
   * @param {Object} expectedOption - Expected option details
   * @returns {Promise<boolean>} True if correct option is selected
   */
  async verifySelectedOption(page, expectedOption) {
    throw new Error('verifySelectedOption must be implemented by site-specific adapter');
  }

  /**
   * Generic utility to find elements by multiple strategies
   * @param {Page} page - Playwright page object
   * @param {Object} searchCriteria - Search criteria
   * @returns {Promise<Object>} Found element info
   */
  async findElementByMultipleStrategies(page, searchCriteria) {
    const { 
      selectors = [], 
      textPatterns = [], 
      pricePatterns = [], 
      contextSelectors = [] 
    } = searchCriteria;

    // Try direct selectors first
    for (const selector of selectors) {
      try {
        const element = await page.waitForSelector(selector, { timeout: 2000 });
        if (element && await element.isVisible() && await element.isEnabled()) {
          return {
            found: true,
            element,
            strategy: 'direct_selector',
            selector
          };
        }
      } catch (e) {
        continue;
      }
    }

    // Try content-based matching
    return await this.findByContentMatching(page, {
      textPatterns,
      pricePatterns,
      contextSelectors
    });
  }

  /**
   * Find elements by content matching (text, price, context)
   * @param {Page} page - Playwright page object
   * @param {Object} criteria - Content matching criteria
   * @returns {Promise<Object>} Found element info
   */
  async findByContentMatching(page, criteria) {
    return await page.evaluate((searchCriteria) => {
      const { textPatterns, pricePatterns, contextSelectors } = searchCriteria;
      
      // Find all potential action buttons
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], .btn, [class*="button"]'));
      
      for (const button of buttons) {
        if (!button.textContent) continue;
        
        // Check if button or its context matches our criteria
        const buttonText = button.textContent.toLowerCase();
        const contextText = this.getContextText(button, 5); // 5 levels up
        
        const textMatch = textPatterns.some(pattern => 
          buttonText.includes(pattern.toLowerCase()) || 
          contextText.includes(pattern.toLowerCase())
        );
        
        const priceMatch = pricePatterns.some(pattern =>
          contextText.includes(pattern)
        );
        
        if (textMatch || priceMatch) {
          return {
            found: true,
            element: button,
            strategy: 'content_matching',
            matchedText: buttonText,
            contextText: contextText.substring(0, 200),
            textMatch,
            priceMatch
          };
        }
      }
      
      return { found: false };
    }, criteria);
  }

  /**
   * Get context text from element's ancestors
   * @param {Element} element - DOM element
   * @param {number} levels - Number of parent levels to check
   * @returns {string} Combined context text
   */
  getContextText(element, levels) {
    let contextText = '';
    let current = element;
    
    for (let i = 0; i < levels && current; i++) {
      if (current.textContent) {
        contextText += ' ' + current.textContent.toLowerCase();
      }
      current = current.parentElement;
    }
    
    return contextText;
  }

  /**
   * Generate price patterns for matching
   * @param {number} price - Numeric price
   * @param {string} currency - Currency code
   * @returns {Array<string>} Array of price pattern strings
   */
  generatePricePatterns(price, currency = 'EUR') {
    const patterns = [];
    const symbol = currency === 'EUR' ? '€' : '$';
    
    // Different price formats
    patterns.push(
      price.toString(),
      price.toFixed(2),
      price.toLocaleString('it-IT'),
      price.toLocaleString('en-US'),
      `${symbol}${price}`,
      `${symbol} ${price}`,
      `${symbol}${price.toLocaleString('it-IT')}`,
      price.toString().replace('.', ',')
    );
    
    return patterns;
  }

  /**
   * Log detailed debug information
   * @param {string} operation - Operation name
   * @param {Object} data - Debug data
   * @param {string} level - Log level (info, warn, error)
   */
  logDebug(operation, data, level = 'info') {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      site: this.siteConfig.name,
      operation,
      data
    };
    
    console.log(`[${level.toUpperCase()}] ${this.siteConfig.name}:${operation}`, logData);
  }
}

module.exports = BaseSiteAdapter;
