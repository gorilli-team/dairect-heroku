import React from 'react'
import { CheckCircle, XCircle, AlertTriangle, Search, Download } from 'lucide-react'
import moment from 'moment'

const BookingResult = ({ result, searchParams, selectedRoom, onNewSearch }) => {
  const isSuccess = result?.success === true
  const hasError = result?.error || result?.success === false

  const getResultIcon = () => {
    if (isSuccess) {
      return <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
    } else if (hasError) {
      return <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
    } else {
      return <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
    }
  }

  const getResultTitle = () => {
    if (isSuccess) {
      return '🎉 Prenotazione Completata!'
    } else if (hasError) {
      return '❌ Prenotazione Fallita'
    } else {
      return '⚠️ Risultato Incerto'
    }
  }

  const getResultMessage = () => {
    if (result?.message) {
      return result.message
    } else if (isSuccess) {
      return 'La tua prenotazione è stata elaborata con successo.'
    } else {
      return 'Si è verificato un errore durante la prenotazione.'
    }
  }

  const formatDate = (dateString) => {
    return moment(dateString).format('DD/MM/YYYY')
  }

  return (
    <div className="card max-w-2xl mx-auto">
      <div className="text-center mb-8">
        {getResultIcon()}
        
        <h2 className="text-3xl font-bold mb-4">
          {getResultTitle()}
        </h2>
        
        <p className="text-lg text-gray-700 mb-6">
          {getResultMessage()}
        </p>
        
        {/* Success Details */}
        {isSuccess && result.bookingReference && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-800 mb-2">
              Dettagli prenotazione:
            </h3>
            <p className="text-green-700">
              <strong>Codice prenotazione:</strong> {result.bookingReference}
            </p>
          </div>
        )}
        
        {/* Error Details */}
        {hasError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-red-800 mb-2">
              Dettagli errore:
            </h3>
            <p className="text-red-700">
              {result.error || 'Errore generico durante il processo di prenotazione'}
            </p>
            {result.errorType && (
              <p className="text-sm text-red-600 mt-2">
                Tipo errore: {result.errorType}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Booking Summary */}
      <div className="bg-gray-50 p-6 rounded-lg mb-8">
        <h3 className="text-lg font-semibold mb-4">Riepilogo prenotazione:</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Hotel:</span>
            <span className="font-medium">Palazzo Vitturi, Venezia</span>
          </div>
          
          {selectedRoom && (
            <div className="flex justify-between">
              <span className="text-gray-600">Camera:</span>
              <span className="font-medium">{selectedRoom.name}</span>
            </div>
          )}
          
          {searchParams && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-600">Check-in:</span>
                <span className="font-medium">{formatDate(searchParams.checkinDate)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Check-out:</span>
                <span className="font-medium">{formatDate(searchParams.checkoutDate)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Ospiti:</span>
                <span className="font-medium">
                  {searchParams.adults} adult{searchParams.adults > 1 ? 'i' : 'o'}
                  {searchParams.children > 0 && `, ${searchParams.children} bambin${searchParams.children > 1 ? 'i' : 'o'}`}
                </span>
              </div>
            </>
          )}
          
          {selectedRoom && (
            <div className="flex justify-between border-t pt-3 mt-3">
              <span className="text-gray-600">Prezzo per notte:</span>
              <span className="font-semibold text-lg">
                {selectedRoom.price} {selectedRoom.currency}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={onNewSearch}
          className="flex-1 btn-primary flex items-center justify-center space-x-2"
        >
          <Search className="h-5 w-5" />
          <span>Nuova Ricerca</span>
        </button>
        
        {isSuccess && (
          <button className="flex-1 btn-secondary flex items-center justify-center space-x-2">
            <Download className="h-5 w-5" />
            <span>Scarica Riepilogo</span>
          </button>
        )}
      </div>

      {/* Additional Info */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">Informazioni sul processo:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>🤖 Automazione guidata da GPT-4</li>
          <li>🎭 Browser headless con Playwright</li>
          <li>🔒 Dati di test utilizzati (nessun pagamento reale)</li>
          <li>📸 Screenshot salvati per debug</li>
        </ul>
      </div>

      {/* Debug Information */}
      {process.env.NODE_ENV === 'development' && result && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
            Mostra dati tecnici (Debug)
          </summary>
          <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

export default BookingResult
