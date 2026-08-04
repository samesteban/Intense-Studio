/**
 * PIN Verification Modal for Protected Sections (e.g. Finanzas)
 */
import React, { useState, useEffect } from 'react';
import { Lock, X, Delete, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  requiredPin?: string;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  requiredPin = '0108'
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(false);
      
      // Auto verify when 4 digits are entered
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const verifyPin = (pinToVerify: string) => {
    if (pinToVerify === requiredPin) {
      setError(false);
      onSuccess();
      onClose();
    } else {
      setError(true);
      setErrorMessage('PIN incorrecto. Intente nuevamente.');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-[#7628A6]/20 text-[#c77dff] rounded-2xl mx-auto flex items-center justify-center border border-[#7628A6]/40 shadow-lg shadow-[#7628A6]/10">
            <Lock className="w-7 h-7 stroke-[2.5]" />
          </div>
          <h3 className="text-xl font-black text-white uppercase italic tracking-wide">
            ACCESO PROTEGIDO
          </h3>
          <p className="text-xs text-slate-400">
            Ingrese el PIN de seguridad de 4 dígitos para acceder al área de <span className="text-[#c77dff] font-bold">Finanzas</span>.
          </p>
        </div>

        {/* PIN Display (4 Dots or Digits) */}
        <div className="flex justify-center items-center gap-3 py-2">
          {[0, 1, 2, 3].map((idx) => {
            const hasValue = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-11 h-13 rounded-2xl border-2 flex items-center justify-center text-xl font-mono font-black transition-all ${
                  error
                    ? 'border-red-500 bg-red-950/20 text-red-400 animate-shake'
                    : hasValue
                    ? 'border-[#7628A6] bg-[#7628A6]/20 text-[#c77dff] shadow-md shadow-[#7628A6]/20'
                    : 'border-slate-800 bg-slate-950 text-slate-600'
                }`}
              >
                {hasValue ? '•' : ''}
              </div>
            );
          })}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-950/40 border border-red-500/40 text-red-400 text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-bold text-center">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-black text-lg rounded-2xl border border-slate-800 hover:border-[#7628A6]/50 transition active:scale-95 shadow-md"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => setPin('')}
            className="py-3.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded-2xl border border-slate-800 transition active:scale-95"
          >
            Borrar
          </button>
          <button
            onClick={() => handleKeyPress('0')}
            className="py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-black text-lg rounded-2xl border border-slate-800 hover:border-[#7628A6]/50 transition active:scale-95 shadow-md"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="py-3.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white font-bold rounded-2xl border border-slate-800 flex items-center justify-center transition active:scale-95"
            title="Eliminar carácter"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
