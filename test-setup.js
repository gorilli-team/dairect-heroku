#!/usr/bin/env node

// Hotel Booking Automation - System Test
// Verifica che tutto sia configurato correttamente

require('dotenv').config();
const { chromium } = require('playwright');
const OpenAI = require('openai');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testConfiguration() {
  log('🏨 Hotel Booking Automation - System Test\n', 'blue');

  let allPassed = true;

  // Test 1: Environment Variables
  log('1. Testing Environment Variables...', 'yellow');
  
  if (!process.env.OPENAI_API_KEY) {
    log('   ❌ OPENAI_API_KEY not found', 'red');
    allPassed = false;
  } else if (process.env.OPENAI_API_KEY.startsWith('sk-proj-')) {
    log('   ✅ OpenAI API Key configured', 'green');
  } else {
    log('   ⚠️  OpenAI API Key format looks unusual', 'yellow');
  }

  if (!process.env.TARGET_HOTEL_URL) {
    log('   ❌ TARGET_HOTEL_URL not found', 'red');
    allPassed = false;
  } else {
    log('   ✅ Target hotel URL configured', 'green');
    log(`     → ${process.env.TARGET_HOTEL_URL}`, 'blue');
  }

  // Test 2: OpenAI API Connection
  log('\n2. Testing OpenAI API Connection...', 'yellow');
  
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello! Reply with just "OK"' }],
      max_tokens: 5
    });

    if (response.choices[0].message.content.trim() === 'OK') {
      log('   ✅ OpenAI API connection successful', 'green');
    } else {
      log('   ✅ OpenAI API connected (unexpected response)', 'green');
    }
  } catch (error) {
    log(`   ❌ OpenAI API connection failed: ${error.message}`, 'red');
    allPassed = false;
  }

  // Test 3: Playwright Browser
  log('\n3. Testing Playwright Browser...', 'yellow');
  
  try {
    const browser = await chromium.launch({ 
      headless: true,
      timeout: 10000
    });
    const page = await browser.newPage();
    await page.goto('https://www.google.com', { timeout: 10000 });
    const title = await page.title();
    await browser.close();
    
    log('   ✅ Playwright browser working', 'green');
    log(`     → Successfully loaded: ${title}`, 'blue');
  } catch (error) {
    log(`   ❌ Playwright browser failed: ${error.message}`, 'red');
    allPassed = false;
  }

  // Test 4: Target Website Accessibility
  log('\n4. Testing Target Website...', 'yellow');
  
  try {
    const browser = await chromium.launch({ 
      headless: true,
      timeout: 10000
    });
    const page = await browser.newPage();
    await page.goto(process.env.TARGET_HOTEL_URL, { 
      timeout: 15000,
      waitUntil: 'networkidle'
    });
    const title = await page.title();
    const hasBookingElements = await page.locator('input, select, button').count() > 0;
    await browser.close();
    
    if (hasBookingElements) {
      log('   ✅ Target website accessible', 'green');
      log(`     → Page title: ${title}`, 'blue');
      log('     → Found form elements for booking', 'blue');
    } else {
      log('   ⚠️  Target website loaded but no form elements found', 'yellow');
    }
  } catch (error) {
    log(`   ❌ Target website not accessible: ${error.message}`, 'red');
    allPassed = false;
  }

  // Test 5: Node.js Dependencies
  log('\n5. Testing Node.js Dependencies...', 'yellow');
  
  const requiredPackages = [
    'express', 'playwright', 'openai', 'winston', 'joi', 'uuid', 'cheerio'
  ];

  let missingPackages = [];
  for (const pkg of requiredPackages) {
    try {
      require(pkg);
    } catch (error) {
      missingPackages.push(pkg);
    }
  }

  if (missingPackages.length === 0) {
    log('   ✅ All required packages installed', 'green');
  } else {
    log(`   ❌ Missing packages: ${missingPackages.join(', ')}`, 'red');
    allPassed = false;
  }

  // Final Result
  log('\n' + '='.repeat(50), 'blue');
  if (allPassed) {
    log('🎉 ALL TESTS PASSED! System ready for automation!', 'green');
    log('\nNext steps:', 'blue');
    log('  1. Run: npm run dev', 'yellow');
    log('  2. Open: http://localhost:5173', 'yellow');
    log('  3. Start booking automation!', 'yellow');
  } else {
    log('❌ Some tests failed. Please fix the issues above.', 'red');
    log('\nTroubleshooting:', 'blue');
    log('  1. Check .env file configuration', 'yellow');
    log('  2. Verify OpenAI API key and credits', 'yellow');
    log('  3. Run: npm run install:all', 'yellow');
    log('  4. Run: cd backend && npx playwright install', 'yellow');
  }
  log('='.repeat(50) + '\n', 'blue');

  process.exit(allPassed ? 0 : 1);
}

// Run tests
testConfiguration().catch(error => {
  log(`\n💥 Test runner crashed: ${error.message}`, 'red');
  process.exit(1);
});
