import React from 'react'
import { Bot, Zap, CheckCircle } from 'lucide-react'
import './LoadingOverlay.css'

const LoadingOverlay = ({ message = 'Caricamento in corso...' }) => {
  return (
    <div className="loading-overlay">
      <div className="loading-modal">
        {/* Background Pattern */}
        <div className="loading-background-pattern"></div>
        
        <div className="loading-content">
          {/* Modern Icon with Animation */}
          <div className="loading-icon-container">
            <div className="loading-icon-bg">
              <Bot className="loading-bot-icon" />
            </div>
            <div className="loading-pulse-ring"></div>
            <div className="loading-pulse-ring loading-pulse-ring-delay"></div>
            
            {/* Floating Action Icons */}
            <div className="loading-action-icons">
              <Zap className="loading-action-icon loading-action-icon-1" />
              <CheckCircle className="loading-action-icon loading-action-icon-2" />
            </div>
          </div>
          
          {/* Main Content */}
          <div className="loading-text-container">
            <h2 className="loading-title">Automazione in corso</h2>
            <p className="loading-message">{message}</p>
            
            {/* Progress Bar */}
            <div className="loading-progress-container">
              <div className="loading-progress-bar">
                <div className="loading-progress-fill"></div>
              </div>
              <span className="loading-progress-text">Analizzando disponibilità...</span>
            </div>
          </div>
          
          {/* Status Info */}
          <div className="loading-status">
            <div className="loading-status-item">
              <span className="loading-status-icon">⚡</span>
              <span className="loading-status-text">Powered by Takyon.io</span>
            </div>
          </div>
          
          {/* Loading Dots */}
          <div className="loading-dots">
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoadingOverlay
