/**
 * Class Schedule & Capacity Management Tab
 * Daily, Weekly and Monthly class calendar with max capacity (cupo máximo) tracking
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Plus,
  Dumbbell,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  UserMinus,
  UserPlus,
  Edit2,
  Trash2,
  Receipt,
  Search,
  X,
  CreditCard,
  ChevronDown
} from 'lucide-react';
import { AttendanceRecord, ClassSchedule, Student } from '../types';
import { useData } from '../data/DataContext';

interface ScheduleTabProps {
  classes: ClassSchedule[];
  attendances: AttendanceRecord[];
  students: Student[];
  onOpenNewClass: () => void;
  onEditClass: (cls: ClassSchedule) => void;
  onDeleteClass: (classId: string) => void;
  onMarkAttendance: (studentId: string, classId?: string, className?: string, dateStr?: string) => void;
  onCancelAttendance?: (attendanceId: string) => void;
  onOpenPaymentModal?: (student: Student) => void;
}

interface SearchableStudentSelectProps {
  students: Student[];
  enrolledIds: string[];
  selectedId: string;
  onSelectId: (id: string) => void;
}

const SearchableStudentSelect: React.FC<SearchableStudentSelectProps> = ({
  students,
  enrolledIds,
  selectedId,
  onSelectId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId) {
      setQuery('');
    } else {
      const found = students.find((s) => s.id === selectedId);
      if (found) {
        setQuery(found.name);
      }
    }
  }, [selectedId, students]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredStudents = students.filter(
    (s) => s.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSelectId('');
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar o seleccionar por nombre..."
          className="w-full bg-slate-900 border border-slate-800 text-white text-xs font-medium p-2.5 pr-8 rounded-xl outline-none focus:border-[#7628A6] placeholder-slate-500"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              onSelectId('');
              setIsOpen(true);
            }}
            className="absolute right-2.5 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="absolute right-2.5 text-slate-400 hover:text-white"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-2xl space-y-0.5 p-1.5">
          {filteredStudents.length === 0 ? (
            <div className="text-xs text-slate-500 p-3 text-center italic">
              No se encontraron alumnos con "{query}"
            </div>
          ) : (
            filteredStudents.map((s) => {
              const isEnrolled = enrolledIds.includes(s.id);
              return (
                <button
                  type="button"
                  key={s.id}
                  disabled={isEnrolled}
                  onClick={() => {
                    onSelectId(s.id);
                    setQuery(s.name);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                    isEnrolled
                      ? 'opacity-40 cursor-not-allowed bg-slate-950/50'
                      : 'hover:bg-[#7628A6]/20 hover:text-white text-slate-200'
                  }`}
                >
                  <div className="font-medium">
                    <span>{s.name}</span>
                  </div>
                  {isEnrolled && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
                      Ya inscrito
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  classes,
  attendances,
  students,
  onOpenNewClass,
  onEditClass,
  onDeleteClass,
  onMarkAttendance,
  onCancelAttendance,
  onOpenPaymentModal
}) => {
  const [viewMode, setViewMode] = useState<'diario' | 'semanal' | 'mensual'>('diario');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(new Date().getDay() || 7); // 1=Mon ... 7=Sun
  const [selectedClassForDetails, setSelectedClassForDetails] = useState<ClassSchedule | null>(null);

  // Enrollments come from the DataProvider (ClassEnrollment[] junction rows,
  // design decision 9); writes go through the write-through mutations instead
  // of a local localStorage Record (3.10 retires enrollment.ts / DAL-REQ-4).
  const { enrollments, enrollStudent, unenrollStudent } = useData();
  const [rosterSearch, setRosterSearch] = useState('');
  const [studentToEnroll, setStudentToEnroll] = useState('');

  const daysOfWeekNames = [
    { id: 1, name: 'Lunes' },
    { id: 2, name: 'Martes' },
    { id: 3, name: 'Miércoles' },
    { id: 4, name: 'Jueves' },
    { id: 5, name: 'Viernes' },
    { id: 6, name: 'Sábado' },
    { id: 7, name: 'Domingo' }
  ];

  const todayIso = new Date().toISOString().slice(0, 10);

  const formattedTodayHeader = new Date().toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const getSelectedDayDateFormatted = (dayOfWeekId: number) => {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + distanceToMon + (dayOfWeekId - 1));

    return targetDate.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getCurrentWeekRange = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMon);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayStr = monday.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
    const sundayStr = sunday.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

    return `Semana del ${mondayStr} al ${sundayStr}`;
  };

  const getDayDateInCurrentWeek = (dayOfWeekId: number) => {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + distanceToMon + (dayOfWeekId - 1));

    return targetDate.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'numeric'
    });
  };

  const getSelectedDayDateIso = (dayOfWeekId: number) => {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + distanceToMon + (dayOfWeekId - 1));
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const selectedDayDateIso = getSelectedDayDateIso(selectedDayOfWeek);

  // Get list of enrolled student IDs for a class on a specific day of week
  const getEnrolledStudentIds = (classId: string, dayOfWeek: number = selectedDayOfWeek): string[] => {
    return enrollments
      .filter((e) => e.classId === classId && e.dayOfWeek === dayOfWeek)
      .map((e) => e.studentId);
  };

  // Count enrolled students for a class on a specific day of week (occupies quota)
  const getClassEnrolledCount = (clsId: string, dayOfWeek: number = selectedDayOfWeek) => {
    return getEnrolledStudentIds(clsId, dayOfWeek).length;
  };

  // Get attendances for the currently selected day
  const selectedDayAttendances = attendances.filter((a) => a.date === selectedDayDateIso);

  // Helper to count attendances confirmed for a given day
  const getClassSelectedDayAttendanceCount = (clsId: string, dayOfWeekId: number = selectedDayOfWeek) => {
    const dayIso = getSelectedDayDateIso(dayOfWeekId);
    return attendances.filter((a) => a.date === dayIso && a.classId === clsId).length;
  };

  const handleEnrollStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassForDetails || !studentToEnroll) return;

    const classId = selectedClassForDetails.id;
    const dayOfWeek = selectedDayOfWeek;

    const currentList = getEnrolledStudentIds(classId, dayOfWeek);
    if (!currentList.includes(studentToEnroll)) {
      void enrollStudent({ classId, studentId: studentToEnroll, dayOfWeek });
    }
    setStudentToEnroll('');
  };

  const handleUnenrollStudent = (studentId: string) => {
    if (!selectedClassForDetails) return;
    const classId = selectedClassForDetails.id;
    const dayOfWeek = selectedDayOfWeek;
    void unenrollStudent({ classId, studentId, dayOfWeek });
  };

  return (
    <div className="space-y-6">
      {/* Header & New Class Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
        <div>
          <h2 className="text-xl font-black text-white uppercase italic tracking-wide flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-[#c77dff]" />
            <span>AGENDA DE CLASES IMPARTIDAS Y CUPOS</span>
          </h2>
          <p className="text-xs text-slate-400">
            Programación diaria, semanal y mensual de disciplinas con control de cupo máximo por clase.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('diario')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg uppercase transition ${
                viewMode === 'diario' ? 'bg-[#7628A6] text-white font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Agenda Diaria
            </button>
            <button
              onClick={() => setViewMode('semanal')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg uppercase transition ${
                viewMode === 'semanal' ? 'bg-[#7628A6] text-white font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Semanal
            </button>
            <button
              onClick={() => setViewMode('mensual')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg uppercase transition ${
                viewMode === 'mensual' ? 'bg-[#7628A6] text-white font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Programación
            </button>
          </div>

          <button
            onClick={onOpenNewClass}
            className="bg-[#7628A6] hover:bg-[#621d8c] text-white font-black px-4 py-2 rounded-xl transition text-xs flex items-center gap-2 shadow-lg shadow-[#7628A6]/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Nueva Clase</span>
          </button>
        </div>
      </div>

      {/* Day Selector Bar for Daily View */}
      {viewMode === 'diario' && (
        <div className="flex items-center gap-1 overflow-x-auto bg-slate-900 border border-slate-800 p-2 rounded-2xl no-scrollbar">
          {daysOfWeekNames.map((d) => {
            const isSelected = selectedDayOfWeek === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDayOfWeek(d.id)}
                className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl font-black text-xs uppercase transition text-center ${
                  isSelected
                    ? 'bg-[#7628A6] text-white shadow-md shadow-[#7628A6]/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div>{d.name}</div>
                <div className="text-[10px] font-normal opacity-80">
                  {classes.filter((c) => c.daysOfWeek.includes(d.id)).length} clases
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Daily View / Selected Day Classes Grid */}
      {viewMode === 'diario' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 px-4 py-3 rounded-2xl text-xs shadow-md">
            <div className="flex items-center gap-2 text-slate-300">
              <CalendarIcon className="w-4 h-4 text-[#c77dff]" />
              <span className="font-bold text-slate-400 uppercase">Día Seleccionado:</span>
              <span className="text-white font-black capitalize">
                {getSelectedDayDateFormatted(selectedDayOfWeek)}
              </span>
            </div>
            <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
              <span>Hoy es:</span>
              <span className="text-[#c77dff] font-black capitalize">{formattedTodayHeader}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes
              .filter((cls) => cls.daysOfWeek.includes(selectedDayOfWeek))
              .map((cls) => {
                const occupancy = getClassEnrolledCount(cls.id);
                const maxCap = cls.maxCapacity;
                const isFull = occupancy >= maxCap;
                const percentage = Math.round((occupancy / maxCap) * 100);

                return (
                  <div
                    key={cls.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between"
                  >
                    <div>
                      {/* Title & Controls */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <h3 className="text-lg font-black text-white leading-tight">{cls.name}</h3>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onEditClass(cls)}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                            title="Editar clase"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteClass(cls.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                            title="Eliminar clase"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-300 flex items-center gap-3 font-semibold mt-2">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-[#c77dff]" />
                          {cls.startTime} - {cls.endTime} hrs
                        </span>
                      </div>

                      {cls.description && (
                        <p className="text-xs text-slate-400 mt-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                          {cls.description}
                        </p>
                      )}

                      {/* Capacity Progress Bar */}
                      <div className="mt-4 bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-[#c77dff]" />
                            Inscritos / Cupo Máximo:
                          </span>
                          <span className={isFull ? 'text-red-400 font-black' : 'text-[#c77dff] font-black'}>
                            {occupancy} / {maxCap} Alumnos ({percentage}%)
                          </span>
                        </div>

                        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              isFull ? 'bg-red-500' : percentage > 80 ? 'bg-amber-400' : 'bg-[#7628A6]'
                            }`}
                            style={{ width: `${Math.min(100, percentage)}%` }}
                          />
                        </div>

                        {isFull && (
                          <div className="text-[10px] font-bold text-red-400 flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>¡CUPO LLENO! Máximo alcanzado para esta sesión.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2">
                      <button
                        onClick={() => setSelectedClassForDetails(cls)}
                        className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-[#c77dff] font-black text-xs rounded-xl transition flex items-center justify-center gap-2 border border-slate-700"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Ver Inscriptos / Pasar Lista</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Weekly Schedule Timetable Grid */}
      {viewMode === 'semanal' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-x-auto shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#c77dff]" />
              <h3 className="text-sm font-black text-white uppercase italic tracking-wide">
                HORARIO Y PROGRAMACIÓN SEMANAL
              </h3>
            </div>
            <div className="bg-slate-950 border border-slate-800 text-[#c77dff] font-black px-4 py-2 rounded-xl text-xs capitalize shadow-inner">
              {getCurrentWeekRange()}
            </div>
          </div>

          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase text-[#c77dff] mb-3 pb-2 border-b border-slate-800">
              {daysOfWeekNames.map((d) => (
                <div key={d.id} className="flex flex-col items-center">
                  <span>{d.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono font-normal">
                    {getDayDateInCurrentWeek(d.id)}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {daysOfWeekNames.map((d) => {
                const dayClasses = classes.filter((c) => c.daysOfWeek.includes(d.id));
                return (
                  <div key={d.id} className="space-y-2 bg-slate-950 p-2 rounded-xl min-h-[220px]">
                    {dayClasses.map((cls) => (
                      <div
                        key={cls.id}
                        onClick={() => {
                          setSelectedDayOfWeek(d.id);
                          setSelectedClassForDetails(cls);
                        }}
                        className="p-2.5 rounded-xl text-left border border-slate-800 bg-slate-900 space-y-1 shadow-sm cursor-pointer hover:border-[#7628A6] transition group"
                      >
                        <div className="text-[10px] font-black uppercase text-slate-400">{cls.startTime}</div>
                        <div className="font-black text-white text-xs leading-tight group-hover:text-[#c77dff] transition">{cls.name}</div>
                        <div className="text-[10px] text-slate-400">Cupo: {getClassEnrolledCount(cls.id, d.id)}/{cls.maxCapacity}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Monthly View Overview */}
      {viewMode === 'mensual' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="text-lg font-black text-white uppercase italic">
            Programación General de Clases Mensuales ({classes.length} Clases Activas)
          </h3>
          <p className="text-xs text-slate-400">
            Matriz de todas las disciplinas configuradas en la parrilla del gimnasio.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {classes.map((c) => (
              <div
                key={c.id}
                className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-white text-sm">{c.name}</div>
                  <div className="text-xs text-slate-400">
                    Horario: {c.startTime} - {c.endTime} hrs
                  </div>
                  <div className="text-[11px] text-[#c77dff] mt-1">
                    Días: {c.daysOfWeek.map((d) => daysOfWeekNames.find((x) => x.id === d)?.name).join(', ')}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black bg-slate-800 text-slate-200 px-3 py-1 rounded-lg border border-slate-700">
                    Max: {c.maxCapacity} cupos
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Class Roster & Attendance Confirmation Modal */}
      {selectedClassForDetails && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 pr-6">
              <div>
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#c77dff]" />
                  <h3 className="text-xl font-black text-white uppercase italic tracking-wide">
                    {selectedClassForDetails.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="bg-[#7628A6]/30 text-[#c77dff] font-black px-2 py-0.5 rounded uppercase border border-[#7628A6]/40">
                    Día: {daysOfWeekNames.find((d) => d.id === selectedDayOfWeek)?.name} ({getDayDateInCurrentWeek(selectedDayOfWeek)})
                  </span>
                  <span>
                    Horario: <strong className="text-white">{selectedClassForDetails.startTime} - {selectedClassForDetails.endTime} hrs</strong>
                  </span>
                  <span>
                    | Cupo: <strong className="text-[#c77dff]">{getClassEnrolledCount(selectedClassForDetails.id, selectedDayOfWeek)}/{selectedClassForDetails.maxCapacity}</strong>
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedClassForDetails(null)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Enroll Student Form */}
            <form onSubmit={handleEnrollStudent} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <label className="block text-xs font-black text-[#c77dff] uppercase tracking-wider">
                Inscribir Alumno a esta Clase ({daysOfWeekNames.find((d) => d.id === selectedDayOfWeek)?.name}):
              </label>
              <div className="flex gap-2 items-start">
                <SearchableStudentSelect
                  students={students}
                  enrolledIds={getEnrolledStudentIds(selectedClassForDetails.id, selectedDayOfWeek)}
                  selectedId={studentToEnroll}
                  onSelectId={setStudentToEnroll}
                />
                <button
                  type="submit"
                  disabled={!studentToEnroll}
                  className="bg-[#7628A6] hover:bg-[#621d8c] disabled:opacity-50 text-white font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-md shrink-0 h-[38px]"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Inscribir</span>
                </button>
              </div>
            </form>

            {/* Roster & Attendance List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-slate-300 uppercase italic">
                  Inscritos para este día ({getEnrolledStudentIds(selectedClassForDetails.id, selectedDayOfWeek).length})
                </span>
                <span className="text-slate-400 text-[11px]">
                  Asistencias confirmadas ({getDayDateInCurrentWeek(selectedDayOfWeek)}): <strong className="text-[#c77dff]">{getClassSelectedDayAttendanceCount(selectedClassForDetails.id, selectedDayOfWeek)}</strong>
                </span>
              </div>

              {/* Filter / Search within roster */}
              {getEnrolledStudentIds(selectedClassForDetails.id, selectedDayOfWeek).length > 0 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar en la lista de inscritos..."
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white text-xs pl-8 pr-3 py-1.5 rounded-xl outline-none"
                  />
                </div>
              )}

              {/* List of Cards for Enrolled Students */}
              {(() => {
                const enrolledIds = getEnrolledStudentIds(selectedClassForDetails.id, selectedDayOfWeek);
                const enrolledStudents = students.filter((s) => enrolledIds.includes(s.id));
                const filteredStudents = enrolledStudents.filter((s) =>
                  s.name.toLowerCase().includes(rosterSearch.toLowerCase())
                );

                if (enrolledStudents.length === 0) {
                  return (
                    <div className="text-center py-8 bg-slate-950 rounded-2xl border border-slate-800 text-slate-500 text-xs italic">
                      No hay alumnos inscritos en esta clase aún. Seleccione un alumno arriba para inscribirlo.
                    </div>
                  );
                }

                if (filteredStudents.length === 0) {
                  return (
                    <div className="text-center py-6 text-slate-500 text-xs italic">
                      No se encontraron alumnos con el término de búsqueda.
                    </div>
                  );
                }

                return filteredStudents.map((s) => {
                  const dayRecord = selectedDayAttendances.find(
                    (a) => a.studentId === s.id && a.classId === selectedClassForDetails.id
                  );
                  const isConfirmed = !!dayRecord;

                  return (
                    <div
                      key={s.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isConfirmed
                          ? 'bg-emerald-950/20 border-emerald-500/40'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Left Side: Name + Pago button underneath */}
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="font-black text-white text-base leading-tight">{s.name}</span>
                        {onOpenPaymentModal && (
                          <button
                            onClick={() => onOpenPaymentModal(s)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[#c77dff] rounded-xl border border-slate-700 transition text-xs font-bold flex items-center gap-1"
                            title="Registrar Pago o Abono para este alumno"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pago</span>
                          </button>
                        )}
                      </div>

                      {/* Right Side: Confirm Attendance + Unenroll button */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isConfirmed ? (
                          <div className="flex items-center gap-1">
                            <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Confirmado</span>
                            </span>
                            {onCancelAttendance && (
                              <button
                                onClick={() => onCancelAttendance(dayRecord.id)}
                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                                title="Desmarcar asistencia de este día"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              onMarkAttendance(
                                s.id,
                                selectedClassForDetails.id,
                                `${selectedClassForDetails.name} (${selectedClassForDetails.startTime})`,
                                selectedDayDateIso
                              )
                            }
                            className="px-3 py-1.5 bg-[#7628A6] hover:bg-[#621d8c] text-white rounded-xl font-black text-xs transition flex items-center gap-1.5 shadow-md active:scale-95"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Confirmar Asistencia</span>
                          </button>
                        )}

                        {/* Unenroll icon button */}
                        <button
                          onClick={() => handleUnenrollStudent(s.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                          title="Quitar de la lista de esta clase"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedClassForDetails(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
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
