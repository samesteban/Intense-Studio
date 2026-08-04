/**
 * Payment Processing Modal
 * Handles recording cash/transfer/card payments for students
 */
import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Calendar, Check, User, ChevronDown } from 'lucide-react';
import { AttendanceRecord, Payment, PaymentMethod, Student } from '../types';
import { calculateStudentFinances } from '../utils/pricing';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  attendances?: AttendanceRecord[];
  payments?: Payment[];
  defaultStudent?: Student | null;
  paymentToEdit?: Payment | null;
  onProcessPayment: (payment: Payment) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  students,
  attendances = [],
  payments = [],
  defaultStudent,
  paymentToEdit,
  onProcessPayment
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [amount, setAmount] = useState(2500);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (paymentToEdit) {
      setSelectedStudentId(paymentToEdit.studentId);
      setAmount(paymentToEdit.amount);
      setPaymentMethod(paymentToEdit.paymentMethod);
      setPaymentDate(paymentToEdit.paymentDate || new Date().toISOString().slice(0, 10));
      setNotes(paymentToEdit.notes || '');
    } else {
      let activeId = '';
      if (defaultStudent) {
        activeId = defaultStudent.id;
      } else if (students.length > 0) {
        activeId = students[0].id;
      }

      setSelectedStudentId(activeId);
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setNotes('');

      if (activeId) {
        const fin = calculateStudentFinances(activeId, attendances, payments);
        setAmount(fin.debt > 0 ? fin.debt : 2500);
      }
    }
  }, [defaultStudent, paymentToEdit, students, isOpen]);

  const handleStudentSelect = (id: string) => {
    setSelectedStudentId(id);
    if (!paymentToEdit) {
      const fin = calculateStudentFinances(id, attendances, payments);
      setAmount(fin.debt > 0 ? fin.debt : 2500);
    }
  };

  if (!isOpen) return null;

  const currentFinances = selectedStudentId
    ? calculateStudentFinances(selectedStudentId, attendances, payments)
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const student = students.find((s) => s.id === selectedStudentId);
    if (!student) return;

    if (paymentToEdit) {
      const updatedPayment: Payment = {
        ...paymentToEdit,
        studentId: student.id,
        studentName: student.name,
        amount,
        paymentMethod,
        paymentDate: paymentDate || paymentToEdit.paymentDate,
        notes
      };
      onProcessPayment(updatedPayment);
    } else {
      const today = paymentDate || new Date().toISOString().slice(0, 10);
      const receiptNum = `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const newPayment: Payment = {
        id: `pay-${Date.now()}`,
        studentId: student.id,
        studentName: student.name,
        amount,
        paymentMethod,
        paymentDate: today,
        receiptNumber: receiptNum,
        notes
      };

      onProcessPayment(newPayment);
    }
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
            <CreditCard className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase italic">
              {paymentToEdit ? 'EDITAR REGISTRO DE PAGO' : 'REGISTRAR PAGO'}
            </h3>
            <p className="text-xs text-slate-400">
              {paymentToEdit ? 'Modifique los datos o monto de este comprobante.' : 'Ingreso de abono o pago de clases asistidas.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Student Selector */}
          <div>
            <label className="block text-xs font-black text-[#c77dff] uppercase mb-1">
              Seleccionar Alumno *
            </label>
            <div className="relative">
              <select
                value={selectedStudentId}
                onChange={(e) => handleStudentSelect(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-white font-bold p-3 pr-10 rounded-xl outline-none appearance-none disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-900/60"
                required
                disabled={!!defaultStudent || !!paymentToEdit}
              >
                {students.map((s) => {
                  const fin = calculateStudentFinances(s.id, attendances, payments);
                  const statusText = fin.debt > 0 ? `DEUDA: $${fin.debt.toLocaleString('es-CL')}` : 'AL DÍA';
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} — {statusText}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Current Debt Card */}
          {currentFinances && !paymentToEdit && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Asistencias registradas:</span>
                <span className="font-bold text-white">{currentFinances.totalAttendances} clases</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Costo total calculado:</span>
                <span className="font-mono font-bold text-white">${currentFinances.totalCost.toLocaleString('es-CL')} CLP</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Total pagado a la fecha:</span>
                <span className="font-mono font-bold text-emerald-400">${currentFinances.totalPaid.toLocaleString('es-CL')} CLP</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-xs font-black uppercase text-slate-300">Saldo Pendiente:</span>
                <span className={`font-mono text-base font-black ${currentFinances.debt > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  ${currentFinances.debt.toLocaleString('es-CL')} CLP
                </span>
              </div>
            </div>
          )}

          {/* Amount, Payment Method & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-300 uppercase mb-1">
                Monto ($ CLP) *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-[#c77dff] font-black text-base p-3 rounded-xl outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-300 uppercase mb-1">
                Método de Pago *
              </label>
              <div className="relative">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-white font-bold p-3 pr-10 rounded-xl outline-none uppercase appearance-none"
                >
                  <option value="efectivo">Efectivo Caja</option>
                  <option value="transferencia">Transferencia Bco</option>
                  <option value="debito">Tarjeta Débito</option>
                  <option value="credito">Tarjeta Crédito</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300 uppercase mb-1">
              Fecha del Pago *
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-white font-bold p-3 rounded-xl outline-none [color-scheme:dark]"
              style={{ colorScheme: 'dark' }}
              required
            />
          </div>

          {/* Quick Amount Presets */}
          {!paymentToEdit && (
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-400">Sugerencias rápidas:</label>
              <div className="flex flex-wrap gap-2">
                {[2500, 2000, 6000, 10000, 20000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-mono font-bold text-slate-300 rounded-lg"
                  >
                    ${preset.toLocaleString('es-CL')}
                  </button>
                ))}
                {currentFinances && currentFinances.debt > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(currentFinances.debt)}
                    className="px-2.5 py-1 bg-[#7628A6]/30 border border-[#7628A6] text-xs font-mono font-bold text-[#c77dff] rounded-lg"
                  >
                    Pagar Deuda Total (${currentFinances.debt.toLocaleString('es-CL')})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-black text-slate-300 uppercase mb-1">
              Observaciones / N° Comprobante
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Depósito BancoEstado o Comprobante POS"
              className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-white font-medium p-3 rounded-xl outline-none"
            />
          </div>

          {/* Submit */}
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
              {paymentToEdit ? 'Guardar Cambios' : 'Confirmar Pago y Emitir Recibo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
