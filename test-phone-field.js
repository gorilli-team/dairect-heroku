const axios = require('axios');

async function testPhoneFieldOnly() {
  console.log('🚀 Testing phone field in payment page...');
  
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
    
    // 3. Fill personal data
    console.log('\n👤 Step 3: Filling personal data...');
    const personalDataResponse = await axios.post('http://localhost:3001/api/booking/fill-personal-data', {
      sessionId: sessionId,
      personalData: {
        firstName: "Mario",
        lastName: "Rossi", 
        email: "mario.rossi.test@example.com",
        acceptNewsletter: false
      }
    }, {
      timeout: 15000
    });

    console.log('✅ Personal data filled successfully!');
    console.log('📊 Personal data result:', JSON.stringify(personalDataResponse.data, null, 2));
    
    // 4. Test ONLY phone field in payment page - with custom timeout and debug
    console.log('\n📱 Step 4: Testing phone field specifically...');
    
    const phoneTestResponse = await axios.post('http://localhost:3001/api/booking/test-phone-field', {
      sessionId: sessionId,
      phone: "3331234567"
    }, {
      timeout: 30000 // 30 seconds timeout
    });

    console.log('✅ Phone field test completed!');
    console.log('📊 Phone field result:', JSON.stringify(phoneTestResponse.data, null, 2));
    
    console.log('\n🎉 Phone field test completed successfully!');
    
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
testPhoneFieldOnly();
