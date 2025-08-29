const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const playwrightService = require('../services/playwrightSteps');
const aiService = require('../services/aiSelector');

// Funzione per costruire URL diretto SimpleBooking
function buildDirectSearchUrl(searchParams) {
  // Usa l'URL base dall'hotel selezionato, altrimenti fallback a Palazzo Vitturi
  const baseUrl = searchParams.hotel?.baseUrl || process.env.TARGET_HOTEL_URL || 'https://www.simplebooking.it/ibe2/hotel/1467?lang=IT&cur=EUR';
  
  // Costruisce parametri date
  const dateParams = `&in=${searchParams.checkinDate}&out=${searchParams.checkoutDate}`;
  
  // Costruisce parametri ospiti (A per ogni adulto)
  const adults = parseInt(searchParams.adults) || 1;
  const guestParams = Array(adults).fill('A').join('%2C'); // %2C è la codifica URL per ,
  const guestsParam = `&guests=${guestParams}`;
  
  const directUrl = baseUrl + dateParams + guestsParam;
  
  return directUrl;
}

// Funzione per estrarre camere usando solo i selettori diretti (NO AI) - OPTIMIZED
async function extractRoomsWithSelectors(page) {
  logger.info('Extracting rooms using direct CSS selectors (optimized)');
  
  const rooms = [];
  
  try {
    // Shorter wait with fallback selectors
    await page.waitForSelector('.RoomResultBlock, .eio1k2u2, .RoomCard', { timeout: 6000 });
    
    // Use parallel extraction approach
    const extractionResult = await page.evaluate(() => {
      const formatCurrencyIT = (amount) => {
        try {
          const n = typeof amount === 'number' ? amount : parseFloat(amount);
          if (!isNaN(n)) {
            const base = n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return `€ ${base}`;
          }
        } catch {}
        return null;
      };
      
      const trySelector = (container, selectors) => {
        for (const sel of selectors) {
          try {
            const el = container.querySelector(sel);
            if (el) return el;
          } catch {}
        }
        return null;
      };
      
      const tryText = (container, selectors) => {
        const el = trySelector(container, selectors);
        return el ? el.textContent?.trim() : null;
      };
      
      const extractPrice = (priceText) => {
        if (!priceText) return 99.00;
        let cleaned = priceText.replace(/[^0-9,.]/g, '');
        if (cleaned.includes('.') && cleaned.includes(',')) {
          // European format: 1.649,76
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else if (cleaned.includes(',') && !cleaned.includes('.')) {
          // Format: 1649,76
          cleaned = cleaned.replace(',', '.');
        } else if (cleaned.includes('.') && !cleaned.includes(',')) {
          const parts = cleaned.split('.');
          if (parts.length === 2 && parts[1].length <= 2) {
            // Already in correct format: 1649.76
            cleaned = cleaned;
          } else {
            // Multiple dots, treat as thousands separator: 1.649.76 -> 1649.76
            cleaned = cleaned.replace(/\./g, '');
          }
        }
        const numericPrice = parseFloat(cleaned);
        return !isNaN(numericPrice) && numericPrice > 0 ? numericPrice : 99.00;
      };
      
      // Find all room containers at once
      const roomContainers = document.querySelectorAll('.RoomResultBlock, .eio1k2u2');
      const extractedRooms = [];
      
      roomContainers.forEach((roomCard, i) => {
        try {
          // Extract title - faster single selector approach
          const title = tryText(roomCard, [
            '.RoomCard h3 strong',
            '.ekc2wag9 h3 strong', 
            'h3.Heading strong',
            'h3 strong',
            'h3'
          ]) || `Camera ${i + 1}`;
          
          // Extract price - prioritize main amount
          const priceText = tryText(roomCard, [
            '.Prices .mainAmount span',
            '.mainAmount span',
            '.eiup2eu1 span',
            '[translate="no"] span'
          ]) || '99';
          const price = extractPrice(priceText);
          
          // Extract price block HTML (for detailed display)
          let priceBlock = null;
          const priceBlockEl = trySelector(roomCard, [
            'div[type="PRICES"].Prices.eo2ouhh3',
            '.Prices.eo2ouhh3',
            '.Prices'
          ]);
          if (priceBlockEl) {
            priceBlock = {
              html: priceBlockEl.outerHTML,
              text: priceBlockEl.textContent?.trim()
            };
          }
          
          // Extract description with basic cleanup
          let description = tryText(roomCard, [
            '.ekc2wag7 .ekc2wag6',
            '.RoomCard .Paragraph',
            '.room-description'
          ]) || 'Camera disponibile';
          
          // Basic description cleanup
          if (description.length > 20) {
            description = description
              .replace(/^Slide \d+ di \d+.*?ruler/g, '')
              .replace(/^\d+ m².*?ruler/g, '')
              .replace(/chevron-left.*?chevron-right/g, '')
              .replace(/Vedi di più/g, '')
              .replace(/\s+/g, ' ')
              .trim();
          }
          if (description.length < 10) description = 'Camera disponibile';
          
          // Extract room info block
          let roomInfoBlock = null;
          const infoBlockEl = trySelector(roomCard, ['.ekc2wag8.ltr-1f91znd.e3a2zab1']);
          if (infoBlockEl) {
            roomInfoBlock = {
              html: infoBlockEl.outerHTML,
              text: infoBlockEl.textContent?.trim()
            };
          }
          
          // Extract basic features (simplified)
          const features = [];
          const featureElements = roomCard.querySelectorAll('.RoomFeature .ltr-zswzrr');
          featureElements.forEach((featureEl) => {
            const featureText = featureEl.textContent?.trim();
            if (featureText && !featureText.match(/^\d+\s*m²$/)) {
              features.push(featureText);
            }
          });
          
          // Extract availability info
          let availabilityInfo = null;
          const availText = tryText(roomCard, ['.enongdq2', '.enongdq0']);
          const availNumber = tryText(roomCard, ['.enongdq1']);
          if (availText || availNumber) {
            availabilityInfo = {
              remaining: availNumber ? parseInt(availNumber) : null,
              description: availText,
              isLimited: true
            };
          }
          
          // Enhanced booking options extraction (optimized but complete)
          const bookingOptions = [];
          const rateOptions = roomCard.querySelectorAll('.RateWithOptions, .e1sl87534');
          rateOptions.forEach((rateEl, rateIdx) => {
            try {
              const rateName = tryText(rateEl, ['h4.e18qkw5q3 strong', 'h4 strong']) || `Tariffa ${rateIdx + 1}`;
              const rateDescription = tryText(rateEl, ['p.e18qkw5q2', '.Paragraph']);
              const ratePriceText = tryText(rateEl, ['.mainAmount', '.eiup2eu2']);
              const ratePrice = parseFloat(extractPrice(ratePriceText));
              
              // Extract meal plan
              const mealPlan = tryText(rateEl, ['.e16r10jm5', 'p b']);
              
              // Extract cancellation policy
              let cancellationPolicy = null;
              const cancelText = tryText(rateEl, ['.Rate__CancellationPolicy', '.e18qkw5q0']);
              if (cancelText) {
                cancellationPolicy = {
                  text: cancelText,
                  refundable: !cancelText.toLowerCase().includes('non rimborsabile')
                };
              }
              
              // Check for special offer
              const specialOffer = !!trySelector(rateEl, ['.Badge:has-text("Offerta speciale")', '.e1jssjhy1']);
              
              let bookSelector = null;
              const bookBtn = trySelector(rateEl, [
                'button:has-text("Prenota"):not(:has-text("Info"))',
                '.RoomOption_CTA',
                'button.e16r10jm0'
              ]);
              if (bookBtn) {
                bookSelector = `.RoomResultBlock:nth-child(${i + 1}) .RateWithOptions:nth-child(${rateIdx + 1}) button:has-text("Prenota")`;
              }
              
              bookingOptions.push({
                id: `rate-${i + 1}-${rateIdx + 1}`,
                name: rateName,
                description: rateDescription ? rateDescription.substring(0, 500) : null,
                price: ratePrice,
                formattedPrice: formatCurrencyIT(ratePrice),
                currency: 'EUR',
                mealPlan: mealPlan,
                cancellationPolicy: cancellationPolicy,
                specialOffer: specialOffer,
                bookSelector: bookSelector,
                available: !!bookBtn
              });
            } catch {}
          });
          
          // Extract main book selector
          let mainBookSelector = null;
          const mainBookBtn = trySelector(roomCard, [
            '.RoomCard_CTA',
            '.ekc2wag2',
            'button:has-text("Info e prenota")',
            'button:has-text("Prenota")'
          ]);
          if (mainBookBtn) {
            mainBookSelector = `.RoomCard:nth-child(${i + 1}) .RoomCard_CTA, .RoomResultBlock:nth-child(${i + 1}) button`;
          }
          
          // Extract images (simplified)
          const images = [];
          const imgElements = roomCard.querySelectorAll('.SpringImageCarousel img[src], .e1sp74u31[src]');
          imgElements.forEach(img => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('http') && !images.includes(src)) {
              images.push(src);
            }
          });
          
          const roomPriceNumber = parseFloat(price) || 99.00;
          const room = {
            id: `room-${i + 1}`,
            name: title.trim(),
            price: roomPriceNumber,
            formattedPrice: formatCurrencyIT(roomPriceNumber),
            currency: 'EUR',
            description: description.substring(0, 200),
            features: features.length > 0 ? features : ['WiFi gratuito', 'Aria condizionata'],
            roomInfoBlock: roomInfoBlock,
            priceBlock: priceBlock,
            mainBookSelector,
            available: true,
            limitedAvailability: tryText(roomCard, ['.enongdq2']),
            availabilityInfo: availabilityInfo,
            images: images,
            bookingOptions: bookingOptions
          };
          
          extractedRooms.push(room);
        } catch (error) {
          console.warn(`Failed to extract room ${i + 1}:`, error.message);
        }
      });
      
      return {
        success: true,
        rooms: extractedRooms,
        totalRooms: extractedRooms.length
      };
    });
    
    logger.info(`Extracted ${extractionResult.rooms.length} rooms using optimized parallel extraction`);
    
    return {
      success: true,
      rooms: extractionResult.rooms,
      totalRooms: extractionResult.rooms.length,
      message: `Found ${extractionResult.rooms.length} unique rooms using direct selectors (optimized)`
    };
    
  } catch (error) {
    logger.error('Failed to extract rooms with selectors:', error);
    return {
      success: false,
      rooms: [],
      totalRooms: 0,
      message: 'No rooms found with direct selectors'
    };
  }
}

const router = express.Router();

// Session storage (in production use Redis or database)
const sessions = new Map();

// Validation schemas
const searchSchema = Joi.object({
  checkinDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  checkoutDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  adults: Joi.number().integer().min(1).max(6).required(),
  children: Joi.number().integer().min(0).max(4).default(0),
  hotel: Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    location: Joi.string().required(),
    emoji: Joi.string().required(),
    baseUrl: Joi.string().uri().required(),
    description: Joi.string().required()
  }).required()
});

const personalDataSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  roomId: Joi.string().required(),
  personalData: Joi.object({
    firstName: Joi.string().min(2).required(),
    lastName: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().min(10).required(),
    cardNumber: Joi.string().pattern(/^\d{16}$/).required(),
    expiryMonth: Joi.string().pattern(/^\d{2}$/).required(),
    expiryYear: Joi.string().pattern(/^\d{4}$/).required(),
    cvv: Joi.string().pattern(/^\d{3,4}$/).required()
  }).required()
});

// POST /api/booking/start-search
router.post('/start-search', async (req, res) => {
  console.log('=== POST start-search Debug ===');
  console.log('Origin:', req.headers.origin);
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('User-Agent:', req.headers['user-agent']);
  console.log('Referer:', req.headers.referer);
  console.log('Body:', req.body);
  console.log('=============================');
  
  try {
    // Validate input
    const { error, value } = searchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { checkinDate, checkoutDate, adults, children, hotel } = value;
    const sessionId = uuidv4();

    logger.info(`Starting booking search for session ${sessionId}`, {
      checkinDate,
      checkoutDate,
      adults,
      children,
      hotel: hotel.name
    });

    // Initialize Playwright session with new browser instance
    let browser = null;
    let page = null;
    
    try {
      browser = await playwrightService.initBrowser();
      page = await playwrightService.createPage(browser);
    } catch (browserError) {
      logger.error('Failed to initialize browser:', browserError);
      return res.status(500).json({
        error: 'Browser initialization failed',
        message: 'Could not start browser session. Please try again.'
      });
    }

    // Validate browser and page before storing session
    if (!browser || !page) {
      logger.error('Browser or page is null after initialization');
      return res.status(500).json({
        error: 'Browser session invalid',
        message: 'Failed to create valid browser session'
      });
    }
    
    // Test browser connectivity
    try {
      await page.goto('about:blank', { timeout: 5000 });
    } catch (connectError) {
      logger.error('Browser connectivity test failed:', connectError);
      await playwrightService.cleanup(browser);
      return res.status(500).json({
        error: 'Browser connectivity failed',
        message: 'Could not establish browser connection'
      });
    }

    // Store session data
    sessions.set(sessionId, {
      sessionId,
      browser,
      page,
      searchParams: { checkinDate, checkoutDate, adults, children, hotel },
      currentStep: 'search',
      createdAt: new Date(),
      lastActivity: new Date()
    });

    // Costruisce URL diretto con parametri di ricerca
    const directUrl = buildDirectSearchUrl({ checkinDate, checkoutDate, adults, children, hotel });
    logger.info('Using direct URL for search', { directUrl, hotel: hotel.name });

    // Navigate directly to search results page with retry logic
    let navigationSuccess = false;
    let lastError = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        logger.info(`Navigation attempt ${attempt}/3 to: ${directUrl}`);
        
        await page.goto(directUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 20000 // Optimized timeout to 20 seconds
        });
        
        navigationSuccess = true;
        logger.info(`Navigation successful on attempt ${attempt}`);
        break;
        
      } catch (error) {
        lastError = error;
        logger.warn(`Navigation attempt ${attempt} failed:`, error.message);
        
        if (attempt < 3) {
          logger.info(`Waiting 1 second before retry...`);
          await page.waitForTimeout(1000);
        }
      }
    }
    
    if (!navigationSuccess) {
      logger.error('All navigation attempts failed:', lastError?.message);
      throw new Error(`Failed to navigate to search page after 3 attempts: ${lastError?.message}`);
    }
    
    // Handle cookie consent and overlays if present - optimized
    await aiService.handleCookieConsent(page);
    await aiService.closeOverlays(page, { maxMs: 400 });
    
    // Wait for results to load
    logger.info('Waiting for availability results to load');
    const waitResult = await aiService.waitForAvailabilityResults(page);
    
    let availableRooms = [];
    
    if (waitResult.success) {
      // Extract rooms using direct selectors (no AI)
      logger.info('Extracting available rooms using direct selectors');
      
      const roomsData = await extractRoomsWithSelectors(page);
      
      if (roomsData.rooms && roomsData.rooms.length > 0) {
        availableRooms = roomsData.rooms;
        logger.info(`Found ${availableRooms.length} rooms using direct selectors`);
        
        // Update session with rooms
        const session = sessions.get(sessionId);
        session.availableRooms = availableRooms;
        session.currentStep = 'room-selection';
      }
    }
    
    const searchResult = {
      success: waitResult.success,
      status: waitResult.status,
      message: waitResult.success ? 'Search completed successfully' : 'Search timed out or failed',
      rooms: availableRooms
    };

    // Take screenshot for debugging
    await page.screenshot({ 
      path: `backend/logs/search-${sessionId}.png`,
      fullPage: true
    });

    res.json({
      success: true,
      sessionId,
      message: 'Search completed successfully',
      data: searchResult
    });

  } catch (error) {
    logger.error('Error in start-search:', error);
    res.status(500).json({
      error: 'Failed to start search',
      message: error.message
    });
  }
});

// GET /api/booking/available-rooms/:sessionId
router.get('/available-rooms/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Invalid or expired session ID'
      });
    }

    // Validate session browser and page
    if (!session.browser || !session.page) {
      logger.error(`Session ${sessionId} has invalid browser or page`);
      sessions.delete(sessionId);
      return res.status(400).json({
        error: 'Invalid session state',
        message: 'Browser session is no longer valid. Please start a new search.'
      });
    }

    // Test if browser is still connected
    try {
      await session.page.url();
      session.lastActivity = new Date();
    } catch (browserError) {
      logger.error(`Browser disconnected for session ${sessionId}:`, browserError);
      await playwrightService.cleanup(session.browser).catch(() => {});
      sessions.delete(sessionId);
      return res.status(400).json({
        error: 'Browser session expired',
        message: 'Your browser session has expired. Please start a new search.'
      });
    }

    logger.info(`Getting available rooms for session ${sessionId}`);

    // Extract rooms using direct selectors (no AI)
    const roomsData = await extractRoomsWithSelectors(session.page);

    logger.info(`Found rooms using direct selectors:`, { roomsCount: roomsData.rooms?.length || 0 });

    // Take screenshot
    await session.page.screenshot({ 
      path: `backend/logs/rooms-${sessionId}.png`,
      fullPage: true
    });

    // Update session
    session.currentStep = 'room-selection';
    session.availableRooms = roomsData.rooms;

    res.json({
      success: true,
      rooms: roomsData.rooms,
      message: roomsData.message || 'Rooms found successfully'
    });

  } catch (error) {
    logger.error('Error getting available rooms:', error);
    res.status(500).json({
      error: 'Failed to get available rooms',
      message: error.message
    });
  }
});

// POST /api/booking/select-room
router.post('/select-room', async (req, res) => {
  try {
    const { sessionId, roomId, optionId } = req.body;

    if (!sessionId || !roomId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'sessionId and roomId are required'
      });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    logger.info(`Selecting room ${roomId} for session ${sessionId}`);

    // Find the room in session data
    const selectedRoom = session.availableRooms?.find(room => room.id === roomId);
    if (!selectedRoom) {
      return res.status(400).json({
        error: 'Room not found',
        message: 'Selected room ID not found in available rooms'
      });
    }

    logger.info('Found room to select:', { 
      name: selectedRoom.name, 
      price: selectedRoom.price,
      selector: selectedRoom.mainBookSelector
    });

    // Use direct selectors to click the "Info e prenota" button (first step)
    const selectors = [
      selectedRoom.mainBookSelector, // Specific selector for this room
      `button:nth-child(${roomId.split('-')[1]}) >> text="Info e prenota"`, // Fallback with room index
      '.RoomCard_CTA', // Generic room booking button
      '.ekc2wag2', // SimpleBooking specific class
      'button:has-text("Info e prenota")', // Generic text search
    ];

    let clicked = false;
    let usedSelector = null;

    for (const selector of selectors) {
      if (!selector) continue;
      
      try {
        logger.info(`Trying to click "Info e prenota" with selector: ${selector}`);
        
        // Wait for selector and try to click
        const element = await session.page.waitForSelector(selector, { timeout: 3000 });
        if (element) {
          await element.click();
          clicked = true;
          usedSelector = selector;
          logger.info(`Successfully clicked "Info e prenota" button with selector: ${selector}`);
          break;
        }
      } catch (error) {
        logger.debug(`Selector ${selector} failed: ${error.message}`);
      }
    }

    if (!clicked) {
      logger.error('Failed to click any "Info e prenota" button');
      return res.status(500).json({
        error: 'Failed to select room',
        message: 'Could not find or click "Info e prenota" button'
      });
    }

    // Wait for the booking options page to load
    logger.info('Waiting for booking options page to load...');
    await session.page.waitForTimeout(3000);
    
    // Check if we're on the booking options page with rate selections
    const bookingOptionsVisible = await session.page.isVisible('.RateWithOptions, .e1sl87534', { timeout: 5000 }).catch(() => false);
    
    if (bookingOptionsVisible) {
      // Ensure overlays are not blocking before interacting with rate options
      await aiService.closeOverlays(session.page, { maxMs: 600 });
      logger.info('✅ Booking options page loaded - found rate options');
      
      let rateOptionClicked = false;
      
      // Get current URL before clicking to detect navigation (needed for both specific and fallback)
      const currentUrl = session.page.url();
      
    // Se l'utente ha specificato un'opzione, usa selettori precisi e scoping per stanza
    if (optionId && selectedRoom.bookingOptions) {
      const selectedOption = selectedRoom.bookingOptions.find(option => option.id === optionId);
      
      if (selectedOption) {
        logger.info(`Trying to click specific option "${selectedOption.name}" with scoped strategy`);

        // 1) Scope: individua la card della stanza selezionata
        let roomIndex = null;
        try {
          // roomId ha formato 'room-<index>'
          const parts = (roomId || '').split('-');
          if (parts.length === 2) roomIndex = parseInt(parts[1]);
        } catch {}
        
        const roomCards = session.page.locator('.RoomCard, .RoomResultBlock, .ekc2wag12, .eio1k2u2');
        const roomScope = Number.isInteger(roomIndex) && roomIndex > 0
          ? roomCards.nth(roomIndex - 1)
          : roomCards.first();

        // Assicurati che il cassetto (collapse) sia visibile all'interno della stanza
        try {
          const expandToggle = roomScope.locator('[aria-expanded="false"], .expand, button:has-text("Info e prenota")').first();
          if (await expandToggle.count() > 0) {
            await expandToggle.click({ timeout: 2000 }).catch(() => {});
          }
        } catch {}
        await session.page.waitForTimeout(800);

        // 2) Prova prima con il selettore precomputato specifico
        if (selectedOption.bookSelector) {
          try {
            logger.info(`Trying precomputed bookSelector: ${selectedOption.bookSelector}`);
            const precomputed = roomScope.locator(selectedOption.bookSelector).first();
            if (await precomputed.count() > 0) {
              await precomputed.scrollIntoViewIfNeeded();
              await precomputed.click({ timeout: 3000 });
              await session.page.waitForTimeout(1500);
              const newUrl = session.page.url();
              if (newUrl !== currentUrl) {
                rateOptionClicked = true;
                logger.info('🎉 SUCCESS! Clicked with precomputed selector');
              } else {
                logger.warn('Precomputed selector clicked but URL did not change');
              }
            } else {
              logger.warn('Precomputed selector not found in room scope');
            }
          } catch (e) {
            logger.debug(`Precomputed selector failed: ${e.message}`);
          }
        }
        // 3) Se non riuscito, prova selezione basata su indice dall'optionId (es. rate-1-2)
        if (!rateOptionClicked) {
          try {
            let optionIndex = null;
            const parts = (optionId || '').split('-');
            if (parts.length === 3) optionIndex = parseInt(parts[2]);
            if (Number.isInteger(optionIndex) && optionIndex > 0) {
              const ratesInRoom = roomScope.locator('.RateWithOptions, .e1sl87534');
              const rateCount = await ratesInRoom.count();
              logger.info(`Index-based fallback: optionIndex=${optionIndex}, rateCount=${rateCount}`);
              if (rateCount >= optionIndex) {
                const targetRateByIndex = ratesInRoom.nth(optionIndex - 1);
                const bookBtn = targetRateByIndex.locator(
                  'button:has-text("Prenota"):not(:has-text("Info")), .RoomOption_CTA:has-text("Prenota"), button.e16r10jm0:has-text("Prenota"), button:has(.CTA_Text:has-text("Prenota"))'
                ).first();
                if (await bookBtn.count() > 0) {
                  await bookBtn.scrollIntoViewIfNeeded();
                  await session.page.screenshot({ 
                    path: `backend/logs/indexed-rate-${sessionId}-${optionId.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                    fullPage: true
                  });
                  await bookBtn.click({ timeout: 5000 });
                  // Success conditions: URL changed OR personal/guarantee/payment page elements appeared
                  await session.page.waitForTimeout(1500);
                  const newUrl = session.page.url();
                  const successBySelectors = await Promise.race([
                    session.page.isVisible('.CustomerDataCollectionPage', { timeout: 3000 }).catch(() => false),
                    session.page.isVisible('input[name="name"], input[name="firstName"]', { timeout: 3000 }).catch(() => false),
                    session.page.isVisible('.GuaranteeDataCollectionPage, .PaymentMethodsForm', { timeout: 3000 }).catch(() => false)
                  ]);
                  if (newUrl !== currentUrl || successBySelectors) {
                    rateOptionClicked = true;
                    logger.info('🎉 SUCCESS! Clicked rate by index-based fallback in scoped room');
                  } else {
                    logger.warn('Index-based Prenota clicked but no navigation indicators detected');
                  }
                } else {
                  logger.warn('No Prenota button found in indexed rate container');
                }
              }
            }
          } catch (e) {
            logger.debug(`Index-based rate click failed: ${e.message}`);
          }
        }

        // 4) Se non riuscito, trova la tariffa per titolo (e optional prezzo) e clicca il suo Prenota
        if (!rateOptionClicked) {
          try {
            const ratesInRoom = roomScope.locator('.RateWithOptions, .e1sl87534');
            // Filtro per titolo della tariffa con confronto più permissivo
            const targetRate = await ratesInRoom.elementHandles();
            let matchedHandle = null;
            for (const handle of targetRate) {
              try {
                const text = (await handle.textContent() || '').toLowerCase();
                const nameLower = (selectedOption.name || '').toLowerCase();
                if (nameLower && text.includes(nameLower.substring(0, Math.min(15, nameLower.length)))) {
                  matchedHandle = handle;
                  break;
                }
              } catch {}
            }

            if (matchedHandle) {
              const rateLocator = roomScope.locator('.RateWithOptions, .e1sl87534').filter({ has: { element: matchedHandle } }).first();
              const bookBtn = rateLocator.locator(
                'button:has-text("Prenota"):not(:has-text("Info")), .RoomOption_CTA:has-text("Prenota"), button.e16r10jm0:has-text("Prenota"), button:has(.CTA_Text:has-text("Prenota"))'
              ).first();
              if (await bookBtn.count() > 0) {
                await bookBtn.scrollIntoViewIfNeeded();
                await session.page.screenshot({ 
                  path: `backend/logs/target-rate-${sessionId}-${optionId.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                  fullPage: true
                });
                await bookBtn.click({ timeout: 5000 });
                await session.page.waitForTimeout(1500);
                const newUrl = session.page.url();
                const successBySelectors = await Promise.race([
                  session.page.isVisible('.CustomerDataCollectionPage', { timeout: 3000 }).catch(() => false),
                  session.page.isVisible('input[name="name"], input[name="firstName"]', { timeout: 3000 }).catch(() => false),
                  session.page.isVisible('.GuaranteeDataCollectionPage, .PaymentMethodsForm', { timeout: 3000 }).catch(() => false)
                ]);
                if (newUrl !== currentUrl || successBySelectors) {
                  rateOptionClicked = true;
                  logger.info('🎉 SUCCESS! Clicked rate-specific Prenota in scoped room (title match)');
                } else {
                  logger.warn('Clicked rate-specific Prenota (title match) but no navigation indicators detected');
                }
              } else {
                logger.warn('No valid Prenota button inside targeted rate (title match)');
              }
            } else {
              logger.warn('Could not find targeted rate container by title');
            }
          } catch (e) {
            logger.debug(`Scoped rate click (title) failed: ${e.message}`);
          }
        }

        // 4) Ultimo fallback: selettori generici ma sempre nello scope della stanza
        if (!rateOptionClicked) {
          logger.info('Falling back to generic Prenota selectors within room scope');
          const simplePrenotaSelectors = [
            'button:has-text("Prenota"):not(:has-text("Info"))',
            '.RoomOption_CTA:has-text("Prenota")',
            'button.e16r10jm0:has-text("Prenota")',
            '[class*="CTA"]:has-text("Prenota")',
            'button[class*="prenota"]',
            'button[class*="Prenota"]'
          ];

          for (const selector of simplePrenotaSelectors) {
            try {
              logger.info(`Trying simple Prenota selector (scoped): ${selector}`);
              const elements = await roomScope.$$(selector);

              for (const element of elements) {
                const isVisible = await element.isVisible();
                const isEnabled = await element.isEnabled();
                const buttonText = await element.textContent();
                const lowerButtonText = (buttonText || '').toLowerCase();
                const isValidPrenota = lowerButtonText.includes('prenota') && !lowerButtonText.includes('info');

                if (isVisible && isEnabled && isValidPrenota) {
                  await element.scrollIntoViewIfNeeded();
                  await session.page.waitForTimeout(300);
                  await element.click({ timeout: 5000 });
                  await session.page.waitForTimeout(1500);
                  const newUrl = session.page.url();
                  const successBySelectors = await Promise.race([
                    session.page.isVisible('.CustomerDataCollectionPage', { timeout: 3000 }).catch(() => false),
                    session.page.isVisible('input[name="name"], input[name="firstName"]', { timeout: 3000 }).catch(() => false),
                    session.page.isVisible('.GuaranteeDataCollectionPage, .PaymentMethodsForm', { timeout: 3000 }).catch(() => false)
                  ]);
                  if (newUrl !== currentUrl || successBySelectors) {
                    rateOptionClicked = true;
                    logger.info(`🎉 SUCCESS! Clicked simple Prenota (scoped) using selector: ${selector}`);
                    break;
                  }
                }
              }
              if (rateOptionClicked) break;
            } catch (error) {
              logger.debug(`Scoped simple Prenota selector ${selector} failed: ${error.message}`);
              continue;
            }
          }
        }
      }
    }
      
      // Solo se l'utente NON ha specificato un'opzione, usa il fallback generico
      if (!rateOptionClicked && !optionId) {
        logger.info('No specific option requested - falling back to first available "Prenota" button');
        
        const rateOptionSelectors = [
          '.RoomOption_CTA.e16r10jm0', // Primary selector for rate option buttons
          'button.RoomOption_CTA', // Generic rate option button
          '.RateWithOptions button:has-text("Prenota")', // Prenota button within rate options
          'button:has-text("Prenota")', // Any Prenota button
        ];
        
        for (const rateSelector of rateOptionSelectors) {
          try {
            logger.info(`Trying to click rate option "Prenota" with selector: ${rateSelector}`);
            
            const rateButton = await session.page.waitForSelector(rateSelector, { timeout: 30000 });
            if (rateButton) {
              // Wait for element to be fully interactive
              await session.page.waitForTimeout(1000);
              
              // Ensure element is visible and enabled
              const isVisible = await rateButton.isVisible();
              const isEnabled = await rateButton.isEnabled();
              
              if (isVisible && isEnabled) {
                // Scroll to element to ensure it's in view
                await rateButton.scrollIntoViewIfNeeded();
                await session.page.waitForTimeout(500);
                
                // Click with force to ensure it registers
                await rateButton.click({ force: true });
                
                // Wait a moment to see if navigation happens
                await session.page.waitForTimeout(2000);
                
                // Check if URL changed (indicates successful navigation)
                const newUrl = session.page.url();
                if (newUrl !== currentUrl) {
                  rateOptionClicked = true;
                  logger.info(`Successfully clicked rate option "Prenota" with selector: ${rateSelector}`);
                  break;
                } else {
                  logger.warn(`Button clicked but no navigation detected with selector: ${rateSelector}`);
                }
              } else {
                logger.warn(`Button found but not clickable: visible=${isVisible}, enabled=${isEnabled}`);
              }
            }
          } catch (error) {
            logger.debug(`Rate selector ${rateSelector} failed: ${error.message}`);
          }
        }
      }
      
      if (!rateOptionClicked) {
        logger.error('Failed to click any rate option "Prenota" button');
        return res.status(500).json({
          error: 'Failed to select rate option',
          message: 'Could not find or click rate option "Prenota" button'
        });
      }
    } else {
      logger.warn('❌ Booking options page not detected - proceeding anyway');
    }

    // Wait for navigation to customer data page
    logger.info('Waiting for navigation to customer data page...');
    
    await session.page.waitForTimeout(5000); // Give more time for navigation
    
    // DEBUG: Get current page state
    const finalUrl = session.page.url();
    const pageTitle = await session.page.title();
    logger.info('After clicking Prenota button:', {
      url: finalUrl,
      title: pageTitle
    });
    
    // Check if we're on customer data page by looking for form elements
    const isCustomerDataPage = await session.page.isVisible(
      'input[name="name"], input[name="firstName"], h2:has-text("Completa i tuoi dati")' 
    ).catch(() => false);

    if (!isCustomerDataPage) {
      logger.warn('Not on customer data page yet, taking screenshot for debugging');
      
      // DEBUG: Check for any forms or input fields on current page
      const allInputs = await session.page.locator('input').all();
      const inputInfo = [];
      
      for (let i = 0; i < Math.min(allInputs.length, 10); i++) {
        try {
          const input = allInputs[i];
          const type = await input.getAttribute('type');
          const name = await input.getAttribute('name');
          const id = await input.getAttribute('id');
          const placeholder = await input.getAttribute('placeholder');
          const visible = await input.isVisible();
          
          inputInfo.push({ index: i, type, name, id, placeholder, visible });
        } catch (e) {
          // Skip this input
        }
      }
      
      logger.info('DEBUG - Current page inputs:', inputInfo);
      
      // Check for potential next steps or buttons
      const allButtons = await session.page.locator('button, input[type="button"], input[type="submit"]').all();
      const buttonInfo = [];
      
      for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
        try {
          const button = allButtons[i];
          const text = await button.textContent();
          const className = await button.getAttribute('class');
          const visible = await button.isVisible();
          
          buttonInfo.push({ index: i, text: text?.trim(), class: className, visible });
        } catch (e) {
          // Skip this button
        }
      }
      
      logger.info('DEBUG - Current page buttons:', buttonInfo);
    }

    // Take screenshot for debugging
    await session.page.screenshot({ 
      path: `backend/logs/room-selected-${sessionId}.png`,
      fullPage: true
    });

    // Update session
    session.selectedRoom = roomId;
    session.selectedRoomData = selectedRoom;
    session.currentStep = 'personal-data';

    res.json({
      success: true,
      message: 'Room selected successfully',
      data: {
        roomId,
        roomName: selectedRoom.name,
        roomPrice: selectedRoom.price,
        selector: usedSelector,
        onCustomerDataPage: isCustomerDataPage
      }
    });

  } catch (error) {
    logger.error('Error selecting room:', error);
    res.status(500).json({
      error: 'Failed to select room',
      message: error.message
    });
  }
});

// POST /api/booking/fill-personal-data
router.post('/fill-personal-data', async (req, res) => {
  logger.info('Fill personal data endpoint called');
  
  const schema = Joi.object({
    sessionId: Joi.string().uuid().required(),
    personalData: Joi.object({
      firstName: Joi.string().min(2).required(),
      lastName: Joi.string().min(2).required(), 
      email: Joi.string().email().required(),
      acceptNewsletter: Joi.boolean().default(false)
    }).required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Invalid request data',
      details: error.details
    });
  }

  const { sessionId, personalData } = value;
  const session = sessions.get(sessionId);

  if (!session || !session.page) {
    return res.status(404).json({
      error: 'Session not found or page not available'
    });
  }

  if (session.currentStep !== 'personal-data') {
    return res.status(400).json({
      error: 'Invalid step',
      message: `Expected step 'personal-data', but current step is '${session.currentStep}'`
    });
  }

  try {
    logger.info('Filling personal data page', {
      sessionId,
      email: personalData.email,
      firstName: personalData.firstName
    });

    // Fill personal data on the page
    const fillResult = await playwrightService.fillPersonalDataPage(
      session.page,
      personalData
    );

    if (fillResult.success) {
      // Click the "Continua" button after filling personal data
      logger.info('Clicking Continua button to proceed to payment page');
      
      try {
        // First, ensure privacy policy is accepted if not already
        logger.info('Ensuring privacy policy is accepted before clicking Continue');
        const privacySelectors = [
          'input[name="privacyPolicyAcceptance"]',
          'input[name="privacy"]',
          'input[type="checkbox"]' // Generic fallback
        ];
        
        for (const privacySelector of privacySelectors) {
          try {
            const privacyCheckbox = await session.page.waitForSelector(privacySelector, { timeout: 2000 });
            if (privacyCheckbox) {
              const isChecked = await privacyCheckbox.isChecked();
              if (!isChecked) {
                await privacyCheckbox.check();
                logger.info(`Privacy policy accepted with selector: ${privacySelector}`);
                await session.page.waitForTimeout(1000); // Give time for UI to update
              }
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        // Try multiple selectors for the Continue button
        const continueSelectors = [
          'button.CustomerDataCollectionPage_CTA',
          '.CustomerDataCollectionPage_CTA',
          'button.CustomerDataCollectionPage_CTA.CTA',
          'button:has-text("Continua")',
          'button[type="submit"]',
          '.CTA:has-text("Continua")',
          'button.CTA'
        ];
        
        let continueClicked = false;
        let usedSelector = null;
        
        for (const selector of continueSelectors) {
          try {
            logger.info(`Trying Continue button selector: ${selector}`);
            
            // Wait for selector with shorter timeout to try multiple selectors quickly
            const button = await session.page.waitForSelector(selector, { timeout: 3000 });
            if (button) {
              const isVisible = await button.isVisible();
              const isEnabled = await button.isEnabled();
              
              logger.info(`Continue button found: visible=${isVisible}, enabled=${isEnabled}`);
              
              if (isVisible && isEnabled) {
                await button.click();
                continueClicked = true;
                usedSelector = selector;
                logger.info(`Successfully clicked Continue button with selector: ${selector}`);
                break;
              } else {
                logger.warn(`Continue button found but not clickable: visible=${isVisible}, enabled=${isEnabled}`);
              }
            }
          } catch (e) {
            logger.debug(`Continue selector ${selector} failed: ${e.message}`);
            continue;
          }
        }
        
        if (!continueClicked) {
          // Take screenshot for debugging before throwing error
          await session.page.screenshot({ 
            path: `backend/logs/continue-button-not-found-${sessionId}.png`,
            fullPage: true
          });
          
          throw new Error('Could not find or click Continue button with any selector');
        }
        
        // Wait for navigation to payment page
        logger.info('Waiting for navigation to payment page...');
        await session.page.waitForTimeout(5000); // Give time for page to load
        
        // Take screenshot to verify we're on the payment page
        await session.page.screenshot({ 
          path: `backend/logs/after-continua-click-${sessionId}.png`,
          fullPage: true
        });
        
        // Verify we're on the payment page by checking for payment elements
        const isOnPaymentPage = await session.page.evaluate(() => {
          const paymentIndicators = [
            'input[name="mobilePhone"]',
            '.PaymentMethodsForm',
            'h2:contains("Scegli come garantire")',
            '.GuaranteeDataCollectionPage'
          ];
          
          return paymentIndicators.some(selector => {
            try {
              return document.querySelector(selector) !== null;
            } catch (e) {
              return false;
            }
          });
        });
        
        if (isOnPaymentPage) {
          logger.info('Successfully navigated to payment page');
        } else {
          logger.warn('May not be on payment page yet, but continuing...');
        }
        
        logger.info(`Continue button clicked successfully using selector: ${usedSelector}`);
        
      } catch (error) {
        logger.error('Error clicking Continua button:', error);
        throw new Error(`Failed to click Continua button: ${error.message}`);
      }

      // Update session - move to payment step
      session.currentStep = 'payment';
      session.personalDataFilled = true;
      session.personalData = personalData;
      session.updatedAt = new Date();
      
      logger.info('Personal data filled successfully and "Continua" button clicked', {
        sessionId,
        email: personalData.email
      });

      res.json({
        success: true,
        sessionId,
        message: 'Personal data filled and "Continua" clicked',
        currentStep: 'payment',
        nextAction: 'Prepare for payment data input'
      });
    } else {
      logger.error('Failed to fill personal data', {
        sessionId,
        error: fillResult.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fill personal data',
        details: fillResult.message,
        sessionId
      });
    }

  } catch (error) {
    logger.error('Error in fill-personal-data endpoint:', error);
    
    res.status(500).json({
      error: 'Failed to fill personal data',
      details: error.message,
      sessionId
    });
  }
});

// POST /api/booking/submit-booking
router.post('/submit-booking', async (req, res) => {
  try {
    // Validate input
    const { error, value } = personalDataSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { sessionId, personalData } = value;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    logger.info(`Submitting booking for session ${sessionId}`, {
      email: personalData.email,
      room: session.selectedRoom
    });

    // Get current page HTML
    const htmlContent = await session.page.content();
    
    // Ask GPT how to fill the form
    const formInstructions = await aiService.analyzeBookingForm(htmlContent, personalData);

    // Fill and submit the booking form
    const bookingResult = await playwrightService.submitBooking(
      session.page,
      formInstructions,
      personalData
    );

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get final page content
    const finalHtml = await session.page.content();
    
    // Ask GPT to analyze the result
    const resultAnalysis = await aiService.analyzeBookingResult(finalHtml);

    // Take final screenshot
    await session.page.screenshot({ 
      path: `backend/logs/booking-final-${sessionId}.png`,
      fullPage: true
    });

    // Clean up session
    await playwrightService.cleanup(session.browser);
    sessions.delete(sessionId);

    res.json({
      success: resultAnalysis.success,
      message: resultAnalysis.message,
      bookingReference: resultAnalysis.bookingReference,
      error: resultAnalysis.error,
      data: {
        sessionId,
        searchParams: session.searchParams,
        selectedRoom: session.selectedRoom,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error submitting booking:', error);
    res.status(500).json({
      error: 'Failed to submit booking',
      message: error.message
    });
  }
});

// GET /api/booking/session/:sessionId/status
router.get('/session/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      error: 'Session not found'
    });
  }

  res.json({
    sessionId,
    currentStep: session.currentStep,
    createdAt: session.createdAt,
    searchParams: session.searchParams,
    availableRooms: session.availableRooms?.length || 0,
    selectedRoom: session.selectedRoom
  });
});

// POST /api/booking/complete-booking
router.post('/complete-booking', async (req, res) => {
  logger.info('Complete booking endpoint called');
  
  const schema = Joi.object({
    sessionId: Joi.string().required(),
    bookingData: Joi.object({
      email: Joi.string().email().required(),
      phone: Joi.string().optional(),
      paymentMethod: Joi.string().valid('credit_card', 'bank_transfer').default('credit_card'),
      cardNumber: Joi.string().optional(),
      cardExpiry: Joi.string().optional(), // MM/YY format
      cardHolder: Joi.string().required(), // Campo titolare carta richiesto
      acceptNewsletter: Joi.boolean().default(false)
    }).required(),
    testMode: Joi.boolean().default(false) // IMPORTANT: prevents actual payment
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Invalid request data',
      details: error.details
    });
  }

  const { sessionId, bookingData, testMode } = value;
  const session = sessions.get(sessionId);

  if (!session || !session.page) {
    return res.status(404).json({
      error: 'Session not found or page not available'
    });
  }

  try {
    logger.info('Completing booking', {
      sessionId,
      email: bookingData.email,
      paymentMethod: bookingData.paymentMethod,
      testMode
    });

    // Call the completion function with real selectors
    const completionResult = await playwrightService.completeBookingWithRealSelectors(
      session.page,
      bookingData,
      testMode
    );

    // Update session
    session.currentStep = 'booking_completed';
    session.bookingResult = completionResult;
    session.updatedAt = new Date();
    
    logger.info('Booking completion result:', {
      sessionId,
      success: completionResult.success,
      message: completionResult.message,
      testMode: completionResult.testMode || testMode
    });

    res.json({
      success: true,
      sessionId,
      result: completionResult,
      message: completionResult.success ? 
        'Booking completed successfully' : 
        'Booking completion failed',
      testMode: completionResult.testMode || testMode
    });

  } catch (error) {
    logger.error('Error in complete-booking endpoint:', error);
    
    // Update session with error
    session.currentStep = 'booking_failed';
    session.error = error.message;
    session.updatedAt = new Date();
    
    res.status(500).json({
      error: 'Failed to complete booking',
      details: error.message,
      sessionId
    });
  }
});

// POST /api/booking/analyze-current-page - Analyze what page we're currently on
router.post('/analyze-current-page', async (req, res) => {
  logger.info('Analyze current page endpoint called');
  
  const schema = Joi.object({
    sessionId: Joi.string().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Invalid request data',
      details: error.details
    });
  }

  const { sessionId } = value;
  const session = sessions.get(sessionId);

  if (!session || !session.page) {
    return res.status(404).json({
      error: 'Session not found or page not available'
    });
  }

  try {
    logger.info('Analyzing current page', { sessionId });

    // Take screenshot of current page
    await session.page.screenshot({ 
      path: `backend/logs/page-analysis-${sessionId}.png`,
      fullPage: true
    });

    // Get basic page info
    const currentUrl = session.page.url();
    const pageTitle = await session.page.title();
    
    logger.info('Current page info:', {
      url: currentUrl,
      title: pageTitle
    });

    // Check for different page indicators
    const pageIndicators = {
      personalDataPage: [
        'h2:has-text("Completa i tuoi dati")',
        'h1:has-text("Completa i tuoi dati")',
        '.CustomerDataCollectionPage',
        'input[name="name"]',
        'input[name="firstName"]'
      ],
      paymentPage: [
        'h2:has-text("Scegli come garantire")',
        '.PaymentMethodsForm',
        'input[name="paymentMethodId"]',
        '.GuaranteeDataCollectionPage'
      ],
      searchPage: [
        '.RoomResultBlock',
        '.SearchWidget',
        'button:has-text("Info e prenota")'
      ],
      confirmationPage: [
        'h2:has-text("Conferma prenotazione")',
        'h1:has-text("Prenotazione confermata")',
        '.BookingConfirmation'
      ]
    };
    
    let currentPageType = 'unknown';
    let foundIndicators = [];
    
    for (const [pageType, selectors] of Object.entries(pageIndicators)) {
      for (const selector of selectors) {
        try {
          if (await session.page.isVisible(selector, { timeout: 1000 })) {
            currentPageType = pageType;
            foundIndicators.push({ pageType, selector, found: true });
            logger.info(`Found ${pageType} indicator: ${selector}`);
          }
        } catch (e) {
          // Indicator not found, continue
        }
      }
    }
    
    // Get all form elements on the page
    const allInputs = await session.page.locator('input').all();
    const inputInfo = [];
    
    for (let i = 0; i < Math.min(allInputs.length, 20); i++) {
      try {
        const input = allInputs[i];
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const placeholder = await input.getAttribute('placeholder');
        const visible = await input.isVisible();
        const checked = type === 'checkbox' ? await input.isChecked() : null;
        
        inputInfo.push({
          index: i,
          type,
          name,
          id,
          placeholder,
          visible,
          checked
        });
      } catch (e) {
        // Skip this input
      }
    }
    
    // Get all buttons on the page
    const allButtons = await session.page.locator('button, input[type="button"], input[type="submit"], a[role="button"]').all();
    const buttonInfo = [];
    
    for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
      try {
        const button = allButtons[i];
        const tagName = await button.evaluate(el => el.tagName);
        const text = await button.textContent().catch(() => '');
        const className = await button.getAttribute('class').catch(() => '');
        const id = await button.getAttribute('id').catch(() => '');
        const visible = await button.isVisible();
        const enabled = await button.isEnabled();
        
        buttonInfo.push({
          index: i,
          tag: tagName,
          text: text?.trim(),
          class: className,
          id: id,
          visible: visible,
          enabled: enabled
        });
      } catch (e) {
        // Skip this button
      }
    }
    
    // Check for privacy checkbox specifically if we're on personal data page
    let privacyCheckboxInfo = null;
    if (currentPageType === 'personalDataPage' || currentPageType === 'unknown') {
      const privacySelectors = [
        'input[name="privacyPolicyAcceptance"]',
        'input[name="privacy"]',
        'input[type="checkbox"]'
      ];
      
      for (const selector of privacySelectors) {
        try {
          const checkbox = await session.page.waitForSelector(selector, { timeout: 2000 });
          if (checkbox) {
            const isVisible = await checkbox.isVisible();
            const isEnabled = await checkbox.isEnabled();
            const isChecked = await checkbox.isChecked();
            const name = await checkbox.getAttribute('name');
            const id = await checkbox.getAttribute('id');
            
            privacyCheckboxInfo = {
              selector,
              visible: isVisible,
              enabled: isEnabled,
              checked: isChecked,
              name,
              id
            };
            
            logger.info('Privacy checkbox found:', privacyCheckboxInfo);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    const result = {
      success: true,
      currentUrl,
      pageTitle,
      currentPageType,
      foundIndicators,
      totalInputsFound: allInputs.length,
      inputInfo,
      totalButtonsFound: allButtons.length,
      buttonInfo,
      privacyCheckboxInfo,
      sessionCurrentStep: session.currentStep,
      message: `Currently on ${currentPageType} page`
    };
    
    logger.info('Page analysis result:', result);
    
    res.json(result);

  } catch (error) {
    logger.error('Error in analyze-current-page endpoint:', error);
    
    // Take error screenshot
    await session.page.screenshot({ 
      path: `backend/logs/page-analysis-error-${sessionId}.png`,
      fullPage: true
    });
    
    res.status(500).json({
      error: 'Failed to analyze current page',
      details: error.message,
      sessionId
    });
  }
});

// POST /api/booking/test-privacy-checkbox - Test privacy policy checkbox in personal data page
router.post('/test-privacy-checkbox', async (req, res) => {
  logger.info('Test privacy checkbox endpoint called');
  
  const schema = Joi.object({
    sessionId: Joi.string().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Invalid request data',
      details: error.details
    });
  }

  const { sessionId } = value;
  const session = sessions.get(sessionId);

  if (!session || !session.page) {
    return res.status(404).json({
      error: 'Session not found or page not available'
    });
  }

  try {
    logger.info('Testing privacy checkbox and page state', { sessionId });

    // Take screenshot of current page
    await session.page.screenshot({ 
      path: `backend/logs/privacy-test-start-${sessionId}.png`,
      fullPage: true
    });

    // Get current page info
    const currentUrl = session.page.url();
    const pageTitle = await session.page.title();
    
    logger.info('Current page info:', {
      url: currentUrl,
      title: pageTitle
    });

    // Check if we're on the personal data page
    const personalDataPageIndicators = [
      'h2:has-text("Completa i tuoi dati")',
      'h1:has-text("Completa i tuoi dati")',
      '.CustomerDataCollectionPage',
      'input[name="name"]',
      'input[name="firstName"]',
      'input[type="email"]'
    ];
    
    let onPersonalDataPage = false;
    let foundIndicator = null;
    
    for (const selector of personalDataPageIndicators) {
      try {
        if (await session.page.isVisible(selector, { timeout: 2000 })) {
          logger.info(`Found personal data page indicator: ${selector}`);
          onPersonalDataPage = true;
          foundIndicator = selector;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Get all form fields on the page
    const allInputs = await session.page.locator('input').all();
    const inputInfo = [];
    
    for (let i = 0; i < allInputs.length; i++) {
      try {
        const input = allInputs[i];
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const placeholder = await input.getAttribute('placeholder');
        const visible = await input.isVisible();
        const checked = type === 'checkbox' ? await input.isChecked() : null;
        
        inputInfo.push({
          index: i,
          type,
          name,
          id,
          placeholder,
          visible,
          checked
        });
      } catch (e) {
        // Skip this input
      }
    }
    
    // Look specifically for privacy policy checkbox
    const privacySelectors = [
      'input[name="privacyPolicyAcceptance"]',
      'input[name="privacy"]',
      'input[type="checkbox"]', // Generic checkbox
      'input[id*="privacy"]',
      'input[id*="Privacy"]'
    ];
    
    let privacyCheckboxFound = false;
    let privacyCheckboxInfo = null;
    let usedPrivacySelector = null;
    
    for (const selector of privacySelectors) {
      try {
        logger.info(`Trying privacy checkbox selector: ${selector}`);
        const checkbox = await session.page.waitForSelector(selector, { timeout: 3000 });
        if (checkbox) {
          const isVisible = await checkbox.isVisible();
          const isEnabled = await checkbox.isEnabled();
          const isChecked = await checkbox.isChecked();
          const name = await checkbox.getAttribute('name');
          const id = await checkbox.getAttribute('id');
          
          privacyCheckboxInfo = {
            selector,
            visible: isVisible,
            enabled: isEnabled,
            checked: isChecked,
            name,
            id
          };
          
          logger.info('Privacy checkbox found:', privacyCheckboxInfo);
          
          if (isVisible && isEnabled) {
            if (!isChecked) {
              await checkbox.check();
              const nowChecked = await checkbox.isChecked();
              logger.info(`Privacy checkbox checked. Status: ${nowChecked}`);
              privacyCheckboxInfo.checkedAfterAction = nowChecked;
            } else {
              logger.info('Privacy checkbox was already checked');
              privacyCheckboxInfo.checkedAfterAction = true;
            }
            
            privacyCheckboxFound = true;
            usedPrivacySelector = selector;
            break;
          } else {
            logger.warn(`Privacy checkbox found but not interactable: visible=${isVisible}, enabled=${isEnabled}`);
          }
        }
      } catch (e) {
        logger.debug(`Privacy selector ${selector} failed: ${e.message}`);
        continue;
      }
    }
    
    // Look for Continue button and check if it's enabled
    const continueSelectors = [
      'button.CustomerDataCollectionPage_CTA.CTA',
      'button.CustomerDataCollectionPage_CTA',
      '.CustomerDataCollectionPage_CTA.CTA',
      '.CustomerDataCollectionPage_CTA',
      'button:has-text("Continua")',
      'button[type="submit"]'
    ];
    
    let continueButtonInfo = null;
    
    for (const selector of continueSelectors) {
      try {
        const button = await session.page.waitForSelector(selector, { timeout: 2000 });
        if (button) {
          const isVisible = await button.isVisible();
          const isEnabled = await button.isEnabled();
          const text = await button.textContent();
          
          continueButtonInfo = {
            selector,
            visible: isVisible,
            enabled: isEnabled,
            text: text?.trim()
          };
          
          logger.info('Continue button found:', continueButtonInfo);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Take screenshot after checking/attempting to check privacy
    await session.page.screenshot({ 
      path: `backend/logs/privacy-test-after-${sessionId}.png`,
      fullPage: true
    });
    
    const result = {
      success: privacyCheckboxFound,
      onPersonalDataPage,
      foundIndicator,
      currentUrl,
      pageTitle,
      privacyCheckboxFound,
      privacyCheckboxInfo,
      usedPrivacySelector,
      continueButtonInfo,
      totalInputsFound: allInputs.length,
      inputInfo,
      message: privacyCheckboxFound ? 
        'Privacy checkbox found and processed' : 
        'Privacy checkbox not found - this might be why Continue button does not work'
    };
    
    logger.info('Privacy checkbox test result:', result);
    
    res.json(result);

  } catch (error) {
    logger.error('Error in test-privacy-checkbox endpoint:', error);
    
    // Take error screenshot
    await session.page.screenshot({ 
      path: `backend/logs/privacy-test-error-${sessionId}.png`,
      fullPage: true
    });
    
    res.status(500).json({
      error: 'Failed to test privacy checkbox',
      details: error.message,
      sessionId
    });
  }
});

// POST /api/booking/test-phone-field - Test only phone field without radio buttons
router.post('/test-phone-field', async (req, res) => {
  logger.info('Test phone field endpoint called');
  
  const schema = Joi.object({
    sessionId: Joi.string().required(),
    phone: Joi.string().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Invalid request data',
      details: error.details
    });
  }

  const { sessionId, phone } = value;
  const session = sessions.get(sessionId);

  if (!session || !session.page) {
    return res.status(404).json({
      error: 'Session not found or page not available'
    });
  }

  try {
    logger.info('Testing phone field only', {
      sessionId,
      phone
    });

    // Take screenshot of current page
    await session.page.screenshot({ 
      path: `backend/logs/phone-test-start-${sessionId}.png`,
      fullPage: true
    });

    // Get current page info
    const currentUrl = session.page.url();
    const pageTitle = await session.page.title();
    
    logger.info('Current page info:', {
      url: currentUrl,
      title: pageTitle
    });

    // Try to find and fill phone field
    const phoneSelectors = [
      'input[name="mobilePhone"]', // Selettore principale
      'input#_rge_', // ID specifico dal HTML fornito dall'utente
      'input[aria-describedby*="_rep_"]', // Backup con aria-describedby
      '.PhoneNumberInputWrapper input[type="text"]', // Selettore container
      'input[type="tel"]', // Generic phone input
      'input[placeholder*="telefono"]', // Italian placeholder
      'input[placeholder*="cellulare"]', // Italian mobile placeholder
      'input[name*="phone"]', // Generic phone name
      'input[id*="phone"]' // Generic phone id
    ];
    
    let phoneFieldFound = false;
    let usedSelector = null;
    let phoneFieldInfo = null;
    
    for (const selector of phoneSelectors) {
      try {
        logger.info(`Trying phone selector: ${selector}`);
        const phoneField = await session.page.waitForSelector(selector, { timeout: 3000 });
        if (phoneField) {
          // Get field info before filling
          const isVisible = await phoneField.isVisible();
          const isEnabled = await phoneField.isEnabled();
          const currentValue = await phoneField.inputValue();
          const placeholder = await phoneField.getAttribute('placeholder');
          
          phoneFieldInfo = {
            selector,
            visible: isVisible,
            enabled: isEnabled,
            currentValue,
            placeholder
          };
          
          logger.info('Phone field found:', phoneFieldInfo);
          
          if (isVisible && isEnabled) {
            await phoneField.fill(phone);
            const newValue = await phoneField.inputValue();
            
            logger.info(`Phone field filled successfully. New value: ${newValue}`);
            phoneFieldFound = true;
            usedSelector = selector;
            phoneFieldInfo.newValue = newValue;
            break;
          } else {
            logger.warn(`Phone field found but not interactable: visible=${isVisible}, enabled=${isEnabled}`);
          }
        }
      } catch (e) {
        logger.debug(`Phone selector ${selector} failed: ${e.message}`);
        continue;
      }
    }
    
    // Also check what other input fields are available
    const allInputs = await session.page.locator('input').all();
    const inputInfo = [];
    
    for (let i = 0; i < Math.min(allInputs.length, 15); i++) { // Limit to first 15 inputs
      try {
        const input = allInputs[i];
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const placeholder = await input.getAttribute('placeholder');
        const visible = await input.isVisible();
        
        inputInfo.push({
          index: i,
          type,
          name,
          id,
          placeholder,
          visible
        });
      } catch (e) {
        // Skip this input
      }
    }
    
    // Take screenshot after attempt
    await session.page.screenshot({ 
      path: `backend/logs/phone-test-after-${sessionId}.png`,
      fullPage: true
    });
    
    const result = {
      success: phoneFieldFound,
      phoneFieldFound,
      usedSelector,
      phoneFieldInfo,
      currentUrl,
      pageTitle,
      totalInputsFound: allInputs.length,
      inputInfo,
      message: phoneFieldFound ? 
        'Phone field found and filled successfully' : 
        'Phone field not found with any selector'
    };
    
    logger.info('Phone field test result:', result);
    
    res.json(result);

  } catch (error) {
    logger.error('Error in test-phone-field endpoint:', error);
    
    // Take error screenshot
    await session.page.screenshot({ 
      path: `backend/logs/phone-test-error-${sessionId}.png`,
      fullPage: true
    });
    
    res.status(500).json({
      error: 'Failed to test phone field',
      details: error.message,
      sessionId
    });
  }
});

// GET /api/booking/personal-data-summary/:sessionId - Extract booking summary from sidebar DOM
router.get('/personal-data-summary/:sessionId', async (req, res) => {
  logger.info('Personal data summary endpoint called');
  
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session || !session.page) {
    return res.status(404).json({
      error: 'Session not found or page not available'
    });
  }

  try {
    logger.info('Extracting booking summary from sidebar DOM', { sessionId });

    // Attempt to close any overlays first
    try {
      await aiService.closeOverlays(session.page, { maxMs: 500 });
    } catch {}

    // Extract all the sidebar booking data using the exact selectors from your HTML
    const summaryData = await session.page.evaluate(() => {
      const tryText = (selector) => {
        try {
          const el = document.querySelector(selector);
          return el ? el.textContent?.trim() : null;
        } catch {
          return null;
        }
      };
      
      const tryHTML = (selector) => {
        try {
          const el = document.querySelector(selector);
          return el ? el.outerHTML : null;
        } catch {
          return null;
        }
      };
      
      const parsePrice = (priceText) => {
        if (!priceText) return null;
        try {
          // Remove currency symbols and extract number
          let cleaned = priceText.replace(/[€$£¥]/g, '').replace(/[^0-9.,]/g, '');
          if (cleaned.includes('.') && cleaned.includes(',')) {
            // Handle European format: 1.649,76
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
          } else if (cleaned.includes(',') && !cleaned.includes('.')) {
            // Handle format: 1649,76
            cleaned = cleaned.replace(',', '.');
          }
          const num = parseFloat(cleaned);
          return isNaN(num) ? null : num;
        } catch {
          return null;
        }
      };
      
      // SECTION 1: Reservation Summary (Date information)
      const reservationSummary = {
        html: tryHTML('.ReservationSummary.e1dfdjmq10'),
        checkinDate: null,
        checkoutDate: null,
        nights: null,
        guests: null
      };
      
      // Extract check-in date (first date block)
      const checkinDayName = tryText('.e1dfdjmq8:nth-child(1) .e1dfdjmq1'); // "venerdì"
      const checkinDay = tryText('.e1dfdjmq8:nth-child(1) .e1dfdjmq6 b'); // "6"
      const checkinMonth = tryText('.e1dfdjmq8:nth-child(1) .e1dfdjmq5 b'); // "feb 2026"
      
      if (checkinDayName && checkinDay && checkinMonth) {
        reservationSummary.checkinDate = `${checkinDayName} ${checkinDay} ${checkinMonth}`;
      }
      
      // Extract check-out date (third child, skipping the arrow)
      const checkoutDayName = tryText('.e1dfdjmq8:nth-child(3) .e1dfdjmq1'); // "domenica"
      const checkoutDay = tryText('.e1dfdjmq8:nth-child(3) .e1dfdjmq6 b'); // "8"
      const checkoutMonth = tryText('.e1dfdjmq8:nth-child(3) .e1dfdjmq5 b'); // "feb 2026"
      
      if (checkoutDayName && checkoutDay && checkoutMonth) {
        reservationSummary.checkoutDate = `${checkoutDayName} ${checkoutDay} ${checkoutMonth}`;
      }
      
      // Extract nights - multiple selector strategy
      reservationSummary.nights = tryText('.IconAndTextWithLabel .label:contains("Notti") + .IconAndText .IconAndText__Text') ||
                                   tryText('.e1dfdjmq3:has(.label) .IconAndText__Text') ||
                                   tryText('.IconAndText__Text'); // First occurrence is nights
      
      // Extract guests - multiple selector strategy  
      reservationSummary.guests = tryText('.IconAndTextWithLabel .label:contains("Ospiti") + .IconAndText .IconAndText__Text') ||
                                  document.querySelectorAll('.IconAndText__Text')[1]?.textContent?.trim() ||
                                  tryText('.IconAndText__Text:nth-of-type(2)');
      
      // SECTION 2: Cart (Room and pricing information)
      const cart = {
        html: tryHTML('.Cart.e1kagkvk5'),
        roomName: null,
        occupants: null,
        rateName: null,
        mealPlan: null,
        refundability: null,
        roomPrice: null,
        originalRoomPrice: null,
        taxes: null,
        mandatoryServices: [],
        totalPrice: null,
        originalTotalPrice: null
      };
      
      // Extract room name
      cart.roomName = tryText('.Cart__Room__Name .CTA_Text'); // "Suite con Balcone DELUXE"
      
      // Extract occupants
      cart.occupants = tryText('.e1m2olwc0'); // "2 Adulti"
      
      // Extract rate name
      cart.rateName = tryText('.Cart__Room__Rate'); // "Tariffa RIVENDIBILE - Takyon..."
      
      // Extract meal plan
      cart.mealPlan = tryText('.Cart__Room__MealPlan'); // "Camera e Colazione"
      
      // Extract refundability
      cart.refundability = tryText('.e13o920w4'); // "Non rimborsabile"
      
      // Extract room price (main amount)
      const roomPriceText = tryText('.Cart__Room .mainAmount span');
      if (roomPriceText) {
        cart.roomPrice = parsePrice(roomPriceText);
        cart.roomPriceFormatted = roomPriceText;
      }
      
      // Extract original room price (if discounted)
      const originalRoomPriceText = tryText('.Cart__Room .originalAmount');
      if (originalRoomPriceText) {
        cart.originalRoomPrice = parsePrice(originalRoomPriceText);
        cart.originalRoomPriceFormatted = originalRoomPriceText;
      }
      
      // Extract taxes information
      const taxesText = tryText('.Cart__Room .discount.e1rm81ho1');
      const taxesAmountText = tryText('.Cart__Room .discount.e1rm81ho1 .e1rm81ho0');
      if (taxesText && taxesAmountText) {
        cart.taxes = {
          description: taxesText.replace(taxesAmountText, '').trim(), // "Tasse incluse"
          amount: parsePrice(taxesAmountText),
          amountFormatted: taxesAmountText
        };
      }
      
      // Extract mandatory services
      const serviceElements = document.querySelectorAll('.Cart__MandatoryServicesList .ltr-199jhfg');
      serviceElements.forEach(serviceEl => {
        try {
          const serviceName = serviceEl.querySelector('.CartServiceItem')?.textContent?.trim();
          const servicePriceText = serviceEl.parentElement?.querySelector('.mainAmount span')?.textContent?.trim();
          
          if (serviceName && servicePriceText) {
            cart.mandatoryServices.push({
              name: serviceName,
              price: parsePrice(servicePriceText),
              priceFormatted: servicePriceText
            });
          }
        } catch {}
      });
      
      // Extract total price
      const totalPriceText = tryText('.Cart__Totals .mainAmount span');
      if (totalPriceText) {
        cart.totalPrice = parsePrice(totalPriceText);
        cart.totalPriceFormatted = totalPriceText;
      }
      
      // Extract original total price (if discounted)
      const originalTotalPriceText = tryText('.Cart__Totals .originalAmount');
      if (originalTotalPriceText) {
        cart.originalTotalPrice = parsePrice(originalTotalPriceText);
        cart.originalTotalPriceFormatted = originalTotalPriceText;
      }
      
      // Extract voucher section
      const voucher = {
        html: tryHTML('.VoucherForm.e1n28f8a7'),
        available: !!document.querySelector('.VoucherForm__ShowFormButton')
      };
      
      // Get the complete sidebar HTML for fallback
      const sidebarHtml = tryHTML('.DesktopSidebar.e15sxj6q4');
      
      return {
        reservationSummary,
        cart,
        voucher,
        sidebarHtml,
        fullSidebarText: document.querySelector('.DesktopSidebar')?.textContent?.trim()
      };
    });
    
    // Take a screenshot for debugging
    try {
      await session.page.screenshot({ 
        path: `backend/logs/personal-data-summary-${sessionId}.png`,
        fullPage: true
      });
    } catch {}
    
    logger.info('Successfully extracted sidebar booking data:', {
      sessionId,
      hasReservationSummary: !!summaryData.reservationSummary.html,
      hasCart: !!summaryData.cart.html,
      roomName: summaryData.cart.roomName,
      totalPrice: summaryData.cart.totalPriceFormatted,
      checkinDate: summaryData.reservationSummary.checkinDate,
      nights: summaryData.reservationSummary.nights
    });
    
    res.json({
      success: true,
      sessionId,
      currentStep: session.currentStep,
      ...summaryData
    });

  } catch (error) {
    logger.error('Error extracting personal data summary:', error);
    
    res.status(500).json({
      error: 'Failed to extract booking summary',
      details: error.message,
      sessionId
    });
  }
});

// DELETE /api/booking/session/:sessionId
router.delete('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (session) {
    await playwrightService.cleanup(session.browser);
    sessions.delete(sessionId);
  }

  res.json({
    success: true,
    message: 'Session cleaned up'
  });
});

module.exports = router;
