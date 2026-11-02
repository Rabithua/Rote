import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import UnsavedSettingsDialog from './UnsavedSettingsDialog';
import { useAdminNavigationGuard } from './useAdminNavigationGuard';

vi.unmock('react-dom/client');

function mount({ saving = false } = {}) {
  const onDiscard = vi.fn();

  function Settings() {
    const [activeTab, setActiveTab] = useState<'site' | 'storage'>('site');
    const [value, setValue] = useState('saved');
    const [isSaving, setIsSaving] = useState(saving);
    const navigate = useNavigate();
    const guard = useAdminNavigationGuard({
      activeTab,
      hasUnsavedChanges: value !== 'saved',
      isSaving,
      onDiscard: () => {
        onDiscard();
        setValue('saved');
      },
      onTabChange: setActiveTab,
    });
    return (
      <>
        <output aria-label="active tab">{activeTab}</output>
        <input aria-label="setting" value={value} onChange={(e) => setValue(e.target.value)} />
        <button onClick={() => guard.requestTabChange('site')}>Site</button>
        <button onClick={() => guard.requestTabChange('storage')}>Storage</button>
        <button onClick={() => setIsSaving(false)}>Finish saving</button>
        <button onClick={() => navigate(-1)}>Back</button>
        <Link to="/home">Home</Link>
        <UnsavedSettingsDialog {...guard.dialogProps} />
      </>
    );
  }

  const router = createMemoryRouter(
    [
      { path: '/admin', element: <Settings /> },
      { path: '/home', element: <p>Home page</p> },
    ],
    { initialEntries: ['/home', '/admin'], initialIndex: 1 }
  );
  const view = render(<RouterProvider router={router} />);
  return { router, onDiscard, ...view };
}

function edit() {
  fireEvent.change(screen.getByRole('textbox', { name: 'setting' }), {
    target: { value: 'draft' },
  });
}

function unload() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('admin settings navigation protection', () => {
  it('allows clean tab and route changes without prompting', async () => {
    const { router, onDiscard } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Storage' }));
    expect(screen.getByLabelText('active tab')).toHaveTextContent('storage');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(unload().defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    await screen.findByText('Home page');
    expect(router.state.location.pathname).toBe('/home');
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('keeps drafts when cancelled, then discards only after confirmation', () => {
    const { onDiscard } = mount();
    edit();
    fireEvent.click(screen.getByRole('button', { name: 'Site' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Storage' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByLabelText('active tab')).toHaveTextContent('site');
    fireEvent.click(screen.getByRole('button', { name: 'continueEditing' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('draft');
    expect(onDiscard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Storage' }));
    fireEvent.click(screen.getByRole('button', { name: 'discardAndLeave' }));
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('active tab')).toHaveTextContent('storage');
    expect(screen.getByRole('textbox')).toHaveValue('saved');
    expect(unload().defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Site' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('treats Escape as continuing to edit', () => {
    const { onDiscard } = mount();
    edit();
    fireEvent.click(screen.getByRole('button', { name: 'Storage' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('draft');
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('treats clicking outside the dialog as continuing to edit', () => {
    vi.useFakeTimers();
    try {
      const { onDiscard } = mount();
      edit();
      fireEvent.click(screen.getByRole('button', { name: 'Storage' }));
      act(() => vi.advanceTimersByTime(0));
      fireEvent.pointerDown(document.querySelector('[data-slot="dialog-overlay"]')!, {
        pointerType: 'mouse',
        button: 0,
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('draft');
      expect(onDiscard).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('protects refresh and close only while changes or saves remain', () => {
    const { unmount } = mount();
    expect(unload().defaultPrevented).toBe(false);
    edit();
    expect(unload().defaultPrevented).toBe(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'saved' } });
    expect(unload().defaultPrevented).toBe(false);
    edit();
    unmount();
    expect(unload().defaultPrevented).toBe(false);
  });

  it('blocks route navigation and allows retry after continuing to edit', async () => {
    const { router, onDiscard } = mount();
    edit();
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    await screen.findByRole('dialog');
    expect(router.state.location.pathname).toBe('/admin');
    fireEvent.click(screen.getByRole('button', { name: 'continueEditing' }));
    expect(screen.getByRole('textbox')).toHaveValue('draft');
    expect(router.state.blockers.size).toBe(1);
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'discardAndLeave' }));
    await screen.findByText('Home page');
    expect(router.state.location.pathname).toBe('/home');
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('blocks browser back and resumes the pending history navigation', async () => {
    const { router } = mount();
    edit();
    await act(async () => router.navigate(-1));
    await screen.findByRole('dialog');
    expect(router.state.location.pathname).toBe('/admin');
    fireEvent.click(screen.getByRole('button', { name: 'discardAndLeave' }));
    await screen.findByText('Home page');
    expect(router.state.location.pathname).toBe('/home');
  });

  it('prevents leaving while a save is pending', async () => {
    const { router, onDiscard } = mount({ saving: true });
    expect(unload().defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Storage' }));
    expect(screen.getByLabelText('active tab')).toHaveTextContent('site');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'discardAndLeave' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'discardAndLeave' }));
    expect(router.state.location.pathname).toBe('/admin');
    expect(onDiscard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'continueEditing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish saving' }));
    await waitFor(() => expect(unload().defaultPrevented).toBe(false));
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    await screen.findByText('Home page');
  });
});
