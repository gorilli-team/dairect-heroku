const axios = require('axios');

const API_BASE = 'http://localhost:3001/api/booking';

async function testImageExtraction() {
  try {
    console.log('🔍 Testing image extraction...');
    
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
    console.log(`🏨 Found ${searchResponse.data.data.rooms?.length || 0} rooms`);
    
    // Step 2: Test image extraction
    console.log('\n🖼️  Testing image extraction...');
    const imageTestResponse = await axios.post(`${API_BASE}/test-image-extraction`, {
      sessionId: sessionId
    });
    
    console.log('\n📊 Image extraction results:');
    console.log(`Total rooms found: ${imageTestResponse.data.totalRoomsFound}`);
    console.log(`Rooms analyzed: ${imageTestResponse.data.roomsAnalyzed}`);
    
    imageTestResponse.data.results.forEach((roomResult, index) => {
      console.log(`\n📋 Room ${roomResult.roomIndex}:`);
      console.log(`  - Carousel slides found: ${roomResult.debugInfo.slideCount || 0}`);
      console.log(`  - Total images extracted: ${roomResult.images.length}`);
      
      if (roomResult.images.length > 0) {
        console.log('  - Images found:');
        roomResult.images.forEach((img, imgIndex) => {
          console.log(`    ${imgIndex + 1}. ${img}`);
        });
      } else {
        console.log('  - ❌ No images found');
        if (roomResult.debugInfo.error) {
          console.log(`  - Error: ${roomResult.debugInfo.error}`);
        }
      }
    });
    
    // Step 3: Get regular room data for comparison
    console.log('\n🔄 Getting regular room data for comparison...');
    const roomsResponse = await axios.get(`${API_BASE}/available-rooms/${sessionId}`);
    
    console.log('\n📊 Regular extraction results:');
    if (roomsResponse.data.rooms) {
      roomsResponse.data.rooms.forEach((room, index) => {
        console.log(`\n📋 Room ${index + 1} (${room.name}):`);
        console.log(`  - Images in regular extraction: ${room.images?.length || 0}`);
        if (room.images && room.images.length > 0) {
          room.images.forEach((img, imgIndex) => {
            console.log(`    ${imgIndex + 1}. ${img}`);
          });
        }
      });
    }
    
    // Step 4: Cleanup
    console.log('\n🧹 Cleaning up session...');
    await axios.delete(`${API_BASE}/session/${sessionId}`);
    console.log('✅ Session cleaned up');
    
    console.log('\n✨ Image extraction test completed!');
    
  } catch (error) {
    console.error('❌ Error during image extraction test:', error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testImageExtraction();
