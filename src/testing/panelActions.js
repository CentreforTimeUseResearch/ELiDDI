import { vi } from 'vitest';
import { setProps } from '../components/propsRegistry';

// A Timeline's panelActions are injected by its stack (ADR 0005). For a
// Timeline mounted on its own in a test, this gives it stub ones: set the
// returned key before connecting it. setProps binds each stub, so a test
// that asserts on an action assigns its own vi.fn() on el.panelActions.
export function stubPanelActionsKey() {
  return setProps(
    {},
    {
      openEntry: vi.fn(),
      openNewEntry: vi.fn(),
      close: vi.fn(),
      reportSaveConflict: vi.fn(),
    },
    true
  );
}
