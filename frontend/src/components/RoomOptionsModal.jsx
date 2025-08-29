import React from 'react';

const RoomOptionsModal = ({ isOpen, onClose, onSelectOption }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full">
        <h3 className="text-xl font-semibold mb-4">Seleziona un'opzione di prenotazione</h3>
        <div className="space-y-4">
          {/* Opzione 1 */}
          <div className="border p-4 rounded-lg">
            <h4 className="text-lg font-semibold">Tariffa RIVENDIBILE - Takyon</h4>
            <p className="text-sm text-gray-600 mt-2">
              Se cambi programmi, la rivendi!
            </p>
            <button 
              onClick={() => onSelectOption('rivendibile')}
              className="btn-primary mt-4"
            >
              Prenota
            </button>
          </div>
          {/* Opzione 2 */}
          <div className="border p-4 rounded-lg">
            <h4 className="text-lg font-semibold">Pre-paga solo 1 notte e risparmia</h4>
            <p className="text-sm text-gray-600 mt-2">
              Paga ora solo la prima notte e risparmia al massimo!
            </p>
            <button 
              onClick={() => onSelectOption('pre-paga')}
              className="btn-primary mt-4"
            >
              Prenota
            </button>
          </div>
          {/* Opzione 3 */}
          <div className="border p-4 rounded-lg">
            <h4 className="text-lg font-semibold">TARIFFA SENZA PENSIERI ~ Cancellazione gratuita</h4>
            <p className="text-sm text-gray-600 mt-2">
              Cancella gratis in qualsiasi momento
            </p>
            <button 
              onClick={() => onSelectOption('cancellazione-gratuita')}
              className="btn-primary mt-4"
            >
              Prenota
            </button>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="mt-6 btn-secondary"
        >
          Chiudi
        </button>
      </div>
    </div>
  );
};

export default RoomOptionsModal;

