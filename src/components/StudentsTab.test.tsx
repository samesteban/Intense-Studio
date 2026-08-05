// @vitest-environment jsdom
/**
 * StudentsTab component tests (follow-up #3: component test coverage).
 * Verifies the roster renders students with their derived status badge
 * (STATUS-REQ-2/6): an inactive student always shows the "Inactivo" marker
 * (never a finance badge), and active students are filtered by finance status.
 *
 * Note: the filter pills ("Al Día" / "Con Deuda") are always rendered as
 * buttons, so status-badge assertions use queryAllByText scoped to the card
 * list rather than a bare getByText (which would match the pill too).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentsTab } from './StudentsTab';
import type { Student } from '../types';

function baseStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'std-1',
    name: 'Camila Muñoz',
    phone: '+56912345678',
    email: 'camila@example.com',
    registrationDate: '2026-01-10',
    active: true,
    ...overrides,
  };
}

function renderTab(students: Student[]) {
  const props = {
    students,
    attendances: [],
    payments: [],
    onOpenNewStudent: vi.fn(),
    onEditStudent: vi.fn(),
    onDeleteStudent: vi.fn(),
    onOpenPaymentModal: vi.fn(),
    onSelectStudentProfile: vi.fn(),
  };
  render(<StudentsTab {...props} />);
  return props;
}

/** The roster card for a student, located by its container class. */
function cardFor(name: string): HTMLElement {
  const card = screen.getByText(name).closest('.rounded-2xl') as HTMLElement | null;
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

describe('StudentsTab', () => {
  it('shows the "Inactivo" marker for an inactive student (no finance badge)', () => {
    renderTab([baseStudent({ id: 'a', name: 'Inactiva', active: false })]);
    expect(screen.getByText('Inactiva')).toBeInTheDocument();
    // No finance badge in the card: pill buttons always render Al Día/Con Deuda,
    // so assert the student card has exactly the inactive marker and no others.
    const card = cardFor('Inactiva');
    expect(within(card).getByText('Inactivo')).toBeInTheDocument();
    expect(within(card).queryByText('Al Día')).not.toBeInTheDocument();
    expect(within(card).queryByText('Con Deuda')).not.toBeInTheDocument();
  });

  it('shows "Al Día" for an active student with no debt', () => {
    renderTab([baseStudent({ id: 'b', name: 'Al Dia Alumna', active: true })]);
    const card = cardFor('Al Dia Alumna');
    expect(within(card).getByText('Al Día')).toBeInTheDocument();
    expect(within(card).queryByText('Inactivo')).not.toBeInTheDocument();
  });

  it('filters students by name via search', async () => {
    const user = userEvent.setup();
    renderTab([
      baseStudent({ id: 'one', name: 'Nombre Unico', active: true }),
      baseStudent({ id: 'two', name: 'Otra Persona', active: true }),
    ]);
    const search = screen.getByPlaceholderText('Buscar por Nombre o Teléfono...');
    await user.type(search, 'Nombre Unico');
    expect(screen.getByText('Nombre Unico')).toBeInTheDocument();
    expect(screen.queryByText('Otra Persona')).not.toBeInTheDocument();
  });

  it('calls onOpenNewStudent from the "+ Nuevo Alumno" button', async () => {
    const user = userEvent.setup();
    const props = renderTab([]);
    await user.click(screen.getByRole('button', { name: '+ Nuevo Alumno' }));
    expect(props.onOpenNewStudent).toHaveBeenCalledTimes(1);
  });

  it('shows an empty-state message when no students match the filters', async () => {
    const user = userEvent.setup();
    renderTab([baseStudent({ id: 'hidden', name: 'Visible Inicialmente', active: true })]);
    expect(screen.getByText('Visible Inicialmente')).toBeInTheDocument();
    // Type a search that matches nothing -> empty-state message appears.
    await user.type(
      screen.getByPlaceholderText('Buscar por Nombre o Teléfono...'),
      'zzz-no-existe',
    );
    expect(
      screen.getByText('No se encontraron alumnos con los filtros seleccionados.'),
    ).toBeInTheDocument();
  });
});