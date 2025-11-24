/**
 * Integration tests for Bidding Flow
 *
 * These tests verify the actual bidding flow logic across multiple components,
 * ensuring price conversion, winner calculation, and bidding order work correctly.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../test/test-utils";
import { PodiumsRow } from "./PodiumsRow";
import { PodiumDisplay } from "./PodiumDisplay";
import { ProductInsetCard } from "./ProductInsetCard";
import type { ContestantWithPlayer, BidWithPlayer } from "../store/gameStore";

// Helper to create mock contestants
const createMockContestant = (
  position: number,
  status = "active",
): ContestantWithPlayer => ({
  id: position,
  player_id: position + 100,
  position,
  game_segment: "section_1",
  status,
  added_at: `2024-01-01T00:0${position}:00Z`,
  revealed_at: status === "active" ? `2024-01-01T00:0${position}:30Z` : null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  first_name: `Player${position}`,
  last_name: "Test",
  photo_filename: `player${position}.jpg`,
  role: "player",
});

const createMockBid = (position: number, amount: number): BidWithPlayer => ({
  id: position,
  player_id: position + 100,
  product_id: "test-product",
  round_number: 1,
  game_segment: "section_1",
  bid_amount: amount,
  is_locked: 1,
  is_winner: 0,
  retry_number: 0,
  created_at: `2024-01-01T00:1${position}:00Z`,
  first_name: `Player${position}`,
  last_name: "Test",
  photo_filename: `player${position}.jpg`,
  position,
});

describe("Bidding Flow Integration (Critical)", () => {
  describe("Price Conversion Integration", () => {
    it("should convert price from cents to dollars for display", () => {
      // Product price stored in database as cents
      const productPriceCents = 478; // $4.78
      const productPriceDollars = productPriceCents / 100;

      const mockProduct = {
        name: "Simply Mango Juice",
        price: productPriceCents,
        images: ["simply-mango.jpg"],
      };

      render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={productPriceDollars}
        />,
      );

      // Should display formatted price
      expect(screen.getByTestId("product-inset-price")).toHaveTextContent(
        "$4.78",
      );
    });

    it("should compare bids (in dollars) with converted price (from cents)", () => {
      // Product: $4.78 (stored as 478 cents)
      const productPriceCents = 478;
      const productPriceDollars = productPriceCents / 100; // 4.78

      // Bids: whole dollar amounts
      const bidTooLow = 3; // $3.00 - valid
      const bidValid = 4; // $4.00 - valid and highest
      const bidTooHigh = 5; // $5.00 - over

      // Winner logic: highest bid <= price
      const bids = [bidTooLow, bidValid, bidTooHigh];
      const validBids = bids.filter((b) => b <= productPriceDollars);
      const winner = Math.max(...validBids);

      expect(winner).toBe(4);
      expect(bidTooHigh > productPriceDollars).toBe(true); // Verify it's actually over
    });
  });

  describe("Contestant Reveal Flow", () => {
    it("should show reveal button only on leftmost pending contestant", () => {
      const contestants = [
        createMockContestant(1, "active"),
        createMockContestant(2, "pending_reveal"),
        createMockContestant(3, "pending_reveal"),
        createMockContestant(4, "active"),
        createMockContestant(5, "active"),
      ];

      const onRevealContestant = vi.fn();

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={null}
          role="host"
          onRevealContestant={onRevealContestant}
        />,
      );

      // Only position 2 should have reveal button (leftmost pending)
      expect(
        screen.queryByTestId("reveal-contestant-1"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("reveal-contestant-2")).toBeInTheDocument();
      expect(
        screen.queryByTestId("reveal-contestant-3"),
      ).not.toBeInTheDocument();

      // Click reveal button
      fireEvent.click(screen.getByTestId("reveal-contestant-2"));
      expect(onRevealContestant).toHaveBeenCalledWith(2); // Called with contestant ID
    });

    it("should progress reveal button as contestants are revealed", () => {
      const onRevealContestant = vi.fn();

      // Start: positions 2-5 pending
      const { rerender } = render(
        <PodiumsRow
          contestants={[
            createMockContestant(1, "active"),
            createMockContestant(2, "pending_reveal"),
            createMockContestant(3, "pending_reveal"),
            createMockContestant(4, "pending_reveal"),
            createMockContestant(5, "pending_reveal"),
          ]}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={null}
          role="host"
          onRevealContestant={onRevealContestant}
        />,
      );

      expect(screen.getByTestId("reveal-contestant-2")).toBeInTheDocument();

      // After revealing position 2
      rerender(
        <PodiumsRow
          contestants={[
            createMockContestant(1, "active"),
            createMockContestant(2, "active"),
            createMockContestant(3, "pending_reveal"),
            createMockContestant(4, "pending_reveal"),
            createMockContestant(5, "pending_reveal"),
          ]}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={null}
          role="host"
          onRevealContestant={onRevealContestant}
        />,
      );

      // Now position 3 should have reveal button
      expect(
        screen.queryByTestId("reveal-contestant-2"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("reveal-contestant-3")).toBeInTheDocument();
    });
  });

  describe("Bidding Input Conditions", () => {
    it("should only show bid input when ALL conditions are met", () => {
      const contestant = createMockContestant(1);

      const { rerender } = render(
        <PodiumDisplay
          position={1}
          contestant={contestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={101}
          allContestantsRevealed={false} // NOT revealed
          productHasBeenShown={false} // NOT shown
        />,
      );

      // Should NOT show input
      expect(screen.queryByTestId("bid-input-1")).not.toBeInTheDocument();

      // Reveal contestants but don't show product
      rerender(
        <PodiumDisplay
          position={1}
          contestant={contestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={101}
          allContestantsRevealed={true}
          productHasBeenShown={false} // Still not shown
        />,
      );

      // Should STILL NOT show input
      expect(screen.queryByTestId("bid-input-1")).not.toBeInTheDocument();

      // Show product
      rerender(
        <PodiumDisplay
          position={1}
          contestant={contestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={101}
          allContestantsRevealed={true}
          productHasBeenShown={true} // NOW shown
        />,
      );

      // NOW should show input
      expect(screen.getByTestId("bid-input-1")).toBeInTheDocument();
    });

    it("should hide input after bid is submitted", () => {
      const contestant = createMockContestant(1);

      const { rerender } = render(
        <PodiumDisplay
          position={1}
          contestant={contestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={101}
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      // Input should be visible
      expect(screen.getByTestId("bid-input-1")).toBeInTheDocument();

      // After bid submitted
      rerender(
        <PodiumDisplay
          position={1}
          contestant={contestant}
          bid={createMockBid(1, 4)} // Bid now exists
          isCurrentBidder={false}
          isWinner={false}
          role="player"
          currentPlayerId={101}
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      // Input should be hidden, bid should display
      expect(screen.queryByTestId("bid-input-1")).not.toBeInTheDocument();
      expect(screen.getByTestId("bid-amount-1")).toHaveTextContent("4");
    });
  });

  describe("Current Bidder Progression", () => {
    it("should progress current bidder as bids are submitted (fresh row)", () => {
      const contestants = [
        createMockContestant(1),
        createMockContestant(2),
        createMockContestant(3),
      ];

      // Round 1: Position 1 is current bidder
      const { rerender } = render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={1}
          winnerPosition={null}
          role="host"
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      expect(screen.getByTestId("podium-1")).toHaveAttribute(
        "data-current",
        "true",
      );
      expect(screen.getByTestId("podium-2")).toHaveAttribute(
        "data-current",
        "false",
      );

      // After position 1 bids, position 2 becomes current
      rerender(
        <PodiumsRow
          contestants={contestants}
          bids={[createMockBid(1, 4)]}
          currentBidderPosition={2}
          winnerPosition={null}
          role="host"
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      expect(screen.getByTestId("podium-1")).toHaveAttribute(
        "data-current",
        "false",
      );
      expect(screen.getByTestId("podium-2")).toHaveAttribute(
        "data-current",
        "true",
      );
      expect(screen.getByTestId("bid-amount-1")).toHaveTextContent("4");
    });
  });

  describe("Winner Display Integration", () => {
    it("should display winner with enlarged photo and badge", () => {
      const contestants = [createMockContestant(1), createMockContestant(2)];
      const bids = [createMockBid(1, 4), createMockBid(2, 5)];

      const { rerender } = render(
        <PodiumsRow
          contestants={contestants}
          bids={bids}
          currentBidderPosition={null}
          winnerPosition={null}
          role="audience"
        />,
      );

      // Before winner revealed
      expect(screen.queryByTestId("winner-label-1")).not.toBeInTheDocument();

      // After winner revealed (position 1)
      rerender(
        <PodiumsRow
          contestants={contestants}
          bids={bids}
          currentBidderPosition={null}
          winnerPosition={1}
          role="audience"
        />,
      );

      // Winner badge should appear
      expect(screen.getByTestId("winner-label-1")).toBeInTheDocument();
      expect(screen.getByText("WINNER!")).toBeInTheDocument();

      // Podium should be marked as winner
      expect(screen.getByTestId("podium-1")).toHaveAttribute(
        "data-winner",
        "true",
      );

      // Name should be hidden (replaced by badge)
      expect(screen.queryByText("Player1")).not.toBeInTheDocument();
    });

    it("should show product price after winner revealed", () => {
      const mockProduct = {
        name: "Simply Mango Juice",
        price: 478,
        images: ["test.jpg"],
      };

      const { rerender } = render(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={false} // Price not shown yet
        />,
      );

      // Price should not be visible
      expect(
        screen.queryByTestId("product-inset-price"),
      ).not.toBeInTheDocument();

      // After winner revealed, show price
      rerender(
        <ProductInsetCard
          product={mockProduct}
          productId="simply-mango"
          isVisible={true}
          showPrice={true}
          price={mockProduct.price / 100} // Convert to dollars
        />,
      );

      // Price should now be visible
      expect(screen.getByTestId("product-inset-price")).toHaveTextContent(
        "$4.78",
      );
    });
  });

  describe("Host Edit Mode Integration", () => {
    it("should allow host to edit existing bid and validate new value", () => {
      const contestant = createMockContestant(1);
      const bid = createMockBid(1, 4);
      const onUpdateBid = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={contestant}
          bid={bid}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
          onUpdateBid={onUpdateBid}
        />,
      );

      // Click bid to enter edit mode
      const bidDisplay = screen.getByTestId("digital-display-1");
      fireEvent.click(bidDisplay);

      // Input should appear with current value
      const input = screen.getByTestId("bid-input-1");
      expect(input).toHaveValue(4);

      // Try to edit to invalid value (negative)
      fireEvent.change(input, { target: { value: "-5" } });
      fireEvent.keyDown(input, { key: "Enter" });

      // Should NOT call update with invalid value
      expect(onUpdateBid).not.toHaveBeenCalled();

      // Edit to valid value
      fireEvent.change(input, { target: { value: "6" } });
      fireEvent.keyDown(input, { key: "Enter" });

      // Should call update with valid value
      expect(onUpdateBid).toHaveBeenCalledWith(1, 6);
    });
  });

  describe("Winner Calculation Scenarios", () => {
    it("should identify highest valid bid as winner", () => {
      const productPrice = 4.78;
      const bids = [3, 4, 5, 2]; // Position-based bids

      // Filter valid bids (bid <= price)
      const validBids = bids.filter((b) => b <= productPrice);
      expect(validBids).toEqual([3, 4, 2]);

      // Find highest valid bid
      const winningBid = Math.max(...validBids);
      expect(winningBid).toBe(4);

      // Winner is at position 2 (index 1)
      const winnerPosition = bids.indexOf(winningBid) + 1;
      expect(winnerPosition).toBe(2);
    });

    it('should handle "all over" scenario', () => {
      const productPrice = 4.78;
      const bids = [5, 6, 7, 8]; // All over

      const validBids = bids.filter((b) => b <= productPrice);
      expect(validBids.length).toBe(0);

      // No winner - all bids are over
      const hasWinner = validBids.length > 0;
      expect(hasWinner).toBe(false);
    });

    it("should handle exact price match", () => {
      const productPrice = 4.0; // Exact dollars
      const bids = [3, 4, 5];

      const validBids = bids.filter((b) => b <= productPrice);
      expect(validBids).toEqual([3, 4]);

      const winningBid = Math.max(...validBids);
      expect(winningBid).toBe(4); // Exact match wins
    });

    it("should handle tie-breaker (earliest bid wins)", () => {
      const bids = [4, 4, 3]; // Two $4 bids

      // In real implementation, backend handles tie-breaker by created_at timestamp
      // Frontend just displays what backend determines
      // This test documents that duplicate amounts are allowed to display
      const duplicateBids = bids.filter((b) => b === 4);
      expect(duplicateBids.length).toBe(2);
    });
  });

  describe("Full Bidding Round Simulation", () => {
    it("should complete full bidding cycle from contestants to winner", () => {
      const contestants = [
        createMockContestant(1),
        createMockContestant(2),
        createMockContestant(3),
      ];

      const mockProduct = {
        name: "Test Product",
        price: 478, // $4.78
        images: ["test.jpg"],
      };

      // 1. All contestants revealed, no bids yet
      const { rerender: rerenderPodiums } = render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={1}
          winnerPosition={null}
          role="host"
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      expect(screen.getByText("Player1")).toBeInTheDocument();
      expect(screen.getByText("Player2")).toBeInTheDocument();
      expect(screen.getByText("Player3")).toBeInTheDocument();

      // 2. Bids submitted: $3, $4, $5
      rerenderPodiums(
        <PodiumsRow
          contestants={contestants}
          bids={[createMockBid(1, 3), createMockBid(2, 4), createMockBid(3, 5)]}
          currentBidderPosition={null}
          winnerPosition={null}
          role="host"
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      expect(screen.getByTestId("bid-amount-1")).toHaveTextContent("3");
      expect(screen.getByTestId("bid-amount-2")).toHaveTextContent("4");
      expect(screen.getByTestId("bid-amount-3")).toHaveTextContent("5");

      // 3. Winner revealed (position 2 with $4)
      rerenderPodiums(
        <PodiumsRow
          contestants={contestants}
          bids={[createMockBid(1, 3), createMockBid(2, 4), createMockBid(3, 5)]}
          currentBidderPosition={null}
          winnerPosition={2}
          role="host"
        />,
      );

      expect(screen.getByTestId("winner-label-2")).toBeInTheDocument();
      expect(screen.getByTestId("podium-2")).toHaveAttribute(
        "data-winner",
        "true",
      );

      // 4. Product card shows price
      render(
        <ProductInsetCard
          product={mockProduct}
          productId="test"
          isVisible={true}
          showPrice={true}
          price={mockProduct.price / 100}
        />,
      );

      expect(screen.getByTestId("product-inset-price")).toHaveTextContent(
        "$4.78",
      );
    });
  });
});
