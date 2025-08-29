import React, { useState, useEffect, useRef } from 'react'
import './RoomSelection.css'

// Componente per visualizzare il blocco prezzo completo con styling personalizzato
const PriceBlockDisplay = ({ priceBlockHtml }) => {
  const containerRef = useRef(null)
  
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current
      
      // Stili per il container principale dei prezzi
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif'
      
      // Stili per l'importo principale (.mainAmount)
      const mainAmounts = container.querySelectorAll('.mainAmount, .eiup2eu1')
      mainAmounts.forEach(amount => {
        amount.style.fontSize = '2rem'
        amount.style.fontWeight = '700'
        amount.style.color = '#1f2937'
        amount.style.lineHeight = '1.2'
      })
      
      // Stili per prezzi barrati (prezzi originali)
      const strikethroughPrices = container.querySelectorAll('[style*="text-decoration: line-through"]')
      strikethroughPrices.forEach(price => {
        price.style.fontSize = '1.1rem'
        price.style.color = '#6b7280'
        price.style.fontWeight = '500'
      })
      
      // Stili per il badge di sconto/percentuale
      const discountBadges = container.querySelectorAll('.discount, [class*="discount"], [style*="background"]')
      discountBadges.forEach(badge => {
        const text = badge.textContent?.trim()
        if (text && text.includes('%')) {
          badge.style.backgroundColor = '#dc2626'
          badge.style.color = 'white'
          badge.style.padding = '0.25rem 0.5rem'
          badge.style.borderRadius = '0.375rem'
          badge.style.fontSize = '0.875rem'
          badge.style.fontWeight = '600'
          badge.style.display = 'inline-block'
        }
      })
      
      // Stili per "Tasse incluse" e note simili
      const taxNotes = container.querySelectorAll('span, div')
      taxNotes.forEach(note => {
        const text = note.textContent?.trim().toLowerCase()
        if (text && (text.includes('tasse') || text.includes('inclus') || text.includes('notte') || text.includes('notti'))) {
          note.style.fontSize = '0.875rem'
          note.style.color = '#6b7280'
          note.style.fontWeight = '500'
        }
      })
      
      // Layout generale del container
      container.style.display = 'flex'
      container.style.flexDirection = 'column'
      container.style.gap = '0.5rem'
      container.style.alignItems = 'flex-start'
    }
  }, [priceBlockHtml])
  
  return (
    <div 
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: priceBlockHtml }}
    />
  )
}

// Componente per visualizzare le informazioni della camera con styling personalizzato
const RoomInfoDisplay = ({ roomInfoHtml }) => {
  const containerRef = useRef(null)
  
  useEffect(() => {
    if (containerRef.current) {
      // Applica gli stili personalizzati dopo che il componente è montato
      const container = containerRef.current
      
      // Stile principale del container
      container.style.display = 'flex'
      container.style.alignItems = 'center'
      container.style.gap = '1.5rem'
      container.style.flexWrap = 'wrap'
      
      // Stili per .RoomFeature (dimensioni camera)
      const roomFeatures = container.querySelectorAll('.RoomFeature')
      roomFeatures.forEach(feature => {
        feature.style.display = 'flex'
        feature.style.alignItems = 'center'
        feature.style.gap = '0.5rem'
        feature.style.background = 'white'
        feature.style.padding = '0.5rem 0.75rem'
        feature.style.borderRadius = '0.75rem'
        feature.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
        feature.style.border = '1px solid #e5e7eb'
      })
      
      // Stili per le icone SVG
      const svgs = container.querySelectorAll('svg')
      svgs.forEach(svg => {
        svg.style.width = '18px'
        svg.style.height = '18px'
        svg.style.flexShrink = '0'
        
        if (svg.getAttribute('title') === 'ruler') {
          svg.style.color = '#3b82f6' // blue-500
        } else if (svg.getAttribute('title') === 'adult') {
          svg.style.color = '#059669' // emerald-600
        } else if (svg.getAttribute('title') === 'crib') {
          svg.style.color = '#dc2626' // red-600
        }
      })
      
      // Stili per il testo delle dimensioni e ospiti
      const textElements = container.querySelectorAll('.ltr-zswzrr')
      textElements.forEach(text => {
        text.style.fontWeight = '600'
        text.style.color = '#374151'
        text.style.fontSize = '14px'
      })
      
      // Stili per il gruppo ospiti [role="group"]
      const guestGroups = container.querySelectorAll('[role="group"]')
      guestGroups.forEach(group => {
        group.style.display = 'flex'
        group.style.alignItems = 'center'
        group.style.gap = '0.75rem'
        group.style.background = 'white'
        group.style.padding = '0.5rem 0.75rem'
        group.style.borderRadius = '0.75rem'
        group.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
        group.style.border = '1px solid #e5e7eb'
        
        // Stili per i paragrafi all'interno del gruppo
        const paragraphs = group.querySelectorAll('p')
        paragraphs.forEach(p => {
          p.style.margin = '0'
          p.style.fontWeight = '600'
          p.style.color = '#374151'
          p.style.fontSize = '14px'
          p.style.whiteSpace = 'nowrap'
        })
        
        // Stili per i contenitori delle icone ospiti
        const guestIconContainers = group.querySelectorAll('.ltr-zswzrr')
        guestIconContainers.forEach(container => {
          container.style.display = 'flex'
          container.style.alignItems = 'center'
          container.style.gap = '0.25rem'
        })
      })
      
      // Nascondi elementi di spacing inutili
      const hideElements = container.querySelectorAll('.ltr-jea9ee, .tether-target, span[style*="flex-shrink"]')
      hideElements.forEach(el => {
        el.style.display = 'none'
      })
    }
  }, [roomInfoHtml])
  
  return (
    <div 
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: roomInfoHtml }}
    />
  )
}

// Componente Carousel per le immagini delle camere
const ImageCarousel = ({ images, roomName }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  
  if (!images || images.length === 0) {
    return (
      <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
        <span className="text-gray-500">Nessuna immagine disponibile</span>
      </div>
    )
  }
  
  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }
  
  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }
  
  return (
    <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
      <img 
        src={images[currentIndex]} 
        alt={`${roomName} - Immagine ${currentIndex + 1}`}
        className="w-full h-full object-cover transition-opacity duration-300"
        onError={(e) => {
          e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltbWFnaW5lIG5vbiBkaXNwb25pYmlsZTwvdGV4dD48L3N2Zz4='
        }}
      />
      
      {images.length > 1 && (
        <>
          {/* Bottoni navigazione */}
          <button 
            onClick={prevImage}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
            aria-label="Immagine precedente"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button 
            onClick={nextImage}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
            aria-label="Immagine successiva"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          {/* Indicatori */}
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex ? 'bg-white' : 'bg-white bg-opacity-50'
                }`}
                aria-label={`Vai all'immagine ${index + 1}`}
              />
            ))}
          </div>
          
          {/* Contatore immagini */}
          <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
            {currentIndex + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  )
}

const RoomSelection = ({ rooms, onSelectRoom, loading, onBack }) => {
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [showRateOptions, setShowRateOptions] = useState(false)

  const handleRoomSelect = (room) => {
    setSelectedRoomId(room.id)
    setShowRateOptions(true)
  }

  const handleOptionSelect = (roomId, optionId) => {
    console.log('🎯 RoomSelection.handleOptionSelect called with:', { roomId, optionId })
    onSelectRoom(roomId, optionId)
  }

  const handleBack = () => {
    if (showRateOptions) {
      setShowRateOptions(false)
      setSelectedRoomId(null)
    } else {
      onBack()
    }
  }

  const selectedRoom = rooms.find(room => room.id === selectedRoomId)

  if (showRateOptions && selectedRoom) {
    return (
      <div className="room-selection-container">
        {/* Header section */}
        <div className="selection-header">
          <h2 className="selection-title">Seleziona la camera</h2>
          <div className="selection-subtitle">
            30 Mag - 02 Giu • 2 ospiti
          </div>
        </div>

        {/* Selected Room Card */}
        <div className="selected-room-card">
          <div className="room-card-layout">
            <div className="room-image-container">
              <img 
                src={selectedRoom.images?.[0] || 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'}
                alt={selectedRoom.name}
                className="room-image"
              />
              {selectedRoom.availabilityInfo && (
                <div className="availability-badge">
                  Ne resta solo {selectedRoom.availabilityInfo.remaining || 1}
                </div>
              )}
            </div>
            
            <div className="room-details">
              <h3 className="room-title">{selectedRoom.name}</h3>
              <div className="room-meta">
                <div className="room-meta-item">
                  <span className="meta-value">38 m²</span>
                  <span className="meta-separator">|</span>
                  <span className="meta-value">Max ospiti: 5</span>
                  <span className="meta-icon">👥</span>
                  <span className="meta-value">1</span>
                  <span className="meta-icon">🚼</span>
                </div>
              </div>
              
              <p className="room-description line-clamp-3">
                {selectedRoom.description || 'Suite con balconcini privati e vista Campo e Canale. Ambiente esclusivo e di pregio, di circa 50 mq, con camera da letto e splendido salotto...'}
                <button className="read-more-btn">leggi di più</button>
              </p>
              
              <div className="room-features">
                <div className="features-title">Servizi inclusi:</div>
                <div className="feature-list">
                  <div className="feature-item">Aria condizionata</div>
                  <div className="feature-item">Insonorizzazione</div>
                  <div className="feature-item">Balcone</div>
                  <div className="feature-item">Free Wi-Fi</div>
                  <button className="feature-more">Vedi tutti</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rate Options */}
        <div className="rate-options-container">
          {selectedRoom.bookingOptions && selectedRoom.bookingOptions.length > 0 ? (
            selectedRoom.bookingOptions.map((option) => (
              <div key={option.id} className="rate-option-card">
                {option.specialOffer && (
                  <div className="special-offer-badge">Offerta speciale</div>
                )}
                <div className="rate-content">
                  <h4 className="rate-name">{option.name}</h4>
                  <p className="rate-description line-clamp-2">
                    {option.description || 'Camera e Colazione inclusa'}
                  </p>
                  
                  {option.mealPlan && (
                    <div className="meal-plan">
                      <span className="meal-icon">🍽️</span>
                      <span>{option.mealPlan}</span>
                    </div>
                  )}
                  
                  {option.cancellationPolicy && (
                    <div className={`cancellation-policy ${
                      option.cancellationPolicy.refundable ? 'refundable' : 'non-refundable'
                    }`}>
                      {option.cancellationPolicy.refundable ? '✓ Rimborsabile' : '⚠️ Non rimborsabile'}
                    </div>
                  )}
                </div>
                
                <div className="rate-price">
                  <div className="price-main">{option.formattedPrice || `€${option.price}`}</div>
                  <div className="price-note">a notte</div>
                </div>
                
                <button
                  onClick={() => handleOptionSelect(selectedRoom.id, option.id)}
                  className="btn btn-primary btn-full rate-select-btn"
                  disabled={loading}
                >
                  {loading ? 'Prenotazione...' : 'Seleziona'}
                </button>
              </div>
            ))
          ) : (
            <div className="rate-option-card">
              <div className="rate-content">
                <h4 className="rate-name">Tariffa Standard</h4>
                <p className="rate-description">
                  Prenotazione standard con servizi inclusi
                </p>
              </div>
              
              <div className="rate-price">
                <div className="price-main">{selectedRoom.formattedPrice || `€${selectedRoom.price}`}</div>
                <div className="price-note">a notte</div>
              </div>
              
              <button
                onClick={() => handleOptionSelect(selectedRoom.id, 'standard')}
                className="btn btn-primary btn-full rate-select-btn"
                disabled={loading}
              >
                {loading ? 'Prenotazione...' : 'Seleziona'}
              </button>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="bottom-actions">
          <button onClick={handleBack} className="btn btn-ghost">
            Indietro
          </button>
          <button className="btn btn-secondary btn-full" disabled>
            Continua
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="room-selection-container">
      {/* Header */}
      <div className="selection-header">
        <h2 className="selection-title">Seleziona la camera</h2>
        <div className="selection-subtitle">
          30 Mag - 02 Giu • 2 ospiti
        </div>
      </div>

      {/* Rooms List */}
      {rooms.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">😭</div>
          <h3 className="empty-title">Nessuna camera disponibile</h3>
          <p className="empty-description">Non abbiamo trovato camere per le date selezionate.</p>
          <button onClick={onBack} className="btn btn-primary">
            Modifica ricerca
          </button>
        </div>
      ) : (
        <div className="rooms-list">
          {rooms.map((room) => (
            <div key={room.id} className="room-card" onClick={() => handleRoomSelect(room)}>
              <div className="room-card-layout">
                <div className="room-image-container">
                  <img 
                    src={room.images?.[0] || 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'}
                    alt={room.name}
                    className="room-image"
                  />
                  {room.availabilityInfo && (
                    <div className="availability-badge">
                      Ne resta solo {room.availabilityInfo.remaining || 1}
                    </div>
                  )}
                </div>
                
                <div className="room-details">
                  <h3 className="room-title">{room.name}</h3>
                  <div className="room-meta">
                    <div className="room-meta-item">
                      <span className="meta-value">38 m²</span>
                      <span className="meta-separator">|</span>
                      <span className="meta-value">Max ospiti: 5</span>
                      <span className="meta-icon">👥</span>
                      <span className="meta-value">1</span>
                      <span className="meta-icon">🚼</span>
                    </div>
                  </div>
                  
                  <p className="room-description line-clamp-3">
                    {room.description || 'Suite con balconcini privati e vista Campo e Canale. Ambiente esclusivo e di pregio, di circa 50 mq, con camera da letto e splendido salotto...'}
                    <button className="read-more-btn">leggi di più</button>
                  </p>
                  
                  <div className="room-features">
                    <div className="features-title">Servizi inclusi:</div>
                    <div className="feature-list">
                      <div className="feature-item">Aria condizionata</div>
                      <div className="feature-item">Insonorizzazione</div>
                      <div className="feature-item">Balcone</div>
                      <div className="feature-item">Free Wi-Fi</div>
                      <button className="feature-more">Vedi tutti</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button onClick={onBack} className="btn btn-ghost">
          Indietro
        </button>
        <button className="btn btn-secondary btn-full" disabled>
          Continua
        </button>
      </div>
    </div>
  )
}

export default RoomSelection;
