/**
 * Gym Control Class Enrollment Persistence Utility
 */

export const ENROLLMENT_STORAGE_KEY = 'gymcontrol_class_enrollments_v3';

export function getClassEnrollments(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(ENROLLMENT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return {
    'class-1': ['std-1', 'std-2', 'std-3'],
    'class-2': ['std-5', 'std-4', 'std-6'],
    'class-3': ['std-2', 'std-3'],
    'class-4': ['std-1', 'std-4'],
    'class-5': ['std-5', 'std-6']
  };
}

export function saveClassEnrollments(enrollments: Record<string, string[]>) {
  localStorage.setItem(ENROLLMENT_STORAGE_KEY, JSON.stringify(enrollments));
}

export function getEnrolledStudentIds(
  enrollments: Record<string, string[]>,
  classId: string,
  dayOfWeek: number
): string[] {
  const specificKey = `${classId}_day_${dayOfWeek}`;
  if (enrollments[specificKey] !== undefined) {
    return enrollments[specificKey];
  }
  if (enrollments[classId] !== undefined) {
    return enrollments[classId];
  }
  return [];
}
