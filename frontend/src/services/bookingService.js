import axios from 'axios'

// Create axios instance with base configuration
const api = axios.create({
  baseURL: `https://dairect.gorilli.io/api/booking`,
  timeout: 300000, // 5 minutes timeout for complex operations
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true' // This is the key header for ngrok
  },
})

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('❌ Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`)
    console.log('📄 Response data:', response.data)
    return response.data
  },
  (error) => {
    // COMPREHENSIVE ERROR DEBUG LOGGING
    console.group('🔍 COMPREHENSIVE ERROR DEBUG')
    console.error('❌ Complete Error Object:', error)
    console.error('❌ Error Keys:', Object.keys(error))
    console.error('❌ Error Constructor:', error.constructor.name)
    console.error('❌ Error Message:', error.message)
    console.error('❌ Error Code:', error.code)
    console.error('❌ Error Config:', error.config)
    
    // Response-specific logging
    if (error.response) {
      console.group('📡 RESPONSE DETAILS')
      console.error('Status:', error.response.status)
      console.error('Status Text:', error.response.statusText)
      console.error('Headers:', error.response.headers)
      console.error('Data (Full):', error.response.data)
      console.error('Data Type:', typeof error.response.data)
      console.error('Data Keys:', error.response.data ? Object.keys(error.response.data) : 'N/A')
      console.groupEnd()
    } else {
      console.warn('⚠️ No response object available')
    }
    
    // Request-specific logging
    if (error.request) {
      console.group('📤 REQUEST DETAILS')
      console.error('Request:', error.request)
      console.error('Request Status:', error.request.status)
      console.error('Request Response Text:', error.request.responseText)
      console.groupEnd()
    } else {
      console.warn('⚠️ No request object available')
    }
    
    console.groupEnd()
    
    // Determine error message and preserve response data
    let message = 'Errore di connessione'
    let errorData = null
    
    if (error.response?.data) {
      errorData = error.response.data
      console.log('🔍 Processing error data:', errorData)
      
      // Handle different error data structures
      if (typeof errorData === 'string') {
        message = errorData
      } else if (errorData.error === 'Validation error') {
        if (errorData.details && Array.isArray(errorData.details)) {
          console.log('🚫 Validation error with details:', errorData.details)
          message = `Errore di validazione: ${errorData.details.join(', ')}`
        } else {
          console.log('🚫 Validation error without details')
          message = 'Errore di validazione (dettagli non disponibili)'
        }
      } else if (errorData.error) {
        message = errorData.error
      } else if (errorData.message) {
        message = errorData.message
      } else {
        console.warn('⚠️ Unrecognized error data structure')
        message = 'Errore sconosciuto dal server'
      }
    } else if (error.message) {
      message = error.message
    }
    
    console.error('❌ Final processed message:', message)
    
    // Create enhanced error object that preserves response data
    const enhancedError = new Error(message)
    enhancedError.response = error.response
    enhancedError.request = error.request
    enhancedError.code = error.code
    enhancedError.config = error.config
    enhancedError.originalError = error
    
    // For debugging: add errorData if available
    if (errorData) {
      enhancedError.errorData = errorData
    }
    
    console.error('❌ Enhanced error object keys:', Object.keys(enhancedError))
    throw enhancedError
  }
)

export const bookingService = {
  /**
   * Start hotel availability search
   * @param {Object} searchData - Search parameters
   * @param {string} searchData.checkinDate - Check-in date (YYYY-MM-DD)
   * @param {string} searchData.checkoutDate - Check-out date (YYYY-MM-DD)
   * @param {number} searchData.adults - Number of adults
   * @param {number} searchData.children - Number of children
   * @param {Object} searchData.hotel - Selected hotel object
   * @returns {Promise<Object>} Search result with sessionId
   */
  async startSearch(searchData) {
    try {
      console.log('🔍 startSearch called with searchData:', searchData)
      console.log('🏨 Hotel object:', searchData.hotel)
      
      // Filter hotel object to only include backend-required fields
      const hotelForBackend = {
        id: searchData.hotel.id,
        name: searchData.hotel.name,
        location: searchData.hotel.location,
        emoji: searchData.hotel.emoji,
        baseUrl: searchData.hotel.baseUrl,
        description: searchData.hotel.description
      }
      
      const requestPayload = {
        checkinDate: searchData.checkinDate,
        checkoutDate: searchData.checkoutDate,
        adults: parseInt(searchData.adults),
        children: parseInt(searchData.children) || 0,
        hotel: hotelForBackend
      }
      
      console.log('📤 Sending request payload:', requestPayload)
      
      const response = await api.post('/start-search', requestPayload)
      
      return response
    } catch (error) {
      console.error('Error starting search:', error)
      throw error
    }
  },

  /**
   * Get available rooms for a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Available rooms data
   */
  async getAvailableRooms(sessionId) {
    try {
      const response = await api.get(`/available-rooms/${sessionId}`)
      return response
    } catch (error) {
      console.error('Error getting available rooms:', error)
      throw error
    }
  },

  /**
   * Select a specific room
   * @param {string} sessionId - Session identifier
   * @param {string} roomId - Room identifier
   * @param {string} optionId - Optional booking option identifier
   * @returns {Promise<Object>} Selection result
   */
  async selectRoom(sessionId, roomId, optionId = null) {
    try {
      console.log('🔍 bookingService.selectRoom called with:', { sessionId, roomId, optionId, type: typeof optionId })
      
      const requestData = {
        sessionId,
        roomId
      }
      
      // Aggiungi optionId solo se specificato
      if (optionId) {
        requestData.optionId = optionId
        console.log('✅ Adding optionId to request:', optionId)
      } else {
        console.log('⚠️ No optionId provided, will use fallback selectors')
      }
      
      console.log('📤 Final request data:', requestData)
      
      const response = await api.post('/select-room', requestData)
      
      return response
    } catch (error) {
      console.error('Error selecting room:', error)
      throw error
    }
  },

  /**
   * Fill personal data on the booking form
   * @param {string} sessionId - Session identifier
   * @param {Object} personalData - Personal data only
   * @returns {Promise<Object>} Fill result
   */
  async fillPersonalData(sessionId, personalData) {
    try {
      const response = await api.post('/fill-personal-data', {
        sessionId,
        personalData: {
          firstName: personalData.firstName,
          lastName: personalData.lastName,
          email: personalData.email,
          acceptNewsletter: personalData.acceptNewsletter || false
        }
      })
      
      return response
    } catch (error) {
      console.error('Error filling personal data:', error)
      throw error
    }
  },

  /**
   * Complete booking with payment data
   * @param {string} sessionId - Session identifier
   * @param {Object} bookingData - Complete booking data including payment
   * @param {boolean} testMode - Whether to run in test mode (default: false for real payments)
   * @returns {Promise<Object>} Booking result
   */
  async completeBooking(sessionId, bookingData, testMode = false) {
    try {
      const response = await api.post('/complete-booking', {
        sessionId,
        bookingData: {
          email: bookingData.email,
          phone: bookingData.phone,
          paymentMethod: 'credit_card',
          cardNumber: bookingData.cardNumber?.replace(/\s/g, ''), // Remove spaces
          cardExpiry: bookingData.cardExpiry,
          cardHolder: bookingData.cardHolder, // Campo titolare carta richiesto
          acceptNewsletter: bookingData.acceptNewsletter || false
        },
        testMode
      })
      
      return response
    } catch (error) {
      console.error('Error completing booking:', error)
      throw error
    }
  },

  /**
   * Submit booking with personal data (DEPRECATED - use fillPersonalData + completeBooking instead)
   * @param {string} sessionId - Session identifier
   * @param {string} roomId - Selected room identifier
   * @param {Object} personalData - Personal and payment information
   * @returns {Promise<Object>} Booking result
   */
  async submitBooking(sessionId, roomId, personalData) {
    try {
      // Step 1: Fill personal data
      console.log('🔄 Step 1: Filling personal data...')
      const personalDataResult = await this.fillPersonalData(sessionId, personalData)
      
      if (!personalDataResult.success) {
        throw new Error('Failed to fill personal data')
      }
      
      // Step 2: Complete booking with payment
      console.log('🔄 Step 2: Completing booking with payment...')
      const bookingData = {
        email: personalData.email,
        phone: personalData.phone,
        cardNumber: personalData.cardNumber,
        cardExpiry: `${personalData.expiryMonth}/${personalData.expiryYear.slice(-2)}`, // Convert to MM/YY
        cardHolder: personalData.cardHolder, // Usa il campo titolare carta dal form
        acceptNewsletter: personalData.acceptNewsletter || false
      }
      
      const bookingResult = await this.completeBooking(sessionId, bookingData, false) // testMode: false for real payments
      
      return bookingResult
    } catch (error) {
      console.error('Error submitting booking:', error)
      throw error
    }
  },

  /**
   * Get session status
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Session status
   */
  async getSessionStatus(sessionId) {
    try {
      const response = await api.get(`/session/${sessionId}/status`)
      return response
    } catch (error) {
      console.error('Error getting session status:', error)
      throw error
    }
  },

  /**
   * Get personal data summary with booking details from sidebar
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Booking summary data
   */
  async getPersonalDataSummary(sessionId) {
    try {
      const response = await api.get(`/personal-data-summary/${sessionId}`)
      return response
    } catch (error) {
      console.error('Error getting personal data summary:', error)
      throw error
    }
  },

  /**
   * Clean up session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupSession(sessionId) {
    try {
      const response = await api.delete(`/session/${sessionId}`)
      return response
    } catch (error) {
      console.error('Error cleaning up session:', error)
      // Don't throw error for cleanup failures
      return null
    }
  },

  /**
   * Health check
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const response = await axios.get('/api/health')
      return response.data
    } catch (error) {
      console.error('Health check failed:', error)
      throw error
    }
  }
}
