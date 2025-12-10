import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "../test/test-utils";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import HostDashboardPage from "./HostDashboardPage";
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

// Mock the API
vi.mock("../utils/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/api")>();
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

describe("HostDashboardPage", () => {
  const mockPlayersResponse = {
    total: 3,
    byRole: {
      host: 1,
      player: 1,
      audience: 1,
    },
    players: [
      {
        id: 1,
        firstName: "Host",
        lastName: "User",
        email: "host@test.com",
        role: "host",
        photoFilename: "host.jpg",
        active: true,
        createdAt: "2025-01-01T00:00:00Z",
      },
      {
        id: 2,
        firstName: "Player",
        lastName: "One",
        email: null,
        role: "player",
        photoFilename: "player1.jpg",
        active: true,
        createdAt: "2025-01-01T00:00:00Z",
      },
      {
        id: 3,
        firstName: "Audience",
        lastName: "Member",
        email: "audience@test.com",
        role: "audience",
        photoFilename: "audience.jpg",
        active: false,
        createdAt: "2025-01-01T00:00:00Z",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Loading State", () => {
    it("should show loading spinner initially", () => {
      // Don't resolve the promise immediately
      vi.mocked(apiRequest).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const { container } = render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      // Look for Chakra spinner by class
      const spinner = container.querySelector(".chakra-spinner");
      expect(spinner).toBeTruthy();
    });
  });

  describe("Data Display", () => {
    beforeEach(() => {
      vi.mocked(apiRequest).mockResolvedValue(mockPlayersResponse);
    });

    it("should display page title", async () => {
      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("Player Dashboard")).toBeInTheDocument();
      });
    });

    it("should display total player count", async () => {
      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByText("3 players currently online"),
        ).toBeInTheDocument();
      });
    });

    it("should display role breakdown", async () => {
      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        // Check role labels exist
        expect(screen.getByText("Host")).toBeInTheDocument();
        expect(screen.getByText("Audience")).toBeInTheDocument();

        // Check for "Player" role - but avoid ambiguity with "Player One"
        // by looking for the role label in the count section
        const playerLabels = screen.getAllByText(/^Players?$/);
        expect(playerLabels.length).toBeGreaterThan(0);
      });
    });

    it("should display player table with names", async () => {
      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("Host User")).toBeInTheDocument();
        expect(screen.getByText("Player One")).toBeInTheDocument();
        expect(screen.getByText("Audience Member")).toBeInTheDocument();
      });
    });

    it("should display email when available", async () => {
      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("host@test.com")).toBeInTheDocument();
        expect(screen.getByText("audience@test.com")).toBeInTheDocument();
      });
    });

    it("should display role badges", async () => {
      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("host")).toBeInTheDocument();
        expect(screen.getByText("player")).toBeInTheDocument();
        expect(screen.getByText("audience")).toBeInTheDocument();
      });
    });

    it("should display active/inactive status badges", async () => {
      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        const activeBadges = screen.getAllByText("Active");
        const inactiveBadges = screen.getAllByText("Inactive");

        expect(activeBadges).toHaveLength(2);
        expect(inactiveBadges).toHaveLength(1);
      });
    });

    it("should show auto-refresh indicator", async () => {
      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByText("Auto-refreshes every 5 seconds"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Empty State", () => {
    it("should show empty message when no players", async () => {
      vi.mocked(apiRequest).mockResolvedValue({
        total: 0,
        byRole: { host: 0, player: 0, audience: 0 },
        players: [],
      });

      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByText("No players currently online"),
        ).toBeInTheDocument();
      });
    });

    it("should show singular when 1 player", async () => {
      vi.mocked(apiRequest).mockResolvedValue({
        total: 1,
        byRole: { host: 1, player: 0, audience: 0 },
        players: [mockPlayersResponse.players[0]],
      });

      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByText("1 player currently online"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    beforeEach(() => {
      vi.mocked(apiRequest).mockResolvedValue(mockPlayersResponse);
    });

    it("should navigate to welcome when Back button is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("Player Dashboard")).toBeInTheDocument();
      });

      const backButton = screen.getByRole("button", { name: /Back/i });
      await user.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith("/welcome");
    });

    it("should navigate to game when Enter Game button is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("Player Dashboard")).toBeInTheDocument();
      });

      const gameButton = screen.getByRole("button", { name: /Enter Game/i });
      await user.click(gameButton);

      expect(mockNavigate).toHaveBeenCalledWith("/game");
    });
  });

  describe("Error State", () => {
    it("should display error message on fetch failure", async () => {
      vi.mocked(apiRequest).mockRejectedValue(new Error("Network error"));

      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("should show Back to Welcome button on error", async () => {
      vi.mocked(apiRequest).mockRejectedValue(new Error("Network error"));

      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Back to Welcome/i }),
        ).toBeInTheDocument();
      });
    });

    it("should navigate to welcome from error state", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      vi.mocked(apiRequest).mockRejectedValue(new Error("Network error"));

      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Back to Welcome/i }),
        ).toBeInTheDocument();
      });

      const backButton = screen.getByRole("button", { name: /Back to Welcome/i });
      await user.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith("/welcome");
    });
  });

  describe("Auto-refresh", () => {
    it("should fetch data on mount", async () => {
      vi.mocked(apiRequest).mockResolvedValue(mockPlayersResponse);

      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith("/players/online");
      });
    });

    it("should fetch data every 5 seconds", async () => {
      vi.mocked(apiRequest).mockResolvedValue(mockPlayersResponse);

      render(
        <BrowserRouter>
          <HostDashboardPage />
        </BrowserRouter>,
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledTimes(1);
      });

      // Advance timer by 5 seconds
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledTimes(2);
      });

      // Advance timer by another 5 seconds
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledTimes(3);
      });
    });
  });
});
