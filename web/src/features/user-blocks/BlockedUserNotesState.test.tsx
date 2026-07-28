import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BlockedUserNotesState from './BlockedUserNotesState';

describe('BlockedUserNotesState', () => {
  it('explains that notes are hidden instead of showing the generic empty state', () => {
    render(<BlockedUserNotesState />);

    expect(screen.getByRole('status')).toHaveTextContent('title');
    expect(screen.getByRole('status')).toHaveTextContent('description');
    expect(screen.queryByText('empty')).not.toBeInTheDocument();
  });
});
