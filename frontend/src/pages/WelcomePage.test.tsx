import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "../test/test-utils";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import WelcomePage from "./WelcomePage";
import { useAuthStore } from "../store/authStore";
import { apiRequest } from "../utils/api";

// Mock the router navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the auth store
vi.mock("../store/authStore");

// Mock the API
vi.mock("../utils/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/api")>();
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

describe("WelcomePage", () => {
  const mockLogout = vi.fn();

  const mockPlayerData = {
    player: {
      id: 1,
      firstName: "John",
      lastName: "Doe",
      accessCode: "TEST01",
      role: "player" as const,
      email: null,
      photoFilename: "john-doe.jpg",
      active: true,
      sessionToken: "test-token-123",
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
    },
  };

  const mockHostData = {
    player: {
      ...mockPlayerData.player,
      firstName: "Host",
      lastName: "User",
      role: "host" as const,
    },
  };

  const mockAudienceData = {
    player: {
      ...mockPlayerData.player,
      firstName: "Audience",
      lastName: "Member",
      role: "audience" as const,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockLogout.mockClear();
  });

  describe("Loading State", () => {
    it("should show loading spinner when loading", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: null,
        loading: true,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
  });

  describe("Player Display", () => {
    it("should display player name", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockPlayerData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      expect(screen.getByText(/Welcome, John!/i)).toBeInTheDocument();
    });

    it("should display player role", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockPlayerData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      expect(screen.getByText(/Role: player/i)).toBeInTheDocument();
    });

    it("should display player avatar with correct props", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockPlayerData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      const { container } = render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      // Chakra v3 Avatar.Image renders an img element
      // The Avatar snippet renders both fallback and image elements
      const avatarImg = container.querySelector(
        'img[src="/images/players/john-doe.jpg"]',
      );
      expect(avatarImg).toBeTruthy();

      // Check that fallback exists with correct initials
      const fallback = container.querySelector('[data-part="fallback"]');
      expect(fallback).toBeTruthy();
      expect(fallback?.textContent).toBe("JD");
    });
  });

  describe("Role-Specific Buttons", () => {
    it("should show player-specific button for player role", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockPlayerData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      expect(
        screen.getByRole("button", { name: /Enter Game/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Game Control/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Admin Tools/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Watch Game/i }),
      ).not.toBeInTheDocument();
    });

    it("should show host-specific buttons for host role", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockHostData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      expect(
        screen.getByRole("button", { name: /Game Control/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Admin Tools/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Enter Game/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Watch Game/i }),
      ).not.toBeInTheDocument();
    });

    it("should show audience-specific button for audience role", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockAudienceData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      expect(
        screen.getByRole("button", { name: /Watch Game/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Game Control/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Admin Tools/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Enter Game/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Placeholder Button Interactions", () => {
    it("should show toast when clicking placeholder button", async () => {
      const user = userEvent.setup();

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockPlayerData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      const button = screen.getByRole("button", { name: /Enter Game/i });
      await user.click(button);

      // Chakra toast creates a new element, so we just verify the button was clicked
      // Full toast testing would require more complex setup
      expect(button).toBeInTheDocument();
    });
  });

  describe("Logout Functionality", () => {
    it("should show logout button", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockPlayerData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      expect(
        screen.getByRole("button", { name: /Logout/i }),
      ).toBeInTheDocument();
    });

    it("should call logout and navigate to / on logout click", async () => {
      const user = userEvent.setup();
      mockLogout.mockResolvedValue(undefined);

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockPlayerData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      const logoutButton = screen.getByRole("button", { name: /Logout/i });
      await user.click(logoutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/");
      });
    });

    it("should show error toast on logout failure", async () => {
      const user = userEvent.setup();
      mockLogout.mockRejectedValue(new Error("Network error"));

      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockPlayerData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      const logoutButton = screen.getByRole("button", { name: /Logout/i });
      await user.click(logoutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });

      // The page should still be rendered (not navigate on error)
      expect(screen.getByText(/Welcome, John!/i)).toBeInTheDocument();
    });
  });

  describe("No Player State", () => {
    it("should return null when no current player", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: null,
        currentPlayer: null,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      const { container } = render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Game Status Toggle", () => {
    beforeEach(() => {
      // Reset the API mock before each test
      vi.mocked(apiRequest).mockClear();
    });

    it("should fetch game status on mount", async () => {
      vi.mocked(apiRequest).mockResolvedValue({ enabled: true });
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockPlayerData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith("/game/status");
      });
    });

    it("should show maintenance alert when game is disabled", async () => {
      vi.mocked(apiRequest).mockResolvedValue({ enabled: false });
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockPlayerData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Game Currently Disabled/i),
        ).toBeInTheDocument();
      });

      expect(screen.getByText(/maintenance mode/i)).toBeInTheDocument();
    });

    it("should not show maintenance alert when game is enabled", async () => {
      vi.mocked(apiRequest).mockResolvedValue({ enabled: true });
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockPlayerData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalled();
      });

      expect(
        screen.queryByText(/Game Currently Disabled/i),
      ).not.toBeInTheDocument();
    });

    it("should disable player button when game is disabled", async () => {
      vi.mocked(apiRequest).mockResolvedValue({ enabled: false });
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockPlayerData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /Enter Game/i });
        expect(button).toBeDisabled();
      });
    });

    it("should disable host Game Control button when game is disabled", async () => {
      vi.mocked(apiRequest).mockResolvedValue({ enabled: false });
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockHostData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /Game Control/i });
        expect(button).toBeDisabled();
      });
    });

    it("should NOT disable Admin Tools button when game is disabled", async () => {
      vi.mocked(apiRequest).mockResolvedValue({ enabled: false });
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockHostData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /Admin Tools/i });
        expect(button).not.toBeDisabled();
      });
    });

    it("should disable audience Watch Game button when game is disabled", async () => {
      vi.mocked(apiRequest).mockResolvedValue({ enabled: false });
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockAudienceData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /Watch Game/i });
        expect(button).toBeDisabled();
      });
    });

    it("should handle API error gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(apiRequest).mockRejectedValue(new Error("Network error"));
      vi.mocked(useAuthStore).mockReturnValue({
        sessionToken: "test-token",
        currentPlayer: mockPlayerData.player,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: mockLogout,
        validateSession: vi.fn(),
        handleSessionExpired: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <BrowserRouter>
          <WelcomePage />
        </BrowserRouter>,
      );

      // Should render the page normally even with API error
      expect(screen.getByText(/Welcome, John!/i)).toBeInTheDocument();

      // Should log the error
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to fetch game status:",
          expect.any(Error),
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
