import { describe, it, expect } from "vitest";
import { render, screen } from "../test/test-utils";
import { PhaseBackground } from "./PhaseBackground";

describe("PhaseBackground", () => {
  describe("Rendering", () => {
    it("should render children", () => {
      render(
        <PhaseBackground phase="bidding">
          <div data-testid="child-content">Test Content</div>
        </PhaseBackground>,
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("should render multiple children", () => {
      render(
        <PhaseBackground phase="wheel">
          <div data-testid="child-1">First</div>
          <div data-testid="child-2">Second</div>
        </PhaseBackground>,
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
    });
  });

  describe("Background Images", () => {
    it("should use bidding background for bidding phase", () => {
      const { container } = render(
        <PhaseBackground phase="bidding">
          <div>Content</div>
        </PhaseBackground>,
      );

      // Background image is now on the first child (background layer) of the outer box
      const outerBox = container.firstChild as HTMLElement;
      const backgroundLayer = outerBox.children[0] as HTMLElement;
      const style = window.getComputedStyle(backgroundLayer);

      expect(style.backgroundImage).toContain("bidding-background.png");
    });

    it("should use wheel background for wheel phase", () => {
      const { container } = render(
        <PhaseBackground phase="wheel">
          <div>Content</div>
        </PhaseBackground>,
      );

      const outerBox = container.firstChild as HTMLElement;
      const backgroundLayer = outerBox.children[0] as HTMLElement;
      const style = window.getComputedStyle(backgroundLayer);

      expect(style.backgroundImage).toContain("spin-the-wheel.png");
    });

    it("should use showcase background for showcase phase", () => {
      const { container } = render(
        <PhaseBackground phase="showcase">
          <div>Content</div>
        </PhaseBackground>,
      );

      const outerBox = container.firstChild as HTMLElement;
      const backgroundLayer = outerBox.children[0] as HTMLElement;
      const style = window.getComputedStyle(backgroundLayer);

      expect(style.backgroundImage).toContain("showcase-showdown.png");
    });
  });

  describe("Layout", () => {
    it("should be positioned fixed", () => {
      const { container } = render(
        <PhaseBackground phase="bidding">
          <div>Content</div>
        </PhaseBackground>,
      );

      const outerBox = container.firstChild as HTMLElement;
      const style = window.getComputedStyle(outerBox);

      expect(style.position).toBe("fixed");
    });

    it("should cover top, left, and right edges", () => {
      const { container } = render(
        <PhaseBackground phase="bidding">
          <div>Content</div>
        </PhaseBackground>,
      );

      const outerBox = container.firstChild as HTMLElement;
      const style = window.getComputedStyle(outerBox);

      expect(style.top).toBe("0px");
      expect(style.left).toBe("0px");
      expect(style.right).toBe("0px");
    });

    it("should leave 80px at bottom for control strip", () => {
      const { container } = render(
        <PhaseBackground phase="bidding">
          <div>Content</div>
        </PhaseBackground>,
      );

      const outerBox = container.firstChild as HTMLElement;
      const style = window.getComputedStyle(outerBox);

      expect(style.bottom).toBe("80px");
    });

    it("should allow overflow scrolling", () => {
      const { container } = render(
        <PhaseBackground phase="bidding">
          <div>Content</div>
        </PhaseBackground>,
      );

      const outerBox = container.firstChild as HTMLElement;
      const style = window.getComputedStyle(outerBox);

      expect(style.overflow).toBe("auto");
    });
  });

  describe("Background Styling", () => {
    it("should cover the entire area", () => {
      const { container } = render(
        <PhaseBackground phase="bidding">
          <div>Content</div>
        </PhaseBackground>,
      );

      // Background styling is now on the background layer (first child of outer box)
      const outerBox = container.firstChild as HTMLElement;
      const backgroundLayer = outerBox.children[0] as HTMLElement;
      const style = window.getComputedStyle(backgroundLayer);

      expect(style.backgroundSize).toBe("cover");
    });

    it("should center the background", () => {
      const { container } = render(
        <PhaseBackground phase="bidding">
          <div>Content</div>
        </PhaseBackground>,
      );

      const outerBox = container.firstChild as HTMLElement;
      const backgroundLayer = outerBox.children[0] as HTMLElement;
      const style = window.getComputedStyle(backgroundLayer);

      // CSS "center" often resolves to "center center" for background-position
      expect(style.backgroundPosition).toContain("center");
    });

    it("should not repeat the background", () => {
      const { container } = render(
        <PhaseBackground phase="bidding">
          <div>Content</div>
        </PhaseBackground>,
      );

      const outerBox = container.firstChild as HTMLElement;
      const backgroundLayer = outerBox.children[0] as HTMLElement;
      const style = window.getComputedStyle(backgroundLayer);

      expect(style.backgroundRepeat).toBe("no-repeat");
    });
  });
});
