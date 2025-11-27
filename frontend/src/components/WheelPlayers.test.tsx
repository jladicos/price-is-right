import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { WheelPlayers } from "./WheelPlayers";
import { render as testRender } from "../test/test-utils";

// Mock contestants
const mockContestant1 = {
  id: 1,
  first_name: "Alice",
  last_name: "Smith",
  photo_filename: "alice.jpg",
};

const mockContestant2 = {
  id: 2,
  first_name: "Bob",
  last_name: "Jones",
  photo_filename: "bob.jpg",
};

const mockContestant3 = {
  id: 3,
  first_name: "Charlie",
  last_name: "Brown",
  photo_filename: "charlie.jpg",
};

const mockContestant4 = {
  id: 4,
  first_name: "Diana",
  last_name: "Prince",
  photo_filename: "diana.jpg",
};

describe("WheelPlayers", () => {
  describe("Basic Rendering", () => {
    it("should render container when sections exist", () => {
      testRender(
        <WheelPlayers currentSpinner={mockContestant1} currentTotal={0.5} />,
      );

      expect(screen.getByTestId("wheel-players")).toBeInTheDocument();
    });

    it("should return null when all sections are empty", () => {
      const { container } = testRender(<WheelPlayers />);

      expect(container.firstChild).toBeNull();
    });

    it("should return null when leader is null and no other sections", () => {
      const { container } = testRender(
        <WheelPlayers leader={null} leaderTotal={0} />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Leader Section", () => {
    it("should show leader section when leader exists", () => {
      testRender(<WheelPlayers leader={mockContestant1} leaderTotal={0.75} />);

      expect(screen.getByTestId("leader-section")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByTestId("player-card-badge")).toHaveTextContent(
        "LEADER",
      );
      expect(screen.getByTestId("leader-total")).toHaveTextContent("$0.75");
    });

    it("should use medium size PlayerCard for leader", () => {
      testRender(<WheelPlayers leader={mockContestant1} leaderTotal={0.5} />);

      const photo = screen.getByTestId("player-card-photo");
      const styles = window.getComputedStyle(photo);
      expect(styles.width).toBe("150px");
      expect(styles.height).toBe("150px");
    });

    it("should show $0.00 when leaderTotal is 0", () => {
      testRender(<WheelPlayers leader={mockContestant1} leaderTotal={0} />);

      expect(screen.getByTestId("leader-total")).toHaveTextContent("$0.00");
    });

    it("should show $0.00 when leaderTotal is undefined", () => {
      testRender(<WheelPlayers leader={mockContestant1} />);

      expect(screen.getByTestId("leader-total")).toHaveTextContent("$0.00");
    });

    it("should not show leader section when leader is null", () => {
      testRender(
        <WheelPlayers
          leader={null}
          currentSpinner={mockContestant2}
          currentTotal={0.5}
        />,
      );

      expect(screen.queryByTestId("leader-section")).not.toBeInTheDocument();
    });

    it("should not show leader section when leader is undefined", () => {
      testRender(
        <WheelPlayers currentSpinner={mockContestant2} currentTotal={0.5} />,
      );

      expect(screen.queryByTestId("leader-section")).not.toBeInTheDocument();
    });
  });

  describe("Current Spinner Section", () => {
    it("should show current section when currentSpinner exists", () => {
      testRender(
        <WheelPlayers currentSpinner={mockContestant2} currentTotal={0.5} />,
      );

      expect(screen.getByTestId("current-section")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByTestId("player-card-badge")).toHaveTextContent(
        "CURRENT",
      );
      expect(screen.getByTestId("current-total")).toHaveTextContent("$0.50");
    });

    it("should use large size PlayerCard for current spinner", () => {
      testRender(
        <WheelPlayers currentSpinner={mockContestant2} currentTotal={0.5} />,
      );

      const photo = screen.getByTestId("player-card-photo");
      const styles = window.getComputedStyle(photo);
      expect(styles.width).toBe("240px");
      expect(styles.height).toBe("240px");
    });

    it("should use highlighted variant for current spinner", () => {
      testRender(
        <WheelPlayers currentSpinner={mockContestant2} currentTotal={0.5} />,
      );

      const photo = screen.getByTestId("player-card-photo");
      // Highlighted variant has yellow border
      expect(photo).toHaveStyle({
        borderColor: expect.stringContaining("yellow"),
      });
    });

    it("should show $0.00 when currentTotal is 0", () => {
      testRender(
        <WheelPlayers currentSpinner={mockContestant2} currentTotal={0} />,
      );

      expect(screen.getByTestId("current-total")).toHaveTextContent("$0.00");
    });

    it("should show $0.00 when currentTotal is undefined", () => {
      testRender(<WheelPlayers currentSpinner={mockContestant2} />);

      expect(screen.getByTestId("current-total")).toHaveTextContent("$0.00");
    });

    it("should not show current section when currentSpinner is null", () => {
      testRender(
        <WheelPlayers
          leader={mockContestant1}
          leaderTotal={0.75}
          currentSpinner={null}
        />,
      );

      expect(screen.queryByTestId("current-section")).not.toBeInTheDocument();
    });

    it("should not show current section when currentSpinner is undefined", () => {
      testRender(<WheelPlayers leader={mockContestant1} leaderTotal={0.75} />);

      expect(screen.queryByTestId("current-section")).not.toBeInTheDocument();
    });
  });

  describe("Waiting Spinners Section", () => {
    it("should show waiting section with one spinner", () => {
      testRender(<WheelPlayers waitingSpinners={[mockContestant3]} />);

      expect(screen.getByTestId("waiting-section")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });

    it("should show waiting section with multiple spinners", () => {
      testRender(
        <WheelPlayers waitingSpinners={[mockContestant3, mockContestant4]} />,
      );

      expect(screen.getByTestId("waiting-section")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
      expect(screen.getByText("Diana")).toBeInTheDocument();
    });

    it("should use small size PlayerCards for waiting spinners", () => {
      testRender(<WheelPlayers waitingSpinners={[mockContestant3]} />);

      const photo = screen.getByTestId("player-card-photo");
      const styles = window.getComputedStyle(photo);
      expect(styles.width).toBe("120px");
      expect(styles.height).toBe("120px");
    });

    it("should not show badges for waiting spinners", () => {
      testRender(<WheelPlayers waitingSpinners={[mockContestant3]} />);

      expect(screen.queryByTestId("player-card-badge")).not.toBeInTheDocument();
    });

    it("should not show totals for waiting spinners", () => {
      testRender(<WheelPlayers waitingSpinners={[mockContestant3]} />);

      // Should only have player name, no total
      expect(screen.getByText("Charlie")).toBeInTheDocument();
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });

    it("should not show waiting section when waitingSpinners is empty array", () => {
      testRender(
        <WheelPlayers
          currentSpinner={mockContestant2}
          currentTotal={0.5}
          waitingSpinners={[]}
        />,
      );

      expect(screen.queryByTestId("waiting-section")).not.toBeInTheDocument();
    });

    it("should not show waiting section when waitingSpinners is undefined", () => {
      testRender(
        <WheelPlayers currentSpinner={mockContestant2} currentTotal={0.5} />,
      );

      expect(screen.queryByTestId("waiting-section")).not.toBeInTheDocument();
    });

    it("should render three waiting spinners", () => {
      testRender(
        <WheelPlayers
          waitingSpinners={[mockContestant1, mockContestant2, mockContestant3]}
        />,
      );

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });
  });

  describe("Combined Sections", () => {
    it("should show all three sections when all have data", () => {
      testRender(
        <WheelPlayers
          leader={mockContestant1}
          leaderTotal={0.75}
          currentSpinner={mockContestant2}
          currentTotal={0.5}
          waitingSpinners={[mockContestant3, mockContestant4]}
        />,
      );

      expect(screen.getByTestId("leader-section")).toBeInTheDocument();
      expect(screen.getByTestId("current-section")).toBeInTheDocument();
      expect(screen.getByTestId("waiting-section")).toBeInTheDocument();

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
      expect(screen.getByText("Diana")).toBeInTheDocument();
    });

    it("should show leader and current only", () => {
      testRender(
        <WheelPlayers
          leader={mockContestant1}
          leaderTotal={0.75}
          currentSpinner={mockContestant2}
          currentTotal={0.5}
        />,
      );

      expect(screen.getByTestId("leader-section")).toBeInTheDocument();
      expect(screen.getByTestId("current-section")).toBeInTheDocument();
      expect(screen.queryByTestId("waiting-section")).not.toBeInTheDocument();
    });

    it("should show current and waiting only", () => {
      testRender(
        <WheelPlayers
          currentSpinner={mockContestant2}
          currentTotal={0.5}
          waitingSpinners={[mockContestant3]}
        />,
      );

      expect(screen.queryByTestId("leader-section")).not.toBeInTheDocument();
      expect(screen.getByTestId("current-section")).toBeInTheDocument();
      expect(screen.getByTestId("waiting-section")).toBeInTheDocument();
    });

    it("should show leader and waiting only", () => {
      testRender(
        <WheelPlayers
          leader={mockContestant1}
          leaderTotal={0.75}
          waitingSpinners={[mockContestant3]}
        />,
      );

      expect(screen.getByTestId("leader-section")).toBeInTheDocument();
      expect(screen.queryByTestId("current-section")).not.toBeInTheDocument();
      expect(screen.getByTestId("waiting-section")).toBeInTheDocument();
    });

    it("should show correct badges for leader and current", () => {
      testRender(
        <WheelPlayers
          leader={mockContestant1}
          leaderTotal={0.75}
          currentSpinner={mockContestant2}
          currentTotal={0.5}
        />,
      );

      const badges = screen.getAllByTestId("player-card-badge");
      expect(badges).toHaveLength(2);
      expect(badges[0]).toHaveTextContent("CURRENT"); // Current is rendered first (Row 1)
      expect(badges[1]).toHaveTextContent("LEADER"); // Leader is rendered second (Row 2)
    });

    it("should show correct totals for leader and current", () => {
      testRender(
        <WheelPlayers
          leader={mockContestant1}
          leaderTotal={1.0}
          currentSpinner={mockContestant2}
          currentTotal={0.65}
        />,
      );

      expect(screen.getByTestId("leader-total")).toHaveTextContent("$1.00");
      expect(screen.getByTestId("current-total")).toHaveTextContent("$0.65");
    });
  });

  describe("Edge Cases", () => {
    it("should handle decimal totals correctly", () => {
      testRender(
        <WheelPlayers
          leader={mockContestant1}
          leaderTotal={0.85}
          currentSpinner={mockContestant2}
          currentTotal={0.45}
        />,
      );

      expect(screen.getByTestId("leader-total")).toHaveTextContent("$0.85");
      expect(screen.getByTestId("current-total")).toHaveTextContent("$0.45");
    });

    it("should handle very large totals", () => {
      testRender(
        <WheelPlayers
          leader={mockContestant1}
          leaderTotal={2.5}
          currentSpinner={mockContestant2}
          currentTotal={1.95}
        />,
      );

      expect(screen.getByTestId("leader-total")).toHaveTextContent("$2.50");
      expect(screen.getByTestId("current-total")).toHaveTextContent("$1.95");
    });

    it("should handle single waiting spinner", () => {
      testRender(<WheelPlayers waitingSpinners={[mockContestant1]} />);

      expect(screen.getByTestId("waiting-section")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    it("should handle many waiting spinners", () => {
      const manySpinners = [
        mockContestant1,
        mockContestant2,
        mockContestant3,
        mockContestant4,
      ];

      testRender(<WheelPlayers waitingSpinners={manySpinners} />);

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
      expect(screen.getByText("Diana")).toBeInTheDocument();
    });

    it("should handle same contestant in multiple sections gracefully", () => {
      // This shouldn't happen in real usage, but test it anyway
      testRender(
        <WheelPlayers
          leader={mockContestant1}
          leaderTotal={0.75}
          currentSpinner={mockContestant1}
          currentTotal={0.5}
        />,
      );

      // Should render both sections
      expect(screen.getByTestId("leader-section")).toBeInTheDocument();
      expect(screen.getByTestId("current-section")).toBeInTheDocument();
    });

    it("should handle negative totals gracefully", () => {
      testRender(
        <WheelPlayers
          leader={mockContestant1}
          leaderTotal={-0.5}
          currentSpinner={mockContestant2}
          currentTotal={-1.0}
        />,
      );

      // Should still format and display
      expect(screen.getByTestId("leader-total")).toHaveTextContent("$-0.50");
      expect(screen.getByTestId("current-total")).toHaveTextContent("$-1.00");
    });

    it("should handle very many waiting spinners (5+)", () => {
      const manySpinners = Array.from({ length: 6 }, (_, i) => ({
        id: i + 1,
        first_name: `Player${i + 1}`,
        last_name: "Test",
        photo_filename: `player${i + 1}.jpg`,
      }));

      testRender(<WheelPlayers waitingSpinners={manySpinners} />);

      expect(screen.getByText("Player1")).toBeInTheDocument();
      expect(screen.getByText("Player6")).toBeInTheDocument();
    });

    it("should handle waiting spinners with duplicate IDs", () => {
      const duplicateIdSpinners = [
        { ...mockContestant1, id: 1 },
        { ...mockContestant2, id: 1 }, // Duplicate ID
      ];

      testRender(<WheelPlayers waitingSpinners={duplicateIdSpinners} />);

      // React will warn about duplicate keys, but should still render
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  describe("Visual Styling", () => {
    it("should use green color for leader total", () => {
      testRender(<WheelPlayers leader={mockContestant1} leaderTotal={0.75} />);

      const total = screen.getByTestId("leader-total");
      // Chakra v3 uses CSS variables - check the variable name
      const computedStyle = window.getComputedStyle(total);
      expect(computedStyle.color).toContain("green");
    });

    it("should use blue color for current total", () => {
      testRender(
        <WheelPlayers currentSpinner={mockContestant2} currentTotal={0.5} />,
      );

      const total = screen.getByTestId("current-total");
      // Chakra v3 uses CSS variables - check the variable name
      const computedStyle = window.getComputedStyle(total);
      expect(computedStyle.color).toContain("blue");
    });

    it("should align container to flex-start for horizontal layout", () => {
      testRender(
        <WheelPlayers currentSpinner={mockContestant1} currentTotal={0.5} />,
      );

      const container = screen.getByTestId("wheel-players");
      expect(container).toHaveStyle({ alignItems: "flex-start" });
    });

    it("should use 100% width for container", () => {
      testRender(
        <WheelPlayers currentSpinner={mockContestant1} currentTotal={0.5} />,
      );

      const container = screen.getByTestId("wheel-players");
      expect(container).toHaveStyle({ width: "100%" });
    });
  });
});
