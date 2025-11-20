import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "../test/test-utils";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { useAuthStore } from "../store/authStore";

// Mock the auth store
vi.mock("../store/authStore");

// Mock Navigate component
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate">{to}</div>
    ),
  };
});

describe("ProtectedRoute", () => {
  const mockPlayer = {
    id: 1,
    firstName: "Test",
    lastName: "User",
    accessCode: "TEST01",
    role: "player" as const,
    email: null,
    photoFilename: "default.jpg",
    active: true,
    sessionToken: "test-token-123",
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should show loading spinner while validating session", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: null,
        loading: true,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });
  });

  describe("Authenticated Access", () => {
    it("should render children when authenticated", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token-123",
        currentPlayer: mockPlayer,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("should render complex children when authenticated", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token-123",
        currentPlayer: mockPlayer,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>
              <h1>Title</h1>
              <p>Description</p>
              <button>Action</button>
            </div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Action/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Unauthenticated Access", () => {
    it("should redirect to / when no session token", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: null,
        currentPlayer: null,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.getByTestId("navigate")).toHaveTextContent("/");
    });

    it("should redirect to / when no current player", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token-123",
        currentPlayer: null,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.getByTestId("navigate")).toHaveTextContent("/");
    });

    it("should redirect to / when both session token and player are missing", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: null,
        currentPlayer: null,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.getByTestId("navigate")).toHaveTextContent("/");
    });
  });

  describe("Edge Cases", () => {
    it("should not render children while loading even with session token", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token-123",
        currentPlayer: null,
        loading: true,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });

    it("should redirect after loading completes if no valid session", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: null,
        currentPlayer: null,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByTestId("navigate")).toHaveTextContent("/");
    });

    it("should handle error state without preventing redirect", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: null,
        currentPlayer: null,
        loading: false,
        error: "Session expired",
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.getByTestId("navigate")).toHaveTextContent("/");
    });
  });

  describe("Different Player Roles", () => {
    it("should allow host role access", () => {
      const hostPlayer = { ...mockPlayer, role: "host" as const };

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token-123",
        currentPlayer: hostPlayer,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("should allow audience role access", () => {
      const audiencePlayer = { ...mockPlayer, role: "audience" as const };

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token-123",
        currentPlayer: audiencePlayer,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  describe("Role-Based Access Control", () => {
    it("should allow access when user has required role (host)", () => {
      const hostPlayer = { ...mockPlayer, role: "host" as const };

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token-123",
        currentPlayer: hostPlayer,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute requireRole="host">
            <div>Host Only Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.getByText("Host Only Content")).toBeInTheDocument();
    });

    it("should redirect to /welcome when user does not have required role", () => {
      const playerUser = { ...mockPlayer, role: "player" as const };

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token-123",
        currentPlayer: playerUser,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute requireRole="host">
            <div>Host Only Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.queryByText("Host Only Content")).not.toBeInTheDocument();
      expect(screen.getByTestId("navigate")).toHaveTextContent("/welcome");
    });

    it("should allow player role to access player-only routes", () => {
      const playerUser = { ...mockPlayer, role: "player" as const };

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token-123",
        currentPlayer: playerUser,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute requireRole="player">
            <div>Player Only Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.getByText("Player Only Content")).toBeInTheDocument();
    });

    it("should reject audience from player-only routes", () => {
      const audienceUser = { ...mockPlayer, role: "audience" as const };

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token-123",
        currentPlayer: audienceUser,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute requireRole="player">
            <div>Player Only Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.queryByText("Player Only Content")).not.toBeInTheDocument();
      expect(screen.getByTestId("navigate")).toHaveTextContent("/welcome");
    });

    it("should allow audience role to access audience-only routes", () => {
      const audienceUser = { ...mockPlayer, role: "audience" as const };

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token-123",
        currentPlayer: audienceUser,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute requireRole="audience">
            <div>Audience Only Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.getByText("Audience Only Content")).toBeInTheDocument();
    });

    it("should work without requireRole (all authenticated users allowed)", () => {
      const playerUser = { ...mockPlayer, role: "player" as const };

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token-123",
        currentPlayer: playerUser,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>All Authenticated Content</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );

      expect(screen.getByText("All Authenticated Content")).toBeInTheDocument();
    });
  });
});
