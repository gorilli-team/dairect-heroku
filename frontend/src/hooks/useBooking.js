import { useState, useCallback } from 'react'
import { bookingService } from '../services/bookingService'

export const useBooking = () => {
  const [state, setState] = useState({
    currentStep: 'search',
    sessionId: null,
    searchParams: null,
    availableRooms: [],
    selectedRoom: null,
    personalData: null, // Store personal data from first step
    bookingResult: null,
    loading: null,
    error: null
  })

  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const setLoading = useCallback((message) => {
    updateState({ loading: message, error: null })
  }, [updateState])

  const setError = useCallback((error) => {
    updateState({ loading: null, error })
  }, [updateState])

  const startSearch = useCallback(async (searchData) => {
    console.log('🔍 useBooking.startSearch called with:', searchData)
    setLoading('Avvio ricerca disponibilità...')
    
    try {
      console.log('🚀 Calling bookingService.startSearch...')
      const response = await bookingService.startSearch(searchData)
      console.log('✅ bookingService.startSearch response:', response)
      
      // Check if rooms are already available in the response
      const rooms = response.data?.rooms || []
      console.log('🏨 Extracted rooms:', rooms.length)
      
      updateState({
        currentStep: 'rooms',
        sessionId: response.sessionId,
        searchParams: searchData,
        availableRooms: rooms,
        loading: rooms.length > 0 ? null : 'Analisi camere in corso...'
      })

      return response
    } catch (error) {
      console.error('❌ useBooking.startSearch error:', error)
      setError(`Errore durante la ricerca: ${error.message}`)
      throw error
    }
  }, [setLoading, setError, updateState])

  const getRooms = useCallback(async () => {
    if (!state.sessionId) {
      setError('Nessuna sessione attiva')
      return
    }

    setLoading('Estrazione camere disponibili...')

    try {
      const response = await bookingService.getAvailableRooms(state.sessionId)
      
      updateState({
        availableRooms: response.rooms || [],
        loading: null
      })

      if (!response.rooms || response.rooms.length === 0) {
        setError('Nessuna camera disponibile per le date selezionate')
      }

      return response
    } catch (error) {
      setError(`Errore nel recupero camere: ${error.message}`)
      throw error
    }
  }, [state.sessionId, setLoading, setError, updateState])

  const selectRoom = useCallback(async (roomId, optionId = null) => {
    if (!state.sessionId) {
      setError('Nessuna sessione attiva')
      return
    }

    setLoading('Selezione camera in corso...')

    try {
      const response = await bookingService.selectRoom(state.sessionId, roomId, optionId)
      let room = state.availableRooms.find(r => r.id === roomId)
      
      // After successful room selection, extract the sidebar summary data
      try {
        setLoading('Estrazione dati prenotazione...')
        const summaryResponse = await bookingService.getPersonalDataSummary(state.sessionId)
        
        if (summaryResponse.success && room) {
          // Enrich the room data with the extracted sidebar summary
          room = {
            ...room,
            summaryStructured: {
              // Reservation summary data
              checkinDate: summaryResponse.reservationSummary?.checkinDate,
              checkoutDate: summaryResponse.reservationSummary?.checkoutDate,
              nights: summaryResponse.reservationSummary?.nights,
              guests: summaryResponse.reservationSummary?.guests,
              
              // Cart data
              roomName: summaryResponse.cart?.roomName,
              occupants: summaryResponse.cart?.occupants,
              rateName: summaryResponse.cart?.rateName,
              mealPlan: summaryResponse.cart?.mealPlan,
              refundability: summaryResponse.cart?.refundability,
              
              // Pricing data
              roomPrice: summaryResponse.cart?.roomPrice,
              roomPriceFormatted: summaryResponse.cart?.roomPriceFormatted,
              originalRoomPrice: summaryResponse.cart?.originalRoomPrice,
              originalRoomPriceFormatted: summaryResponse.cart?.originalRoomPriceFormatted,
              
              // Taxes
              taxes: summaryResponse.cart?.taxes,
              
              // Services
              mandatoryServices: summaryResponse.cart?.mandatoryServices || [],
              
              // Final totals
              totalPrice: summaryResponse.cart?.totalPrice,
              totalPriceFormatted: summaryResponse.cart?.totalPriceFormatted,
              originalTotalPrice: summaryResponse.cart?.originalTotalPrice,
              originalTotalPriceFormatted: summaryResponse.cart?.originalTotalPriceFormatted,
              
              // Voucher
              voucher: summaryResponse.voucher,
              
              // Raw HTML for fallback
              sidebarHtml: summaryResponse.sidebarHtml,
              reservationSummaryHtml: summaryResponse.reservationSummary?.html,
              cartHtml: summaryResponse.cart?.html
            }
          }
        }
      } catch (summaryError) {
        console.warn('Failed to extract sidebar summary, proceeding without it:', summaryError.message)
        // Continue without summary data
      }

      updateState({
        selectedRoom: room,
        currentStep: 'personal-data', // First step: personal data
        loading: null
      })

      return response
    } catch (error) {
      setError(`Errore nella selezione camera: ${error.message}`)
      throw error
    }
  }, [state.sessionId, state.availableRooms, setLoading, setError, updateState])

  // Step 1: Fill personal data and click 'Continua'
  const fillPersonalData = useCallback(async (personalData) => {
    if (!state.sessionId) {
      setError('Nessuna sessione attiva')
      return
    }

    setLoading('Compilazione dati personali...')

    try {
      const response = await bookingService.fillPersonalData(state.sessionId, personalData)

      updateState({
        personalData: personalData, // Store personal data for later use
        currentStep: 'payment', // Move to payment step
        loading: null
      })

      return response
    } catch (error) {
      setError(`Errore durante la compilazione: ${error.message}`)
      throw error
    }
  }, [state.sessionId, setLoading, setError, updateState])

  // Step 2: Complete booking with payment data
  const completeBooking = useCallback(async (paymentData, testMode = false) => {
    if (!state.sessionId) {
      setError('Nessuna sessione attiva')
      return
    }

    if (!state.personalData) {
      setError('Dati personali mancanti')
      return
    }

    setLoading('Completamento prenotazione...')

    try {
      // Combine personal data with payment data
      const completeBookingData = {
        email: state.personalData.email,
        phone: paymentData.phone,
        paymentMethod: 'credit_card',
        cardNumber: paymentData.cardNumber?.replace(/\s/g, ''), // Remove spaces
        cardExpiry: `${paymentData.expiryMonth}/${paymentData.expiryYear.slice(-2)}`, // Convert to MM/YY format
        cardHolder: paymentData.cardHolder,
        acceptNewsletter: state.personalData.acceptNewsletter || false
      }

      const response = await bookingService.completeBooking(state.sessionId, completeBookingData, testMode)

      updateState({
        bookingResult: response,
        currentStep: 'result',
        loading: null
      })

      return response
    } catch (error) {
      setError(`Errore durante la prenotazione: ${error.message}`)
      
      // Still move to result step to show the error
      updateState({
        bookingResult: {
          success: false,
          message: error.message,
          error: error.message
        },
        currentStep: 'result',
        loading: null
      })
      
      throw error
    }
  }, [state.sessionId, state.personalData, setLoading, setError, updateState])

  // Legacy method for backward compatibility
  const submitBooking = useCallback(async (room, personalData) => {
    if (!state.sessionId || !room) {
      setError('Dati mancanti per completare la prenotazione')
      return
    }

    setLoading('Invio dati di prenotazione...')

    try {
      const response = await bookingService.submitBooking(
        state.sessionId,
        room.id,
        personalData
      )

      updateState({
        bookingResult: response,
        currentStep: 'result',
        loading: null
      })

      return response
    } catch (error) {
      setError(`Errore durante la prenotazione: ${error.message}`)
      
      // Still move to result step to show the error
      updateState({
        bookingResult: {
          success: false,
          message: error.message,
          error: error.message
        },
        currentStep: 'result',
        loading: null
      })
      
      throw error
    }
  }, [state.sessionId, setLoading, setError, updateState])

  const resetBooking = useCallback(() => {
    // Clean up session on backend if exists
    if (state.sessionId) {
      bookingService.cleanupSession(state.sessionId).catch(console.error)
    }

    setState({
      currentStep: 'search',
      sessionId: null,
      searchParams: null,
      availableRooms: [],
      selectedRoom: null,
      personalData: null,
      bookingResult: null,
      loading: null,
      error: null
    })
  }, [state.sessionId])

  const getSessionStatus = useCallback(async () => {
    if (!state.sessionId) return null

    try {
      const status = await bookingService.getSessionStatus(state.sessionId)
      return status
    } catch (error) {
      console.error('Error getting session status:', error)
      return null
    }
  }, [state.sessionId])

  return {
    // State
    ...state,
    
    // Actions
    startSearch,
    getRooms,
    selectRoom,
    fillPersonalData,
    completeBooking,
    submitBooking, // Legacy
    resetBooking,
    getSessionStatus,
    
    // Utilities
    setLoading,
    setError
  }
}
