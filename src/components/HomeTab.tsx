/**
 * HomeTab Component - Main Landing Page with Next Class Card, Recent Student Card, and Bottom "Nuevo" Drawer
 */
import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  Users,
  UserPlus,
  CreditCard,
  Plus,
  X,
  ChevronRight,
  Flame,
  CheckCircle,
  AlertTriangle,
  Dumbbell,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  CalendarDays,
  Pencil,
  Search,
  Trash2
} from 'lucide-react';
import { ClassSchedule, Student, Payment } from '../types';
import { getClassEnrollments, getEnrolledStudentIds, saveClassEnrollments } from '../utils/enrollment';

interface HomeTabProps {
  students: Student[];
  classes: ClassSchedule[];
  payments: Payment[];
  onNavigateTab: (tab: string) => void;
  onOpenNewClass: () => void;
  onOpenNewStudent: () => void;
  onOpenNewPayment: (student?: Student | null) => void;
  onSelectStudentProfile: (student: Student) => void;
  onEditClass?: (cls: ClassSchedule) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  students,
  classes,
  payments,
  onNavigateTab,
  onOpenNewClass,
  onOpenNewStudent,
  onOpenNewPayment,
  onSelectStudentProfile,
  onEditClass
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [enrollmentsState, setEnrollmentsState] = useState<Record<string, string[]>>(() => getClassEnrollments());

  // Enrollment Modal state for Próxima Clase
  const [enrollmentModalClass, setEnrollmentModalClass] = useState<{
    cls: ClassSchedule;
    targetDayId: number;
  } | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Day names for Chilean Spanish context
  const dayNames = [
    { id: 1, name: 'Lunes' },
    { id: 2, name: 'Martes' },
    { id: 3, name: 'Miércoles' },
    { id: 4, name: 'Jueves' },
    { id: 5, name: 'Viernes' },
    { id: 6, name: 'Sábado' },
    { id: 7, name: 'Domingo' }
  ];

  // Get current date & time
  const now = new Date();
  const currentJsDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const currentDayId = currentJsDay === 0 ? 7 : currentJsDay;
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  // Helper to calculate next upcoming class
  const getNextUpcomingClass = (): { cls: ClassSchedule; dayName: string; isToday: boolean; targetDayId: number } | null => {
    if (!classes || classes.length === 0) return null;

    // 1. Search for a class remaining TODAY
    const todayClasses = classes
      .filter((c) => c.daysOfWeek.includes(currentDayId) && c.startTime >= currentTimeStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (todayClasses.length > 0) {
      return { cls: todayClasses[0], dayName: 'Hoy', isToday: true, targetDayId: currentDayId };
    }

    // 2. Search for the next available day in the week
    for (let offset = 1; offset <= 7; offset++) {
      let targetDayId = currentDayId + offset;
      if (targetDayId > 7) targetDayId -= 7;

      const dayClasses = classes
        .filter((c) => c.daysOfWeek.includes(targetDayId))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      if (dayClasses.length > 0) {
        const dayObj = dayNames.find((d) => d.id === targetDayId);
        const dayLabel = offset === 1 ? `Mañana (${dayObj?.name})` : dayObj?.name || 'Próximo día';
        return { cls: dayClasses[0], dayName: dayLabel, isToday: false, targetDayId };
      }
    }

    return null;
  };

  const nextClassInfo = getNextUpcomingClass();

  // Enroll / Unenroll helpers
  const handleEnrollStudent = (studentId: string, classId: string, dayOfWeek: number) => {
    const specificKey = `${classId}_day_${dayOfWeek}`;
    const currentList = enrollmentsState[specificKey] || [];
    if (!currentList.includes(studentId)) {
      const updatedList = [...currentList, studentId];
      const newEnrollments = { ...enrollmentsState, [specificKey]: updatedList };
      setEnrollmentsState(newEnrollments);
      saveClassEnrollments(newEnrollments);
    }
  };

  const handleUnenrollStudent = (studentId: string, classId: string, dayOfWeek: number) => {
    const specificKey = `${classId}_day_${dayOfWeek}`;
    const currentList = enrollmentsState[specificKey] || [];
    const updatedList = currentList.filter((id) => id !== studentId);
    const newEnrollments = { ...enrollmentsState, [specificKey]: updatedList };
    setEnrollmentsState(newEnrollments);
    saveClassEnrollments(newEnrollments);
  };

  // Find most recent student (sorted by registrationDate or position)
  const getMostRecentStudent = (): Student | null => {
    if (!students || students.length === 0) return null;
    const sorted = [...students].sort((a, b) => {
      if (a.registrationDate && b.registrationDate) {
        return b.registrationDate.localeCompare(a.registrationDate);
      }
      return 0;
    });
    return sorted[0];
  };

  const recentStudent = getMostRecentStudent();

  // Enrollments data
  const enrollments = getClassEnrollments();

  return (
    <div className="space-y-6 pb-20">
      {/* Hero Welcome & Quick Stats */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#7628A6]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#c77dff]">
              <Flame className="w-4 h-4 fill-[#c77dff]" /> Panel de Control Principal
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white italic tracking-tight">
              ¡BIENVENIDO A <span className="text-[#c77dff]">INTENSE STUDIO</span>!
            </h2>
            <p className="text-sm text-slate-400 font-medium">
              Gestión centralizada de clases, alumnos e ingresos del gimnasio.
            </p>
          </div>

          {/* Prominent "Nuevo" Action Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#7628A6] hover:bg-[#621d8c] text-white rounded-2xl font-black text-sm tracking-wide transition-all shadow-xl shadow-[#7628A6]/30 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 border border-[#9d4edd]/30"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>NUEVO REGISTRO</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Bar */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="text-slate-400 text-xs font-semibold">Total Alumnos</div>
            <div className="text-xl font-black text-white mt-0.5">{students.length}</div>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="text-slate-400 text-xs font-semibold">Al Día</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">
              {students.filter((s) => s.status === 'al_dia').length}
            </div>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="text-slate-400 text-xs font-semibold">Con Deuda</div>
            <div className="text-xl font-black text-amber-400 mt-0.5">
              {students.filter((s) => s.status === 'con_deuda').length}
            </div>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="text-slate-400 text-xs font-semibold">Clases Registradas</div>
            <div className="text-xl font-black text-[#c77dff] mt-0.5">{classes.length}</div>
          </div>
        </div>
      </div>

      {/* Main Grid Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: Próxima Clase */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#7628A6]/20 text-[#c77dff] rounded-2xl border border-[#7628A6]/40">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white uppercase italic tracking-wide">
                    Próxima Clase
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">Siguiente sesión programada</p>
                </div>
              </div>
              {nextClassInfo && (
                <span className="text-xs font-black px-3 py-1 bg-[#7628A6]/30 text-[#c77dff] rounded-full border border-[#7628A6]/50 uppercase tracking-wider">
                  {nextClassInfo.dayName}
                </span>
              )}
            </div>

            {/* Content */}
            {nextClassInfo ? (
              (() => {
                const { cls, targetDayId } = nextClassInfo;
                const enrolledCount = getEnrolledStudentIds(enrollmentsState, cls.id, targetDayId).length;
                const percentage = Math.min(100, Math.round((enrolledCount / cls.maxCapacity) * 100));

                return (
                  <div className="space-y-4 pt-2">
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-black text-white text-xl leading-tight">{cls.name}</h4>
                        </div>
                        <div className="bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-right">
                          <span className="text-xs font-black text-[#c77dff] block">{cls.startTime} - {cls.endTime}</span>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Horario</span>
                        </div>
                      </div>

                      {cls.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/50">
                          "{cls.description}"
                        </p>
                      )}

                      {/* Capacity Bar */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-[#c77dff]" /> Cupo reservado:
                          </span>
                          <span className={enrolledCount >= cls.maxCapacity ? 'text-red-400 font-black' : 'text-[#c77dff] font-black'}>
                            {enrolledCount} / {cls.maxCapacity} Alumnos ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              enrolledCount >= cls.maxCapacity ? 'bg-red-500' : 'bg-gradient-to-r from-[#7628A6] to-[#c77dff]'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Card Buttons: Inscripción & Editar */}
                      <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
                        <button
                          onClick={() => setEnrollmentModalClass({ cls, targetDayId })}
                          className="flex-1 py-2.5 px-3 bg-[#7628A6] hover:bg-[#621d8c] text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-[#7628A6]/20 border border-[#9d4edd]/30 active:scale-95"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>Inscripción</span>
                        </button>

                        {onEditClass && (
                          <button
                            onClick={() => onEditClass(cls)}
                            className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 active:scale-95"
                          >
                            <Pencil className="w-4 h-4 text-[#c77dff]" />
                            <span>Editar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-8 bg-slate-950/50 rounded-2xl border border-slate-800/60 space-y-3">
                <Dumbbell className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-sm font-medium">No hay clases registradas en la agenda.</p>
                <button
                  onClick={onOpenNewClass}
                  className="px-4 py-2 bg-[#7628A6] text-white rounded-xl font-bold text-xs hover:bg-[#621d8c] transition"
                >
                  Crear Primera Clase
                </button>
              </div>
            )}
          </div>

          {/* Card Footer Action */}
          <div className="pt-6">
            <button
              onClick={() => onNavigateTab('schedule')}
              className="w-full py-3 bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white rounded-2xl font-bold text-xs transition border border-slate-800 flex items-center justify-center gap-2 group/btn"
            >
              <span>VER AGENDA COMPLETA Y TOMAR ASISTENCIA</span>
              <ChevronRight className="w-4 h-4 text-[#c77dff] group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* CARD 2: Alumno Más Reciente */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/30">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white uppercase italic tracking-wide">
                    Alumno Más Reciente
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">Última incorporación al gym</p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/30 uppercase tracking-wider">
                Nuevo
              </span>
            </div>

            {/* Content */}
            {recentStudent ? (
              <div className="space-y-4 pt-2">
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7628A6] to-purple-900 text-white font-black text-lg flex items-center justify-center shadow-md border border-[#9d4edd]/30">
                        {recentStudent.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-black text-white text-lg leading-snug">{recentStudent.name}</h4>
                        <p className="text-xs text-slate-400 font-medium">
                          Inscrito el: <span className="text-slate-200">{recentStudent.registrationDate}</span>
                        </p>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="text-right">
                      {recentStudent.status === 'al_dia' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-black">
                          <CheckCircle className="w-3.5 h-3.5" /> Al Día
                        </span>
                      )}
                      {recentStudent.status === 'con_deuda' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-950/80 text-amber-400 border border-amber-500/40 rounded-xl text-xs font-black">
                          <AlertTriangle className="w-3.5 h-3.5" /> Con Deuda
                        </span>
                      )}
                      {recentStudent.status === 'inactivo' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl text-xs font-black">
                          Inactivo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80">
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px] font-semibold uppercase">Teléfono</span>
                      <span className="text-slate-200 font-bold">{recentStudent.phone || 'No registrado'}</span>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px] font-semibold uppercase">Último Pago</span>
                      <span className="text-slate-200 font-bold">
                        {recentStudent.lastPaymentAmount
                          ? `$${recentStudent.lastPaymentAmount.toLocaleString('es-CL')} (${recentStudent.lastPaymentDate || ''})`
                          : 'Sin pagos aun'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onSelectStudentProfile(recentStudent)}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition border border-slate-800 flex items-center justify-center gap-1"
                    >
                      <User className="w-3.5 h-3.5 text-[#c77dff]" />
                      <span>Ver Ficha</span>
                    </button>
                    <button
                      onClick={() => onOpenNewPayment(recentStudent)}
                      className="flex-1 py-2 bg-[#7628A6]/20 hover:bg-[#7628A6]/40 text-[#c77dff] rounded-xl font-bold text-xs transition border border-[#7628A6]/40 flex items-center justify-center gap-1"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Cobrar Mensualidad</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-950/50 rounded-2xl border border-slate-800/60 space-y-3">
                <User className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-sm font-medium">No hay alumnos registrados todavia.</p>
                <button
                  onClick={onOpenNewStudent}
                  className="px-4 py-2 bg-[#7628A6] text-white rounded-xl font-bold text-xs hover:bg-[#621d8c] transition"
                >
                  Registrar Primer Alumno
                </button>
              </div>
            )}
          </div>

          {/* Card Footer Action */}
          <div className="pt-6">
            <button
              onClick={() => onNavigateTab('students')}
              className="w-full py-3 bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white rounded-2xl font-bold text-xs transition border border-slate-800 flex items-center justify-center gap-2 group/btn"
            >
              <span>VER LISTADO COMPLETO DE ALUMNOS ({students.length})</span>
              <ChevronRight className="w-4 h-4 text-[#c77dff] group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* DRAWER INFERIOR DE "NUEVO" */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer Content Sheet */}
          <div className="relative z-10 bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 shadow-2xl space-y-6 max-w-xl mx-auto w-full animate-in slide-in-from-bottom duration-300">
            {/* Handle Drag Indicator */}
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#7628A6] text-white rounded-xl">
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white italic uppercase tracking-wide">
                    Crear Nuevo Registro
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Selecciona una opción para continuar
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3 Options Grid/List */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: Clase */}
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  onOpenNewClass();
                }}
                className="p-4 bg-slate-950 hover:bg-[#7628A6]/20 border border-slate-800 hover:border-[#7628A6] rounded-2xl text-left space-y-2 transition-all group active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-[#7628A6]/30 text-[#c77dff] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Dumbbell className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-white text-base block leading-tight group-hover:text-[#c77dff] transition">
                    Clase
                  </span>
                  <span className="text-[11px] text-slate-400 block font-medium mt-1 leading-snug">
                    Nueva clase u horario en la agenda
                  </span>
                </div>
              </button>

              {/* Option 2: Alumno */}
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  onOpenNewStudent();
                }}
                className="p-4 bg-slate-950 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500 rounded-2xl text-left space-y-2 transition-all group active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-white text-base block leading-tight group-hover:text-emerald-400 transition">
                    Alumno
                  </span>
                  <span className="text-[11px] text-slate-400 block font-medium mt-1 leading-snug">
                    Inscribir nuevo estudiante
                  </span>
                </div>
              </button>

              {/* Option 3: Pago */}
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  onOpenNewPayment();
                }}
                className="p-4 bg-slate-950 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500 rounded-2xl text-left space-y-2 transition-all group active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-white text-base block leading-tight group-hover:text-amber-400 transition">
                    Pago
                  </span>
                  <span className="text-[11px] text-slate-400 block font-medium mt-1 leading-snug">
                    Registrar cobro o mensualidad
                  </span>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <div className="pt-2">
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Inscripción Rápida a Clase */}
      {enrollmentModalClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative z-10 bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#7628A6]/20 text-[#c77dff] rounded-2xl border border-[#7628A6]/40">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white italic uppercase tracking-wide">
                    Inscripción a Clase
                  </h3>
                  <p className="text-xs text-[#c77dff] font-bold">
                    {enrollmentModalClass.cls.name} ({enrollmentModalClass.cls.startTime} - {enrollmentModalClass.cls.endTime} hrs)
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEnrollmentModalClass(null);
                  setStudentSearchQuery('');
                }}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form / Search to Enroll Student */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <label className="block text-xs font-black text-slate-300 uppercase tracking-wider">
                Seleccionar Alumno para Inscribir:
              </label>

              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar alumno por nombre..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-white text-xs pl-9 pr-3 py-2.5 rounded-xl outline-none focus:border-[#7628A6]"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
                  {students
                    .filter((s) => s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()))
                    .map((s) => {
                      const specificKey = `${enrollmentModalClass.cls.id}_day_${enrollmentModalClass.targetDayId}`;
                      const currentEnrolled = enrollmentsState[specificKey] || [];
                      const isEnrolled = currentEnrolled.includes(s.id);

                      return (
                        <div
                          key={s.id}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs transition ${
                            isEnrolled ? 'bg-emerald-950/40 border border-emerald-500/20 text-slate-400' : 'hover:bg-slate-800 text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 text-[#c77dff] font-bold flex items-center justify-center text-xs">
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold">{s.name}</span>
                              {s.phone && <span className="text-[10px] text-slate-500 block">{s.phone}</span>}
                            </div>
                          </div>

                          {isEnrolled ? (
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950 px-2 py-1 rounded-md border border-emerald-500/30">
                              <CheckCircle className="w-3 h-3" /> Inscrito
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEnrollStudent(s.id, enrollmentModalClass.cls.id, enrollmentModalClass.targetDayId)}
                              className="px-3 py-1 bg-[#7628A6] hover:bg-[#621d8c] text-white text-[11px] font-black rounded-lg transition"
                            >
                              Inscribir
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Enrolled Students List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              <h4 className="text-xs font-black text-slate-400 uppercase italic">
                Alumnos Inscritos ({getEnrolledStudentIds(enrollmentsState, enrollmentModalClass.cls.id, enrollmentModalClass.targetDayId).length} / {enrollmentModalClass.cls.maxCapacity})
              </h4>

              {(() => {
                const enrolledIds = getEnrolledStudentIds(enrollmentsState, enrollmentModalClass.cls.id, enrollmentModalClass.targetDayId);
                const enrolledList = students.filter((s) => enrolledIds.includes(s.id));

                if (enrolledList.length === 0) {
                  return (
                    <p className="text-xs text-slate-500 italic text-center py-4 bg-slate-950/40 rounded-xl border border-slate-800/50">
                      Aún no hay alumnos inscritos en esta clase.
                    </p>
                  );
                }

                return (
                  <div className="space-y-1.5">
                    {enrolledList.map((st) => (
                      <div key={st.id} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7628A6] to-purple-900 text-white font-black flex items-center justify-center text-xs">
                            {st.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-white block">{st.name}</span>
                            <span className="text-[10px] text-slate-400">{st.status === 'al_dia' ? 'Al día' : 'Con deuda'}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUnenrollStudent(st.id, enrollmentModalClass.cls.id, enrollmentModalClass.targetDayId)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-lg transition"
                          title="Desinscribir alumno"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Close Button */}
            <div className="pt-2">
              <button
                onClick={() => {
                  setEnrollmentModalClass(null);
                  setStudentSearchQuery('');
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-2xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
