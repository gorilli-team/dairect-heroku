import React from 'react'
import { Check } from 'lucide-react'

const StepIndicator = ({ steps, currentStepIndex }) => {
  return (
    <div className="flex items-center justify-between w-full max-w-3xl mx-auto">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          {/* Step Circle */}
          <div className="flex flex-col items-center">
            <div
              className={`step-indicator ${
                index < currentStepIndex
                  ? 'step-completed'
                  : index === currentStepIndex
                  ? 'step-active'
                  : 'step-inactive'
              }`}
            >
              {index < currentStepIndex ? (
                <Check className="h-4 w-4" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <div className="mt-2 text-center">
              <div
                className={`font-medium text-sm ${
                  index <= currentStepIndex ? 'text-booking-blue' : 'text-gray-400'
                }`}
              >
                {step.title}
              </div>
              <div className="text-xs text-gray-500 hidden sm:block">
                {step.description}
              </div>
            </div>
          </div>

          {/* Connector Line */}
          {index < steps.length - 1 && (
            <div className="flex-1 mx-4">
              <div
                className={`h-1 rounded-full ${
                  index < currentStepIndex
                    ? 'bg-green-500'
                    : index === currentStepIndex
                    ? 'bg-booking-blue'
                    : 'bg-gray-300'
                }`}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

export default StepIndicator
