/**
 * Student Profile & Details Full Screen View
 * Detailed screen showing student contact info, financial KPIs, and timeline/mini-cards of attended classes organized by date.
 */
import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Clock,
  MessageSquare,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Search,
  Dumbbell,
  Edit2,
  CalendarCheck,
  TrendingUp,
  Receipt,
  Tag,
  Trash2
} from 'lucide-react';
import { AttendanceRecord, Payment, Student } from '../types';
import { getWhatsAppLink } from '../utils/whatsapp';
import { calculateStudentFinances } from '../utils/pricing';

interface StudentProfileViewProps {
  student: Student;
  payments: Payment[];
  attendances: AttendanceRecord[];
  onBack: () => void;
  onOpenPaymentModal: (student: Student) => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent?: (studentId: string) => void;
  onViewReceipt?: (payment: Payment) => void;
  onEditPayment?: (payment: Payment) => void;
  onDeletePayment?: (paymentId: string) => void;
}

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  student,
  payments,
  attendances,
  onBack,
  onOpenPaymentModal,
  onEditStudent,
  onDeleteStudent,
  onViewReceipt,
  onEditPayment,
  onDeletePayment
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('todos');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [activeSubTab, setActiveSubTab] = useState<'clases' | 'pagos'>('clases');

  // Filter payments and attendances for this student
  const studentPayments = useMemo(() => {
    return payments
      .filter((p) => p.studentId === student.id)
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }, [payments, student.id]);

  const studentAttendances = useMemo(() => {
    return attendances.filter((a) => a.studentId === student.id);
  }, [attendances, student.id]);

  // Overall financial calculation
  const finances = useMemo(() => {
    return calculateStudentFinances(student.id, attendances, payments);
  }, [student.id, attendances, payments]);

  // KPI 1: Classes attended in the current month (e.g. YYYY-MM)
  const currentMonthKey = new Date().toISOString().slice(0, 7); // e.g. "2026-08"
  const currentMonthName = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  const classesThisMonth = useMemo(() => {
    return studentAttendances.filter((a) => a.date.startsWith(currentMonthKey)).length;
  }, [studentAttendances, currentMonthKey]);

  // KPI 2: Latest payment made
  const latestPayment = studentPayments.length > 0 ? studentPayments[0] : null;

  // KPI 3: Pending debt
  const pendingDebt = finances.debt;

  // Map itemized pricing rules to attendance IDs for mini card displays
  const itemizedMap = useMemo(() => {
    const map = new Map<string, { unitPrice: number; appliedRule: string }>();
    finances.itemizedAttendances.forEach((item) => {
      map.set(item.attendanceId, {
        unitPrice: item.unitPrice,
        appliedRule: item.appliedRule
      });
    });
    return map;
  }, [finances]);

  // Extract unique months for filter
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    studentAttendances.forEach((a) => set.add(a.date.substring(0, 7)));
    return Array.from(set).sort().reverse();
  }, [studentAttendances]);

  // Filtered & Sorted Attendances for display
  const processedAttendances = useMemo(() => {
    let list = [...studentAttendances];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (a) =>
          a.className.toLowerCase().includes(q) ||
          a.date.includes(q) ||
          a.time.includes(q)
      );
    }

    if (monthFilter !== 'todos') {
      list = list.filter((a) => a.date.startsWith(monthFilter));
    }

    list.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [studentAttendances, searchTerm, monthFilter, sortOrder]);

  // Group attendances by Date string for organized presentation
  const groupedByDate = useMemo(() => {
    const groups: { dateStr: string; items: AttendanceRecord[] }[] = [];
    const map = new Map<string, AttendanceRecord[]>();

    processedAttendances.forEach((att) => {
      if (!map.has(att.date)) {
        map.set(att.date, []);
      }
      map.get(att.date)!.push(att);
    });

    map.forEach((items, dateStr) => {
      groups.push({ dateStr, items });
    });

    return groups;
  }, [processedAttendances]);

  const waLink = getWhatsAppLink(
    student.phone,
    `Hola ${student.name}, te escribimos de Intense Studio. Saludos de nuestro equipo de entrenadores.`
  );

  return (
    <div className="space-y-6">
      {/* Top Navigation & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition flex items-center gap-2 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4 text-[#c77dff]" />
            <span>Volver</span>
          </button>

          <div>
            <h2 className="text-xl font-black text-white uppercase italic tracking-wide flex items-center gap-2">
              <span>FICHA Y REGISTRO DEL ALUMNO</span>
            </h2>
            <p className="text-xs text-slate-400">
              Detalle completo de asistencia, métricas del mes en curso e historial de pagos.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 rounded-xl border border-emerald-500/30 transition text-xs font-bold flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>

          <button
            onClick={() => onEditStudent(student)}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition text-xs font-bold flex items-center gap-2 border border-slate-700"
          >
            <Edit2 className="w-4 h-4 text-[#c77dff]" />
            <span className="hidden sm:inline">Editar Datos</span>
          </button>

          {onDeleteStudent && (
            <button
              onClick={() => onDeleteStudent(student.id)}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-red-950/80 text-red-400 border border-slate-700 hover:border-red-500/50 rounded-xl transition text-xs font-bold flex items-center gap-2"
              title="Eliminar Alumno"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Borrar</span>
            </button>
          )}

          <button
            onClick={() => onOpenPaymentModal(student)}
            className="px-4 py-2.5 bg-[#7628A6] hover:bg-[#621d8c] text-white font-black text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-[#7628A6]/20"
          >
            <CreditCard className="w-4 h-4" />
            <span>Cobrar / Registrar Pago</span>
          </button>
        </div>
      </div>

      {/* Student Identity Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#7628A6] text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-[#7628A6]/30 border-2 border-[#c77dff]/30">
              {student.name.substring(0, 2).toUpperCase()}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-white leading-tight">{student.name}</h1>
                {finances.status === 'al_dia' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2.5 py-1 rounded-full uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Al Día
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2.5 py-1 rounded-full uppercase">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Con Deuda
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-1">
                <span className="flex items-center gap-1 text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {student.phone}
                </span>
                {student.email && (
                  <span className="flex items-center gap-1 text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {student.email}
                  </span>
                )}
                <span className="flex items-center gap-1 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Ingreso: {student.registrationDate}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes if any */}
        {student.notes && (
          <div className="mt-4 bg-slate-950 p-3 rounded-xl border border-amber-500/30 text-xs text-amber-200/90 italic flex items-center gap-2">
            <span className="font-bold text-amber-400 not-italic uppercase text-[10px]">Observación:</span>
            <span>"{student.notes}"</span>
          </div>
        )}
      </div>

      {/* KPI CARDS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: Clases en el Mes en Curso */}
        <div className="bg-slate-900 border border-slate-800 hover:border-[#7628A6]/40 p-5 rounded-2xl shadow-xl space-y-2 relative overflow-hidden transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Asistencias Mes En Curso
            </span>
            <div className="p-2 bg-[#7628A6]/20 text-[#c77dff] rounded-xl">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{classesThisMonth}</span>
            <span className="text-xs text-[#c77dff] font-bold">clases</span>
          </div>

          <p className="text-[11px] text-slate-400 capitalize">
            Asistencias registradas en {currentMonthName}
          </p>
        </div>

        {/* KPI 2: Último Pago Realizado */}
        <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 p-5 rounded-2xl shadow-xl space-y-2 relative overflow-hidden transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Último Pago Realizado
            </span>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          {latestPayment ? (
            <div>
              <div className="text-3xl font-black text-emerald-400 font-mono">
                ${latestPayment.amount.toLocaleString('es-CL')} CLP
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Fecha: <span className="font-bold text-slate-200">{latestPayment.paymentDate}</span> ({latestPayment.paymentMethod.toUpperCase()})
              </p>
            </div>
          ) : (
            <div>
              <div className="text-2xl font-black text-slate-500">$0 CLP</div>
              <p className="text-[11px] text-slate-500 mt-1">Sin registros de pago anteriores</p>
            </div>
          )}
        </div>

        {/* KPI 3: Deuda Pendiente */}
        <div
          className={`bg-slate-900 border p-5 rounded-2xl shadow-xl space-y-2 relative overflow-hidden transition ${
            pendingDebt > 0 ? 'border-amber-500/50 bg-amber-950/10' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Saldo Pendiente / Deuda
            </span>
            <div
              className={`p-2 rounded-xl ${
                pendingDebt > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {pendingDebt > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
          </div>

          <div>
            <div
              className={`text-3xl font-black font-mono ${
                pendingDebt > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              ${pendingDebt.toLocaleString('es-CL')} CLP
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {pendingDebt > 0
                ? `${finances.totalAttendances} clases asistidas ($${finances.totalCost.toLocaleString('es-CL')}) vs $${finances.totalPaid.toLocaleString('es-CL')} pagado`
                : 'Alumno al día con sus clases marcadas'}
            </p>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT SECTION: TABS FOR ATTENDANCE CARDS & PAYMENTS */}
      <div className="space-y-4">
        {/* Navigation Bar for Sub Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('clases')}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center gap-2 ${
                activeSubTab === 'clases'
                  ? 'bg-[#7628A6] text-white shadow-lg shadow-[#7628A6]/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              <span>Historial de Clases ({studentAttendances.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('pagos')}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center gap-2 ${
                activeSubTab === 'pagos'
                  ? 'bg-[#7628A6] text-white shadow-lg shadow-[#7628A6]/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Historial de Pagos ({studentPayments.length})</span>
            </button>
          </div>

          {activeSubTab === 'clases' && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar clase..."
                  className="bg-slate-950 border border-slate-800 text-xs text-white pl-8 pr-3 py-2 rounded-xl outline-none focus:border-[#7628A6] placeholder:text-slate-600"
                />
              </div>

              {/* Month Filter */}
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 px-3 py-2 rounded-xl outline-none"
              >
                <option value="todos">Todos los meses</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              {/* Sort Order */}
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition"
                title="Cambiar orden"
              >
                {sortOrder === 'desc' ? 'Más recientes' : 'Más antiguas'}
              </button>
            </div>
          )}
        </div>

        {/* TAB 1: ATTENDED CLASSES (MINI CARDS ORGANIZED BY DATE) */}
        {activeSubTab === 'clases' && (
          <div>
            {processedAttendances.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
                <Dumbbell className="w-10 h-10 text-slate-600 mx-auto stroke-[1.5]" />
                <h3 className="text-base font-bold text-slate-300">No hay clases asistidas registradas</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  El alumno no registra asistencias marcadas con los filtros seleccionados.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedByDate.map((group) => {
                  // Format nice Chilean date title (e.g., "Lunes, 3 de Agosto de 2026")
                  const dateParts = group.dateStr.split('-');
                  const formattedDateHeader = new Date(
                    parseInt(dateParts[0]),
                    parseInt(dateParts[1]) - 1,
                    parseInt(dateParts[2])
                  ).toLocaleDateString('es-CL', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  });

                  return (
                    <div key={group.dateStr} className="space-y-3">
                      {/* Date Section Header */}
                      <div className="flex items-center gap-3">
                        <div className="h-px bg-slate-800 flex-1" />
                        <div className="bg-slate-900 border border-slate-800 text-[#c77dff] px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="capitalize">{formattedDateHeader}</span>
                          <span className="bg-[#7628A6] text-white px-1.5 py-0.2 rounded-full text-[10px]">
                            {group.items.length} {group.items.length === 1 ? 'clase' : 'clases'}
                          </span>
                        </div>
                        <div className="h-px bg-slate-800 flex-1" />
                      </div>

                      {/* Mini Cards Grid for this Date */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.items.map((att) => {
                          const itemPricing = itemizedMap.get(att.id);

                          return (
                            <div
                              key={att.id}
                              className="bg-slate-900 border border-slate-800 hover:border-[#7628A6]/50 rounded-2xl p-4 transition-all shadow-md hover:shadow-lg flex flex-col justify-between space-y-3"
                            >
                              {/* Top Bar: Name & Time */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 bg-[#7628A6]/20 text-[#c77dff] rounded-xl">
                                    <Dumbbell className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="font-black text-white text-sm leading-tight">
                                      {att.className}
                                    </h4>
                                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                                      <Clock className="w-3 h-3 text-[#c77dff]" />
                                      {att.time} hrs
                                    </span>
                                  </div>
                                </div>

                                {att.recordedOffline && (
                                  <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                    Offline
                                  </span>
                                )}
                              </div>

                              {/* Rule & Pricing Footer Badge */}
                              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                                  <Tag className="w-3 h-3 text-slate-500" />
                                  {itemPricing?.appliedRule || 'Tarifa Estándar'}
                                </span>
                                <span className="font-mono font-black text-[#c77dff]">
                                  ${itemPricing ? itemPricing.unitPrice.toLocaleString('es-CL') : '2.500'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PAYMENTS HISTORY */}
        {activeSubTab === 'pagos' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {studentPayments.length === 0 ? (
              <div className="p-10 text-center space-y-2 text-slate-400">
                <Receipt className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="font-bold text-sm">Sin registros de pago para este alumno.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-black border-b border-slate-800 tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Recibo / Fecha</th>
                      <th className="py-3.5 px-4">Método</th>
                      <th className="py-3.5 px-4">Observaciones</th>
                      <th className="py-3.5 px-4">Monto ($ CLP)</th>
                      <th className="py-3.5 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-200 font-medium">
                    {studentPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/50 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-[#c77dff] text-xs">
                            {p.receiptNumber}
                          </div>
                          <div className="text-[11px] text-slate-500">{p.paymentDate}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                            {p.paymentMethod}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-400 italic">
                          {p.notes || '—'}
                        </td>

                        <td className="py-3.5 px-4 font-black text-emerald-400 text-base font-mono">
                          ${p.amount.toLocaleString('es-CL')}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {onViewReceipt && (
                              <button
                                onClick={() => onViewReceipt(p)}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-[#c77dff] rounded-lg border border-slate-700 transition inline-flex items-center gap-1 text-xs font-bold"
                                title="Ver Recibo"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>Recibo</span>
                              </button>
                            )}

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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
