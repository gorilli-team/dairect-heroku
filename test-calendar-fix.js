#!/usr/bin/env node

// Simple test to validate calendar improvements

const axios = require('axios');

async function testBookingFlow() {
  console.log('🧪 Testing improved calendar date selection...\n');
  
  const testBookingData = {
    checkinDate: '2025-09-17',
    checkoutDate: '2025-09-20',
    adults: 2,
    children: 0
  };

  try {
    console.log('📅 Starting search with:', testBookingData);
    
    const response = await axios.post('http://localhost:3001/api/booking/start-search', testBookingData);
    
    if (response.data.success) {
      console.log('✅ Calendar date selection improvements working!');
      console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    } else {
      console.log('❌ Test failed:', response.data.error);
    }
  } catch (error) {
    console.log('❌ Test error:', error.response?.data || error.message);
  }
}

// Check if server is running
const SERVER_URL = 'http://localhost:3001';

axios.get(SERVER_URL + '/health')
  .then(() => {
    console.log('🟢 Server is running, proceeding with test...\n');
    testBookingFlow();
  })
  .catch(() => {
    console.log('🔴 Server is not running. Please start with `npm run dev` first.');
    process.exit(1);
  });
