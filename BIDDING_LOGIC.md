# Bidding Phase Logic Documentation

## Implementation Status

### ✅ Completed Features
- [x] **Bidding logic** - Winner calculation, all-over scenario, tie-breaker
- [x] **Price handling** - Dollar-based pricing (updated from cents)
- [x] **Bidding order** - Fresh row (left-to-right) vs replacement row (newest first)
- [x] **Contestant flow** - Status management (pending_reveal → active → won → replaced)
- [x] **Host controls** - Bid editing with Enter/Escape keys
- [x] **Winner display** - Photo enlargement, badge, price reveal
- [x] **Weighted selection** - Priority-based contestant selection
- [x] **Comprehensive testing** - 740+ tests passing
- [x] **Code quality** - ESLint passing (0 errors, 11 warnings)

### 📋 Recent Updates
- **Price Format**: Changed from cents (288) to dollars (2.88) for clarity
- **Weighted Selection**: Added player weight system for prioritized selection
- **Test Coverage**: Fixed all pre-existing test failures
- **Documentation**: Updated to reflect pricing changes

## Overview
This document explains the key logic and rules for the bidding phase of the Price is Right game.

## Price and Bid Format

### Product Prices ✅ UPDATED
- **Storage**: Prices are stored in `data/products.json` as **dollar amounts**
  - Integer values (e.g., `288`) = $288.00
  - Decimal values (e.g., `2.88`) = $2.88
  - Example: Simply Mango juice → `2.88` in JSON = $2.88
- **Display**: Shown with 2 decimal places
  - Frontend: `price.toFixed(2)` → "$2.88"
- **Comparison**: Used directly (no conversion needed)
  - Backend: `product.price` → 2.88

### Bid Amounts
- **Input**: Players enter bids as **whole dollar amounts**
  - Example: Entering `2` means $2.00, `3` means $3.00
- **Storage**: Stored as integers (no conversion needed)
- **Comparison**: Compared directly with product prices

### Why This Design?
- **Clear and intuitive**: Prices defined as you see them ($2.88 vs 288 cents)
- **Flexible**: Supports both dollar amounts (288) and cents (2.88)
- **No conversion bugs**: Direct comparison, no /100 divisions
- Example: Product at $2.88
  - Bid of `2` ($2.00) → UNDER (valid)
  - Bid of `3` ($3.00) → OVER (invalid)

## Winner Calculation

### Rules
1. Winner is the **HIGHEST** bid that does **NOT EXCEED** the actual price
2. If bid equals price, it wins (e.g., $4.78 bid wins if price is $4.78)
3. **Tie-breaker**: If multiple bids have same amount, earliest bid wins
4. **"All Over"**: If ALL bids exceed the price, everyone must rebid

### Examples
Product at $4.78:
- Bids: $3, $4, $5 → Winner: $4 (highest valid)
- Bids: $1, $2, $3 → Winner: $3 (highest valid)
- Bids: $5, $6, $7 → All over (retry required)
- Bids: $4, $4, $5 → Winner: First $4 bid (tie-breaker)

## Bidding Order

### Fresh Row (is_fresh_row = true)
When all 5 contestants are selected at once:
- **Trigger**: Game start, or host refreshes entire row
- **Order**: Left to right → Position 1, 2, 3, 4, 5
- **Logic**: Classic game show format for new contestants

### Replacement Row (is_fresh_row = false)
After a winner is replaced:
- **Trigger**: Auto-replacement when advancing from bidding phase
- **Order**: Newest contestant first, then circular
- **Example**: Winner at position 2 replaced
  - New order: 2 (newest), 3, 4, 5, 1

### Flag Management
The `is_fresh_row` flag is managed as follows:

**Set to TRUE:**
- `POST /api/game/start` - Initial 5 contestants selected
- `POST /api/game/refresh-contestants-row` - Host replaces all 5

**Set to FALSE:**
- `POST /api/game/advance` - When advancing FROM bidding phase (auto-replacement detected)

**Preserved:**
- `POST /api/game/advance` - When advancing from other phases
- Carried over in phase_metadata across phase transitions

## Contestant Status Flow

### Status Values
- `pending_reveal`: Selected but not yet revealed to audience
- `active`: Revealed and participating in game
- `won`: Winner of a bidding round (still visible, occupies position)
- `replaced`: No longer in game (removed from active contestants)

### Winner Display Logic
When a winner is revealed:
1. Contestant status changes to `won`
2. Winner remains visible at their podium
3. Winner's photo enlarges by 60% (150px → 240px)
4. "WINNER!" badge appears above photo
5. Winner's podium gets highlighted glow
6. Product inset card shows actual price

### Contestant Replacement
When advancing to next round:
1. Find contestant with status `won`
2. Replace them with new random contestant
3. New contestant gets status `pending_reveal`
4. Host reveals new contestant → status becomes `active`
5. Set `is_fresh_row = false` (newest bids first)

## Host Controls

### Bid Editing
Host can click any bid to edit:
1. **Click bid** → Enters edit mode
2. **Type new amount** → Updates input
3. **Press Enter** → Submits updated bid
4. **Press Escape** → Cancels edit

Host does NOT see:
- Submit button (✓) - uses Enter key
- Cancel button (✕) - uses Escape key

Players see submit button (✓) but not cancel.

### Validation
- Bid must be positive integer
- No duplicate bids allowed (each contestant must have unique amount)
- Duplicate check excludes the bid being edited

## UI/UX Details

### Podium Highlighting
Podiums are highlighted when:
- **Before bidding**: Next contestant to reveal (pending_reveal)
- **During bidding**: Current bidder's turn
- **After winner**: Winner's podium (with color glow)

Highlighting requires:
- `allContestantsRevealed = true` (all 5 revealed)
- `productHasBeenShown = true` (product displayed at least once)

### Winner Photo Overflow
Winner's enlarged photo (240px) overflows its container:
- Container stays at 150px (maintains layout)
- Photo uses absolute positioning
- Bottom-aligned with other photos
- zIndex ensures it appears above adjacent content

### Product Inset Card
After winner revealed:
- Card remains visible (not hidden)
- Shows product name and image
- Displays actual price in green box at bottom
- Price formatted as dollars with 2 decimals: "$4.78"

## Game Flow Summary

### Round 1 (Fresh Row)
1. Game starts → 5 contestants selected (all pending_reveal)
2. Host reveals contestants one by one (left to right)
3. Host shows product
4. Bidding begins: Position 1 → 2 → 3 → 4 → 5
5. Host reveals winner
6. Winner status → `won`, stays visible at podium

### Round 2+ (Replacement Row)
1. Host advances phase → Winner auto-replaced with new contestant
2. New contestant has pending_reveal status
3. Host reveals new contestant
4. Host shows product
5. Bidding begins: Newest contestant first, then circular
6. Host reveals winner
7. Repeat...

## Testing Considerations

### Key Test Scenarios
1. **Price conversion**: Verify cents → dollars conversion
2. **Winner calculation**: Test various bid combinations
3. **All over scenario**: All bids exceed price
4. **Tie-breaker**: Multiple bids with same amount
5. **Bidding order**: Fresh row vs replacement row
6. **Edit mode**: Host can edit bids
7. **Winner display**: Photo size, badge, price shown
8. **Flag preservation**: is_fresh_row across phase changes

### Edge Cases
- Empty bids array
- Single contestant
- All contestants overbid
- Exact price match
- Negative/zero bids (should be rejected)
- Duplicate bids (should be rejected)
- Winner at each position (1-5)

## Weighted Player Selection ✅ NEW FEATURE

### Overview
The game supports weighted random selection for contestants, allowing you to prioritize certain players over others when filling the contestant's row.

### Weight System
Each player has a `weight` field (0.0 to 1.0):
- **weight > 0**: Primary tier - selected with weighted probability
- **weight = 0**: Backup tier - only selected if no primary tier players available
- **Default**: 1.0 (full probability)

### Selection Algorithm
When selecting contestants:
1. **Filter** by active audience members
2. **Separate** into two tiers:
   - Primary: weight > 0
   - Backup: weight = 0
3. **Select from primary** using weighted random selection
4. **Fallback to backup** only if primary tier exhausted
5. **Within each tier**: Higher weights = higher probability

### Example Usage
```javascript
// In data/players-import.xlsx
Player A: weight 1.0   // Full probability
Player B: weight 0.5   // Half probability of Player A
Player C: weight 0.1   // Low probability
Player D: weight 0.0   // Backup only
```

When selecting 5 contestants:
- Players A, B, C selected first (weighted probability)
- Player D only selected if A, B, C unavailable

### Implementation Details
- **Database**: `players.weight` column (REAL, default 1.0)
- **API**: `PUT /api/players/:id` accepts `weight` field (clamped to [0, 1])
- **Import**: Excel import supports `Weight` column
- **Selection**: `src/utils/weighted-selection.ts`

### Testing ✅ COMPLETED
- Unit tests for weighted selection algorithm
- Integration tests for database player selection
- API validation tests for weight field
- Import script weight parsing tests
