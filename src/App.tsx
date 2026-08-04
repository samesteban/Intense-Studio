/**
 * Intense Studio - Main Gym Management Web Application
 */
import React, { useState, useEffect } from 'react';
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

import {
  AttendanceRecord,
  ClassSchedule,
  OfflineSyncItem,
  Payment,
  Student
} from './types';

import {
  addToOfflineQueue,
  clearOfflineQueue,
  computeMemberStatus,
  getAttendance,
  getClasses,
  getOfflineQueue,
  getPayments,
  getStudents,
  initStorageSeed,
  saveAttendance,
  saveClasses,
  savePayments,
  saveStudents
} from './utils/storage';

export default function App() {
  // Offline State Listener
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncQueue, setPendingSyncQueue] = useState<OfflineSyncItem[]>(getOfflineQueue());

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

  // Core Gym Data
  const [students, setStudentsState] = useState<Student[]>([]);
  const [classes, setClassesState] = useState<ClassSchedule[]>([]);
  const [payments, setPaymentsState] = useState<Payment[]>([]);
  const [attendances, setAttendancesState] = useState<AttendanceRecord[]>([]);

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

  // Initialize and update status on mount
  useEffect(() => {
    initStorageSeed();
    refreshAllData();

    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshAllData = () => {
    const rawStudents = getStudents();
    const rawAtts = getAttendance();
    const rawPays = getPayments();
    const updatedStudents = rawStudents.map((s) => computeMemberStatus(s, rawAtts, rawPays));
    saveStudents(updatedStudents);

    setStudentsState(updatedStudents);
    setClassesState(getClasses());
    setPaymentsState(rawPays);
    setAttendancesState(rawAtts);
    setPendingSyncQueue(getOfflineQueue());
  };

  // Sync Offline Queue
  const handleSyncOfflineData = () => {
    if (pendingSyncQueue.length === 0) return;
    clearOfflineQueue();
    setPendingSyncQueue([]);
    refreshAllData();
  };

  // Reset Demo Seed Data
  const handleResetData = () => {
    setConfirmModal({
      isOpen: true,
      title: '¿Restablecer Datos de Ejemplo?',
      message: 'Esta acción reiniciará el sistema con los alumnos, clases y pagos iniciales de prueba.',
      confirmText: 'Sí, Restablecer',
      onConfirm: () => {
        initStorageSeed(true);
        refreshAllData();
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

    const updatedAttendances = [newAttendance, ...attendances];
    setAttendancesState(updatedAttendances);
    saveAttendance(updatedAttendances);

    // Recalculate student status after adding attendance
    const updatedStudentsList = students.map((s) => computeMemberStatus(s, updatedAttendances, payments));
    setStudentsState(updatedStudentsList);
    saveStudents(updatedStudentsList);

    if (!isOnline) {
      addToOfflineQueue({
        action: 'RECORD_ATTENDANCE',
        entity: 'Attendance',
        payload: newAttendance
      });
      setPendingSyncQueue(getOfflineQueue());
    }
  };

  const handleCancelAttendance = (attendanceId: string) => {
    const updatedAttendances = attendances.filter((a) => a.id !== attendanceId);
    setAttendancesState(updatedAttendances);
    saveAttendance(updatedAttendances);

    const updatedStudentsList = students.map((s) => computeMemberStatus(s, updatedAttendances, payments));
    setStudentsState(updatedStudentsList);
    saveStudents(updatedStudentsList);
  };

  // Handlers: Student Save
  const handleSaveStudent = (newOrUpdatedStudent: Student) => {
    const exists = students.some((s) => s.id === newOrUpdatedStudent.id);
    const computed = computeMemberStatus(newOrUpdatedStudent, attendances, payments);
    let updatedList: Student[] = [];

    if (exists) {
      updatedList = students.map((s) => (s.id === computed.id ? computed : s));
    } else {
      updatedList = [computed, ...students];
    }

    setStudentsState(updatedList);
    saveStudents(updatedList);

    if (!isOnline) {
      addToOfflineQueue({
        action: exists ? 'UPDATE_STUDENT' : 'CREATE_STUDENT',
        entity: 'Student',
        payload: computed
      });
      setPendingSyncQueue(getOfflineQueue());
    }
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
        const updatedList = students.filter((s) => s.id !== studentId);
        setStudentsState(updatedList);
        saveStudents(updatedList);
        if (selectedProfileStudent?.id === studentId) {
          setSelectedProfileStudent(null);
        }
      }
    });
  };

  // Handlers: Process Payment (Create or Edit)
  const handleProcessPayment = (payment: Payment) => {
    const exists = payments.some((p) => p.id === payment.id);
    let updatedPayments: Payment[] = [];

    if (exists) {
      updatedPayments = payments.map((p) => (p.id === payment.id ? payment : p));
    } else {
      updatedPayments = [payment, ...payments];
    }

    setPaymentsState(updatedPayments);
    savePayments(updatedPayments);

    const updatedStudentsList = students.map((s) => computeMemberStatus(s, attendances, updatedPayments));
    setStudentsState(updatedStudentsList);
    saveStudents(updatedStudentsList);

    setActiveReceipt(payment);

    if (!isOnline) {
      addToOfflineQueue({
        action: 'RECORD_PAYMENT',
        entity: 'Payment',
        payload: payment
      });
      setPendingSyncQueue(getOfflineQueue());
    }
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
        const updatedPayments = payments.filter((p) => p.id !== paymentId);
        setPaymentsState(updatedPayments);
        savePayments(updatedPayments);

        const updatedStudentsList = students.map((s) => computeMemberStatus(s, attendances, updatedPayments));
        setStudentsState(updatedStudentsList);
        saveStudents(updatedStudentsList);
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
    const exists = classes.some((c) => c.id === cls.id);
    let updatedList: ClassSchedule[] = [];

    if (exists) {
      updatedList = classes.map((c) => (c.id === cls.id ? cls : c));
    } else {
      updatedList = [...classes, cls];
    }

    setClassesState(updatedList);
    saveClasses(updatedList);
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
        const updatedList = classes.filter((c) => c.id !== classId);
        setClassesState(updatedList);
        saveClasses(updatedList);
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
        pendingSyncCount={pendingSyncQueue.length}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onResetData={handleResetData}
        onSync={handleSyncOfflineData}
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
