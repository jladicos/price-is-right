import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test/test-utils';
import { WheelDisplay } from './WheelDisplay';
import userEvent from '@testing-library/user-event';

describe('WheelDisplay', () => {
  describe('Basic Rendering', () => {
    it('should render wheel container', () => {
      render(<WheelDisplay currentValue={100} />);

      expect(screen.getByTestId('wheel-display')).toBeInTheDocument();
      expect(screen.getByTestId('wheel-container')).toBeInTheDocument();
    });

    it('should render pointer/indicator', () => {
      render(<WheelDisplay currentValue={100} />);

      expect(screen.getByTestId('wheel-pointer')).toBeInTheDocument();
    });

    it('should render wheel segments', () => {
      render(<WheelDisplay currentValue={100} />);

      expect(screen.getByTestId('wheel-segments')).toBeInTheDocument();
    });

    it('should render accessibility button', () => {
      render(<WheelDisplay currentValue={100} />);

      const button = screen.getByTestId('spin-wheel-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Spin Wheel');
    });
  });

  describe('Segment Display', () => {
    it('should render all 300 segments (20 values × 15 loops)', () => {
      render(<WheelDisplay currentValue={100} />);

      // Should have 300 total segments (15 loops of 20)
      const segments = screen.getAllByTestId(/wheel-segment-/);
      expect(segments).toHaveLength(300);
    });

    it('should display segments in correct order', () => {
      render(<WheelDisplay currentValue={100} />);

      const expectedOrder = [
        15, 80, 35, 60, 20, 40, 75, 55, 95, 50, 85, 30, 65, 10, 45, 70, 25, 90, 5, 100,
      ];

      // Check first 20 segments
      for (let i = 0; i < 20; i++) {
        const segment = screen.getByTestId(`wheel-segment-${i}`);
        expect(segment).toHaveAttribute('data-value', expectedOrder[i].toString());
      }
    });

    it('should display 5¢ with green styling', () => {
      render(<WheelDisplay currentValue={5} />);

      const segment = screen.getByTestId('wheel-segment-18'); // 5¢ is at index 18
      expect(segment).toHaveAttribute('data-value', '5');
      expect(segment).toHaveTextContent('5¢');
    });

    it('should display 15¢ with green styling', () => {
      render(<WheelDisplay currentValue={15} />);

      const segment = screen.getByTestId('wheel-segment-0'); // 15¢ is at index 0
      expect(segment).toHaveAttribute('data-value', '15');
      expect(segment).toHaveTextContent('15¢');
    });

    it('should display $1.00 with special styling', () => {
      render(<WheelDisplay currentValue={100} />);

      const segment = screen.getByTestId('wheel-segment-19'); // 100¢ is at index 19
      expect(segment).toHaveAttribute('data-value', '100');
      expect(segment).toHaveTextContent('$1.00');
    });

    it('should display standard values correctly', () => {
      render(<WheelDisplay currentValue={50} />);

      const segment = screen.getByTestId('wheel-segment-9'); // 50¢ is at index 9
      expect(segment).toHaveAttribute('data-value', '50');
      expect(segment).toHaveTextContent('50¢');
    });
  });

  describe('Interaction', () => {
    it('should call onSpin when container is clicked', async () => {
      const user = userEvent.setup();
      const onSpin = vi.fn();

      render(<WheelDisplay currentValue={100} onSpin={onSpin} />);

      const container = screen.getByTestId('wheel-container');
      await user.click(container);

      expect(onSpin).toHaveBeenCalledTimes(1);
    });

    it('should call onSpin when button is clicked', async () => {
      const user = userEvent.setup();
      const onSpin = vi.fn();

      render(<WheelDisplay currentValue={100} onSpin={onSpin} />);

      const button = screen.getByTestId('spin-wheel-button');
      await user.click(button);

      expect(onSpin).toHaveBeenCalledTimes(1);
    });

    it('should not call onSpin when disabled', async () => {
      const user = userEvent.setup();
      const onSpin = vi.fn();

      render(<WheelDisplay currentValue={100} onSpin={onSpin} disabled={true} />);

      const container = screen.getByTestId('wheel-container');
      await user.click(container);

      expect(onSpin).not.toHaveBeenCalled();
    });

    it('should not call onSpin when spinning', async () => {
      const user = userEvent.setup();
      const onSpin = vi.fn();

      render(<WheelDisplay currentValue={100} onSpin={onSpin} isSpinning={true} />);

      const container = screen.getByTestId('wheel-container');
      await user.click(container);

      expect(onSpin).not.toHaveBeenCalled();
    });

    it('should show pointer cursor when clickable', () => {
      render(<WheelDisplay currentValue={100} />);

      const container = screen.getByTestId('wheel-container');
      expect(container).toHaveAttribute('data-clickable', 'true');
    });

    it('should not show pointer cursor when disabled', () => {
      render(<WheelDisplay currentValue={100} disabled={true} />);

      const container = screen.getByTestId('wheel-container');
      expect(container).toHaveAttribute('data-clickable', 'false');
    });

    it('should not show pointer cursor when spinning', () => {
      render(<WheelDisplay currentValue={100} isSpinning={true} />);

      const container = screen.getByTestId('wheel-container');
      expect(container).toHaveAttribute('data-clickable', 'false');
    });
  });

  describe('Button States', () => {
    it("should show 'Spin Wheel' text when not spinning", () => {
      render(<WheelDisplay currentValue={100} />);

      const button = screen.getByTestId('spin-wheel-button');
      expect(button).toHaveTextContent('Spin Wheel');
    });

    it("should show 'Spinning...' text when spinning", () => {
      render(<WheelDisplay currentValue={100} isSpinning={true} />);

      const button = screen.getByTestId('spin-wheel-button');
      expect(button).toHaveTextContent('Spinning...');
    });

    it('should disable button when disabled prop is true', () => {
      render(<WheelDisplay currentValue={100} disabled={true} />);

      const button = screen.getByTestId('spin-wheel-button');
      expect(button).toBeDisabled();
    });

    it('should disable button when spinning', () => {
      render(<WheelDisplay currentValue={100} isSpinning={true} />);

      const button = screen.getByTestId('spin-wheel-button');
      expect(button).toBeDisabled();
    });

    it('should enable button when not disabled and not spinning', () => {
      render(<WheelDisplay currentValue={100} disabled={false} isSpinning={false} />);

      const button = screen.getByTestId('spin-wheel-button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('Animation', () => {
    it('should position wheel at currentValue', () => {
      render(<WheelDisplay currentValue={100} />);

      const segments = screen.getByTestId('wheel-segments');
      // Should have inline transform style with translateY
      const transform = segments.getAttribute('style');
      expect(transform).toContain('translateY');
      expect(transform).toContain('px');
    });

    it('should update position when currentValue changes', () => {
      const { rerender } = render(<WheelDisplay currentValue={100} />);

      const segmentsBefore = screen.getByTestId('wheel-segments');
      const styleBefore = segmentsBefore.getAttribute('style');

      rerender(<WheelDisplay currentValue={50} />);

      const segmentsAfter = screen.getByTestId('wheel-segments');
      const styleAfter = segmentsAfter.getAttribute('style');

      // Transform should change when value changes
      expect(styleBefore).not.toBe(styleAfter);
      expect(styleAfter).toContain('translateY');
    });

    it('should apply transition when spinning', () => {
      render(<WheelDisplay currentValue={100} targetValue={50} isSpinning={true} />);

      const segments = screen.getByTestId('wheel-segments');
      const styles = window.getComputedStyle(segments);

      // Should have transition property
      expect(styles.transition).toContain('transform');
    });

    it('should not apply transition when not spinning', () => {
      render(<WheelDisplay currentValue={100} isSpinning={false} />);

      const segments = screen.getByTestId('wheel-segments');
      const styles = window.getComputedStyle(segments);

      // Should have no transition
      expect(styles.transition).toBe('none');
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid currentValue gracefully', () => {
      render(<WheelDisplay currentValue={999} isSpinning={false} />);

      const segments = screen.getByTestId('wheel-segments');
      expect(segments).toBeInTheDocument();
      // Should not crash
    });

    it('should handle negative currentValue', () => {
      render(<WheelDisplay currentValue={-5} isSpinning={false} />);

      const segments = screen.getByTestId('wheel-segments');
      expect(segments).toBeInTheDocument();
      // Should not crash
    });

    it('should handle spinning with same start and target value', () => {
      render(<WheelDisplay currentValue={50} targetValue={50} isSpinning={true} />);

      const segments = screen.getByTestId('wheel-segments');
      expect(segments).toBeInTheDocument();
    });

    it('should handle very large targetValue', () => {
      render(<WheelDisplay currentValue={5} targetValue={100} isSpinning={true} />);

      const segments = screen.getByTestId('wheel-segments');
      // Should still render and position correctly
      expect(segments).toBeInTheDocument();
    });

    it('should handle rapid state changes', () => {
      const { rerender } = render(<WheelDisplay currentValue={5} isSpinning={false} />);

      rerender(<WheelDisplay currentValue={50} isSpinning={true} />);
      rerender(<WheelDisplay currentValue={50} isSpinning={false} />);
      rerender(<WheelDisplay currentValue={95} isSpinning={true} />);

      const segments = screen.getByTestId('wheel-segments');
      expect(segments).toBeInTheDocument();
    });

    it('should handle custom startingPosition', () => {
      render(<WheelDisplay currentValue={5} startingPosition="second" isSpinning={false} />);

      const segments = screen.getByTestId('wheel-segments');
      expect(segments).toBeInTheDocument();

      // Position should be based on startingPosition
      const style = segments.getAttribute('style');
      expect(style).toBeDefined();
    });

    it('should handle missing onSpin callback', async () => {
      render(<WheelDisplay currentValue={50} isSpinning={false} />);

      const button = screen.getByTestId('spin-wheel-button');
      expect(button).toBeInTheDocument();

      // Should not crash when clicking without callback
      await userEvent.click(button);
    });

    it('should handle disabled state with onSpin callback', async () => {
      const onSpin = vi.fn();
      render(<WheelDisplay currentValue={50} onSpin={onSpin} disabled={true} />);

      const button = screen.getByTestId('spin-wheel-button');
      await userEvent.click(button);

      // Should not call callback when disabled
      expect(onSpin).not.toHaveBeenCalled();
    });
  });
});
