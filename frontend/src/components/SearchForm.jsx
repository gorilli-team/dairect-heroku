import React, { useState, useEffect } from 'react'
import { Calendar, Users, Search, Hotel, MapPin, Star, ChevronDown, ChevronUp } from 'lucide-react'
import moment from 'moment'
import './SearchForm.css'

// Hotel configuration
const HOTELS = [
  {
    id: 'palazzo-vitturi',
    name: 'Hotel Palazzo Vitturi',
    location: 'Venezia, Italia',
    emoji: '🏛️',
    rating: 4.8,
    reviews: 645,
    baseUrl: 'https://www.simplebooking.it/ibe2/hotel/1467?lang=IT&cur=EUR',
    description: 'Elegante palazzo storico nel cuore di Venezia',
    image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'hotel-niccolo-v',
    name: 'Hotel Niccolò V 4S',
    location: 'Viterbo, Italia',
    emoji: '🌿',
    rating: 4.6,
    reviews: 328,
    baseUrl: 'https://www.simplebooking.it/ibe2/hotel/7304?lang=IT&cur=EUR',
    description: 'Hotel 4 stelle con centro benessere termale',
    image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'castello-san-marco',
    name: 'Castello San Marco Hotel & SPA',
    location: 'Calatabiano, Sicilia',
    emoji: '🏰',
    rating: 4.7,
    reviews: 891,
    baseUrl: 'https://www.simplebooking.it/ibe2/hotel/10118?lang=IT&cur=EUR',
    description: 'Resort di charme con SPA ai piedi dell\'Etna',
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  }
];

const SearchForm = ({ onSearch, loading, initialData }) => {
  const [formData, setFormData] = useState({
    hotel: HOTELS[0], // Default to first hotel
    checkinDate: '',
    checkoutDate: '',
    adults: 2,
    children: 0
  })

  const [errors, setErrors] = useState({})
  const [isHotelDropdownOpen, setIsHotelDropdownOpen] = useState(false)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isHotelDropdownOpen && !event.target.closest('.hotel-selector')) {
        setIsHotelDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isHotelDropdownOpen])

  // Set default dates on mount
  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    } else {
      // Use preset test dates for faster testing
      setFormData(prev => ({
        ...prev,
        checkinDate: '2026-04-03',
        checkoutDate: '2026-04-05'
      }))
    }
  }, [initialData])

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.checkinDate) {
      newErrors.checkinDate = 'Data check-in richiesta'
    }
    
    if (!formData.checkoutDate) {
      newErrors.checkoutDate = 'Data check-out richiesta'
    }
    
    if (formData.checkinDate && formData.checkoutDate) {
      const checkin = moment(formData.checkinDate)
      const checkout = moment(formData.checkoutDate)
      
      if (checkin.isBefore(moment(), 'day')) {
        newErrors.checkinDate = 'La data di check-in non può essere nel passato'
      }
      
      if (checkout.isSameOrBefore(checkin)) {
        newErrors.checkoutDate = 'La data di check-out deve essere successiva al check-in'
      }
    }
    
    if (formData.adults < 1 || formData.adults > 6) {
      newErrors.adults = 'Numero adulti deve essere tra 1 e 6'
    }
    
    if (formData.children < 0 || formData.children > 4) {
      newErrors.children = 'Numero bambini deve essere tra 0 e 4'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (validateForm() && !loading) {
      onSearch(formData)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }))
    }
  }

  const getDaysDifference = () => {
    if (formData.checkinDate && formData.checkoutDate) {
      const checkin = moment(formData.checkinDate)
      const checkout = moment(formData.checkoutDate)
      return checkout.diff(checkin, 'days')
    }
    return 0
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Hotel Selection - Compact Dropdown */}
      <div className="form-group">
        <label className="form-label">Seleziona Hotel</label>
        <div className="hotel-selector">
          {/* Selected Hotel Display */}
          <button
            type="button"
            className="hotel-selected-display"
            onClick={() => setIsHotelDropdownOpen(!isHotelDropdownOpen)}
          >
            <div className="hotel-selected-info">
              <div className="hotel-selected-main">
                <span className="hotel-emoji">{formData.hotel.emoji}</span>
                <div className="hotel-selected-text">
                  <span className="hotel-selected-name">{formData.hotel.name}</span>
                  <span className="hotel-selected-location">
                    <MapPin className="location-icon-small" />
                    {formData.hotel.location}
                  </span>
                </div>
              </div>
              <div className="hotel-rating-compact">
                <Star className="rating-icon-small" />
                <span className="rating-value-small">{formData.hotel.rating}</span>
              </div>
            </div>
            {isHotelDropdownOpen ? (
              <ChevronUp className="dropdown-chevron" />
            ) : (
              <ChevronDown className="dropdown-chevron" />
            )}
          </button>

          {/* Dropdown List */}
          {isHotelDropdownOpen && (
            <div className="hotel-dropdown-list">
              {HOTELS.map((hotel) => (
                <button
                  key={hotel.id}
                  type="button"
                  className={`hotel-dropdown-item ${
                    formData.hotel.id === hotel.id ? 'hotel-dropdown-item-selected' : ''
                  }`}
                  onClick={() => {
                    handleChange('hotel', hotel)
                    setIsHotelDropdownOpen(false)
                  }}
                >
                  <div className="hotel-dropdown-main">
                    <span className="hotel-emoji">{hotel.emoji}</span>
                    <div className="hotel-dropdown-text">
                      <span className="hotel-dropdown-name">{hotel.name}</span>
                      <span className="hotel-dropdown-location">
                        <MapPin className="location-icon-small" />
                        {hotel.location}
                      </span>
                      <span className="hotel-dropdown-description">{hotel.description}</span>
                    </div>
                  </div>
                  <div className="hotel-dropdown-rating">
                    <Star className="rating-icon-small" />
                    <span className="rating-value-small">{hotel.rating}</span>
                    <span className="rating-reviews-small">({hotel.reviews})</span>
                  </div>
                  {formData.hotel.id === hotel.id && (
                    <div className="hotel-dropdown-selected-indicator">
                      <div className="selected-check">✓</div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Date Selection */}
      <div className="form-group">
        <div className="date-grid">
          <div>
            <label className="form-label required">Check-in</label>
            <div className="date-input-wrapper">
              <Calendar className="date-icon" />
              <input
                type="date"
                className={`form-input date-input ${errors.checkinDate ? 'form-input-error' : ''}`}
                value={formData.checkinDate}
                onChange={(e) => handleChange('checkinDate', e.target.value)}
                min={moment().format('YYYY-MM-DD')}
              />
            </div>
            {errors.checkinDate && (
              <div className="form-error">{errors.checkinDate}</div>
            )}
          </div>

          <div>
            <label className="form-label required">Check-out</label>
            <div className="date-input-wrapper">
              <Calendar className="date-icon" />
              <input
                type="date"
                className={`form-input date-input ${errors.checkoutDate ? 'form-input-error' : ''}`}
                value={formData.checkoutDate}
                onChange={(e) => handleChange('checkoutDate', e.target.value)}
                min={formData.checkinDate || moment().format('YYYY-MM-DD')}
              />
            </div>
            {errors.checkoutDate && (
              <div className="form-error">{errors.checkoutDate}</div>
            )}
          </div>
        </div>
      </div>

      {/* Guests Selection */}
      <div className="form-group">
        <div className="guests-grid">
          <div>
            <label className="form-label required">Adulti</label>
            <div className="counter-wrapper">
              <button
                type="button"
                className="counter-btn"
                onClick={() => handleChange('adults', Math.max(1, formData.adults - 1))}
                disabled={formData.adults <= 1}
              >
                −
              </button>
              <div className="counter-display">
                <span className="counter-value">{formData.adults}</span>
                <span className="counter-label">adult{formData.adults > 1 ? 'i' : 'o'}</span>
              </div>
              <button
                type="button"
                className="counter-btn"
                onClick={() => handleChange('adults', Math.min(6, formData.adults + 1))}
                disabled={formData.adults >= 6}
              >
                +
              </button>
            </div>
            {errors.adults && (
              <div className="form-error">{errors.adults}</div>
            )}
          </div>

          <div>
            <label className="form-label">Bambini</label>
            <div className="counter-wrapper">
              <button
                type="button"
                className="counter-btn"
                onClick={() => handleChange('children', Math.max(0, formData.children - 1))}
                disabled={formData.children <= 0}
              >
                −
              </button>
              <div className="counter-display">
                <span className="counter-value">{formData.children}</span>
                <span className="counter-label">
                  {formData.children === 0 ? 'bambini' : `bambin${formData.children > 1 ? 'i' : 'o'}`}
                </span>
              </div>
              <button
                type="button"
                className="counter-btn"
                onClick={() => handleChange('children', Math.min(4, formData.children + 1))}
                disabled={formData.children >= 4}
              >
                +
              </button>
            </div>
            {errors.children && (
              <div className="form-error">{errors.children}</div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Summary */}
      {getDaysDifference() > 0 && (
        <div className="booking-summary">
          <div className="summary-content">
            <div className="summary-icon">🏨</div>
            <div>
              <div className="summary-title">Riepilogo prenotazione</div>
              <div className="summary-details">
                {getDaysDifference()} nott{getDaysDifference() > 1 ? 'i' : 'e'} • {' '}
                {formData.adults + formData.children} person{formData.adults + formData.children > 1 ? 'e' : 'a'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary btn-lg btn-full search-button"
      >
        {loading ? (
          <>
            <div className="loading-spinner-small" />
            <span>Ricerca in corso...</span>
          </>
        ) : (
          <>
            <Search className="search-icon" />
            <span>Cerca camere disponibili</span>
          </>
        )}
      </button>

      {/* Features */}
      <div className="features-section">
        <div className="features-title">Powered by Takyon.io</div>
        <div className="features-grid">
          <div className="feature">
            <span className="feature-icon">⚡</span>
            <span className="feature-text">Automazione avanzata</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🔒</span>
            <span className="feature-text">Sicuro e affidabile</span>
          </div>
          <div className="feature">
            <span className="feature-icon">💎</span>
            <span className="feature-text">Miglior prezzo garantito</span>
          </div>
        </div>
      </div>
    </form>
  )
}

export default SearchForm
