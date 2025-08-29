const BaseSiteAdapter = require('./baseSiteAdapter');

/**
 * SimpleBooking specific adapter
 * Implements the hotel booking interface for SimpleBooking sites
 */
class SimpleBookingAdapter extends BaseSiteAdapter {
  constructor() {
    const siteConfig = {
      name: 'SimpleBooking',
      baseUrl: '',
      selectors: {
        roomCards: '.room-card, [data-room], .card-room',
        roomTitles: '.room-title, .card-title, h3, h4',
        priceElements: '.price, .cost, [class*="prezzo"], [class*="price"]',
        bookingButtons: 'button:has-text("Prenota"), button:has-text("prenota"), .btn-prenota, [class*="prenota"]',
        infoButtons: 'button:has-text("Info"), .btn-info, [class*="info"]',
        optionPanels: '.options-panel, .cassetto, [class*="opzioni"]',
        optionRows: '.option-row, .rate-option, [class*="tariffa"]'
      },
      patterns: {
        priceRegex: /€?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/,
        keywords: {
          refundable: ['rivendibile', 'rimborsabile', 'refundable'],
          prepaid: ['prepaga', 'prepaid', 'pagamento anticipato'],
          takyon: ['takyon'],
          standard: ['standard', 'base', 'normale'],
          deluxe: ['deluxe', 'superior', 'premium']
        }
      }
    };
    super(siteConfig);
  }

  /**
   * Extract all rooms and their options from the page
   */
  async extractRooms(page) {
    this.logDebug('extractRooms', { action: 'starting room extraction' });
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow for any dynamic content
    
    return await page.evaluate((config) => {
      const rooms = [];
      
      // Find all room cards
      const roomElements = Array.from(document.querySelectorAll(
        config.selectors.roomCards.split(', ').join(', ')
      ));
      
      roomElements.forEach((roomEl, index) => {
        const roomId = `room_${index}`;
        const titleEl = roomEl.querySelector(config.selectors.roomTitles.split(', ').join(', '));
        const roomTitle = titleEl ? titleEl.textContent.trim() : `Camera ${index + 1}`;
        
        // Look for expandable info panel or direct options
        const room = {
          id: roomId,
          title: roomTitle,
          element: roomEl.outerHTML.substring(0, 500), // First 500 chars for debug
          options: []
        };
        
        // Try to find existing expanded options or collect info for expansion
        const optionElements = roomEl.querySelectorAll(
          config.selectors.optionRows.split(', ').join(', ')
        );
        
        if (optionElements.length > 0) {
          // Options are already visible
          optionElements.forEach((optEl, optIndex) => {
            const optionId = `${roomId}_opt_${optIndex}`;
            const optionText = optEl.textContent.trim();
            const priceMatch = optionText.match(config.patterns.priceRegex);
            const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 0;
            
            room.options.push({
              id: optionId,
              name: this.extractOptionName(optionText, config.patterns.keywords),
              price: price,
              text: optionText,
              keywords: this.extractKeywords(optionText, config.patterns.keywords)
            });
          });
        } else {
          // Look for info button that might expand options
          const infoButton = roomEl.querySelector(
            config.selectors.infoButtons.split(', ').join(', ')
          );
          
          if (infoButton) {
            room.hasInfoButton = true;
            room.infoButtonSelector = this.generateSelector(infoButton);
          }
          
          // Add a default option for now
          room.options.push({
            id: `${roomId}_opt_0`,
            name: 'Standard Rate',
            price: 0,
            text: roomTitle,
            keywords: ['standard']
          });
        }
        
        rooms.push(room);
      });
      
      return rooms;
      
    }, this.siteConfig);
  }

  /**
   * Select a specific room and rate option
   */
  async selectRoomAndOption(page, roomId, optionData) {
    this.logDebug('selectRoomAndOption', { 
      roomId, 
      optionData,
      action: 'starting selection process'
    });

    try {
      // First expand the room info panel if needed
      await this.expandRoomOptions(page, roomId);
      
      // Wait for options to be visible
      await page.waitForTimeout(1500);
      
      // Now find and click the specific option's booking button
      const result = await this.findAndClickBookingButton(page, optionData);
      
      if (result.success) {
        // Verify the selection worked
        const verification = await this.verifySelectedOption(page, optionData);
        result.verified = verification;
        
        this.logDebug('selectRoomAndOption', {
          result,
          verification,
          action: 'selection completed'
        });
      }
      
      return result;
      
    } catch (error) {
      this.logDebug('selectRoomAndOption', { 
        error: error.message,
        stack: error.stack,
        action: 'selection failed'
      }, 'error');
      
      return {
        success: false,
        error: error.message,
        action: 'exception_caught'
      };
    }
  }

  /**
   * Expand room options by clicking info button
   */
  async expandRoomOptions(page, roomId) {
    this.logDebug('expandRoomOptions', { roomId });
    
    // Look for info buttons to expand options
    const infoButtons = await page.$$('button:has-text("Info"), button:has-text("info"), .btn-info');
    
    if (infoButtons.length > 0) {
      // Click all info buttons to expand all room options
      for (const button of infoButtons) {
        try {
          if (await button.isVisible() && await button.isEnabled()) {
            await button.click();
            await page.waitForTimeout(500);
          }
        } catch (e) {
          this.logDebug('expandRoomOptions', { 
            error: e.message,
            action: 'failed to click info button'
          }, 'warn');
        }
      }
      
      // Wait for panels to expand
      await page.waitForTimeout(1000);
    }
  }

  /**
   * Find and click the correct booking button using enhanced matching
   */
  async findAndClickBookingButton(page, optionData) {
    this.logDebug('findAndClickBookingButton', { optionData });

    // Generate search patterns
    const textPatterns = this.generateTextPatterns(optionData.name || optionData.text);
    const pricePatterns = this.generatePricePatterns(optionData.price || 0);
    
    // Enhanced DOM search with multiple strategies
    const result = await page.evaluate(async (searchData) => {
      const { textPatterns, pricePatterns, keywords } = searchData;
      
      // Find all potential booking buttons
      const buttons = Array.from(document.querySelectorAll(
        'button:contains("Prenota"), button:contains("prenota"), .btn-prenota, [class*="prenota"], button[type="submit"]'
      ));
      
      if (buttons.length === 0) {
        // Fallback - find any clickable buttons
        buttons.push(...Array.from(document.querySelectorAll('button, [role="button"]')));
      }
      
      console.log(`Found ${buttons.length} potential buttons to analyze`);
      
      let bestMatch = null;
      let bestScore = 0;
      
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const buttonText = button.textContent.toLowerCase().trim();
        
        // Skip clearly wrong buttons
        if (buttonText.includes('cancella') || buttonText.includes('annulla') || 
            buttonText.includes('indietro') || buttonText.includes('close')) {
          continue;
        }
        
        // Get context text from parents (up to 6 levels)
        let contextText = '';
        let current = button;
        for (let level = 0; level < 6 && current; level++) {
          if (current.textContent) {
            contextText += ' ' + current.textContent.toLowerCase();
          }
          current = current.parentElement;
        }
        
        console.log(`Button ${i}: "${buttonText}" | Context: "${contextText.substring(0, 200)}..."`);
        
        // Calculate match score
        let score = 0;
        
        // Direct button text bonus
        if (buttonText.includes('prenota')) {
          score += 30;
        }
        
        // Text pattern matching
        textPatterns.forEach(pattern => {
          if (contextText.includes(pattern.toLowerCase())) {
            score += 20;
            console.log(`Text match: "${pattern}" found in context`);
          }
        });
        
        // Price pattern matching
        pricePatterns.forEach(pattern => {
          if (contextText.includes(pattern.toString())) {
            score += 25;
            console.log(`Price match: "${pattern}" found in context`);
          }
        });
        
        // Keyword matching
        if (keywords && keywords.length > 0) {
          keywords.forEach(keyword => {
            if (contextText.includes(keyword.toLowerCase())) {
              score += 15;
              console.log(`Keyword match: "${keyword}" found in context`);
            }
          });
        }
        
        // Proximity bonus - if button is closer to top of context
        const buttonPosition = contextText.indexOf(buttonText);
        if (buttonPosition >= 0 && buttonPosition < 100) {
          score += 5;
        }
        
        console.log(`Button ${i} total score: ${score}`);
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            button,
            score,
            buttonText,
            contextText: contextText.substring(0, 300),
            index: i
          };
        }
      }
      
      if (bestMatch && bestScore > 10) { // Minimum score threshold
        console.log(`Selected button with score ${bestMatch.score}:`, bestMatch);
        return {
          found: true,
          ...bestMatch
        };
      }
      
      return { 
        found: false, 
        analyzed: buttons.length,
        bestScore 
      };
      
    }, {
      textPatterns,
      pricePatterns,
      keywords: optionData.keywords || []
    });

    if (result.found) {
      this.logDebug('findAndClickBookingButton', {
        result,
        action: 'attempting click on best match'
      });
      
      try {
        // Try to click the button
        await page.evaluate((buttonIndex) => {
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          if (buttons[buttonIndex]) {
            buttons[buttonIndex].click();
            return true;
          }
          return false;
        }, result.index);
        
        // Wait for navigation or page change
        await Promise.race([
          page.waitForNavigation({ timeout: 5000 }),
          page.waitForSelector('.booking-form, .checkout, [class*="conferma"]', { timeout: 5000 })
        ]);
        
        return {
          success: true,
          strategy: 'enhanced_matching',
          matchScore: result.score,
          buttonText: result.buttonText,
          contextText: result.contextText
        };
        
      } catch (clickError) {
        this.logDebug('findAndClickBookingButton', {
          error: clickError.message,
          action: 'click failed'
        }, 'error');
        
        return {
          success: false,
          error: `Click failed: ${clickError.message}`,
          buttonFound: true,
          matchScore: result.score
        };
      }
    }
    
    return {
      success: false,
      error: 'No suitable booking button found',
      analyzed: result.analyzed,
      bestScore: result.bestScore
    };
  }

  /**
   * Verify that the correct option was selected
   */
  async verifySelectedOption(page, expectedOption) {
    this.logDebug('verifySelectedOption', { expectedOption });
    
    try {
      // Wait a bit for page to stabilize
      await page.waitForTimeout(2000);
      
      // Look for confirmation elements
      const confirmationExists = await page.evaluate((expected) => {
        // Look for confirmation page elements
        const confirmElements = document.querySelectorAll(
          '.confirmation, .booking-summary, .checkout, [class*="conferma"], [class*="riepilogo"]'
        );
        
        if (confirmElements.length === 0) {
          return { found: false, reason: 'no_confirmation_page' };
        }
        
        // Check if our option details are present
        const pageText = document.body.textContent.toLowerCase();
        const priceStr = expected.price ? expected.price.toString() : '';
        const nameStr = expected.name ? expected.name.toLowerCase() : '';
        
        const priceFound = !priceStr || pageText.includes(priceStr);
        const nameFound = !nameStr || pageText.includes(nameStr);
        
        return {
          found: priceFound && nameFound,
          priceFound,
          nameFound,
          pageUrl: window.location.href,
          pageText: pageText.substring(0, 500)
        };
        
      }, expectedOption);
      
      this.logDebug('verifySelectedOption', { confirmationExists });
      return confirmationExists.found;
      
    } catch (error) {
      this.logDebug('verifySelectedOption', { 
        error: error.message 
      }, 'error');
      return false;
    }
  }

  /**
   * Generate text patterns for matching
   */
  generateTextPatterns(text) {
    if (!text) return [];
    
    const patterns = [];
    const cleanText = text.toLowerCase().trim();
    
    // Full text
    patterns.push(cleanText);
    
    // First 15 characters
    if (cleanText.length > 15) {
      patterns.push(cleanText.substring(0, 15));
    }
    
    // Last 15 characters
    if (cleanText.length > 15) {
      patterns.push(cleanText.substring(cleanText.length - 15));
    }
    
    // Words (split by spaces, take significant ones)
    const words = cleanText.split(/\s+/).filter(word => word.length > 3);
    patterns.push(...words);
    
    // Remove duplicates
    return [...new Set(patterns)];
  }

  /**
   * Extract option name from text
   */
  extractOptionName(text, keywords) {
    // Simple extraction - take first meaningful part
    const cleaned = text.replace(/€.*$/, '').trim(); // Remove price part
    return cleaned.length > 50 ? cleaned.substring(0, 50) + '...' : cleaned;
  }

  /**
   * Extract keywords from text
   */
  extractKeywords(text, keywordMap) {
    const found = [];
    const lowerText = text.toLowerCase();
    
    Object.entries(keywordMap).forEach(([category, keywords]) => {
      keywords.forEach(keyword => {
        if (lowerText.includes(keyword.toLowerCase())) {
          found.push(keyword);
        }
      });
    });
    
    return found;
  }

  /**
   * Generate a CSS selector for an element
   */
  generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      const classes = element.className.split(/\s+/).slice(0, 2).join('.');
      return `.${classes}`;
    }
    
    const tagName = element.tagName.toLowerCase();
    const parent = element.parentElement;
    
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element);
      return `${tagName}:nth-child(${index + 1})`;
    }
    
    return tagName;
  }
}

module.exports = SimpleBookingAdapter;
