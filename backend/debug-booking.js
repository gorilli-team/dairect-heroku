const { chromium } = require('playwright');
const logger = require('./utils/logger');

async function debugBookingProcess() {
  const browser = await chromium.launch({ 
    headless: false, // Modalità visibile per debug
    slowMo: 1000 // Rallenta le azioni per poterle vedere
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Vai alla pagina dell'hotel con date e ospiti
    const url = 'https://www.simplebooking.it/ibe2/hotel/1467?lang=IT&cur=EUR&in=2026-02-05&out=2026-02-07&guests=A%2CA';
    console.log('Navigando verso:', url);
    await page.goto(url);
    
    // Aspetta che la pagina carichi
    await page.waitForTimeout(3000);
    console.log('Pagina caricata, URL attuale:', page.url());
    
    // Cerca le camere disponibili
    await page.waitForSelector('.RoomResultBlock, .eio1k2u2', { timeout: 10000 });
    console.log('✅ Camere trovate');
    
    // Trova il primo bottone "Info e prenota"
    const roomButtons = await page.locator('.RoomCard_CTA, .ekc2wag2, button:has-text("Info e prenota")').all();
    console.log(`Trovati ${roomButtons.length} bottoni "Info e prenota"`);
    
    if (roomButtons.length > 0) {
      console.log('Cliccando sul primo bottone...');
      await roomButtons[0].click();
      
      // Aspetta un po' per vedere cosa succede
      await page.waitForTimeout(5000);
      
      console.log('URL dopo il click:', page.url());
      
      // Verifica se siamo su una nuova pagina o se è apparso un popup/sezione
      const currentUrl = page.url();
      
      // Cerca elementi della pagina dati personali
      const personalDataElements = [
        'input[name="name"]',
        'input[name="firstName"]',
        'h2:has-text("Completa i tuoi dati")',
        '.CustomerDataCollectionPage'
      ];
      
      console.log('Cercando elementi della pagina dati personali...');
      for (const selector of personalDataElements) {
        const isVisible = await page.isVisible(selector, { timeout: 2000 }).catch(() => false);
        console.log(`- ${selector}: ${isVisible ? '✅ Trovato' : '❌ Non trovato'}`);
      }
      
      // Cerca elementi della pagina di pagamento
      const paymentElements = [
        '.PaymentMethodsForm',
        'input[name="paymentMethodId"]',
        'h2:has-text("Scegli come garantire")',
        '.GuaranteeDataCollectionPage'
      ];
      
      console.log('Cercando elementi della pagina di pagamento...');
      for (const selector of paymentElements) {
        const isVisible = await page.isVisible(selector, { timeout: 2000 }).catch(() => false);
        console.log(`- ${selector}: ${isVisible ? '✅ Trovato' : '❌ Non trovato'}`);
      }
      
      // Cerca popup o sezioni espandibili
      const expandableElements = [
        '.roomOptionsCollapse',
        '.modal',
        '.popup',
        '[role="dialog"]',
        '.overlay'
      ];
      
      console.log('Cercando popup o sezioni espandibili...');
      for (const selector of expandableElements) {
        const isVisible = await page.isVisible(selector, { timeout: 2000 }).catch(() => false);
        console.log(`- ${selector}: ${isVisible ? '✅ Trovato' : '❌ Non trovato'}`);
      }
      
      // Elenca tutti i bottoni visibili
      console.log('Bottoni attualmente visibili sulla pagina:');
      const allButtons = await page.locator('button, input[type="button"], input[type="submit"], a[role="button"]').all();
      for (let i = 0; i < Math.min(allButtons.length, 20); i++) {
        try {
          const button = allButtons[i];
          const text = await button.textContent().catch(() => '');
          const isVisible = await button.isVisible();
          const isEnabled = await button.isEnabled();
          
          if (isVisible && text.trim()) {
            console.log(`  ${i}: "${text.trim()}" (enabled: ${isEnabled})`);
          }
        } catch (e) {
          // Skip
        }
      }
      
      // Prendi screenshot per debug
      await page.screenshot({ 
        path: `logs/debug-after-room-click-${Date.now()}.png`,
        fullPage: true
      });
      console.log('Screenshot salvato in logs/');
      
    } else {
      console.log('❌ Nessun bottone "Info e prenota" trovato');
    }
    
  } catch (error) {
    console.error('Errore durante il debug:', error);
  } finally {
    // Mantiene il browser aperto per 30 secondi per ispezionare manualmente
    console.log('Browser rimane aperto per 30 secondi per ispezione manuale...');
    await page.waitForTimeout(30000);
    await browser.close();
  }
}

// Esegui il debug
debugBookingProcess().catch(console.error);
