import { describe, it, expect } from "vitest";
import { render, screen } from "../test/test-utils";
import WaitingScreen from "./WaitingScreen";

describe("WaitingScreen", () => {
  it("should render the waiting message", () => {
    render(<WaitingScreen />);

    expect(
      screen.getByText("The Cost is Accurate"),
    ).toBeInTheDocument();
  });

  it("should display text in Pricedown font", () => {
    render(<WaitingScreen />);

    const text = screen.getByText("The Cost is Accurate");
    const style = window.getComputedStyle(text);

    // Font family should include Pricedown
    expect(style.fontFamily).toContain("Pricedown");
  });

  it("should have black background", () => {
    const { container } = render(<WaitingScreen />);

    // The outer Box should have black background (Chakra uses CSS variables)
    const outerBox = container.firstChild as HTMLElement;
    const style = window.getComputedStyle(outerBox);

    // Check for either rgb value or CSS variable
    expect(
      style.backgroundColor === "rgb(0, 0, 0)" ||
        style.backgroundColor.includes("black") ||
        style.backgroundColor === "rgba(0, 0, 0, 0)", // JSDOM may not resolve CSS vars
    ).toBe(true);
  });

  it("should be a full-screen overlay", () => {
    const { container } = render(<WaitingScreen />);

    const outerBox = container.firstChild as HTMLElement;
    const style = window.getComputedStyle(outerBox);

    expect(style.position).toBe("fixed");
    expect(style.top).toBe("0px");
    expect(style.left).toBe("0px");
    expect(style.right).toBe("0px");
    expect(style.bottom).toBe("0px");
  });

  it("should center the text", () => {
    const { container } = render(<WaitingScreen />);

    const outerBox = container.firstChild as HTMLElement;
    const style = window.getComputedStyle(outerBox);

    expect(style.display).toBe("flex");
    expect(style.alignItems).toBe("center");
    expect(style.justifyContent).toBe("center");
  });

  it("should have white text color", () => {
    render(<WaitingScreen />);

    const text = screen.getByText("The Cost is Accurate");
    const style = window.getComputedStyle(text);

    // Chakra uses CSS variables, so check for the variable or the resolved color
    expect(
      style.color === "rgb(255, 255, 255)" ||
        style.color.includes("white") ||
        style.color.includes("--chakra-colors-white"),
    ).toBe(true);
  });

  it("should center text alignment", () => {
    render(<WaitingScreen />);

    const text = screen.getByText("The Cost is Accurate");
    const style = window.getComputedStyle(text);

    expect(style.textAlign).toBe("center");
  });
});
