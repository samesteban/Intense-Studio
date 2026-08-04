/**
 * Class Schedule Creation & Editing Modal
 * Configures class name, schedule, days and max capacity (cupo máximo)
 */
import React, { useState, useEffect } from 'react';
import { Dumbbell, Clock, Users, Calendar } from 'lucide-react';
import { ClassSchedule } from '../types';

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cls: ClassSchedule) => void;
  classToEdit?: ClassSchedule | null;
}

export const ClassModal: React.FC<ClassModalProps> = ({
  isOpen,
  onClose,
  onSave,
  classToEdit
}) => {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri default
  const [maxCapacity, setMaxCapacity] = useState(15);
  const [color, setColor] = useState('#84cc16');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (classToEdit) {
      setName(classToEdit.name);
      setStartTime(classToEdit.startTime);
      setEndTime(classToEdit.endTime);
      setDaysOfWeek(classToEdit.daysOfWeek || [1, 3, 5]);
      setMaxCapacity(classToEdit.maxCapacity || 15);
      setColor(classToEdit.color || '#84cc16');
      setDescription(classToEdit.description || '');
    } else {
      setName('');
      setStartTime('18:00');
      setEndTime('19:00');
      setDaysOfWeek([1, 3, 5]);
      setMaxCapacity(15);
      setColor('#84cc16');
      setDescription('');
    }
  }, [classToEdit, isOpen]);

  if (!isOpen) return null;

  const toggleDay = (dayNum: number) => {
    if (daysOfWeek.includes(dayNum)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== dayNum));
    } else {
      setDaysOfWeek([...daysOfWeek, dayNum].sort());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || daysOfWeek.length === 0) return;

    const newClass: ClassSchedule = {
      id: classToEdit ? classToEdit.id : `class-${Date.now()}`,
      name,
      startTime,
      endTime,
      daysOfWeek,
      maxCapacity,
      color,
      description
    };

    onSave(newClass);
    onClose();
  };

  const daysList = [
    { id: 1, label: 'Lunes' },
    { id: 2, label: 'Martes' },
    { id: 3, label: 'Miércoles' },
    { id: 4, label: 'Jueves' },
    { id: 5, label: 'Viernes' },
    { id: 6, label: 'Sábado' },
    { id: 7, label: 'Domingo' }
  ];

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
            <Dumbbell className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase italic">
              {classToEdit ? 'EDITAR CLASE' : 'PROGRAMAR NUEVA CLASE'}
            </h3>
            <p className="text-xs text-slate-400">Definir disciplina, horario e identificación de cupos.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-black text-[#c77dff] uppercase mb-1">
              Nombre de la Clase / Disciplina *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: CrossFit WOD, Functional, Spinning, Box Fit"
              className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-white font-bold p-3 rounded-xl outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-300 uppercase mb-1">
              Cupo Máximo de Alumnos *
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(parseInt(e.target.value, 10) || 15)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-[#c77dff] font-black p-3 rounded-xl outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-300 uppercase mb-1">
                Hora Inicio *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-white font-bold p-3 rounded-xl outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-300 uppercase mb-1">
                Hora Fin *
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-white font-bold p-3 rounded-xl outline-none"
                required
              />
            </div>
          </div>

          {/* Days selector */}
          <div>
            <label className="block text-xs font-black text-slate-300 uppercase mb-2">
              Días de la Semana Impartidos *
            </label>
            <div className="flex flex-wrap gap-1.5">
              {daysList.map((d) => {
                const active = daysOfWeek.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDay(d.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-black uppercase transition ${
                      active
                        ? 'bg-[#7628A6] text-white shadow-md shadow-[#7628A6]/20'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {d.label.substring(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color & Description */}
          <div>
            <label className="block text-xs font-black text-slate-300 uppercase mb-1">
              Descripción Corta
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Circuito aeróbico de alta intensidad..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-[#7628A6] text-white font-medium p-3 rounded-xl outline-none"
            />
          </div>

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
              Guardar Clase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
