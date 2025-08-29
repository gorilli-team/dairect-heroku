import React from 'react'
import { Hotel, RefreshCw } from 'lucide-react'

const Header = ({ onReset }) => {
  return (
    <header className="gradient-bg text-white shadow-lg">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Hotel className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold text-shadow">
                Hotel Booking Automation
              </h1>
              <p className="text-blue-100 text-sm">
                SimpleBooking Automation - Palazzo Vitturi, Venezia
              </p>
            </div>
          </div>
          
          <button
            onClick={onReset}
            className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 
                     px-4 py-2 rounded-lg transition-colors duration-200"
            title="Resetta sessione"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden md:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
