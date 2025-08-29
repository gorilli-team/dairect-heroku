const axios = require('axios');

async function testPersonalDataPage() {
  console.log('🚀 Testing access to personal data page...');
  
  let sessionId = null;
  
  try {
    // 1. Start search
    console.log('\n📅 Step 1: Starting availability search...');
    const searchResponse = await axios.post('http://localhost:3001/api/booking/start-search', {
      checkinDate: "2025-09-15",
      checkoutDate: "2025-09-18", 
      adults: 2,
      children: 0
    }, {
      timeout: 30000
    });

    console.log('✅ Search completed successfully!');
    sessionId = searchResponse.data.sessionId;
    const rooms = searchResponse.data.data.rooms || [];
    
    if (rooms.length === 0) {
      throw new Error('No rooms available for the selected dates');
    }
    
    console.log(`🏨 Found ${rooms.length} available rooms`);
    
    // 2. Select first available room
    console.log('\n🎯 Step 2: Selecting room...');
    const selectedRoom = rooms[0];
    
    const roomResponse = await axios.post('http://localhost:3001/api/booking/select-room', {
      sessionId: sessionId,
      roomId: selectedRoom.id
    }, {
      timeout: 15000
    });

    console.log('✅ Room selected successfully!');
    console.log('📊 Room selection result:', JSON.stringify(roomResponse.data, null, 2));
    
    // 3. Check what page we're on and analyze it
    console.log('\n📋 Step 3: Analyzing current page state...');
    
    const pageAnalysisResponse = await axios.post('http://localhost:3001/api/booking/analyze-current-page', {
      sessionId: sessionId
    }, {
      timeout: 15000
    });

    console.log('✅ Page analysis completed!');
    console.log('📊 Current page analysis:', JSON.stringify(pageAnalysisResponse.data, null, 2));
    
    console.log('\n🎉 Personal data page access test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('📄 Error details:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    // Cleanup session if created
    if (sessionId) {
      try {
        console.log('\n🧹 Cleaning up session...');
        await axios.delete(`http://localhost:3001/api/booking/session/${sessionId}`, { timeout: 5000 });
        console.log('✅ Session cleaned up successfully');
      } catch (cleanupError) {
        console.warn('⚠️ Session cleanup failed:', cleanupError.message);
      }
    }
  }
}

// Run the test
testPersonalDataPage();
