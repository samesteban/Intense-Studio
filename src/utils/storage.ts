/**
 * Storage and Offline Synchronization Manager
 * Handles local persistence in localStorage and offline queue
 */
import {
  AttendanceRecord,
  ClassSchedule,
  OfflineSyncItem,
  Payment,
  Student
} from '../types';
import { calculateStudentFinances } from './pricing';

const STORAGE_KEYS = {
  STUDENTS: 'gymcontrol_students_v3',
  PAYMENTS: 'gymcontrol_payments_v3',
  CLASSES: 'gymcontrol_classes_v3',
  ATTENDANCE: 'gymcontrol_attendance_v3',
  OFFLINE_QUEUE: 'gymcontrol_offline_queue_v3',
  SEEDED: 'gymcontrol_seeded_v3'
};

// Seed initial Chilean Gym data
const INITIAL_STUDENTS: Student[] = [
  {
    id: 'std-1',
    name: 'Camila Muñoz Contreras',
    phone: '+56987654321',
    email: 'camila.m@gmail.com',
    registrationDate: '2026-06-15',
    status: 'al_dia',
    lastPaymentAmount: 10000,
    lastPaymentDate: '2026-08-01',
    notes: 'Lesión leve en rodilla izquierda. Evitar sentadillas pesadas.'
  },
  {
    id: 'std-2',
    name: 'Rodrigo Fuenzalida Lagos',
    phone: '+56976543210',
    email: 'rodrigo.f@hotm.com',
    registrationDate: '2026-05-10',
    status: 'al_dia',
    lastPaymentAmount: 15000,
    lastPaymentDate: '2026-07-20',
    notes: 'Entrena CrossFit 19:00 hrs.'
  },
  {
    id: 'std-3',
    name: 'Valentina Silva Sepúlveda',
    phone: '+56965432109',
    email: 'valesilva@gmail.com',
    registrationDate: '2026-07-01',
    status: 'con_deuda',
    lastPaymentAmount: 5000,
    lastPaymentDate: '2026-07-06',
    notes: 'Recordar pago de saldo vía WhatsApp.'
  },
  {
    id: 'std-4',
    name: 'Gonzalo Rojas Paredes',
    phone: '+56954321098',
    registrationDate: '2026-04-12',
    status: 'con_deuda',
    lastPaymentAmount: 0,
    lastPaymentDate: '',
    notes: 'Registrado recientemente.'
  },
  {
    id: 'std-5',
    name: 'Javiera Torres Alarcón',
    phone: '+56943210987',
    email: 'javi.torres@outlook.cl',
    registrationDate: '2026-08-02',
    status: 'al_dia',
    lastPaymentAmount: 2500,
    lastPaymentDate: '2026-08-03',
    notes: 'Pagado en efectivo clase individual.'
  },
  {
    id: 'std-6',
    name: 'Matías Araneda Tapia',
    phone: '+56932109876',
    registrationDate: '2026-07-15',
    status: 'al_dia',
    lastPaymentAmount: 10000,
    lastPaymentDate: '2026-07-15',
    notes: 'Al día.'
  }
];

const INITIAL_CLASSES: ClassSchedule[] = [
  {
    id: 'class-1',
    name: 'CrossFit WOD & High Power',
    startTime: '08:00',
    endTime: '09:00',
    daysOfWeek: [1, 3, 5], // Lunes, Miércoles, Viernes
    maxCapacity: 15,
    color: '#84cc16', // Neon Lime
    description: 'Entrenamiento de alta intensidad con barras, pesas rusas y cardio.'
  },
  {
    id: 'class-2',
    name: 'Entrenamiento Funcional Express',
    startTime: '10:00',
    endTime: '11:00',
    daysOfWeek: [1, 2, 3, 4, 5], // Lun - Vie
    maxCapacity: 20,
    color: '#38bdf8', // Sky Blue
    description: 'Circuito aeróbico y tonificación para todos los niveles.'
  },
  {
    id: 'class-3',
    name: 'Spinning & Cardio Resistance',
    startTime: '18:30',
    endTime: '19:30',
    daysOfWeek: [2, 4], // Martes, Jueves
    maxCapacity: 12,
    color: '#f97316', // Orange
    description: 'Ciclismo bajo techo con ritmos de alta energía.'
  },
  {
    id: 'class-4',
    name: 'Box & Kickboxing Fit',
    startTime: '19:30',
    endTime: '20:30',
    daysOfWeek: [1, 3, 5],
    maxCapacity: 15,
    color: '#e11d48', // Rose/Red
    description: 'Técnica de golpeo, sacos de boxeo y trabajo físico rudo.'
  },
  {
    id: 'class-5',
    name: 'Yoga Stretch & Mobility',
    startTime: '20:30',
    endTime: '21:30',
    daysOfWeek: [2, 4, 6],
    maxCapacity: 15,
    color: '#a855f7', // Purple
    description: 'Recuperación muscular, movilidad articular y relajación.'
  }
];

const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay-1001',
    studentId: 'std-1',
    studentName: 'Camila Muñoz Contreras',
    amount: 10000,
    paymentMethod: 'transferencia',
    paymentDate: '2026-08-01',
    receiptNumber: 'REC-2026-0801',
    notes: 'Pago abono clases. Comprobante BCO Chile.'
  },
  {
    id: 'pay-1002',
    studentId: 'std-2',
    studentName: 'Rodrigo Fuenzalida Lagos',
    amount: 15000,
    paymentMethod: 'efectivo',
    paymentDate: '2026-07-20',
    receiptNumber: 'REC-2026-0720',
    notes: 'Abono en efectivo.'
  },
  {
    id: 'pay-1003',
    studentId: 'std-3',
    studentName: 'Valentina Silva Sepúlveda',
    amount: 5000,
    paymentMethod: 'debito',
    paymentDate: '2026-07-06',
    receiptNumber: 'REC-2026-0706',
    notes: 'Pago abono asistencia.'
  },
  {
    id: 'pay-1004',
    studentId: 'std-5',
    studentName: 'Javiera Torres Alarcón',
    amount: 2500,
    paymentMethod: 'efectivo',
    paymentDate: '2026-08-03',
    receiptNumber: 'REC-2026-0803',
    notes: 'Pago clase individual.'
  }
];

const INITIAL_ATTENDANCES: AttendanceRecord[] = [
  {
    id: 'att-1',
    studentId: 'std-1',
    studentName: 'Camila Muñoz Contreras',
    classId: 'class-1',
    className: 'CrossFit WOD & High Power',
    date: '2026-08-03',
    time: '08:15',
    recordedOffline: false
  },
  {
    id: 'att-2',
    studentId: 'std-2',
    studentName: 'Rodrigo Fuenzalida Lagos',
    classId: 'class-1',
    className: 'CrossFit WOD & High Power',
    date: '2026-08-03',
    time: '08:20',
    recordedOffline: false
  },
  {
    id: 'att-3',
    studentId: 'std-5',
    studentName: 'Javiera Torres Alarcón',
    classId: 'class-2',
    className: 'Entrenamiento Funcional Express',
    date: '2026-08-03',
    time: '10:05',
    recordedOffline: false
  }
];

export function initStorageSeed(forceReset = false) {
  if (forceReset || !localStorage.getItem(STORAGE_KEYS.SEEDED)) {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(INITIAL_CLASSES));
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(INITIAL_PAYMENTS));
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(INITIAL_ATTENDANCES));
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');
  }
}

// Helpers
export function getStudents(): Student[] {
  initStorageSeed();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    return raw ? JSON.parse(raw) : INITIAL_STUDENTS;
  } catch (e) {
    return INITIAL_STUDENTS;
  }
}

export function saveStudents(students: Student[]) {
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
}

export function getClasses(): ClassSchedule[] {
  initStorageSeed();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLASSES);
    return raw ? JSON.parse(raw) : INITIAL_CLASSES;
  } catch (e) {
    return INITIAL_CLASSES;
  }
}

export function saveClasses(classes: ClassSchedule[]) {
  localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
}

export function getPayments(): Payment[] {
  initStorageSeed();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    return raw ? JSON.parse(raw) : INITIAL_PAYMENTS;
  } catch (e) {
    return INITIAL_PAYMENTS;
  }
}

export function savePayments(payments: Payment[]) {
  localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
}

export function getAttendance(): AttendanceRecord[] {
  initStorageSeed();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    return raw ? JSON.parse(raw) : INITIAL_ATTENDANCES;
  } catch (e) {
    return INITIAL_ATTENDANCES;
  }
}

export function saveAttendance(records: AttendanceRecord[]) {
  localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
}

// Offline queue management
export function getOfflineQueue(): OfflineSyncItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function addToOfflineQueue(item: Omit<OfflineSyncItem, 'id' | 'timestamp'>) {
  const queue = getOfflineQueue();
  const newItem: OfflineSyncItem = {
    ...item,
    id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString()
  };
  queue.push(newItem);
  localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
}

export function clearOfflineQueue() {
  localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify([]));
}

export function computeMemberStatus(student: Student, allAttendances?: AttendanceRecord[], allPayments?: Payment[]): Student {
  const atts = allAttendances || getAttendance();
  const pays = allPayments || getPayments();
  const summary = calculateStudentFinances(student.id, atts, pays);
  return {
    ...student,
    status: summary.status
  };
}
