const { chromium } = require('playwright');

async function testCreditCardSelection() {
  console.log('Starting credit card selection test...');
  
  const browser = await chromium.launch({ 
    headless: false, // Per vedere cosa succede
    slowMo: 1000 
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Naviga direttamente alla pagina di pagamento di SimpleBooking
    console.log('Navigating to SimpleBooking payment page...');
    await page.goto('https://www.simplebooking.it/ibe2/hotel/1467?lang=IT&cur=EUR');
    
    // Simula un flusso di booking fino alla pagina di pagamento
    // Questo richiederebbe di fare tutto il processo, ma per ora testiamo se possiamo
    // almeno raggiungere la pagina e trovare gli elementi di pagamento
    
    console.log('Current URL:', page.url());
    
    // Cerchiamo elementi di pagamento sulla pagina corrente
    console.log('Looking for payment elements...');
    
    const paymentSelectors = [
      'input[name="paymentMethodId"]',
      'input#_ret_',
      'input[value="104"]',
      'input[type="radio"]'
    ];
    
    for (const selector of paymentSelectors) {
      try {
        const element = await page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 2000 });
        console.log(`Selector ${selector}: visible=${isVisible}`);
        
        if (isVisible) {
          const attributes = {
            name: await element.getAttribute('name'),
            value: await element.getAttribute('value'),
            id: await element.getAttribute('id'),
            type: await element.getAttribute('type'),
            enabled: await element.isEnabled(),
            checked: await element.isChecked()
          };
          console.log(`  Attributes:`, attributes);
        }
      } catch (e) {
        console.log(`Selector ${selector}: not found (${e.message})`);
      }
    }
    
    // Prova a trovare tutti i radio button sulla pagina
    console.log('\nLooking for all radio buttons on page...');
    try {
      const allRadios = await page.locator('input[type="radio"]').all();
      console.log(`Found ${allRadios.length} radio buttons`);
      
      for (let i = 0; i < Math.min(allRadios.length, 10); i++) {
        try {
          const radio = allRadios[i];
          const radioInfo = {
            index: i,
            name: await radio.getAttribute('name'),
            value: await radio.getAttribute('value'),
            id: await radio.getAttribute('id'),
            visible: await radio.isVisible(),
            enabled: await radio.isEnabled()
          };
          console.log(`Radio ${i}:`, radioInfo);
        } catch (e) {
          console.log(`Error inspecting radio ${i}: ${e.message}`);
        }
      }
    } catch (e) {
      console.log('Error finding radio buttons:', e.message);
    }
    
    // Scatta uno screenshot per vedere lo stato della pagina
    await page.screenshot({ path: 'test-credit-card-page.png', fullPage: true });
    console.log('Screenshot saved as test-credit-card-page.png');
    
    // Attendi per permettere l'ispezione manuale
    console.log('Waiting 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

// Esegui il test
testCreditCardSelection().catch(console.error);
