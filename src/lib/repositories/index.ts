/**
 * Repository barrel — single import point for the data layer (DAL-REQ-2).
 */
export { repoError, type Repo } from './base';
export { studentsRepo } from './students';
export { paymentsRepo } from './payments';
export { classesRepo } from './classes';
export { attendanceRepo } from './attendance';
export { enrollmentsRepo, type EnrollmentsRepo } from './enrollments';
