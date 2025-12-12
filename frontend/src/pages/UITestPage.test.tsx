import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import UITestPage from './UITestPage';
import { apiRequest } from '../utils/api';

// Mock the router navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the API
vi.mock('../utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/api')>();
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

// Mock the phase view components since they have complex dependencies
vi.mock('../components/phases/BiddingPhaseView', () => ({
  BiddingPhaseView: ({ gameState }: { gameState: unknown }) => (
    <div data-testid="bidding-phase-view">
      Bidding Phase View - {gameState ? 'with data' : 'no data'}
    </div>
  ),
}));

vi.mock('./WheelPhaseView', () => ({
  WheelPhaseView: ({ gameState }: { gameState: unknown }) => (
    <div data-testid="wheel-phase-view">
      Wheel Phase View - {gameState ? 'with data' : 'no data'}
    </div>
  ),
}));

vi.mock('../components/phases/ShowcasePhaseView', () => ({
  ShowcasePhaseView: ({ gameState }: { gameState: unknown }) => (
    <div data-testid="showcase-phase-view">
      Showcase Phase View - {gameState ? 'with data' : 'no data'}
    </div>
  ),
}));

describe('UITestPage', () => {
  const mockBiddingResponse = {
    phase: 'bidding',
    testState: {
      workflow: { phase_type: 'bidding', officially_started: 1 },
      contestantsRow: [],
      currentBids: [],
    },
    players: [
      { id: 1, firstName: 'Test', lastName: 'Player1', photoFilename: 'p1.jpg' },
      { id: 2, firstName: 'Test', lastName: 'Player2', photoFilename: 'p2.jpg' },
    ],
  };

  const mockWheelResponse = {
    phase: 'wheel',
    testState: {
      workflow: { phase_type: 'wheel', officially_started: 1 },
      contestantsRow: [],
      playerTotals: [],
    },
    players: [{ id: 1, firstName: 'Test', lastName: 'Player1', photoFilename: 'p1.jpg' }],
  };

  const mockShowcaseResponse = {
    phase: 'showcase',
    testState: {
      workflow: { phase_type: 'showcase', officially_started: 1 },
      contestantsRow: [],
      showcaseBids: [],
    },
    players: [{ id: 1, firstName: 'Test', lastName: 'Player1', photoFilename: 'p1.jpg' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  describe('Header', () => {
    beforeEach(() => {
      vi.mocked(apiRequest).mockResolvedValue(mockBiddingResponse);
    });

    it('should display UI Test Mode title', async () => {
      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('UI Test Mode')).toBeInTheDocument();
      });
    });

    it('should display interaction disabled message', async () => {
      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Display only - interactions disabled')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    beforeEach(() => {
      vi.mocked(apiRequest).mockImplementation((url: string) => {
        if (url.includes('phase=bidding')) {
          return Promise.resolve(mockBiddingResponse);
        }
        if (url.includes('phase=wheel')) {
          return Promise.resolve(mockWheelResponse);
        }
        if (url.includes('phase=showcase')) {
          return Promise.resolve(mockShowcaseResponse);
        }
        return Promise.reject(new Error('Unknown phase'));
      });
    });

    it('should show Bidding tab button', async () => {
      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Bidding' })).toBeInTheDocument();
      });
    });

    it('should show Wheel tab button', async () => {
      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Wheel' })).toBeInTheDocument();
      });
    });

    it('should show Showcase tab button', async () => {
      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Showcase' })).toBeInTheDocument();
      });
    });

    it('should fetch bidding data by default', async () => {
      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith('/admin/ui-test-data?phase=bidding');
      });
    });

    it('should fetch wheel data when Wheel tab is clicked', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Wheel' })).toBeInTheDocument();
      });

      const wheelTab = screen.getByRole('button', { name: 'Wheel' });
      await user.click(wheelTab);

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith('/admin/ui-test-data?phase=wheel');
      });
    });

    it('should fetch showcase data when Showcase tab is clicked', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Showcase' })).toBeInTheDocument();
      });

      const showcaseTab = screen.getByRole('button', { name: 'Showcase' });
      await user.click(showcaseTab);

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith('/admin/ui-test-data?phase=showcase');
      });
    });
  });

  describe('Phase Views', () => {
    beforeEach(() => {
      vi.mocked(apiRequest).mockImplementation((url: string) => {
        if (url.includes('phase=bidding')) {
          return Promise.resolve(mockBiddingResponse);
        }
        if (url.includes('phase=wheel')) {
          return Promise.resolve(mockWheelResponse);
        }
        if (url.includes('phase=showcase')) {
          return Promise.resolve(mockShowcaseResponse);
        }
        return Promise.reject(new Error('Unknown phase'));
      });
    });

    it('should render BiddingPhaseView by default', async () => {
      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('bidding-phase-view')).toBeInTheDocument();
      });
    });

    it('should render WheelPhaseView when Wheel tab is selected', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Wheel' })).toBeInTheDocument();
      });

      const wheelTab = screen.getByRole('button', { name: 'Wheel' });
      await user.click(wheelTab);

      await waitFor(() => {
        expect(screen.getByTestId('wheel-phase-view')).toBeInTheDocument();
      });
    });

    it('should render ShowcasePhaseView when Showcase tab is selected', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Showcase' })).toBeInTheDocument();
      });

      const showcaseTab = screen.getByRole('button', { name: 'Showcase' });
      await user.click(showcaseTab);

      await waitFor(() => {
        expect(screen.getByTestId('showcase-phase-view')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh and Exit Buttons', () => {
    beforeEach(() => {
      vi.mocked(apiRequest).mockResolvedValue(mockBiddingResponse);
    });

    it('should show Refresh Data button', async () => {
      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Refresh Data' })).toBeInTheDocument();
      });
    });

    it('should show Exit button', async () => {
      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Exit' })).toBeInTheDocument();
      });
    });

    it('should refresh data when Refresh Data button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Refresh Data' })).toBeInTheDocument();
      });

      // Clear mock to track new calls
      vi.mocked(apiRequest).mockClear();
      vi.mocked(apiRequest).mockResolvedValue(mockBiddingResponse);

      const refreshButton = screen.getByRole('button', { name: 'Refresh Data' });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith('/admin/ui-test-data?phase=bidding');
      });
    });

    it('should navigate to welcome when Exit button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Exit' })).toBeInTheDocument();
      });

      const exitButton = screen.getByRole('button', { name: 'Exit' });
      await user.click(exitButton);

      expect(mockNavigate).toHaveBeenCalledWith('/welcome');
    });
  });

  describe('Test Players Info', () => {
    beforeEach(() => {
      vi.mocked(apiRequest).mockResolvedValue(mockBiddingResponse);
    });

    it('should show Test Players section', async () => {
      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Test Players:')).toBeInTheDocument();
      });
    });

    it('should display player names from response', async () => {
      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Test Player1')).toBeInTheDocument();
        expect(screen.getByText('Test Player2')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner while fetching', () => {
      // Don't resolve the promise immediately
      vi.mocked(apiRequest).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const { container } = render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      // Look for Chakra spinner by class
      const spinner = container.querySelector('.chakra-spinner');
      expect(spinner).toBeTruthy();
    });
  });

  describe('Error State', () => {
    it('should show error message on fetch failure', async () => {
      vi.mocked(apiRequest).mockRejectedValue(new Error('Failed to fetch'));

      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
      });
    });

    it('should show Retry button on error', async () => {
      vi.mocked(apiRequest).mockRejectedValue(new Error('Failed to fetch'));

      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      });
    });

    it('should retry fetch when Retry button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockRejectedValue(new Error('Failed to fetch'));

      render(
        <BrowserRouter>
          <UITestPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      });

      // Now make it succeed
      vi.mocked(apiRequest).mockClear();
      vi.mocked(apiRequest).mockResolvedValue(mockBiddingResponse);

      const retryButton = screen.getByRole('button', { name: 'Retry' });
      await user.click(retryButton);

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith('/admin/ui-test-data?phase=bidding');
      });
    });
  });
});
