const axios = require('axios');

async function testPrivacyCheckbox() {
  console.log('🚀 Testing privacy checkbox in personal data page...');
  
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
    
    // 3. Test privacy checkbox specifically  
    console.log('\n🔐 Step 3: Testing privacy checkbox specifically...');
    
    const privacyTestResponse = await axios.post('http://localhost:3001/api/booking/test-privacy-checkbox', {
      sessionId: sessionId
    }, {
      timeout: 20000 // 20 seconds timeout
    });

    console.log('✅ Privacy checkbox test completed!');
    console.log('📊 Privacy checkbox result:', JSON.stringify(privacyTestResponse.data, null, 2));
    
    console.log('\n🎉 Privacy checkbox test completed successfully!');
    
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
        await axios.delete(`http://localhost:3001/api/booking/session/${sessionId}`);
        console.log('✅ Session cleaned up successfully');
      } catch (cleanupError) {
        console.warn('⚠️ Session cleanup failed:', cleanupError.message);
      }
    }
  }
}

// Run the test
testPrivacyCheckbox();
