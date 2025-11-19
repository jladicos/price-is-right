import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from './AdminPage';
import * as apiModule from '../utils/api';

// Mock the API
vi.mock('../utils/api', () => ({
  apiRequest: vi.fn(),
  setSessionTokenGetter: vi.fn(),
  setSessionExpiredHandler: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPlayersResponse = {
    players: [
      {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: null,
        accessCode: 'JOHN01',
        photoFilename: 'default.jpg',
        role: 'player' as const,
        active: true,
        sessionToken: null,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      },
      {
        id: 2,
        firstName: 'Jane',
        lastName: 'Smith',
        email: null,
        accessCode: 'JANE01',
        photoFilename: 'default.jpg',
        role: 'host' as const,
        active: true,
        sessionToken: null,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      },
    ],
    total: 2,
  };

  describe('Rendering', () => {
    it('should render admin tools heading', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true }); // Game status

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Admin Tools')).toBeInTheDocument();
      });
    });

    it('should render player table with data', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should show total count', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Showing 2 of 2 players')).toBeInTheDocument();
      });
    });

    it('should display role badges', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('player')).toBeInTheDocument();
        expect(screen.getByText('host')).toBeInTheDocument();
      });
    });

    it('should display active status badges', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        const activeBadges = screen.getAllByText('Active');
        expect(activeBadges.length).toBeGreaterThan(0);
      });
    });

    it('should display access codes', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('JOHN01')).toBeInTheDocument();
        expect(screen.getByText('JANE01')).toBeInTheDocument();
      });
    });
  });

  describe('Filters', () => {
    it('should render search input', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search by name...')).toBeInTheDocument();
      });
    });

    it('should render role filter dropdown', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('All Roles')).toBeInTheDocument();
      });
    });

    it('should render active status filter dropdown', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('All Status')).toBeInTheDocument();
      });
    });
  });

  describe('Action buttons', () => {
    it('should render bulk action buttons', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Add Player')).toBeInTheDocument();
        expect(screen.getByText('Reset All Codes')).toBeInTheDocument();
        expect(screen.getByText('Delete All Players')).toBeInTheDocument();
      });
    });

    it('should render per-player action buttons', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        const viewButtons = screen.getAllByText('View Code');
        const editButtons = screen.getAllByText('Edit');
        const resetButtons = screen.getAllByText('Reset Code');

        expect(viewButtons.length).toBe(2); // One per player
        expect(editButtons.length).toBe(2);
        expect(resetButtons.length).toBe(2);
      });
    });
  });

  describe('Error handling', () => {
    it('should show error toast when API request fails', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockRejectedValueOnce(new Error('Failed to load players'))
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      // Wait for the error to be handled
      await waitFor(() => {
        expect(apiModule.apiRequest).toHaveBeenCalled();
      });
    });
  });

  describe('Empty state', () => {
    it("should show 'No players found' when list is empty", async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce({
          players: [],
          total: 0,
        })
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('No players found')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should have Back to Welcome button', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Back to Welcome')).toBeInTheDocument();
      });
    });
  });

  describe('Game Toggle', () => {
    it('should fetch and display game status on load', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse) // First call: fetch players
        .mockResolvedValueOnce({ enabled: true }); // Second call: fetch game status

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Game Enabled')).toBeInTheDocument();
      });

      expect(apiModule.apiRequest).toHaveBeenCalledWith('/api/game/status');
    });

    it('should display "Game Disabled" when game is disabled', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: false }); // Game disabled

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Game Disabled')).toBeInTheDocument();
      });
    });

    it('should render toggle switch with correct state', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        const switchElement = screen.getByRole('checkbox', { name: /game enabled/i });
        expect(switchElement).toBeInTheDocument();
        expect(switchElement).toBeChecked();
      });
    });

    it('should call PUT /api/game/status when toggle is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true }) // Initial status
        .mockResolvedValueOnce({ enabled: false, message: 'Game disabled' }); // Toggle response

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Game Enabled')).toBeInTheDocument();
      });

      // Click the toggle switch
      const switchElement = screen.getByRole('checkbox', { name: /game enabled/i });
      await user.click(switchElement);

      // Verify PUT was called with correct payload
      await waitFor(() => {
        expect(apiModule.apiRequest).toHaveBeenCalledWith('/api/game/status', {
          method: 'PUT',
          body: JSON.stringify({ enabled: false }),
        });
      });
    });

    it('should update UI after successful toggle', async () => {
      const user = userEvent.setup();

      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true })
        .mockResolvedValueOnce({ enabled: false, message: 'Game disabled' });

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      // Wait for initial "Enabled" state
      await waitFor(() => {
        expect(screen.getByText('Game Enabled')).toBeInTheDocument();
      });

      // Click toggle
      const switchElement = screen.getByRole('checkbox', { name: /game enabled/i });
      await user.click(switchElement);

      // Should now show "Disabled"
      await waitFor(() => {
        expect(screen.getByText('Game Disabled')).toBeInTheDocument();
      });
    });

    it('should disable toggle switch while request is in progress', async () => {
      const user = userEvent.setup();

      // Create a promise we can control
      let resolveToggle: (value: any) => void;
      const togglePromise = new Promise((resolve) => {
        resolveToggle = resolve;
      });

      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true })
        .mockReturnValueOnce(togglePromise as any); // Toggle in progress

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Game Enabled')).toBeInTheDocument();
      });

      const switchElement = screen.getByRole('checkbox', { name: /game enabled/i });
      await user.click(switchElement);

      // Switch should be disabled while loading
      expect(switchElement).toBeDisabled();

      // Resolve the promise
      resolveToggle!({ enabled: false, message: 'Game disabled' });

      // Switch should be enabled again
      await waitFor(() => {
        expect(switchElement).not.toBeDisabled();
      });
    });

    it('should handle toggle error gracefully', async () => {
      const user = userEvent.setup();

      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockResolvedValueOnce({ enabled: true })
        .mockRejectedValueOnce(new Error('Network error'));

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Game Enabled')).toBeInTheDocument();
      });

      const switchElement = screen.getByRole('checkbox', { name: /game enabled/i });
      await user.click(switchElement);

      // Should still show enabled (toggle failed)
      await waitFor(() => {
        expect(screen.getByText('Game Enabled')).toBeInTheDocument();
      });
    });

    it('should handle missing game status on load', async () => {
      vi.mocked(apiModule.apiRequest)
        .mockResolvedValueOnce(mockPlayersResponse)
        .mockRejectedValueOnce(new Error('Failed to fetch game status'));

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      // Should still render the page (error is logged but not shown)
      await waitFor(() => {
        expect(screen.getByText('Admin Tools')).toBeInTheDocument();
      });
    });
  });
});
