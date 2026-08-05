/**
 * Student Registration & Edit Modal
 * Handles student contact details and notes
 */
import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, FileText } from 'lucide-react';
import { Student } from '../types';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (student: Student) => void;
  studentToEdit?: Student | null;
}

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  studentToEdit
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+569');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  // Manual active flag (STATUS-REQ-1 / DAL-REQ-5). Falls back to true when a
  // legacy record lacks the field (S1), never falsy-excluding on absence.
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (studentToEdit) {
      setName(studentToEdit.name);
      setPhone(studentToEdit.phone || '+569');
      setEmail(studentToEdit.email || '');
      setNotes(studentToEdit.notes || '');
      setActive(studentToEdit.active !== false);
    } else {
      setName('');
      setPhone('+569');
      setEmail('');
      setNotes('');
      setActive(true);
    }
  }, [studentToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const today = new Date().toISOString().slice(0, 10);
    const generatedId = studentToEdit
      ? studentToEdit.id
      : (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `std-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);

    const newStudent: Student = {
      id: generatedId,
      name: name.trim(),
      phone,
      email,
      registrationDate: studentToEdit ? studentToEdit.registrationDate : today,
      active,
      notes
    };

    onSave(newStudent);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative my-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white font-black text-lg"
        >
          ✕
        </button>

        <div className="flex items-center gap-3">
          <div className="bg-[#7628A6] p-2.5 rounded-xl text-white">
            <User className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase italic">
              {studentToEdit ? 'EDITAR ALUMNO' : 'NUEVO REGISTRO DE ALUMNO'}
            </h3>
            <p className="text-xs text-slate-400">
              Datos de contacto, teléfono y observaciones del alumno.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Nombre Completo */}
          <div>
            <label className="block text-xs font-black text-[#c77dff] uppercase mb-1">
              Nombre Completo *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Camila Muñoz Contreras"
              className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-white font-medium p-3 rounded-xl outline-none"
              required
            />
          </div>

          {/* Teléfono & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-300 uppercase mb-1">
                Teléfono (WhatsApp) *
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+56987654321"
                className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-white font-medium p-3 rounded-xl outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-300 uppercase mb-1">
                Email (Opcional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-white font-medium p-3 rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Notes / Medical details */}
          <div>
            <label className="block text-xs font-black text-slate-300 uppercase mb-1">
              Notas / Lesiones / Observaciones
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Lesión en rodilla, o alumno avanzado..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-white font-medium p-3 rounded-xl outline-none resize-none"
            />
          </div>

          {/* Active flag toggle (STATUS-REQ-1 / DAL-REQ-5) */}
          <div className="flex items-center justify-between gap-4 bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
            <div>
              <span className="block text-xs font-black text-slate-300 uppercase mb-0.5">
                Estado del Alumno
              </span>
              <span className="text-[11px] text-slate-500">
                {active
                  ? 'Activo — participa en clases y finanzas'
                  : 'Inactivo — se muestra con el marcador de inactivo'}
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label="Alternar estado activo/inactivo"
              onClick={() => setActive((a) => !a)}
              className={`relative w-14 h-8 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c77dff] ${
                active ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  active ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-[#7628A6] hover:bg-[#621d8c] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-[#7628A6]/20"
            >
              {studentToEdit ? 'Guardar Cambios' : 'Registrar Alumno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
