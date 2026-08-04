/**
 * Students Roster Management Tab
 * Full student list with WhatsApp integration, profile modal and Excel export
 */
import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  MessageSquare,
  Eye,
  Edit2,
  Trash2
} from 'lucide-react';
import { Student } from '../types';
import { getWhatsAppLink } from '../utils/whatsapp';
import { exportStudentsListToExcel } from '../utils/excelExport';

interface StudentsTabProps {
  students: Student[];
  onOpenNewStudent: () => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onOpenPaymentModal: (student: Student) => void;
  onSelectStudentProfile: (student: Student) => void;
}

export const StudentsTab: React.FC<StudentsTabProps> = ({
  students,
  onOpenNewStudent,
  onEditStudent,
  onDeleteStudent,
  onOpenPaymentModal,
  onSelectStudentProfile
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'al_dia' | 'con_deuda'>('todos');

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone.includes(searchTerm);

    if (statusFilter === 'todos') return matchesSearch;
    return matchesSearch && s.status === statusFilter;
  });

  const handleExportExcel = () => {
    exportStudentsListToExcel(filteredStudents);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
        <div>
          <h2 className="text-xl font-black text-white uppercase italic tracking-wide flex items-center gap-2">
            <Users className="w-6 h-6 text-[#c77dff]" />
            <span>NÓMINA DE ALUMNOS DEL GIMNASIO</span>
          </h2>
          <p className="text-xs text-slate-400">
            Control de asistencia, teléfono y estado de pagos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl transition text-xs flex items-center gap-2 shadow-lg"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel (.xlsx)</span>
          </button>

          <button
            onClick={onOpenNewStudent}
            className="bg-[#7628A6] hover:bg-[#621d8c] text-white font-black px-5 py-2.5 rounded-xl transition text-xs flex items-center gap-2 shadow-lg shadow-[#7628A6]/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Nuevo Alumno</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Search */}
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Nombre o Teléfono..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-[#7628A6] text-white font-medium pl-12 pr-4 py-3 rounded-xl outline-none placeholder:text-slate-500 text-sm"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setStatusFilter('todos')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              statusFilter === 'todos' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({students.length})
          </button>
          <button
            onClick={() => setStatusFilter('al_dia')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              statusFilter === 'al_dia' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Al Día
          </button>
          <button
            onClick={() => setStatusFilter('con_deuda')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              statusFilter === 'con_deuda' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Con Deuda
          </button>
        </div>
      </div>

      {/* Table / Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
            No se encontraron alumnos con los filtros seleccionados.
          </div>
        ) : (
          filteredStudents.map((student) => {
            const waLink = getWhatsAppLink(
              student.phone,
              `Hola ${student.name}, te escribimos de Intense Studio. Saludo de nuestro equipo. ¡Te esperamos en clase!`
            );

            return (
              <div
                key={student.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-4 shadow-lg flex flex-col justify-between"
              >
                <div>
                  {/* Top Row: Name and Status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-black text-white text-lg leading-tight">{student.name}</h3>
                    </div>

                    {/* Status Badge */}
                    {student.status === 'al_dia' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full uppercase">
                        <CheckCircle2 className="w-3 h-3" />
                        Al Día
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full uppercase">
                        <AlertTriangle className="w-3 h-3" />
                        Con Deuda
                      </span>
                    )}
                  </div>

                  {/* Info Details */}
                  <div className="space-y-1.5 text-xs text-slate-300 border-t border-slate-800/80 pt-3 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Teléfono:</span>
                      <span className="font-bold flex items-center gap-1 text-slate-200">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {student.phone}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Fecha Registro:</span>
                      <span className="font-bold text-slate-200">{student.registrationDate}</span>
                    </div>

                    {student.notes && (
                      <div className="text-[11px] bg-slate-950 p-2 rounded-lg text-slate-400 italic mt-2 border border-slate-800">
                        "{student.notes}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 rounded-xl border border-emerald-500/30 transition"
                    title="Enviar WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => onSelectStudentProfile(student)}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Ficha</span>
                  </button>

                  <button
                    onClick={() => onOpenPaymentModal(student)}
                    className="py-2 px-3 bg-[#7628A6] hover:bg-[#621d8c] text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1 shadow-md shadow-[#7628A6]/20"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Cobrar</span>
                  </button>

                  <button
                    onClick={() => onEditStudent(student)}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                    title="Editar datos"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onDeleteStudent(student.id)}
                    className="p-2.5 bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-red-300 rounded-xl transition"
                    title="Eliminar alumno"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
