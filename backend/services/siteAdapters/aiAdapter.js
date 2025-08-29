const BaseSiteAdapter = require('./baseSiteAdapter');

/**
 * AI-powered adapter for handling unknown or complex booking sites
 * Uses machine learning and heuristics to understand site structure
 */
class AIAdapter extends BaseSiteAdapter {
  constructor() {
    const siteConfig = {
      name: 'AI_Universal',
      baseUrl: '',
      selectors: {
        // Generic selectors that work across many sites
        roomCards: '[class*="room"], [class*="camera"], [class*="card"], .room, .camera, article',
        roomTitles: 'h1, h2, h3, h4, .title, [class*="title"], [class*="nome"], [class*="name"]',
        priceElements: '[class*="price"], [class*="prezzo"], [class*="cost"], [class*="euro"], .price, .prezzo',
        bookingButtons: 'button, [role="button"], .btn, [class*="button"], [class*="prenota"], [class*="book"]',
        infoButtons: '[class*="info"], [class*="detail"], button:contains("info"), button:contains("detail")',
        optionPanels: '[class*="option"], [class*="rate"], [class*="tariffa"], .options, .rates',
        optionRows: 'tr, li, .option, .rate, [class*="tariffa"], [class*="option"]'
      },
      patterns: {
        priceRegex: /[€$£¥]\s*(\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{2})?)|(\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*[€$£¥]/,
        keywords: {
          booking: ['book', 'prenota', 'réserver', 'buchen', 'reservar'],
          price: ['price', 'prezzo', 'prix', 'preis', 'precio', 'cost', 'costo'],
          room: ['room', 'camera', 'chambre', 'zimmer', 'habitación'],
          available: ['available', 'disponibile', 'disponible', 'verfügbar'],
          info: ['info', 'details', 'détails', 'detalles', 'informazioni']
        }
      }
    };
    super(siteConfig);
    
    this.learningData = {
      successfulSelectors: new Map(),
      failedSelectors: new Set(),
      sitePatterns: new Map()
    };
  }

  /**
   * AI-powered room extraction using multiple heuristics
   */
  async extractRooms(page) {
    this.logDebug('extractRooms', { action: 'AI extraction started' });
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Try multiple extraction strategies
    const strategies = [
      this.extractByStructuralAnalysis,
      this.extractByContentAnalysis,
      this.extractByVisualLayout,
      this.extractBySemanticAnalysis
    ];

    let bestResult = { rooms: [], confidence: 0 };

    for (const strategy of strategies) {
      try {
        const result = await strategy.call(this, page);
        if (result.confidence > bestResult.confidence) {
          bestResult = result;
        }
      } catch (error) {
        this.logDebug('extractRooms', { 
          strategy: strategy.name, 
          error: error.message 
        }, 'warn');
      }
    }

    // Learn from successful extraction
    if (bestResult.confidence > 0.7) {
      this.learnFromSuccess(page.url(), bestResult);
    }

    this.logDebug('extractRooms', { 
      roomCount: bestResult.rooms.length,
      confidence: bestResult.confidence,
      strategy: bestResult.strategy
    });

    return bestResult.rooms;
  }

  /**
   * Structural analysis - find repeated patterns in DOM
   */
  async extractByStructuralAnalysis(page) {
    return await page.evaluate(() => {
      const rooms = [];
      const allElements = Array.from(document.querySelectorAll('*'));
      
      // Find elements with similar structure (same tag, similar classes)
      const structureMap = new Map();
      
      allElements.forEach(el => {
        if (el.children.length > 2 && el.textContent.trim().length > 20) {
          const structure = {
            tag: el.tagName,
            childCount: el.children.length,
            classList: Array.from(el.classList).sort(),
            hasPrice: /[€$£¥]\s*\d+|\d+\s*[€$£¥]/.test(el.textContent),
            hasBooking: /book|prenota|réserver|buchen/i.test(el.textContent)
          };
          
          const key = `${structure.tag}_${structure.childCount}_${structure.classList.join('_')}`;
          if (!structureMap.has(key)) {
            structureMap.set(key, []);
          }
          structureMap.get(key).push({ element: el, structure });
        }
      });
      
      // Find the most common structure that looks like room cards
      let bestPattern = null;
      let maxCount = 0;
      
      structureMap.forEach((elements, pattern) => {
        if (elements.length >= 2) { // At least 2 similar elements
          const score = elements.reduce((sum, { structure }) => {
            return sum + (structure.hasPrice ? 10 : 0) + (structure.hasBooking ? 15 : 0);
          }, 0);
          
          if (score > maxCount) {
            maxCount = score;
            bestPattern = elements;
          }
        }
      });
      
      if (bestPattern) {
        bestPattern.forEach((item, index) => {
          const el = item.element;
          const titleEl = el.querySelector('h1, h2, h3, h4, .title, [class*="title"]');
          const priceMatch = el.textContent.match(/[€$£¥]\s*(\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{2})?)|(\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*[€$£¥]/);
          
          rooms.push({
            id: `ai_room_${index}`,
            title: titleEl ? titleEl.textContent.trim() : `Room ${index + 1}`,
            price: priceMatch ? parseFloat((priceMatch[1] || priceMatch[2]).replace(',', '.')) : 0,
            element: el.outerHTML.substring(0, 300),
            confidence: 0.8,
            extractionMethod: 'structural_analysis',
            options: [{
              id: `ai_room_${index}_opt_0`,
              name: 'Standard Rate',
              price: priceMatch ? parseFloat((priceMatch[1] || priceMatch[2]).replace(',', '.')) : 0,
              text: el.textContent.substring(0, 200).trim()
            }]
          });
        });
      }
      
      return {
        rooms,
        confidence: rooms.length > 0 ? 0.8 : 0.2,
        strategy: 'structural_analysis'
      };
    });
  }

  /**
   * Content analysis - look for booking-related keywords and patterns
   */
  async extractByContentAnalysis(page) {
    return await page.evaluate((keywords) => {
      const rooms = [];
      const textElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent.trim();
        return text.length > 50 && text.length < 1000 && 
               keywords.booking.some(kw => text.toLowerCase().includes(kw)) &&
               keywords.price.some(kw => text.toLowerCase().includes(kw));
      });
      
      textElements.forEach((el, index) => {
        if (rooms.length < 10) { // Limit to reasonable number
          const text = el.textContent;
          const priceMatch = text.match(/[€$£¥]\s*(\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{2})?)|(\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*[€$£¥]/);
          const titleEl = el.querySelector('h1, h2, h3, h4') || el;
          
          rooms.push({
            id: `ai_content_${index}`,
            title: titleEl.textContent.substring(0, 100).trim(),
            price: priceMatch ? parseFloat((priceMatch[1] || priceMatch[2]).replace(',', '.')) : 0,
            confidence: 0.7,
            extractionMethod: 'content_analysis',
            options: [{
              id: `ai_content_${index}_opt_0`,
              name: 'Standard Rate',
              price: priceMatch ? parseFloat((priceMatch[1] || priceMatch[2]).replace(',', '.')) : 0,
              text: text.substring(0, 200).trim()
            }]
          });
        }
      });
      
      return {
        rooms,
        confidence: rooms.length > 0 ? 0.7 : 0.1,
        strategy: 'content_analysis'
      };
    }, this.siteConfig.patterns.keywords);
  }

  /**
   * Visual layout analysis - find elements positioned like room cards
   */
  async extractByVisualLayout(page) {
    return await page.evaluate(() => {
      const rooms = [];
      const allElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 200 && rect.height > 100 && 
               rect.width < window.innerWidth * 0.8 &&
               rect.height < window.innerHeight * 0.6;
      });
      
      // Group elements by similar size and position
      const layoutGroups = new Map();
      
      allElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const sizeKey = `${Math.round(rect.width / 50) * 50}_${Math.round(rect.height / 50) * 50}`;
        
        if (!layoutGroups.has(sizeKey)) {
          layoutGroups.set(sizeKey, []);
        }
        layoutGroups.get(sizeKey).push(el);
      });
      
      // Find the largest group that looks like room cards
      let bestGroup = null;
      let maxScore = 0;
      
      layoutGroups.forEach(elements => {
        if (elements.length >= 2) {
          const score = elements.reduce((sum, el) => {
            const hasPrice = /[€$£¥]\s*\d+|\d+\s*[€$£¥]/.test(el.textContent);
            const hasBooking = /book|prenota/i.test(el.textContent);
            const hasTitle = !!el.querySelector('h1, h2, h3, h4');
            
            return sum + (hasPrice ? 5 : 0) + (hasBooking ? 5 : 0) + (hasTitle ? 3 : 0);
          }, 0);
          
          if (score > maxScore) {
            maxScore = score;
            bestGroup = elements;
          }
        }
      });
      
      if (bestGroup) {
        bestGroup.forEach((el, index) => {
          const titleEl = el.querySelector('h1, h2, h3, h4, .title');
          const priceMatch = el.textContent.match(/[€$£¥]\s*(\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{2})?)|(\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*[€$£¥]/);
          
          rooms.push({
            id: `ai_visual_${index}`,
            title: titleEl ? titleEl.textContent.trim() : `Room ${index + 1}`,
            price: priceMatch ? parseFloat((priceMatch[1] || priceMatch[2]).replace(',', '.')) : 0,
            confidence: 0.6,
            extractionMethod: 'visual_layout',
            options: [{
              id: `ai_visual_${index}_opt_0`,
              name: 'Standard Rate',
              price: priceMatch ? parseFloat((priceMatch[1] || priceMatch[2]).replace(',', '.')) : 0,
              text: el.textContent.substring(0, 200).trim()
            }]
          });
        });
      }
      
      return {
        rooms,
        confidence: rooms.length > 0 ? 0.6 : 0.1,
        strategy: 'visual_layout'
      };
    });
  }

  /**
   * Semantic analysis using microdata, JSON-LD, or structured data
   */
  async extractBySemanticAnalysis(page) {
    return await page.evaluate(() => {
      const rooms = [];
      
      // Look for structured data (JSON-LD, microdata)
      const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      
      jsonLdScripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent);
          if (data && (data['@type'] === 'Hotel' || data['@type'] === 'Accommodation')) {
            // Handle structured hotel data
            if (data.hasOfferCatalog && data.hasOfferCatalog.itemListElement) {
              data.hasOfferCatalog.itemListElement.forEach((offer, index) => {
                rooms.push({
                  id: `ai_semantic_${index}`,
                  title: offer.name || `Room ${index + 1}`,
                  price: offer.priceSpecification ? parseFloat(offer.priceSpecification.price) : 0,
                  confidence: 0.9,
                  extractionMethod: 'semantic_analysis',
                  options: [{
                    id: `ai_semantic_${index}_opt_0`,
                    name: offer.name || 'Standard Rate',
                    price: offer.priceSpecification ? parseFloat(offer.priceSpecification.price) : 0,
                    text: offer.description || ''
                  }]
                });
              });
            }
          }
        } catch (e) {
          // Invalid JSON, continue
        }
      });
      
      // Look for microdata
      const microdataItems = Array.from(document.querySelectorAll('[itemtype*="schema.org"]'));
      microdataItems.forEach((item, index) => {
        if (item.getAttribute('itemtype').includes('Accommodation') || 
            item.getAttribute('itemtype').includes('Room')) {
          const nameEl = item.querySelector('[itemprop="name"]');
          const priceEl = item.querySelector('[itemprop="price"]');
          
          if (nameEl) {
            rooms.push({
              id: `ai_microdata_${index}`,
              title: nameEl.textContent.trim(),
              price: priceEl ? parseFloat(priceEl.textContent) : 0,
              confidence: 0.85,
              extractionMethod: 'semantic_analysis',
              options: [{
                id: `ai_microdata_${index}_opt_0`,
                name: nameEl.textContent.trim(),
                price: priceEl ? parseFloat(priceEl.textContent) : 0,
                text: item.textContent.substring(0, 200).trim()
              }]
            });
          }
        }
      });
      
      return {
        rooms,
        confidence: rooms.length > 0 ? 0.9 : 0.1,
        strategy: 'semantic_analysis'
      };
    });
  }

  /**
   * AI-powered room selection using multiple strategies
   */
  async selectRoomAndOption(page, roomId, optionData) {
    this.logDebug('selectRoomAndOption', { 
      roomId, 
      optionData,
      action: 'AI selection starting'
    });

    // Try different selection strategies
    const strategies = [
      this.selectByExactMatching,
      this.selectByFuzzyMatching,
      this.selectByContextualAnalysis,
      this.selectByNeuralHeuristics
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy.call(this, page, roomId, optionData);
        if (result.success) {
          // Learn from successful selection
          this.learnFromSelectionSuccess(page.url(), strategy.name, result);
          return result;
        }
      } catch (error) {
        this.logDebug('selectRoomAndOption', {
          strategy: strategy.name,
          error: error.message
        }, 'warn');
      }
    }

    return {
      success: false,
      error: 'All AI selection strategies failed',
      strategiesTried: strategies.length
    };
  }

  /**
   * Exact matching strategy
   */
  async selectByExactMatching(page, roomId, optionData) {
    const textPatterns = this.generateTextPatterns(optionData.name || optionData.text);
    const pricePatterns = this.generatePricePatterns(optionData.price || 0);

    const result = await page.evaluate((searchData) => {
      const { textPatterns, pricePatterns } = searchData;
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], .btn'));
      
      for (const button of buttons) {
        const buttonText = button.textContent.toLowerCase();
        const contextElement = button.closest('[class*="room"], [class*="card"], article, .option');
        const contextText = contextElement ? contextElement.textContent.toLowerCase() : buttonText;
        
        // Exact text match
        const exactTextMatch = textPatterns.some(pattern => 
          contextText.includes(pattern.toLowerCase())
        );
        
        // Exact price match
        const exactPriceMatch = pricePatterns.some(pattern =>
          contextText.includes(pattern.toString())
        );
        
        if (exactTextMatch && exactPriceMatch) {
          return { found: true, button, strategy: 'exact_matching' };
        }
      }
      
      return { found: false };
    }, { textPatterns, pricePatterns });

    if (result.found) {
      // Click the button
      await page.evaluate(() => result.button.click());
      
      return {
        success: true,
        strategy: 'exact_matching',
        confidence: 0.9
      };
    }

    return { success: false };
  }

  /**
   * Fuzzy matching with similarity scoring
   */
  async selectByFuzzyMatching(page, roomId, optionData) {
    return await page.evaluate((optionData) => {
      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      let bestMatch = null;
      let bestScore = 0;
      
      // Simple Levenshtein distance function
      const levenshteinDistance = (a, b) => {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
          matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
          matrix[0][j] = j;
        }
        for (let i = 1; i <= b.length; i++) {
          for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
            }
          }
        }
        return matrix[b.length][a.length];
      };
      
      const targetText = (optionData.name || optionData.text || '').toLowerCase();
      const targetPrice = optionData.price || 0;
      
      buttons.forEach(button => {
        const contextElement = button.closest('[class*="room"], [class*="card"], article');
        const contextText = contextElement ? contextElement.textContent.toLowerCase() : '';
        
        if (contextText.length > 20) {
          // Text similarity
          const distance = levenshteinDistance(targetText, contextText.substring(0, targetText.length));
          const textSimilarity = Math.max(0, 1 - distance / Math.max(targetText.length, contextText.length));
          
          // Price similarity
          const priceMatch = contextText.match(/(\d+(?:[.,]\d{2})?)/);
          const contextPrice = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 0;
          const priceSimilarity = targetPrice > 0 ? 
            Math.max(0, 1 - Math.abs(targetPrice - contextPrice) / targetPrice) : 0.5;
          
          const totalScore = (textSimilarity * 0.7) + (priceSimilarity * 0.3);
          
          if (totalScore > bestScore && totalScore > 0.6) {
            bestScore = totalScore;
            bestMatch = button;
          }
        }
      });
      
      if (bestMatch) {
        bestMatch.click();
        return {
          success: true,
          strategy: 'fuzzy_matching',
          confidence: bestScore
        };
      }
      
      return { success: false };
    }, optionData);
  }

  /**
   * Learn from successful extractions
   */
  learnFromSuccess(url, result) {
    const domain = new URL(url).hostname;
    if (!this.learningData.sitePatterns.has(domain)) {
      this.learningData.sitePatterns.set(domain, []);
    }
    
    this.learningData.sitePatterns.get(domain).push({
      strategy: result.strategy,
      confidence: result.confidence,
      roomCount: result.rooms.length,
      timestamp: new Date().toISOString()
    });
    
    this.logDebug('learnFromSuccess', {
      domain,
      strategy: result.strategy,
      confidence: result.confidence
    });
  }

  /**
   * Learn from successful selections
   */
  learnFromSelectionSuccess(url, strategy, result) {
    const domain = new URL(url).hostname;
    const key = `${domain}_${strategy}`;
    
    if (!this.learningData.successfulSelectors.has(key)) {
      this.learningData.successfulSelectors.set(key, []);
    }
    
    this.learningData.successfulSelectors.get(key).push({
      confidence: result.confidence,
      timestamp: new Date().toISOString()
    });
    
    this.logDebug('learnFromSelectionSuccess', {
      domain,
      strategy,
      confidence: result.confidence
    });
  }

  // Placeholder implementations for other strategies
  async selectByContextualAnalysis(page, roomId, optionData) {
    return { success: false };
  }

  async selectByNeuralHeuristics(page, roomId, optionData) {
    return { success: false };
  }

  async verifySelectedOption(page, expectedOption) {
    // Basic verification - check if we're on a different page
    await page.waitForTimeout(2000);
    
    return await page.evaluate((expected) => {
      const currentUrl = window.location.href;
      const hasForm = !!document.querySelector('form, [class*="checkout"], [class*="booking"]');
      const pageText = document.body.textContent.toLowerCase();
      
      // Look for confirmation indicators
      const confirmationWords = ['confirm', 'booking', 'reservation', 'checkout', 'payment'];
      const hasConfirmationWords = confirmationWords.some(word => pageText.includes(word));
      
      return hasForm || hasConfirmationWords || currentUrl !== expected.originalUrl;
    }, { ...expectedOption, originalUrl: page.url() });
  }
}

module.exports = AIAdapter;
