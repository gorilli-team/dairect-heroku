import React, { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import SearchForm from './components/SearchForm'
import RoomSelection from './components/RoomSelection'
import PersonalDataForm from './components/PersonalDataForm'
import PaymentForm from './components/PaymentForm'
import BookingResult from './components/BookingResult'
import LoadingOverlay from './components/LoadingOverlay'
import { useBooking } from './hooks/useBooking'
import toast, { Toaster } from 'react-hot-toast'
import './App.css'

// Modern App Layout Component
function AppLayout() {
  const {
    currentStep,
    sessionId,
    searchParams,
    availableRooms,
    selectedRoom,
    bookingResult,
    loading,
    error,
    startSearch,
    getRooms,
    selectRoom,
    fillPersonalData,
    completeBooking,
    submitBooking,
    resetBooking
  } = useBooking()
  
  const navigate = useNavigate()
  const location = useLocation()
  const [showModal, setShowModal] = useState(false)
  const [backgroundImage, setBackgroundImage] = useState(null)

  // Set background based on selected room or default hotel image
  useEffect(() => {
    if (selectedRoom?.images && selectedRoom.images.length > 0) {
      setBackgroundImage(selectedRoom.images[0])
    } else {
      // Default elegant hotel background (Palazzo Vitturi style)
      setBackgroundImage('https://images.unsplash.com/photo-1564501049412-61c2a3083791?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')
    }
  }, [selectedRoom])

  // Show modal when we're not on search page
  useEffect(() => {
    const shouldShowModal = location.pathname !== '/' && currentStep !== 'search'
    setShowModal(shouldShowModal)
  }, [currentStep, location.pathname])

  // Handle search
  const handleSearch = async (searchData) => {
    try {
      console.log('🔍 App.jsx handleSearch called with:', searchData)
      const result = await startSearch(searchData)
      console.log('✅ startSearch result:', result)
      if (result.success) {
        const roomsCount = result.data?.rooms?.length || 0
        if (roomsCount > 0) {
          toast.success(`Trovate ${roomsCount} camere disponibili!`)
          navigate('/rooms')
        } else {
          setTimeout(() => {
            getRooms()
            navigate('/rooms')
          }, 2000)
          toast.success('Ricerca avviata con successo!')
        }
      }
    } catch (err) {
      console.error('❌ App.jsx handleSearch error:', err)
      console.error('❌ Error details:', {
        message: err.message,
        stack: err.stack,
        response: err.response
      })
      toast.error('Errore durante la ricerca: ' + (err.message || 'Errore sconosciuto'))
    }
  }

  // Handle room selection
  const handleRoomSelect = async (roomId, optionId = null) => {
    try {
      const result = await selectRoom(roomId, optionId)
      if (result.success) {
        toast.success('Camera selezionata!')
        navigate('/personal-data')
      }
    } catch (err) {
      toast.error('Errore nella selezione: ' + (err.message || 'Errore sconosciuto'))
    }
  }

  // Handle personal data submission
  const handlePersonalDataSubmit = async (personalData) => {
    try {
      const result = await fillPersonalData(personalData)
      if (result.success) {
        toast.success('Dati personali salvati!')
        navigate('/payment')
      }
    } catch (err) {
      toast.error('Errore nei dati personali: ' + (err.message || 'Errore sconosciuto'))
    }
  }

  // Handle payment submission
  const handlePaymentSubmit = async (paymentData) => {
    try {
      const result = await completeBooking(paymentData)
      if (result.success) {
        toast.success('Prenotazione completata!')
        navigate('/confirmation')
      } else {
        toast.error(result.message || 'Errore nella prenotazione')
      }
    } catch (err) {
      toast.error('Errore durante la prenotazione: ' + (err.message || 'Errore sconosciuto'))
    }
  }

  // Handle modal close
  const handleCloseModal = () => {
    resetBooking()
    navigate('/')
    setShowModal(false)
    toast.success('Sessione resettata')
  }

  // Handle back navigation
  const handleBack = () => {
    if (location.pathname === '/rooms') {
      navigate('/')
    } else if (location.pathname === '/personal-data') {
      navigate('/rooms')
    } else if (location.pathname === '/payment') {
      navigate('/personal-data')
    } else {
      navigate('/')
    }
  }

  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  return (
    <div className="app-container">
      {/* Background Image */}
      <div 
        className="app-background"
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none'
        }}
      />
      
      {/* Toast Notifications */}
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1F2937',
            color: '#fff',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500'
          },
          success: {
            iconTheme: {
              primary: '#22C55E',
              secondary: '#fff'
            }
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff'
            }
          }
        }}
      />
      
      {/* Main Content - Search Form always visible */}
      <main className="app-main">
        {location.pathname === '/' && (
          <div className="search-container">
            <h2>🏨 Prenotazione D-Alrect</h2>
            <SearchForm 
              onSearch={handleSearch}
              loading={loading}
              initialData={searchParams}
            />
          </div>
        )}
      </main>

      {/* Modal Overlay for booking steps */}
      {showModal && (
        <div className="modal-overlay animate-fadeIn">
          <div className="modal-content animate-slideUp">
            {/* Dark Header with room info (like Figma) */}
            {selectedRoom && location.pathname === '/personal-data' && (
              <div className="dark-header-bar">
                <div>
                  <div className="dark-header-title">
                    {selectedRoom.name || 'Suite con Balcone DELUXE'}
                  </div>
                  <div className="dark-header-subtitle">
                    {searchParams?.checkinDate && searchParams?.checkoutDate ? (
                      `${new Date(searchParams.checkinDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${new Date(searchParams.checkoutDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} • ${searchParams.adults || 2} ospiti`
                    ) : (
                      '30 Mag - 02 Giu • 2 ospiti'
                    )}
                  </div>
                </div>
                <div className="dark-header-price">
                  <div className="dark-header-price-main">
                    {selectedRoom.formattedPrice || '1280€'}
                  </div>
                  <div className="dark-header-price-note">
                    tasse incluse
                  </div>
                </div>
              </div>
            )}
            
            {/* Modal Header */}
            <div className="modal-header">
              <div className="header-title">
                {location.pathname === '/rooms' && 'Prenotazione D-Alrect'}
                {location.pathname === '/personal-data' && 'Informazioni personali'}
                {location.pathname === '/payment' && 'Pagamento'}
                {location.pathname === '/confirmation' && 'Conferma prenotazione'}
              </div>
              <div className="header-subtitle">
                {searchParams?.hotel?.name || 'Hotel Palazzo Vitturi'}
              </div>
              <button 
                className="close-button"
                onClick={handleCloseModal}
                aria-label="Chiudi"
              />
            </div>
            
            {/* Modal Body */}
            <div className="modal-body">
              <Routes>
                <Route 
                  path="/rooms" 
                  element={
                    <RoomSelection
                      rooms={availableRooms}
                      loading={loading}
                      onSelectRoom={handleRoomSelect}
                      onBack={handleBack}
                    />
                  } 
                />
                <Route 
                  path="/personal-data" 
                  element={
                    <PersonalDataForm
                      room={selectedRoom}
                      searchParams={searchParams}
                      onSubmit={handlePersonalDataSubmit}
                      onBack={handleBack}
                      loading={loading}
                    />
                  } 
                />
                <Route 
                  path="/payment" 
                  element={
                    <PaymentForm
                      room={selectedRoom}
                      searchParams={searchParams}
                      onSubmit={handlePaymentSubmit}
                      onBack={handleBack}
                      loading={loading}
                    />
                  } 
                />
                <Route 
                  path="/confirmation" 
                  element={
                    <BookingResult
                      result={bookingResult}
                      searchParams={searchParams}
                      selectedRoom={selectedRoom}
                      onNewSearch={handleCloseModal}
                    />
                  } 
                />
              </Routes>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && <LoadingOverlay message={loading} />}

      {/* Error State */}
      {error && !loading && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div className="header-title">Errore</div>
              <button className="close-button" onClick={handleCloseModal} />
            </div>
            <div className="modal-body">
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-4xl)', marginBottom: 'var(--space-4)' }}>⚠️</div>
                <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-4)', color: 'var(--color-error)' }}>
                  Si è verificato un errore
                </h3>
                <p style={{ color: 'var(--color-gray-600)', marginBottom: 'var(--space-6)' }}>
                  {error}
                </p>
                <button 
                  onClick={handleCloseModal}
                  className="btn btn-primary btn-full"
                >
                  Ricomincia
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function App() {
  return <AppLayout />
}

export default App
