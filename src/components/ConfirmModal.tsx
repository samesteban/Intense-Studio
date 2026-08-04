/**
 * ConfirmModal Component - Sleek Confirmation Popup for Delete and Risky Actions
 */
import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  itemName,
  confirmText = 'Sí, Borrar',
  cancelText = 'Cancelar',
  onConfirm,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white italic uppercase tracking-wide">
              {title}
            </h3>
            <p className="text-xs text-red-400 font-semibold flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Confirmación Requerida
            </p>
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-2 text-sm text-slate-300 font-medium">
          <p>{message}</p>
          {itemName && (
            <p className="font-bold text-white bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs">
              "{itemName}"
            </p>
          )}
          <p className="text-xs text-slate-500 italic pt-1">
            Esta acción no se puede deshacer.
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl font-bold text-xs transition border border-slate-700"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs transition shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
