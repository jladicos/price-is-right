import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "../test/test-utils";
import userEvent from "@testing-library/user-event";
import { ManualSelectContestantModal } from "./ManualSelectContestantModal";
import * as apiModule from "../utils/api";

// Mock API and toast
vi.mock("../utils/api", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("../utils/toast", () => ({
  showToast: vi.fn(),
}));

describe("ManualSelectContestantModal", () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const mockPlayers = [
    {
      id: 1,
      firstName: "John",
      lastName: "Doe",
      photoFilename: "john.jpg",
      role: "audience",
      active: true,
    },
    {
      id: 2,
      firstName: "Jane",
      lastName: "Smith",
      photoFilename: "jane.jpg",
      role: "player",
      active: true,
    },
    {
      id: 3,
      firstName: "Bob",
      lastName: "Johnson",
      photoFilename: "bob.jpg",
      role: "audience",
      active: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnConfirm.mockResolvedValue(undefined);
    vi.mocked(apiModule.apiRequest).mockResolvedValue({
      players: mockPlayers,
      total: 3,
    });
  });

  describe("Rendering", () => {
    it("should not render when closed", () => {
      render(
        <ManualSelectContestantModal
          isOpen={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(
        screen.queryByText("Manually Select Contestant"),
      ).not.toBeInTheDocument();
    });

    it("should render modal when open", async () => {
      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(
        screen.getByText("Manually Select Contestant"),
      ).toBeInTheDocument();
      expect(screen.getByText("Position")).toBeInTheDocument();
      expect(screen.getByText("Segment")).toBeInTheDocument();
      expect(screen.getByText("Search Players")).toBeInTheDocument();
    });

    it("should fetch players when modal opens", async () => {
      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(apiModule.apiRequest).toHaveBeenCalledWith("/players?active=true");

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
        expect(screen.getByText("Bob Johnson")).toBeInTheDocument();
      });
    });

    it("should show loading state while fetching players", async () => {
      let resolveApi: (value: unknown) => void;
      const apiPromise = new Promise((resolve) => {
        resolveApi = resolve;
      });
      vi.mocked(apiModule.apiRequest).mockReturnValue(apiPromise);

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.getByText("Loading players...")).toBeInTheDocument();

      resolveApi!({ players: mockPlayers, total: 3 });

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });
    });

    it("should use current segment prop as default", async () => {
      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          currentSegment="section_2"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Find the segment select element by checking all selects for section_2 value
      const selects = document.querySelectorAll("select");
      const segmentSelect = Array.from(selects).find(
        (select) => select.value === "section_2",
      );
      expect(segmentSelect).toBeDefined();
      expect(segmentSelect?.value).toBe("section_2");
    });
  });

  describe("Position and Segment Selection", () => {
    it("should allow changing position", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Find position select - it's the first select element
      const selects = document.querySelectorAll("select");
      const positionSelect = selects[0];

      await user.selectOptions(positionSelect, "3");

      expect(positionSelect.value).toBe("3");
    });

    it("should allow changing segment", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Find segment select - it's the second select element
      const selects = document.querySelectorAll("select");
      const segmentSelect = selects[1];

      await user.selectOptions(segmentSelect, "section_2");

      expect(segmentSelect.value).toBe("section_2");
    });
  });

  describe("Player Search", () => {
    it("should filter players based on first name", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search by name...");
      await user.type(searchInput, "jane");

      await waitFor(() => {
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
        expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
        expect(screen.queryByText("Bob Johnson")).not.toBeInTheDocument();
      });
    });

    it("should filter players based on last name", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search by name...");
      await user.type(searchInput, "doe");

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.queryByText("Jane Smith")).not.toBeInTheDocument();
        expect(screen.queryByText("Bob Johnson")).not.toBeInTheDocument();
      });
    });

    it("should show all players when search is cleared", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search by name...");
      await user.type(searchInput, "jane");

      await waitFor(() => {
        expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
      });

      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
        expect(screen.getByText("Bob Johnson")).toBeInTheDocument();
      });
    });

    it("should show no players found message when search has no results", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search by name...");
      await user.type(searchInput, "nonexistent");

      await waitFor(() => {
        expect(screen.getByText("No players found")).toBeInTheDocument();
      });
    });

    it("should update player count in header", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/3 found/)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search by name...");
      await user.type(searchInput, "jane");

      await waitFor(() => {
        expect(screen.getByText(/1 found/)).toBeInTheDocument();
      });
    });
  });

  describe("Player Selection", () => {
    it("should allow selecting a player", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const johnCard = screen.getByText("John Doe").closest("div")!;
      await user.click(johnCard);

      // Should show preview
      await waitFor(() => {
        expect(screen.getByText("Selection Preview")).toBeInTheDocument();
      });
    });

    it("should highlight selected player", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const johnCard = screen.getByText("John Doe").closest("div")!;
      await user.click(johnCard);

      // Check if the card has selected styling (blue border)
      expect(johnCard).toHaveStyle({ borderColor: "blue.500" });
    });

    it("should show selection preview with player details", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const johnCard = screen.getByText("John Doe").closest("div")!;
      await user.click(johnCard);

      await waitFor(() => {
        const preview = screen.getByText("Selection Preview").closest("div")!;
        expect(preview).toHaveTextContent("Player: John Doe");
        expect(preview).toHaveTextContent("Position: 1");
        expect(preview).toHaveTextContent("Segment: section_1");
      });
    });

    it("should allow changing selection", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Select John
      const johnCard = screen.getByText("John Doe").closest("div")!;
      await user.click(johnCard);

      await waitFor(() => {
        expect(screen.getByText("Selection Preview")).toBeInTheDocument();
      });

      // Change to Jane
      const janeCard = screen.getByText("Jane Smith").closest("div")!;
      await user.click(janeCard);

      await waitFor(() => {
        const preview = screen.getByText("Selection Preview").closest("div")!;
        expect(preview).toHaveTextContent("Player: Jane Smith");
      });
    });
  });

  describe("Confirmation", () => {
    it("should call onConfirm with correct parameters when confirmed", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Select a player
      const johnCard = screen.getByText("John Doe").closest("div")!;
      await user.click(johnCard);

      // Click confirm button
      const confirmButton = screen.getByRole("button", {
        name: /Confirm Selection/i,
      });
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith(1, 1, "section_1");
    });

    it("should prevent confirmation when no player selected via disabled button", async () => {
      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Confirm button should be disabled when no player selected
      const confirmButton = screen.getByRole("button", {
        name: /Confirm Selection/i,
      });
      expect(confirmButton).toBeDisabled();

      // Cannot click disabled button, so onConfirm should not be called
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it("should disable confirm button when no player selected", async () => {
      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", {
        name: /Confirm Selection/i,
      });
      expect(confirmButton).toBeDisabled();
    });

    it("should enable confirm button when player selected", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", {
        name: /Confirm Selection/i,
      });
      expect(confirmButton).toBeDisabled();

      // Select a player
      const johnCard = screen.getByText("John Doe").closest("div")!;
      await user.click(johnCard);

      await waitFor(() => {
        expect(confirmButton).not.toBeDisabled();
      });
    });

    it("should close modal after successful confirmation", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Select and confirm
      const johnCard = screen.getByText("John Doe").closest("div")!;
      await user.click(johnCard);

      const confirmButton = screen.getByRole("button", {
        name: /Confirm Selection/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("should show loading state while confirming", async () => {
      const user = userEvent.setup();
      let resolveConfirm: () => void;
      const confirmPromise = new Promise<void>((resolve) => {
        resolveConfirm = resolve;
      });
      mockOnConfirm.mockReturnValue(confirmPromise);

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const johnCard = screen.getByText("John Doe").closest("div")!;
      await user.click(johnCard);

      const confirmButton = screen.getByRole("button", {
        name: /Confirm Selection/i,
      });
      await user.click(confirmButton);

      expect(confirmButton).toBeDisabled();

      resolveConfirm!();

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe("Cancel and Close", () => {
    it("should call onClose when cancel button clicked", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should reset state when modal closes", async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Select a player and search
      const johnCard = screen.getByText("John Doe").closest("div")!;
      await user.click(johnCard);

      const searchInput = screen.getByPlaceholderText("Search by name...");
      await user.type(searchInput, "john");

      // Verify selection preview and filtered search
      await waitFor(() => {
        expect(screen.getByText("Selection Preview")).toBeInTheDocument();
      });

      // Unmount and remount to simulate full reset
      unmount();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Search should be cleared and no player selected
      expect(screen.getByPlaceholderText("Search by name...")).toHaveValue("");
      expect(screen.queryByText("Selection Preview")).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should show error toast when player fetch fails", async () => {
      const showToast = await import("../utils/toast");
      vi.mocked(apiModule.apiRequest).mockRejectedValue(
        new Error("Network error"),
      );

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(showToast.showToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Network error",
          type: "error",
        });
      });
    });

    it("should show error toast when confirmation fails", async () => {
      const user = userEvent.setup();
      const showToast = await import("../utils/toast");
      mockOnConfirm.mockRejectedValue(new Error("Failed to add contestant"));

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      const johnCard = screen.getByText("John Doe").closest("div")!;
      await user.click(johnCard);

      const confirmButton = screen.getByRole("button", {
        name: /Confirm Selection/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(showToast.showToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Failed to add contestant",
          type: "error",
        });
      });

      // Modal should not close on error
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Additional Edge Cases", () => {
    it("should handle empty players array from API", async () => {
      vi.mocked(apiModule.apiRequest).mockResolvedValue({
        players: [],
        total: 0,
      });

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("No players found")).toBeInTheDocument();
        expect(screen.getByText(/0 found/)).toBeInTheDocument();
      });
    });

    it("should handle API returning malformed data gracefully", async () => {
      vi.mocked(apiModule.apiRequest).mockResolvedValue({
        players: null as any,
        total: 0,
      });

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      // Component should not crash
      expect(
        screen.getByText("Manually Select Contestant"),
      ).toBeInTheDocument();
    });

    it("should maintain selection when filtering players", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Select John
      const johnCard = screen.getByText("John Doe").closest("div")!;
      await user.click(johnCard);

      await waitFor(() => {
        expect(screen.getByText("Selection Preview")).toBeInTheDocument();
      });

      // Search for Jane (filters out John from player list but not from preview)
      const searchInput = screen.getByPlaceholderText("Search by name...");
      await user.type(searchInput, "jane");

      // Confirm button should still be enabled because John is still selected
      const confirmButton = screen.getByRole("button", {
        name: /Confirm Selection/i,
      });
      expect(confirmButton).not.toBeDisabled();

      // Preview should still show John
      expect(screen.getByText("Selection Preview")).toBeInTheDocument();
    });

    it("should handle case-insensitive search", async () => {
      const user = userEvent.setup();

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Search with uppercase
      const searchInput = screen.getByPlaceholderText("Search by name...");
      await user.type(searchInput, "JOHN");

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.queryByText("Jane Smith")).not.toBeInTheDocument();
      });
    });

    it("should handle special characters in player names", async () => {
      vi.mocked(apiModule.apiRequest).mockResolvedValue({
        players: [
          {
            id: 1,
            firstName: "O'Brien",
            lastName: "Smith-Jones",
            photoFilename: "test.jpg",
            role: "audience",
            active: true,
          },
        ],
        total: 1,
      });

      render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("O'Brien Smith-Jones")).toBeInTheDocument();
      });
    });

    it("should not fetch players when modal is closed", () => {
      render(
        <ManualSelectContestantModal
          isOpen={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      // Should not call API when closed
      expect(apiModule.apiRequest).not.toHaveBeenCalled();
    });

    it("should refetch players when modal reopens", async () => {
      const { rerender } = render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(apiModule.apiRequest).toHaveBeenCalledTimes(1);
      });

      // Close modal
      rerender(
        <ManualSelectContestantModal
          isOpen={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      // Reopen modal
      rerender(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      // Should fetch again
      await waitFor(() => {
        expect(apiModule.apiRequest).toHaveBeenCalledTimes(2);
      });
    });

    it("should preserve segment when currentSegment prop changes", async () => {
      const { rerender } = render(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          currentSegment="section_1"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Change prop
      rerender(
        <ManualSelectContestantModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          currentSegment="section_2"
        />,
      );

      // Segment should update
      await waitFor(() => {
        const selects = document.querySelectorAll("select");
        const segmentSelect = Array.from(selects).find(
          (select) => select.value === "section_2",
        );
        expect(segmentSelect).toBeDefined();
      });
    });
  });
});
