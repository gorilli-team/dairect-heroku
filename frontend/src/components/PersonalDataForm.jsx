import React, { useState } from 'react'
import './PersonalDataForm.css'

const PersonalDataForm = ({ room, searchParams, onSubmit, onBack, loading }) => {
  const [formData, setFormData] = useState({
    firstName: 'Prova',
    lastName: 'Takyon',
    email: 'arbi@gorilli.io',
    acceptNewsletter: false
  })

  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Nome richiesto'
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Cognome richiesto'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email richiesta'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email non valida'
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

  return (
    <div className="personal-data-container">
      {/* Header Section */}
      <div className="personal-data-header">
        <h2 className="personal-data-title">Informazioni personali</h2>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="personal-data-form">
        {/* Nome */}
        <div className="form-group">
          <label className="form-label required">Nome</label>
          <input
            type="text"
            className={`form-input ${errors.firstName ? 'form-input-error' : ''}`}
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="Filippo"
          />
          {errors.firstName && (
            <div className="form-error">{errors.firstName}</div>
          )}
        </div>

        {/* Cognome */}
        <div className="form-group">
          <label className="form-label required">Cognome</label>
          <input
            type="text"
            className={`form-input ${errors.lastName ? 'form-input-error' : ''}`}
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            placeholder="Roveda"
          />
          {errors.lastName && (
            <div className="form-error">{errors.lastName}</div>
          )}
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="form-label required">Email</label>
          <input
            type="email"
            className={`form-input ${errors.email ? 'form-input-error' : ''}`}
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="filorove00@gmail.com"
          />
          {errors.email && (
            <div className="form-error">{errors.email}</div>
          )}
        </div>

        {/* Conferma Email */}
        <div className="form-group">
          <label className="form-label required">Conferma Email</label>
          <input
            type="email"
            className="form-input"
            value={formData.email}
            placeholder="filorove00@gmail.com"
            readOnly
          />
        </div>

        {/* Newsletter Checkbox */}
        <div className="checkbox-wrapper">
          <input
            type="checkbox"
            id="newsletter"
            className="checkbox"
            checked={formData.acceptNewsletter}
            onChange={(e) => handleChange('acceptNewsletter', e.target.checked)}
          />
          <label htmlFor="newsletter" className="checkbox-label">
            Accetto di ricevere newsletter e offerte speciali
          </label>
        </div>

        {/* Privacy Policy Checkbox */}
        <div className="checkbox-wrapper">
          <input
            type="checkbox"
            id="privacy"
            className="checkbox"
            defaultChecked
            required
          />
          <label htmlFor="privacy" className="checkbox-label">
            Acconsento al trattamento dei miei dati personali{' '}
            <a href="#" className="privacy-link">Privacy Policy</a>
          </label>
        </div>
      </form>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button onClick={onBack} className="btn btn-ghost">
          Indietro
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn btn-primary btn-lg btn-full"
        >
          {loading ? 'Elaborazione...' : 'Continua'}
        </button>
      </div>
    </div>
  )
}

export default PersonalDataForm
