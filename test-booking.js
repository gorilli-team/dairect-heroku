const axios = require('axios');

async function testBookingFlow() {
  console.log('🚀 Starting complete booking flow test...');
  
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
      timeout: 30000 // 30 seconds for search
    });

    console.log('✅ Search completed successfully!');
    console.log('📊 Search results:', JSON.stringify(searchResponse.data, null, 2));
    
    sessionId = searchResponse.data.sessionId;
    const rooms = searchResponse.data.data.rooms || [];
    
    if (rooms.length === 0) {
      throw new Error('No rooms available for the selected dates');
    }
    
    console.log(`\n🏨 Found ${rooms.length} available rooms`);
    rooms.forEach((room, index) => {
      console.log(`   ${index + 1}. ${room.name} - €${room.price}`);
    });
    
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
    
    // 4. Complete booking (payment page)
    console.log('\n💳 Step 4: Completing booking with payment details...');
    const bookingResponse = await axios.post('http://localhost:3001/api/booking/complete-booking', {
      sessionId: sessionId,
      bookingData: {
        email: "mario.rossi.test@example.com",
        phone: "3331234567", // Senza prefisso come richiesto
        paymentMethod: "credit_card",
        cardNumber: "4111111111111111", // Test card
        cardExpiry: "12/28",
        cvv: "123",
        cardHolder: "Mario Rossi",
        acceptNewsletter: false
      },
      testMode: false // MODALITÀ PAGAMENTO REALE: abilita transazioni vere
    }, {
      timeout: 60000 // 1 minuto per il processo di pagamento
    });

    console.log('✅ Booking process completed!');
    console.log('📊 Final booking result:', JSON.stringify(bookingResponse.data, null, 2));
    
    console.log('\n🎉 Test completed successfully! All steps executed without errors.');
    
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
testBookingFlow();
