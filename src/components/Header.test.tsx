// @vitest-environment jsdom
/**
 * Header component tests (follow-up #3: component test coverage).
 * Header is a pure prop-driven component: offline banner, sync buttons,
 * quarantine badge, online/offline indicator and tab navigation.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';

function renderHeader(overrides: Partial<React.ComponentProps<typeof Header>> = {}) {
  const defaults: React.ComponentProps<typeof Header> = {
    isOnline: true,
    pendingSyncCount: 0,
    quarantinedCount: 0,
    activeTab: 'home',
    setActiveTab: vi.fn(),
    onResetData: vi.fn(),
    onSync: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  const result = render(<Header {...props} />);
  return { ...props, ...result };
}

describe('Header', () => {
  it('renders the offline banner when offline', () => {
    renderHeader({ isOnline: false });
    expect(screen.getByText(/MODO OFFLINE ACTIVO/i)).toBeInTheDocument();
  });

  it('does not render the offline banner when online', () => {
    renderHeader({ isOnline: true });
    expect(screen.queryByText(/MODO OFFLINE ACTIVO/i)).not.toBeInTheDocument();
  });

  it('shows the sync count button in the offline banner when there are pending changes', () => {
    renderHeader({ isOnline: false, pendingSyncCount: 3 });
    expect(
      screen.getByRole('button', { name: /Sincronizar 3 cambios pendientes/i }),
    ).toBeInTheDocument();
  });

  it('shows the manual sync button when online with pending changes', () => {
    renderHeader({ isOnline: true, pendingSyncCount: 2 });
    expect(screen.getByRole('button', { name: 'Sincronizar 2' })).toBeInTheDocument();
  });

  it('hides both sync buttons when there are no pending changes', () => {
    renderHeader({ isOnline: true, pendingSyncCount: 0 });
    expect(screen.queryByRole('button', { name: /^Sincronizar/ })).not.toBeInTheDocument();
  });

  it('calls onSync when the offline sync button is clicked', async () => {
    const user = userEvent.setup();
    const props = renderHeader({ isOnline: false, pendingSyncCount: 4 });
    await user.click(screen.getByRole('button', { name: /Sincronizar 4 cambios pendientes/i }));
    expect(props.onSync).toHaveBeenCalledTimes(1);
  });

  it('calls onSync when the quarantine badge is clicked', async () => {
    const user = userEvent.setup();
    const props = renderHeader({ quarantinedCount: 2 });
    await user.click(screen.getByRole('button', { name: /2 en cuarentena/i }));
    expect(props.onSync).toHaveBeenCalledTimes(1);
  });

  it('renders the quarantine badge only when quarantinedCount > 0', () => {
    const { unmount } = renderHeader({ quarantinedCount: 1 });
    expect(screen.getByRole('button', { name: /1 en cuarentena/i })).toBeInTheDocument();
    unmount();
    renderHeader({ quarantinedCount: 0 });
    expect(screen.queryByRole('button', { name: /en cuarentena/i })).not.toBeInTheDocument();
  });

  it('shows the online indicator when online and offline indicator when offline', () => {
    const { unmount } = renderHeader({ isOnline: true });
    expect(screen.getByTitle('En Línea')).toBeInTheDocument();
    unmount();
    renderHeader({ isOnline: false });
    expect(screen.getByTitle('Sin conexión')).toBeInTheDocument();
  });

  it('renders all navigation tabs and calls setActiveTab on click', async () => {
    const user = userEvent.setup();
    const props = renderHeader({ activeTab: 'home' });
    const labels = ['Inicio', 'Alumnos', 'Agenda & Clases', 'Asistencia', 'Finanzas'];
    for (const label of labels) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: 'Alumnos' }));
    expect(props.setActiveTab).toHaveBeenCalledWith('students');
  });
});
