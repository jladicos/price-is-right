import { describe, it, expect } from "vitest";
import { render, screen } from "../test/test-utils";
import { PlayerCard } from "./PlayerCard";

const mockPlayer = {
  id: 1,
  first_name: "John",
  last_name: "Doe",
  photo_filename: "john-doe.jpg",
};

describe("PlayerCard", () => {
  describe("Basic Rendering", () => {
    it("should render player photo", () => {
      render(<PlayerCard player={mockPlayer} />);

      const photo = screen.getByTestId("player-card-photo");
      expect(photo).toBeInTheDocument();

      const image = screen.getByAltText("John Doe");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", expect.stringContaining("john-doe.jpg"));
    });

    it("should not show name by default", () => {
      render(<PlayerCard player={mockPlayer} />);

      expect(screen.queryByTestId("player-card-name")).not.toBeInTheDocument();
    });

    it("should not show badge by default", () => {
      render(<PlayerCard player={mockPlayer} />);

      expect(screen.queryByTestId("player-card-badge")).not.toBeInTheDocument();
    });

    it("should not render children by default", () => {
      render(<PlayerCard player={mockPlayer} />);

      expect(screen.queryByTestId("player-card-children")).not.toBeInTheDocument();
    });
  });

  describe("Name Display", () => {
    it("should show name when showName is true", () => {
      render(<PlayerCard player={mockPlayer} showName={true} />);

      const name = screen.getByTestId("player-card-name");
      expect(name).toBeInTheDocument();
      expect(name).toHaveTextContent("John");
    });

    it("should hide name when showName is false", () => {
      render(<PlayerCard player={mockPlayer} showName={false} />);

      expect(screen.queryByTestId("player-card-name")).not.toBeInTheDocument();
    });
  });

  describe("Badge Display", () => {
    it("should show WINNER badge", () => {
      render(<PlayerCard player={mockPlayer} badge="WINNER" />);

      const badge = screen.getByTestId("player-card-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("WINNER");
    });

    it("should show CURRENT badge", () => {
      render(<PlayerCard player={mockPlayer} badge="CURRENT" />);

      const badge = screen.getByTestId("player-card-badge");
      expect(badge).toHaveTextContent("CURRENT");
    });

    it("should show LEADER badge", () => {
      render(<PlayerCard player={mockPlayer} badge="LEADER" />);

      const badge = screen.getByTestId("player-card-badge");
      expect(badge).toHaveTextContent("LEADER");
    });

    it("should show ELIMINATED badge", () => {
      render(<PlayerCard player={mockPlayer} badge="ELIMINATED" />);

      const badge = screen.getByTestId("player-card-badge");
      expect(badge).toHaveTextContent("ELIMINATED");
    });

    it("should show custom badge text", () => {
      render(<PlayerCard player={mockPlayer} badge="TOP SPINNER" />);

      const badge = screen.getByTestId("player-card-badge");
      expect(badge).toHaveTextContent("TOP SPINNER");
    });
  });

  describe("Size Variants", () => {
    it("should use medium size by default", () => {
      render(<PlayerCard player={mockPlayer} />);

      const photo = screen.getByTestId("player-card-photo");
      const styles = window.getComputedStyle(photo);
      expect(styles.width).toBe("150px");
      expect(styles.height).toBe("150px");
    });

    it("should render small size", () => {
      render(<PlayerCard player={mockPlayer} size="small" />);

      const photo = screen.getByTestId("player-card-photo");
      const styles = window.getComputedStyle(photo);
      expect(styles.width).toBe("120px");
      expect(styles.height).toBe("120px");
    });

    it("should render large size", () => {
      render(<PlayerCard player={mockPlayer} size="large" />);

      const photo = screen.getByTestId("player-card-photo");
      const styles = window.getComputedStyle(photo);
      expect(styles.width).toBe("240px");
      expect(styles.height).toBe("240px");
    });
  });

  describe("Visual Variants", () => {
    it("should use default variant by default", () => {
      render(<PlayerCard player={mockPlayer} />);

      const photo = screen.getByTestId("player-card-photo");
      expect(photo).toBeInTheDocument();
      // Default variant has gray border
      expect(photo).toHaveStyle({ borderColor: expect.stringContaining("gray") });
    });

    it("should render highlighted variant", () => {
      render(<PlayerCard player={mockPlayer} variant="highlighted" />);

      const photo = screen.getByTestId("player-card-photo");
      // Highlighted has blue border
      expect(photo).toHaveStyle({ borderColor: expect.stringContaining("blue") });
    });

    it("should render winner variant", () => {
      render(<PlayerCard player={mockPlayer} variant="winner" />);

      const photo = screen.getByTestId("player-card-photo");
      // Winner has green border
      expect(photo).toHaveStyle({ borderColor: expect.stringContaining("green") });
    });

    it("should render eliminated variant with overlay", () => {
      render(<PlayerCard player={mockPlayer} variant="eliminated" />);

      const photo = screen.getByTestId("player-card-photo");
      // Eliminated has red border
      expect(photo).toHaveStyle({ borderColor: expect.stringContaining("red") });

      const overlay = screen.getByTestId("player-card-eliminated-overlay");
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveTextContent("ELIMINATED");
    });

    it("should not show eliminated overlay for other variants", () => {
      render(<PlayerCard player={mockPlayer} variant="default" />);

      expect(screen.queryByTestId("player-card-eliminated-overlay")).not.toBeInTheDocument();
    });
  });

  describe("Children Content", () => {
    it("should render children when provided", () => {
      render(
        <PlayerCard player={mockPlayer}>
          <div data-testid="custom-child">Custom Content</div>
        </PlayerCard>
      );

      const childrenContainer = screen.getByTestId("player-card-children");
      expect(childrenContainer).toBeInTheDocument();

      const customChild = screen.getByTestId("custom-child");
      expect(customChild).toBeInTheDocument();
      expect(customChild).toHaveTextContent("Custom Content");
    });

    it("should render button children", () => {
      render(
        <PlayerCard player={mockPlayer}>
          <button>Spin Again</button>
        </PlayerCard>
      );

      const button = screen.getByRole("button", { name: "Spin Again" });
      expect(button).toBeInTheDocument();
    });

    it("should render text children", () => {
      render(
        <PlayerCard player={mockPlayer}>
          <div>Total: $0.75</div>
        </PlayerCard>
      );

      expect(screen.getByText("Total: $0.75")).toBeInTheDocument();
    });
  });

  describe("Combined Props", () => {
    it("should show name, badge, and children together", () => {
      render(
        <PlayerCard player={mockPlayer} showName={true} badge="LEADER">
          <div>Spin Total: $0.85</div>
        </PlayerCard>
      );

      expect(screen.getByTestId("player-card-name")).toHaveTextContent("John");
      expect(screen.getByTestId("player-card-badge")).toHaveTextContent("LEADER");
      expect(screen.getByText("Spin Total: $0.85")).toBeInTheDocument();
    });

    it("should render eliminated variant with badge", () => {
      render(
        <PlayerCard player={mockPlayer} variant="eliminated" badge="ELIMINATED" />
      );

      const badge = screen.getByTestId("player-card-badge");
      expect(badge).toHaveTextContent("ELIMINATED");

      const overlay = screen.getByTestId("player-card-eliminated-overlay");
      expect(overlay).toHaveTextContent("ELIMINATED");
    });

    it("should render large highlighted card with all features", () => {
      render(
        <PlayerCard
          player={mockPlayer}
          size="large"
          variant="highlighted"
          showName={true}
          badge="CURRENT"
        >
          <button>Stay</button>
          <button>Spin Again</button>
        </PlayerCard>
      );

      const photo = screen.getByTestId("player-card-photo");
      const styles = window.getComputedStyle(photo);
      expect(styles.width).toBe("240px");

      expect(screen.getByTestId("player-card-name")).toBeInTheDocument();
      expect(screen.getByTestId("player-card-badge")).toHaveTextContent("CURRENT");
      expect(screen.getByRole("button", { name: "Stay" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Spin Again" })).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper alt text for image", () => {
      render(<PlayerCard player={mockPlayer} />);

      const image = screen.getByAltText("John Doe");
      expect(image).toBeInTheDocument();
    });

    it("should have proper alt text with different player names", () => {
      const player = {
        id: 2,
        first_name: "Jane",
        last_name: "Smith",
        photo_filename: "jane-smith.jpg",
      };

      render(<PlayerCard player={player} />);

      const image = screen.getByAltText("Jane Smith");
      expect(image).toBeInTheDocument();
    });
  });
});
