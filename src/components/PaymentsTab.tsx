/**
 * Payments & Memberships Tab
 * Registration of daily, weekly, monthly payments and class packs with digital receipts
 */
import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  FileSpreadsheet,
  Receipt,
  Search,
  Edit2,
  Trash2,
  Lock
} from 'lucide-react';
import { Payment, Student } from '../types';
import { exportIncomeReportToExcel } from '../utils/excelExport';

interface PaymentsTabProps {
  payments: Payment[];
  students: Student[];
  onOpenNewPayment: (defaultStudent?: Student) => void;
  onViewReceipt: (payment: Payment) => void;
  onEditPayment?: (payment: Payment) => void;
  onDeletePayment?: (paymentId: string) => void;
  onLockFinances?: () => void;
}

export const PaymentsTab: React.FC<PaymentsTabProps> = ({
  payments,
  students,
  onOpenNewPayment,
  onViewReceipt,
  onEditPayment,
  onDeletePayment,
  onLockFinances
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('todos');

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase());

    if (methodFilter === 'todos') return matchesSearch;
    return matchesSearch && p.paymentMethod === methodFilter;
  });

  // Calculate stats
  const totalAmount = filteredPayments.reduce((acc, p) => acc + p.amount, 0);

  const handleExportExcel = () => {
    exportIncomeReportToExcel(filteredPayments, 'Historial_Pagos');
  };

  return (
    <div className="space-y-6">
      {/* Header & New Payment CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
        <div>
          <h2 className="text-xl font-black text-white uppercase italic tracking-wide flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-[#c77dff]" />
            <span>MÓDULO DE FINANZAS</span>
          </h2>
          <p className="text-xs text-slate-400">
            Registro de abonos, cobros, ingresos por clases y estado de caja del estudio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onLockFinances && (
            <button
              onClick={onLockFinances}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 transition text-xs flex items-center gap-2"
              title="Bloquear acceso a Finanzas"
            >
              <Lock className="w-4 h-4 text-[#c77dff]" />
              <span className="hidden sm:inline">Bloquear Finanzas</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl transition text-xs flex items-center gap-2 shadow-lg"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => onOpenNewPayment()}
            className="bg-[#7628A6] hover:bg-[#621d8c] text-white font-black px-5 py-2.5 rounded-xl transition text-xs flex items-center gap-2 shadow-lg shadow-[#7628A6]/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Registrar Nuevo Pago</span>
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs font-bold text-slate-400 uppercase">Recaudación Filtrada</div>
          <div className="text-2xl font-black text-[#c77dff] mt-1">
            ${totalAmount.toLocaleString('es-CL')} CLP
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{filteredPayments.length} transacciones registradas</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs font-bold text-slate-400 uppercase">Pagos Efectivo</div>
          <div className="text-xl font-black text-emerald-400 mt-1">
            $
            {payments
              .filter((p) => p.paymentMethod === 'efectivo')
              .reduce((acc, p) => acc + p.amount, 0)
              .toLocaleString('es-CL')}{' '}
            CLP
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Dinero en caja física</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs font-bold text-slate-400 uppercase">Transferencias Bco</div>
          <div className="text-xl font-black text-sky-400 mt-1">
            $
            {payments
              .filter((p) => p.paymentMethod === 'transferencia')
              .reduce((acc, p) => acc + p.amount, 0)
              .toLocaleString('es-CL')}{' '}
            CLP
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Depósitos verificados</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs font-bold text-slate-400 uppercase">Débito / Crédito</div>
          <div className="text-xl font-black text-[#c77dff] mt-1">
            $
            {payments
              .filter((p) => p.paymentMethod === 'debito' || p.paymentMethod === 'credito')
              .reduce((acc, p) => acc + p.amount, 0)
              .toLocaleString('es-CL')}{' '}
            CLP
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Terminal POS / Redelcom</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 relative min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar pago por Alumno o N° Recibo..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-[#7628A6] text-white font-medium pl-10 pr-4 py-2.5 rounded-xl outline-none placeholder:text-slate-500 text-sm"
          />
        </div>

        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
          {['todos', 'efectivo', 'transferencia', 'debito', 'credito'].map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg uppercase transition ${
                methodFilter === m
                  ? 'bg-[#7628A6] text-white font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-black border-b border-slate-800 tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Recibo / Fecha</th>
                <th className="py-3.5 px-4">Alumno</th>
                <th className="py-3.5 px-4">Método</th>
                <th className="py-3.5 px-4">Observaciones</th>
                <th className="py-3.5 px-4">Monto ($ CLP)</th>
                <th className="py-3.5 px-4 text-right">Comprobante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200 font-medium">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No hay registros de cobros coincidentes.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-[#c77dff] text-xs">{p.receiptNumber}</div>
                      <div className="text-[11px] text-slate-500">{p.paymentDate}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-black text-white">{p.studentName}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                        {p.paymentMethod}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-400 italic">
                      {p.notes || '—'}
                    </td>

                    <td className="py-3.5 px-4 font-black text-[#c77dff] text-base">
                      ${p.amount.toLocaleString('es-CL')}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onViewReceipt(p)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-[#c77dff] rounded-lg border border-slate-700 transition inline-flex items-center gap-1 text-xs font-bold"
                          title="Ver / Imprimir Recibo"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Recibo</span>
                        </button>

                        {onEditPayment && (
                          <button
                            onClick={() => onEditPayment(p)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition inline-flex items-center gap-1 text-xs font-bold"
                            title="Editar Pago"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-[#c77dff]" />
                            <span>Editar</span>
                          </button>
                        )}

                        {onDeletePayment && (
                          <button
                            onClick={() => onDeletePayment(p.id)}
                            className="p-2 bg-slate-800 hover:bg-red-950/80 text-red-400 border border-slate-700 hover:border-red-500/50 rounded-lg transition inline-flex items-center gap-1 text-xs font-bold"
                            title="Eliminar Pago"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Borrar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
