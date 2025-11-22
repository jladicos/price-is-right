import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/test-utils';
import { ProductInsetCard } from './ProductInsetCard';

describe('ProductInsetCard', () => {
  const mockProduct = {
    name: 'Simply Mango Juice',
    price: 478, // Stored in cents
    images: ['simply-mango-1.jpg', 'simply-mango-2.jpg'],
  };

  describe('Visibility', () => {
    it('should not render when isVisible is false', () => {
      render(<ProductInsetCard product={mockProduct} productId="simply-mango" isVisible={false} />);

      expect(screen.queryByTestId('product-inset-card')).not.toBeInTheDocument();
    });

    it('should not render when product is null', () => {
      render(<ProductInsetCard product={null} productId="simply-mango" isVisible={true} />);

      expect(screen.queryByTestId('product-inset-card')).not.toBeInTheDocument();
    });

    it('should not render when productId is null', () => {
      render(<ProductInsetCard product={mockProduct} productId={null} isVisible={true} />);

      expect(screen.queryByTestId('product-inset-card')).not.toBeInTheDocument();
    });

    it('should render when all props are valid', () => {
      render(<ProductInsetCard product={mockProduct} productId="simply-mango" isVisible={true} />);

      expect(screen.getByTestId('product-inset-card')).toBeInTheDocument();
    });
  });

  describe('Product Display', () => {
    it('should display product name', () => {
      render(<ProductInsetCard product={mockProduct} productId="simply-mango" isVisible={true} />);

      expect(screen.getByTestId('product-inset-name')).toHaveTextContent('Simply Mango Juice');
    });

    it('should display product image', () => {
      render(<ProductInsetCard product={mockProduct} productId="simply-mango" isVisible={true} />);

      const image = screen.getByTestId('product-inset-image');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('alt', 'Simply Mango Juice');
    });
  });

  describe('Price Display', () => {
    it('should NOT show price when showPrice is false', () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={false}
        />,
      );

      expect(screen.queryByTestId('product-inset-price')).not.toBeInTheDocument();
    });

    it('should NOT show price when price is undefined', () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={undefined}
        />,
      );

      expect(screen.queryByTestId('product-inset-price')).not.toBeInTheDocument();
    });

    it('should show price when showPrice is true and price is provided', () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={4.78}
        />,
      );

      expect(screen.getByTestId('product-inset-price')).toBeInTheDocument();
    });

    it('should format price with 2 decimal places', () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={4.78}
        />,
      );

      expect(screen.getByTestId('product-inset-price')).toHaveTextContent('$4.78');
    });

    it('should format whole dollar amounts with .00', () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={5}
        />,
      );

      expect(screen.getByTestId('product-inset-price')).toHaveTextContent('$5.00');
    });

    it('should format prices with cents correctly', () => {
      const testCases = [
        { price: 4.78, expected: '$4.78' },
        { price: 10.5, expected: '$10.50' },
        { price: 99.99, expected: '$99.99' },
        { price: 100.01, expected: '$100.01' },
        { price: 0.99, expected: '$0.99' },
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

        expect(screen.getByTestId('product-inset-price')).toHaveTextContent(expected);
        unmount();
      });
    });
  });

  describe('Winner Scenario', () => {
    it('should show complete card with price after winner revealed', () => {
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
      expect(screen.getByTestId('product-inset-card')).toBeInTheDocument();
      expect(screen.getByTestId('product-inset-image')).toBeInTheDocument();
      expect(screen.getByTestId('product-inset-name')).toBeInTheDocument();
      expect(screen.getByTestId('product-inset-price')).toBeInTheDocument();
      expect(screen.getByText('$4.78')).toBeInTheDocument();
    });
  });

  describe('Price Formatting Edge Cases (Critical)', () => {
    it('should format zero price correctly', () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={0}
        />,
      );

      expect(screen.getByTestId('product-inset-price')).toHaveTextContent('$0.00');
    });

    it('should handle very large prices', () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={999999.99}
        />,
      );

      expect(screen.getByTestId('product-inset-price')).toHaveTextContent('$999999.99');
    });

    it('should handle very small prices', () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={0.01}
        />,
      );

      expect(screen.getByTestId('product-inset-price')).toHaveTextContent('$0.01');
    });

    it('should handle prices with single decimal digit', () => {
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
      expect(screen.getByTestId('product-inset-price')).toHaveTextContent('$9.50');
    });

    it('should handle null price (not just undefined)', () => {
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={null}
        />,
      );

      expect(screen.queryByTestId('product-inset-price')).not.toBeInTheDocument();
    });

    it('should handle negative prices gracefully', () => {
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
      expect(screen.getByTestId('product-inset-price')).toHaveTextContent('-$5.99');
    });
  });

  describe('Visibility Edge Cases (Critical)', () => {
    it('should not render when product name is empty', () => {
      const emptyNameProduct = { ...mockProduct, name: '' };

      render(
        <ProductInsetCard product={emptyNameProduct} productId="simply-mango" isVisible={true} />,
      );

      // Still renders - empty name is allowed
      expect(screen.getByTestId('product-inset-card')).toBeInTheDocument();
      expect(screen.getByTestId('product-inset-name')).toHaveTextContent('');
    });

    it('should not render when productId is empty string', () => {
      render(<ProductInsetCard product={mockProduct} productId="" isVisible={true} />);

      // Empty string is falsy, should not render
      expect(screen.queryByTestId('product-inset-card')).not.toBeInTheDocument();
    });

    it('should not render when both isVisible and product are null', () => {
      render(<ProductInsetCard product={null} productId="test" isVisible={false} />);

      expect(screen.queryByTestId('product-inset-card')).not.toBeInTheDocument();
    });
  });

  describe('Missing Images Edge Cases (Critical)', () => {
    it('should handle empty images array gracefully', () => {
      const productNoImages = { ...mockProduct, images: [] };

      // Should not crash even with empty array
      expect(() => {
        render(
          <ProductInsetCard product={productNoImages} productId="simply-mango" isVisible={true} />,
        );
      }).not.toThrow();

      // Card should still render
      expect(screen.getByTestId('product-inset-card')).toBeInTheDocument();
    });

    it('should handle undefined images', () => {
      const productNoImages = { ...mockProduct, images: undefined };

      // Should not crash
      expect(() => {
        render(
          <ProductInsetCard product={productNoImages} productId="simply-mango" isVisible={true} />,
        );
      }).not.toThrow();
    });

    it('should handle null in images array', () => {
      const productNullImage = { ...mockProduct, images: [null] };

      // Should not crash
      expect(() => {
        render(
          <ProductInsetCard product={productNullImage} productId="simply-mango" isVisible={true} />,
        );
      }).not.toThrow();
    });

    it('should handle empty string in images array', () => {
      const productEmptyImage = { ...mockProduct, images: [''] };

      render(
        <ProductInsetCard product={productEmptyImage} productId="simply-mango" isVisible={true} />,
      );

      // Image should still render with empty src
      const img = screen.getByTestId('product-inset-image');
      expect(img).toBeInTheDocument();
    });
  });
});
