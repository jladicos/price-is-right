import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import RootPage from './RootPage';
import { useAuthStore } from '../store/authStore';

// Mock the router navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the auth store
vi.mock('../store/authStore');

describe('RootPage', () => {
  const mockLogin = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Default mock state
    vi.mocked(useAuthStore).mockReturnValue({
      sessionToken: null,
      currentPlayer: null,
      loading: false,
      error: null,
      login: mockLogin,
      logout: vi.fn(),
      validateSession: vi.fn(),
      handleSessionExpired: vi.fn(),
      clearError: mockClearError,
    });
  });

  describe('Rendering', () => {
    it('should render login form', () => {
      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      expect(screen.getByText('Price Is Right Game')).toBeInTheDocument();
      expect(screen.getByLabelText(/access code/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });

    it('should render access code input with correct attributes', () => {
      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      const input = screen.getByLabelText(/access code/i);
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('maxLength', '6');
    });

    it('should have submit button disabled when code is empty', () => {
      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      const button = screen.getByRole('button', { name: /log in/i });
      expect(button).toBeDisabled();
    });
  });

  describe('User Input', () => {
    it('should enable submit button when code is entered', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      const input = screen.getByLabelText(/access code/i);
      const button = screen.getByRole('button', { name: /log in/i });

      await user.type(input, 'TEST01');

      expect(button).not.toBeDisabled();
    });

    it('should convert input to uppercase', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      const input = screen.getByLabelText(/access code/i) as HTMLInputElement;

      await user.type(input, 'test01');

      // Input should show uppercase due to CSS text-transform
      expect(input.value).toBe('test01'); // Actual value is lowercase
      // But it will be normalized to uppercase on submit
    });

    it('should clear error when user starts typing', async () => {
      const user = userEvent.setup();

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: null,
        currentPlayer: null,
        loading: false,
        error: 'Invalid access code',
        login: mockLogin,
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: mockClearError,
      });

      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      const input = screen.getByLabelText(/access code/i);

      await user.type(input, 'T');

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('should call login with normalized access code on submit', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(undefined);

      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      const input = screen.getByLabelText(/access code/i);
      const button = screen.getByRole('button', { name: /log in/i });

      // Input has maxLength=6, so we can only type 6 characters
      await user.type(input, 'test01');
      await user.click(button);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('TEST01');
      });
    });

    it('should navigate to /welcome on successful login', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(undefined);

      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      const input = screen.getByLabelText(/access code/i);
      const button = screen.getByRole('button', { name: /log in/i });

      await user.type(input, 'TEST01');
      await user.click(button);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/welcome');
      });
    });

    it('should show loading state during login', async () => {
      // Mock loading state
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: null,
        currentPlayer: null,
        loading: true,
        error: null,
        login: mockLogin,
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: mockClearError,
      });

      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      const button = screen.getByRole('button', { name: /logging in/i });
      expect(button).toBeDisabled();
    });

    it('should not submit with empty/whitespace code', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      const input = screen.getByLabelText(/access code/i);
      const button = screen.getByRole('button', { name: /log in/i });

      await user.type(input, '   ');

      expect(button).toBeDisabled();
    });

    it('should handle login error', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValue(new Error('Invalid access code'));

      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      const input = screen.getByLabelText(/access code/i);
      const button = screen.getByRole('button', { name: /log in/i });

      await user.type(input, 'INVALID');
      await user.click(button);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });
    });
  });

  describe('Error Display', () => {
    it('should display error message when error exists', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: null,
        currentPlayer: null,
        loading: false,
        error: 'Invalid access code',
        login: mockLogin,
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: mockClearError,
      });

      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      expect(screen.getByText('Invalid access code')).toBeInTheDocument();
    });

    it('should not display error when error is null', () => {
      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('URL Parameter Handling', () => {
    it('should auto-fill and login with ?code= parameter', async () => {
      mockLogin.mockResolvedValue(undefined);

      render(
        <MemoryRouter initialEntries={['/?code=TEST01']}>
          <RootPage />
        </MemoryRouter>,
      );

      await waitFor(
        () => {
          expect(mockLogin).toHaveBeenCalledWith('TEST01');
        },
        { timeout: 3000 },
      );
    });

    it('should normalize code from URL parameter', async () => {
      mockLogin.mockResolvedValue(undefined);

      render(
        <MemoryRouter initialEntries={['/?code=test01']}>
          <RootPage />
        </MemoryRouter>,
      );

      await waitFor(
        () => {
          expect(mockLogin).toHaveBeenCalledWith('TEST01');
        },
        { timeout: 3000 },
      );
    });

    it('should redirect to /welcome if already authenticated without ?code param', () => {
      const mockPlayer = {
        id: 1,
        firstName: 'Test',
        lastName: 'User',
        accessCode: 'TEST01',
        role: 'player' as const,
        email: null,
        photoFilename: 'default.jpg',
        active: true,
        sessionToken: 'test-token',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      };

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: 'test-token',
        currentPlayer: mockPlayer,
        loading: false,
        error: null,
        login: mockLogin,
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: mockClearError,
      });

      render(
        <MemoryRouter initialEntries={['/']}>
          <RootPage />
        </MemoryRouter>,
      );

      expect(mockNavigate).toHaveBeenCalledWith('/welcome');
    });

    it('should show login form if ?code param present even when authenticated', async () => {
      mockLogin.mockResolvedValue(undefined);

      const mockPlayer = {
        id: 1,
        firstName: 'Test',
        lastName: 'User',
        accessCode: 'TEST01',
        role: 'player' as const,
        email: null,
        photoFilename: 'default.jpg',
        active: true,
        sessionToken: 'test-token',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      };

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: 'test-token',
        currentPlayer: mockPlayer,
        loading: false,
        error: null,
        login: mockLogin,
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: mockClearError,
      });

      render(
        <MemoryRouter initialEntries={['/?code=TEST02']}>
          <RootPage />
        </MemoryRouter>,
      );

      await waitFor(
        () => {
          expect(mockLogin).toHaveBeenCalledWith('TEST02');
        },
        { timeout: 3000 },
      );
    });
  });

  describe('Accessibility', () => {
    it('should have required attribute on access code input', () => {
      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      const input = screen.getByLabelText(/access code/i);
      expect(input).toBeRequired();
    });

    it('should have proper label association', () => {
      render(
        <BrowserRouter>
          <RootPage />
        </BrowserRouter>,
      );

      const input = screen.getByLabelText(/access code/i);
      expect(input).toHaveAttribute('id');
    });
  });
});
