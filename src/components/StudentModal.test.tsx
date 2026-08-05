// @vitest-environment jsdom
/**
 * StudentModal component tests (follow-up #3: component test coverage).
 * Covers the manual active flag toggle (STATUS-REQ-1 / DAL-REQ-5): the switch
 * defaults to active, flips to inactive on click, persists the value in the
 * saved student, and preloads inactive state when editing an inactive student.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentModal } from './StudentModal';
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

function renderModal(overrides: Partial<React.ComponentProps<typeof StudentModal>> = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    studentToEdit: null,
    ...overrides,
  };
  render(<StudentModal {...props} />);
  return {
    ...props,
    onSave: vi.mocked(props.onSave),
  };
}

describe('StudentModal', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <StudentModal isOpen={false} onClose={vi.fn()} onSave={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows new-student title when creating', () => {
    renderModal();
    expect(screen.getByText('NUEVO REGISTRO DE ALUMNO')).toBeInTheDocument();
  });

  it('shows edit title and preloads data when editing', () => {
    renderModal({ studentToEdit: baseStudent({ active: false }) });
    expect(screen.getByText('EDITAR ALUMNO')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Camila Muñoz')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('defaults the active toggle to active for new students', () => {
    renderModal();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Activo — participa en clases y finanzas/i)).toBeInTheDocument();
  });

  it('flips the active toggle and saves active=false', async () => {
    const user = userEvent.setup();
    const props = renderModal();
    await user.click(screen.getByRole('switch', { name: 'Alternar estado activo/inactivo' }));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/Inactivo — se muestra con el marcador de inactivo/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Ej: Camila Muñoz Contreras'), 'Ana Soto');
    await user.click(screen.getByRole('button', { name: 'Registrar Alumno' }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
    const saved = props.onSave.mock.calls[0][0] as Student;
    expect(saved.active).toBe(false);
  });

  it('preloads inactive state when editing an inactive student and saves it back', async () => {
    const user = userEvent.setup();
    const student = baseStudent({ active: false });
    const props = renderModal({ studentToEdit: student });
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
    const saved = props.onSave.mock.calls[0][0] as Student;
    expect(saved.active).toBe(false);
    expect(saved.id).toBe(student.id);
  });
});
