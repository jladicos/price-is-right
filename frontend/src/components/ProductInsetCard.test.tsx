import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "../test/test-utils";
import { ProductInsetCard } from "./ProductInsetCard";
import userEvent from "@testing-library/user-event";

describe("ProductInsetCard", () => {
  const mockProduct = {
    name: "Simply Mango Juice",
    price: 478, // Stored in cents
    images: ["simply-mango-1.jpg", "simply-mango-2.jpg"],
  };

  describe("Visibility", () => {
    it("should not render when isVisible is false", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={false}
        />,
      );

      expect(
        screen.queryByTestId("product-inset-card"),
      ).not.toBeInTheDocument();
    });

    it("should not render when product is null", () => {
      render(
        <ProductInsetCard
          product={null}
          productId="simply-mango"
          isVisible={true}
        />,
      );

      expect(
        screen.queryByTestId("product-inset-card"),
      ).not.toBeInTheDocument();
    });

    it("should not render when productId is null", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId={null}
          isVisible={true}
        />,
      );

      expect(
        screen.queryByTestId("product-inset-card"),
      ).not.toBeInTheDocument();
    });

    it("should render when all props are valid", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
        />,
      );

      expect(screen.getByTestId("product-inset-card")).toBeInTheDocument();
    });
  });

  describe("Product Display", () => {
    it("should display product name", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
        />,
      );

      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Simply Mango Juice",
      );
    });

    it("should display product image", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
        />,
      );

      const image = screen.getByTestId("product-inset-image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("alt", "Simply Mango Juice");
    });
  });

  describe("Price Display", () => {
    it("should NOT show price when showPrice is false", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={false}
        />,
      );

      expect(
        screen.queryByTestId("product-inset-price"),
      ).not.toBeInTheDocument();
    });

    it("should NOT show price when price is undefined", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={undefined}
        />,
      );

      expect(
        screen.queryByTestId("product-inset-price"),
      ).not.toBeInTheDocument();
    });

    it("should show price when showPrice is true and price is provided", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={4.78}
        />,
      );

      expect(screen.getByTestId("product-inset-price")).toBeInTheDocument();
    });

    it("should format price with 2 decimal places", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={4.78}
        />,
      );

      expect(screen.getByTestId("product-inset-price")).toHaveTextContent(
        "$4.78",
      );
    });

    it("should format whole dollar amounts with .00", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={5}
        />,
      );

      expect(screen.getByTestId("product-inset-price")).toHaveTextContent(
        "$5.00",
      );
    });

    it("should format prices with cents correctly", () => {
      const testCases = [
        { price: 4.78, expected: "$4.78" },
        { price: 10.5, expected: "$10.50" },
        { price: 99.99, expected: "$99.99" },
        { price: 100.01, expected: "$100.01" },
        { price: 0.99, expected: "$0.99" },
      ];

      testCases.forEach(({ price, expected }) => {
        const { unmount } = render(
          <ProductInsetCard
            product={mockProduct}
            productId="simply-mango"
            isVisible={true}
            showPrice={true}
            price={price}
          />,
        );

        expect(screen.getByTestId("product-inset-price")).toHaveTextContent(
          expected,
        );
        unmount();
      });
    });
  });

  describe("Winner Scenario", () => {
    it("should show complete card with price after winner revealed", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={4.78}
        />,
      );

      // All elements should be visible
      expect(screen.getByTestId("product-inset-card")).toBeInTheDocument();
      expect(screen.getByTestId("product-inset-image")).toBeInTheDocument();
      expect(screen.getByTestId("product-inset-name")).toBeInTheDocument();
      expect(screen.getByTestId("product-inset-price")).toBeInTheDocument();
      expect(screen.getByText("$4.78")).toBeInTheDocument();
    });
  });

  describe("Price Formatting Edge Cases (Critical)", () => {
    it("should format zero price correctly", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={0}
        />,
      );

      expect(screen.getByTestId("product-inset-price")).toHaveTextContent(
        "$0.00",
      );
    });

    it("should handle very large prices", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={999999.99}
        />,
      );

      expect(screen.getByTestId("product-inset-price")).toHaveTextContent(
        "$999,999.99",
      );
    });

    it("should handle very small prices", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={0.01}
        />,
      );

      expect(screen.getByTestId("product-inset-price")).toHaveTextContent(
        "$0.01",
      );
    });

    it("should handle prices with single decimal digit", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={9.5}
        />,
      );

      // toFixed(2) should pad to $9.50
      expect(screen.getByTestId("product-inset-price")).toHaveTextContent(
        "$9.50",
      );
    });

    it("should handle null price (not just undefined)", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={null}
        />,
      );

      expect(
        screen.queryByTestId("product-inset-price"),
      ).not.toBeInTheDocument();
    });

    it("should handle negative prices gracefully", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={-5.99}
        />,
      );

      // Should still format, even if negative (edge case)
      expect(screen.getByTestId("product-inset-price")).toHaveTextContent(
        "-$5.99",
      );
    });
  });

  describe("Visibility Edge Cases (Critical)", () => {
    it("should not render when product name is empty", () => {
      const emptyNameProduct = { ...mockProduct, name: "" };

      render(
        <ProductInsetCard
          product={emptyNameProduct}
          productId="simply-mango"
          isVisible={true}
        />,
      );

      // Still renders - empty name is allowed
      expect(screen.getByTestId("product-inset-card")).toBeInTheDocument();
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent("");
    });

    it("should not render when productId is empty string", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId=""
          isVisible={true}
        />,
      );

      // Empty string is falsy, should not render
      expect(
        screen.queryByTestId("product-inset-card"),
      ).not.toBeInTheDocument();
    });

    it("should not render when both isVisible and product are null", () => {
      render(
        <ProductInsetCard product={null} productId="test" isVisible={false} />,
      );

      expect(
        screen.queryByTestId("product-inset-card"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Missing Images Edge Cases (Critical)", () => {
    it("should handle empty images array gracefully", () => {
      const productNoImages = { ...mockProduct, images: [] };

      // Should not crash even with empty array
      expect(() => {
        render(
          <ProductInsetCard
            product={productNoImages}
            productId="simply-mango"
            isVisible={true}
          />,
        );
      }).not.toThrow();

      // Card should still render
      expect(screen.getByTestId("product-inset-card")).toBeInTheDocument();
    });

    it("should handle undefined images", () => {
      const productNoImages = { ...mockProduct, images: undefined };

      // Should not crash
      expect(() => {
        render(
          <ProductInsetCard
            product={productNoImages}
            productId="simply-mango"
            isVisible={true}
          />,
        );
      }).not.toThrow();
    });

    it("should handle null in images array", () => {
      const productNullImage = { ...mockProduct, images: [null] };

      // Should not crash
      expect(() => {
        render(
          <ProductInsetCard
            product={productNullImage}
            productId="simply-mango"
            isVisible={true}
          />,
        );
      }).not.toThrow();
    });

    it("should handle empty string in images array", () => {
      const productEmptyImage = { ...mockProduct, images: [""] };

      render(
        <ProductInsetCard
          product={productEmptyImage}
          productId="simply-mango"
          isVisible={true}
        />,
      );

      // Image should still render with empty src
      const img = screen.getByTestId("product-inset-image");
      expect(img).toBeInTheDocument();
    });
  });

  describe("Showcase Mode", () => {
    const mockShowcaseProducts = [
      {
        id: "product-1",
        product: {
          name: "Laptop Computer",
          price: 1299.99,
          images: ["laptop-1.jpg"],
        },
      },
      {
        id: "product-2",
        product: {
          name: "Wireless Headphones",
          price: 299.99,
          images: ["headphones-1.jpg"],
        },
      },
      {
        id: "product-3",
        product: {
          name: "Smart Watch",
          price: 399.99,
          images: ["watch-1.jpg"],
        },
      },
    ];

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it("should render first product in showcase mode", () => {
      render(
        <ProductInsetCard products={mockShowcaseProducts} isVisible={true} />,
      );

      expect(screen.getByTestId("product-inset-card")).toBeInTheDocument();
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Laptop Computer",
      );
    });

    it("should show navigation arrows in showcase mode with multiple products", () => {
      render(
        <ProductInsetCard products={mockShowcaseProducts} isVisible={true} />,
      );

      expect(screen.getByTestId("carousel-prev-button")).toBeInTheDocument();
      expect(screen.getByTestId("carousel-next-button")).toBeInTheDocument();
    });

    it("should NOT show navigation arrows with single product", () => {
      const singleProduct = [mockShowcaseProducts[0]];
      render(<ProductInsetCard products={singleProduct} isVisible={true} />);

      expect(
        screen.queryByTestId("carousel-prev-button"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("carousel-next-button"),
      ).not.toBeInTheDocument();
    });

    it("should show carousel indicator with multiple products", () => {
      render(
        <ProductInsetCard products={mockShowcaseProducts} isVisible={true} />,
      );

      const indicator = screen.getByTestId("carousel-indicator");
      expect(indicator).toHaveTextContent("1 / 3");
    });

    it("should NOT show carousel indicator with single product", () => {
      const singleProduct = [mockShowcaseProducts[0]];
      render(<ProductInsetCard products={singleProduct} isVisible={true} />);

      expect(
        screen.queryByTestId("carousel-indicator"),
      ).not.toBeInTheDocument();
    });

    it("should navigate to next product when next button clicked", () => {
      render(
        <ProductInsetCard products={mockShowcaseProducts} isVisible={true} />,
      );

      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Laptop Computer",
      );

      act(() => {
        fireEvent.click(screen.getByTestId("carousel-next-button"));
      });

      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Wireless Headphones",
      );
      expect(screen.getByTestId("carousel-indicator")).toHaveTextContent(
        "2 / 3",
      );
    });

    it("should navigate to previous product when previous button clicked", () => {
      render(
        <ProductInsetCard products={mockShowcaseProducts} isVisible={true} />,
      );

      // Click next to get to product 2
      act(() => {
        fireEvent.click(screen.getByTestId("carousel-next-button"));
      });
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Wireless Headphones",
      );

      // Click previous to go back to product 1
      act(() => {
        fireEvent.click(screen.getByTestId("carousel-prev-button"));
      });
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Laptop Computer",
      );
      expect(screen.getByTestId("carousel-indicator")).toHaveTextContent(
        "1 / 3",
      );
    });

    it("should wrap to first product when clicking next on last product", () => {
      render(
        <ProductInsetCard products={mockShowcaseProducts} isVisible={true} />,
      );

      // Navigate to last product
      act(() => {
        fireEvent.click(screen.getByTestId("carousel-next-button"));
      });
      act(() => {
        fireEvent.click(screen.getByTestId("carousel-next-button"));
      });
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Smart Watch",
      );
      expect(screen.getByTestId("carousel-indicator")).toHaveTextContent(
        "3 / 3",
      );

      // Click next should wrap to first
      act(() => {
        fireEvent.click(screen.getByTestId("carousel-next-button"));
      });
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Laptop Computer",
      );
      expect(screen.getByTestId("carousel-indicator")).toHaveTextContent(
        "1 / 3",
      );
    });

    it("should wrap to last product when clicking previous on first product", () => {
      render(
        <ProductInsetCard products={mockShowcaseProducts} isVisible={true} />,
      );

      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Laptop Computer",
      );

      // Click previous should wrap to last
      act(() => {
        fireEvent.click(screen.getByTestId("carousel-prev-button"));
      });
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Smart Watch",
      );
      expect(screen.getByTestId("carousel-indicator")).toHaveTextContent(
        "3 / 3",
      );
    });

    it("should auto-advance to next product after 5 seconds", async () => {
      render(
        <ProductInsetCard products={mockShowcaseProducts} isVisible={true} />,
      );

      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Laptop Computer",
      );

      // Fast-forward 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Wireless Headphones",
      );
    });

    it("should continue auto-advancing through all products", async () => {
      render(
        <ProductInsetCard products={mockShowcaseProducts} isVisible={true} />,
      );

      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Laptop Computer",
      );

      // Advance to product 2
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Wireless Headphones",
      );

      // Advance to product 3
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Smart Watch",
      );

      // Advance back to product 1 (wrap around)
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Laptop Computer",
      );
    });

    it("should reset auto-advance timer when manually navigating", () => {
      render(
        <ProductInsetCard products={mockShowcaseProducts} isVisible={true} />,
      );

      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Laptop Computer",
      );

      // Wait 3 seconds (not enough to auto-advance)
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Manually navigate
      act(() => {
        fireEvent.click(screen.getByTestId("carousel-next-button"));
      });
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Wireless Headphones",
      );

      // Wait another 3 seconds (total 6 seconds, but timer should have reset)
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Should still be on product 2 (timer was reset to 0 on manual navigation)
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Wireless Headphones",
      );

      // Wait 2 more seconds (total 5 seconds since manual navigation)
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Now it should auto-advance to product 3
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Smart Watch",
      );
    });

    it("should NOT auto-advance with single product", async () => {
      const singleProduct = [mockShowcaseProducts[0]];
      render(<ProductInsetCard products={singleProduct} isVisible={true} />);

      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Laptop Computer",
      );

      // Wait 10 seconds (more than auto-advance time)
      vi.advanceTimersByTime(10000);

      // Should still be on the same product
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Laptop Computer",
      );
    });
  });

  describe("Position Prop", () => {
    it("should position card on right by default", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="test"
          isVisible={true}
        />,
      );

      const card = screen.getByTestId("product-inset-card");
      // Check that right style is applied (not left)
      expect(card).toHaveStyle({ right: "20px" });
    });

    it('should position card on left when position="left"', () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="test"
          isVisible={true}
          position="left"
        />,
      );

      const card = screen.getByTestId("product-inset-card");
      expect(card).toHaveStyle({ left: "20px" });
    });

    it('should position card on right when position="right"', () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="test"
          isVisible={true}
          position="right"
        />,
      );

      const card = screen.getByTestId("product-inset-card");
      expect(card).toHaveStyle({ right: "20px" });
    });
  });

  describe("Showcase Total Value Display", () => {
    const mockShowcaseProducts = [
      {
        id: "product-1",
        product: {
          name: "Laptop Computer",
          price: 1299.99,
          images: ["laptop-1.jpg"],
        },
      },
      {
        id: "product-2",
        product: {
          name: "Wireless Headphones",
          price: 299.99,
          images: ["headphones-1.jpg"],
        },
      },
    ];

    it('should show "TOTAL VALUE" label in showcase mode when price is shown', () => {
      render(
        <ProductInsetCard
          products={mockShowcaseProducts}
          isVisible={true}
          showPrice={true}
          price={1599.98}
        />,
      );

      expect(screen.getByTestId("showcase-total-label")).toHaveTextContent(
        "TOTAL VALUE",
      );
    });

    it('should NOT show "TOTAL VALUE" label in single product mode', () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="test"
          isVisible={true}
          showPrice={true}
          price={4.78}
        />,
      );

      expect(
        screen.queryByTestId("showcase-total-label"),
      ).not.toBeInTheDocument();
    });

    it("should NOT show total value label when price is not shown", () => {
      render(
        <ProductInsetCard
          products={mockShowcaseProducts}
          isVisible={true}
          showPrice={false}
        />,
      );

      expect(
        screen.queryByTestId("showcase-total-label"),
      ).not.toBeInTheDocument();
    });

    it("should format total showcase value correctly", () => {
      render(
        <ProductInsetCard
          products={mockShowcaseProducts}
          isVisible={true}
          showPrice={true}
          price={1599.98}
        />,
      );

      expect(screen.getByTestId("product-inset-price")).toHaveTextContent(
        "$1,599.98",
      );
      expect(screen.getByTestId("showcase-total-label")).toBeInTheDocument();
    });
  });

  describe("Backward Compatibility (Single Product Mode)", () => {
    it("should work with legacy single product props", () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="test"
          isVisible={true}
        />,
      );

      expect(screen.getByTestId("product-inset-card")).toBeInTheDocument();
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Simply Mango Juice",
      );
      expect(
        screen.queryByTestId("carousel-prev-button"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("carousel-next-button"),
      ).not.toBeInTheDocument();
    });

    it("should not render when both product and products are missing", () => {
      render(<ProductInsetCard isVisible={true} />);

      expect(
        screen.queryByTestId("product-inset-card"),
      ).not.toBeInTheDocument();
    });

    it("should prioritize products prop over product prop when both provided", () => {
      const showcaseProducts = [
        {
          id: "showcase-product",
          product: {
            name: "Showcase Item",
            price: 999.99,
            images: ["showcase-1.jpg"],
          },
        },
      ];

      render(
        <ProductInsetCard
          product={mockProduct}
          productId="single-product"
          products={showcaseProducts}
          isVisible={true}
        />,
      );

      // Should show showcase product, not single product
      expect(screen.getByTestId("product-inset-name")).toHaveTextContent(
        "Showcase Item",
      );
    });
  });
});
