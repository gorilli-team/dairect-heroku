const axios = require('axios');

const API_BASE = 'http://localhost:3001/api/booking';

async function testCarouselNavigation() {
  try {
    console.log('🔍 Testing carousel navigation to trigger lazy loading...');
    
    // Step 1: Start a search session
    console.log('📊 Starting search session...');
    const searchResponse = await axios.post(`${API_BASE}/start-search`, {
      checkinDate: '2025-08-15',
      checkoutDate: '2025-08-17', 
      adults: 2,
      children: 0
    });
    
    if (!searchResponse.data.success) {
      throw new Error('Failed to start search session');
    }
    
    const sessionId = searchResponse.data.sessionId;
    console.log(`✅ Search session started: ${sessionId}`);
    
    // Step 2: Manually navigate through carousel using Playwright
    console.log('\n🎠 Testing manual carousel navigation...');
    
    // We need to send a command to navigate carousel
    // Since we don't have a direct endpoint, let's create a simple test
    // that uses page.evaluate to navigate the carousel
    
    console.log('\n🧹 Cleaning up session...');
    await axios.delete(`${API_BASE}/session/${sessionId}`);
    console.log('✅ Session cleaned up');
    
    console.log('\n💡 Insight: We need to implement carousel navigation to trigger lazy loading.');
    console.log('   The issue is that images are loaded on-demand when slides become active.');
    console.log('   SimpleBooking uses lazy loading - only visible slides have src attributes.');
    
  } catch (error) {
    console.error('❌ Error during carousel navigation test:', error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testCarouselNavigation();
