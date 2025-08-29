import React, { useState } from 'react'
import { Phone, CreditCard, ArrowLeft, Calendar, Users, Euro, MapPin, Shield } from 'lucide-react'
import './PaymentForm.css'

const PaymentForm = ({ room, onSubmit, onBack, loading }) => {
  const [formData, setFormData] = useState({
    phone: '3246987461',
    cardNumber: '4444333322221111',
    expiryMonth: '06',
    expiryYear: '2027',
    cardHolder: 'Prova Takyon' // Campo titolare carta richiesto
  })

  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}

    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefono richiesto'
    }

    if (!formData.cardNumber.trim()) {
      newErrors.cardNumber = 'Numero carta richiesto'
    } else if (formData.cardNumber.replace(/\s/g, '').length !== 16) {
      newErrors.cardNumber = 'Numero carta deve essere di 16 cifre'
    }

    if (!formData.cardHolder.trim()) {
      newErrors.cardHolder = 'Titolare carta richiesto'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (validateForm() && !loading) {
      onSubmit(formData)
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

  const formatCardNumber = (value) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')
    // Add spaces every 4 digits
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  return (
    <div className="payment-form-container">
      {/* Header */}
      <div className="payment-header">
        <button onClick={onBack} className="payment-back-btn">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="payment-title">Dati di pagamento</h2>
      </div>

      {/* Clean Booking Summary */}
      <div className="booking-summary-card">
        <h3 className="booking-summary-title">
          <MapPin className="h-5 w-5" />
          Riepilogo della tua prenotazione
        </h3>
        
        <div className="booking-summary-content">
          {/* Stay Information */}
          <div className="summary-section">
            <h4 className="summary-section-title">
              <Calendar className="h-4 w-4" />
              Date soggiorno
            </h4>
            
            <div className="summary-info-grid">
              <div className="summary-info-item">
                <span className="summary-info-label">Check-in</span>
                <span className="summary-info-value">
                  {room.summaryStructured?.checkinDate || 'venerdì 3 apr 2026'}
                </span>
              </div>
              
              <div className="summary-info-item">
                <span className="summary-info-label">Check-out</span>
                <span className="summary-info-value">
                  {room.summaryStructured?.checkoutDate || 'domenica 5 apr 2026'}
                </span>
              </div>
              
              <div className="summary-info-item">
                <span className="summary-info-label">Notti</span>
                <span className="summary-info-value">
                  {room.summaryStructured?.nights || '2'}
                </span>
              </div>
              
              <div className="summary-info-item">
                <span className="summary-info-label">Ospiti</span>
                <span className="summary-info-value">
                  {room.summaryStructured?.guests || '2 Adulti'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Room & Rate Information */}
          <div className="summary-section">
            <h4 className="summary-section-title">
              <MapPin className="h-4 w-4" />
              Camera & Tariffa
            </h4>
            
            <div className="summary-info-item">
              <span className="summary-info-label">Camera selezionata</span>
              <span className="summary-info-value">
                {room.summaryStructured?.roomName || room.name || 'Camera Luxury Matrimoniale o Doppia con Letti singoli'}
              </span>
            </div>
            
            <div className="summary-info-item">
              <span className="summary-info-label">Trattamento</span>
              <span className="summary-info-value">
                {room.summaryStructured?.mealPlan || 'Pernottamento e prima colazione'}
              </span>
            </div>
            
            {room.summaryStructured?.refundability && (
              <div className="summary-info-item">
                <span className="summary-info-label">Rimborso</span>
                <span className="summary-info-value text-sm" style={{ color: 'var(--color-orange-700)' }}>
                  {room.summaryStructured.refundability}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Pricing Summary */}
        <div className="summary-pricing">
          <div className="pricing-row">
            <span className="pricing-label">Camera</span>
            <span className="pricing-value">
              {room.summaryStructured?.roomPriceFormatted || '€ 443'}
            </span>
          </div>
          
          {room.summaryStructured?.taxes && (
            <div className="pricing-row">
              <span className="pricing-label">
                {room.summaryStructured.taxes.description || 'Tassa di soggiorno'}
              </span>
              <span className="pricing-value">
                {room.summaryStructured.taxes.amountFormatted || '€ 11,20'}
              </span>
            </div>
          )}
          
          <div className="pricing-row pricing-total">
            <span className="pricing-label">Totale da pagare</span>
            <span className="pricing-value">
              {room.summaryStructured?.totalPriceFormatted || '€ 454,20'}
            </span>
          </div>
        </div>
        
        {/* Security Notice */}
        <div className="security-notice">
          <div className="security-notice-title">
            <Shield className="h-4 w-4" />
            Pagamento sicuro
          </div>
          <p className="security-notice-text">
            I tuoi dati di pagamento sono protetti da crittografia SSL. Il pagamento sarà elaborato in modo sicuro.
          </p>
        </div>
      </div>

      {/* Form Sections */}
      <form onSubmit={handleSubmit}>
        {/* Phone Section */}
        <div className="form-section">
          <h3 className="form-section-title">
            <Phone className="h-5 w-5" />
            Numero di telefono
          </h3>

          <div className="input-group">
            <label className="input-label input-required">
              <Phone className="h-4 w-4" />
              Telefono
            </label>
            <input
              type="tel"
              className={`input-field ${errors.phone ? 'error' : ''}`}
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+39 123 456 7890"
            />
            {errors.phone && (
              <p className="input-error">{errors.phone}</p>
            )}
          </div>
        </div>

        {/* Card Details Section */}
        <div className="form-section">
          <h3 className="form-section-title">
            <CreditCard className="h-5 w-5" />
            Dettagli della carta
          </h3>

          <div className="input-group">
            <label className="input-label input-required">
              Numero carta
            </label>
            <input
              type="text"
              className={`input-field ${errors.cardNumber ? 'error' : ''}`}
              value={formatCardNumber(formData.cardNumber)}
              onChange={(e) => handleChange('cardNumber', e.target.value.replace(/\s/g, ''))}
              placeholder="4111 1111 1111 1111"
              maxLength="19"
            />
            {errors.cardNumber && (
              <p className="input-error">{errors.cardNumber}</p>
            )}
          </div>

          <div className="form-grid">
            <div className="input-group">
              <label className="input-label input-required">
                Mese scadenza
              </label>
              <select
                className="input-field"
                value={formData.expiryMonth}
                onChange={(e) => handleChange('expiryMonth', e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const month = (i + 1).toString().padStart(2, '0')
                  return (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label input-required">
                Anno scadenza
              </label>
              <select
                className="input-field"
                value={formData.expiryYear}
                onChange={(e) => handleChange('expiryYear', e.target.value)}
              >
                {Array.from({ length: 10 }, (_, i) => {
                  const year = (new Date().getFullYear() + i).toString()
                  return (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label input-required">
              Titolare carta
            </label>
            <input
              type="text"
              className={`input-field ${errors.cardHolder ? 'error' : ''}`}
              value={formData.cardHolder}
              onChange={(e) => handleChange('cardHolder', e.target.value)}
              placeholder="Mario Rossi"
            />
            {errors.cardHolder && (
              <p className="input-error">{errors.cardHolder}</p>
            )}
          </div>
        </div>

        {/* Terms */}
        <div className="terms-section">
          <p className="terms-text">
            Procedendo con il pagamento, confermi di accettare i termini e le condizioni dell'hotel.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="payment-submit-btn"
        >
          <CreditCard className="h-5 w-5" />
          <span>{loading ? 'Elaborazione...' : 'Completa pagamento'}</span>
        </button>
      </form>
    </div>
  )
}

export default PaymentForm

