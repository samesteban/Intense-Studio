/**
 * Intense Studio - Main Gym Management Web Application
 *
 * Data state, connectivity and the offline queue are owned by the DataProvider
 * (src/data/DataContext.tsx, tasks.md 3.7). This component consumes useData()
 * instead of reading/writing localStorage directly (tasks.md 3.8, design
 * decision 8): every mutation is write-through (DAL-REQ-4) and derived finance
 * status is never persisted (DAL-REQ-6/STATUS-REQ-4).
 */
import React, { useState } from 'react';
import { Header } from './components/Header';
import { HomeTab } from './components/HomeTab';
import { StudentsTab } from './components/StudentsTab';
import { PaymentsTab } from './components/PaymentsTab';
import { ScheduleTab } from './components/ScheduleTab';
import { ReportsTab } from './components/ReportsTab';

import { StudentModal } from './components/StudentModal';
import { PaymentModal } from './components/PaymentModal';
import { ClassModal } from './components/ClassModal';
import { ReceiptModal } from './components/ReceiptModal';
import { StudentProfileView } from './components/StudentProfileView';
import { PinModal } from './components/PinModal';
import { ConfirmModal } from './components/ConfirmModal';

import { AttendanceRecord, ClassSchedule, Payment, Student } from './types';
import { useData } from './data/DataContext';

export default function App() {
  const {
    students,
    classes,
    payments,
    attendances,
    isOnline,
    queue,
    syncNow,
    resetData,
    upsertStudent,
    deleteStudent,
    saveClass,
    deleteClass,
    processPayment,
    deletePayment,
    recordAttendance,
    cancelAttendance
  } = useData();

  // Active Tab & PIN Protection
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isFinancesUnlocked, setIsFinancesUnlocked] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    if (tab === 'payments' && !isFinancesUnlocked) {
      setIsPinModalOpen(true);
    } else {
      setSelectedProfileStudent(null);
      setActiveTab(tab);
    }
  };

  const handlePinSuccess = () => {
    setIsFinancesUnlocked(true);
    setSelectedProfileStudent(null);
    setActiveTab('payments');
  };

  const handleLockFinances = () => {
    setIsFinancesUnlocked(false);
    setActiveTab('home');
  };

  // Modals
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentDefaultStudent, setPaymentDefaultStudent] = useState<Student | null>(null);
  const [paymentToEdit, setPaymentToEdit] = useState<Payment | null>(null);

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classToEdit, setClassToEdit] = useState<ClassSchedule | null>(null);

  const [activeReceipt, setActiveReceipt] = useState<Payment | null>(null);
  const [selectedProfileStudent, setSelectedProfileStudent] = useState<Student | null>(null);

  // Global Confirmation Popup State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemName?: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Reset Demo Seed Data (clears client cache + queue and refetches; DAL-REQ-7)
  const handleResetData = () => {
    setConfirmModal({
      isOpen: true,
      title: '¿Restablecer Datos de Ejemplo?',
      message: 'Esta acción reiniciará el sistema con los alumnos, clases y pagos iniciales de prueba.',
      confirmText: 'Sí, Restablecer',
      onConfirm: () => {
        void resetData();
      }
    });
  };

  // Handlers: Mark Attendance
  const handleMarkAttendance = (studentId: string, classId?: string, className?: string, dateStrOverride?: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const dateStr = dateStrOverride || todayStr;

    const newAttendance: AttendanceRecord = {
      id: `att-${Date.now()}`,
      studentId: student.id,
      studentName: student.name,
      classId,
      className: className || 'Entrenamiento Libre',
      date: dateStr,
      time: timeStr,
      recordedOffline: !isOnline
    };

    // Write-through: optimistic state + cache always; repo upsert online,
    // offline item enqueued when offline (DAL-REQ-4). Status recomputes on
    // render from derived status, never persisted.
    void recordAttendance(newAttendance);
  };

  const handleCancelAttendance = (attendanceId: string) => {
    void cancelAttendance(attendanceId);
  };

  // Handlers: Student Save
  const handleSaveStudent = (newOrUpdatedStudent: Student) => {
    void upsertStudent(newOrUpdatedStudent);
  };

  // Handlers: Delete Student
  const handleDeleteStudent = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar Alumno?',
      message: '¿Estás seguro de que deseas eliminar a este alumno? Se borrarán sus datos y su ficha del sistema.',
      itemName: student ? student.name : undefined,
      confirmText: 'Sí, Eliminar Alumno',
      onConfirm: () => {
        void deleteStudent(studentId);
        if (selectedProfileStudent?.id === studentId) {
          setSelectedProfileStudent(null);
        }
      }
    });
  };

  // Handlers: Process Payment (Create or Edit)
  const handleProcessPayment = (payment: Payment) => {
    void processPayment(payment);
    setActiveReceipt(payment);
  };

  // Handlers: Delete Payment
  const handleDeletePayment = (paymentId: string) => {
    const payment = payments.find((p) => p.id === paymentId);
    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar Registro de Pago?',
      message: '¿Estás seguro de que deseas eliminar este pago? El saldo y estado financiero del alumno se recalcularán automáticamente.',
      itemName: payment
        ? `$${payment.amount.toLocaleString('es-CL')} CLP - ${payment.studentName} (${payment.receiptNumber || 'Sin folio'})`
        : undefined,
      confirmText: 'Sí, Eliminar Pago',
      onConfirm: () => {
        void deletePayment(paymentId);
      }
    });
  };

  const handleOpenNewPayment = (defaultStudent?: Student | null) => {
    setPaymentToEdit(null);
    setPaymentDefaultStudent(defaultStudent || null);
    setIsPaymentModalOpen(true);
  };

  const handleOpenEditPayment = (payment: Payment) => {
    setPaymentToEdit(payment);
    setPaymentDefaultStudent(null);
    setIsPaymentModalOpen(true);
  };

  // Handlers: Save Class
  const handleSaveClass = (cls: ClassSchedule) => {
    void saveClass(cls);
  };

  // Handlers: Delete Class
  const handleDeleteClass = (classId: string) => {
    const cls = classes.find((c) => c.id === classId);
    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar Clase de la Agenda?',
      message: '¿Estás seguro de que deseas eliminar esta clase de la programación semanal?',
      itemName: cls ? `${cls.name} (${cls.startTime} hrs)` : undefined,
      confirmText: 'Sí, Eliminar Clase',
      onConfirm: () => {
        void deleteClass(classId);
      }
    });
  };

  const currentSelectedStudent = selectedProfileStudent
    ? students.find((s) => s.id === selectedProfileStudent.id) || selectedProfileStudent
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-[#7628A6] selection:text-white">
      {/* App Header */}
      <Header
        isOnline={isOnline}
        pendingSyncCount={queue.length}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onResetData={handleResetData}
        onSync={() => {
          void syncNow();
        }}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {currentSelectedStudent ? (
          <StudentProfileView
            student={currentSelectedStudent}
            payments={payments}
            attendances={attendances}
            onBack={() => setSelectedProfileStudent(null)}
            onOpenPaymentModal={(student) => {
              handleOpenNewPayment(student);
            }}
            onEditStudent={(student) => {
              setStudentToEdit(student);
              setIsStudentModalOpen(true);
            }}
            onDeleteStudent={handleDeleteStudent}
            onViewReceipt={(payment) => {
              setActiveReceipt(payment);
            }}
            onEditPayment={handleOpenEditPayment}
            onDeletePayment={handleDeletePayment}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeTab
                students={students}
                classes={classes}
                payments={payments}
                onNavigateTab={handleTabChange}
                onOpenNewClass={() => {
                  setClassToEdit(null);
                  setIsClassModalOpen(true);
                }}
                onOpenNewStudent={() => {
                  setStudentToEdit(null);
                  setIsStudentModalOpen(true);
                }}
                onOpenNewPayment={(student) => {
                  handleOpenNewPayment(student || null);
                }}
                onSelectStudentProfile={(student) => {
                  setSelectedProfileStudent(student);
                }}
                onEditClass={(cls) => {
                  setClassToEdit(cls);
                  setIsClassModalOpen(true);
                }}
              />
            )}

            {activeTab === 'students' && (
              <StudentsTab
                students={students}
                onOpenNewStudent={() => {
                  setStudentToEdit(null);
                  setIsStudentModalOpen(true);
                }}
                onEditStudent={(student) => {
                  setStudentToEdit(student);
                  setIsStudentModalOpen(true);
                }}
                onDeleteStudent={handleDeleteStudent}
                onOpenPaymentModal={(student) => {
                  handleOpenNewPayment(student);
                }}
                onSelectStudentProfile={(student) => {
                  setSelectedProfileStudent(student);
                }}
              />
            )}

            {activeTab === 'payments' && (
              <PaymentsTab
                payments={payments}
                students={students}
                onOpenNewPayment={(defaultStudent) => {
                  handleOpenNewPayment(defaultStudent);
                }}
                onViewReceipt={(payment) => {
                  setActiveReceipt(payment);
                }}
                onEditPayment={handleOpenEditPayment}
                onDeletePayment={handleDeletePayment}
                onLockFinances={handleLockFinances}
              />
            )}

            {activeTab === 'schedule' && (
              <ScheduleTab
                classes={classes}
                attendances={attendances}
                students={students}
                onOpenNewClass={() => {
                  setClassToEdit(null);
                  setIsClassModalOpen(true);
                }}
                onEditClass={(cls) => {
                  setClassToEdit(cls);
                  setIsClassModalOpen(true);
                }}
                onDeleteClass={handleDeleteClass}
                onMarkAttendance={handleMarkAttendance}
                onCancelAttendance={handleCancelAttendance}
                onOpenPaymentModal={(student) => {
                  handleOpenNewPayment(student);
                }}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsTab
                attendances={attendances}
                students={students}
                classes={classes}
                onDeleteAttendance={handleCancelAttendance}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500 font-medium">
        Intense Studio • Control de Gym y Clases con Persistencia Offline • {new Date().getFullYear()}
      </footer>

      {/* Modals */}
      <StudentModal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        onSave={handleSaveStudent}
        studentToEdit={studentToEdit}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentToEdit(null);
        }}
        students={students}
        attendances={attendances}
        payments={payments}
        defaultStudent={paymentDefaultStudent}
        paymentToEdit={paymentToEdit}
        onProcessPayment={handleProcessPayment}
      />

      <ClassModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        onSave={handleSaveClass}
        classToEdit={classToEdit}
      />

      <ReceiptModal payment={activeReceipt} attendances={attendances} onClose={() => setActiveReceipt(null)} />

      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
        requiredPin="0108"
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        itemName={confirmModal.itemName}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}