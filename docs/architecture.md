# Architecture & Design Decisions

This document captures key architectural decisions made during development. It serves as a permanent reference for understanding why certain design choices were made.

---

## Game Phase Extensibility

**Decision Date**: November 2024
**Context**: Support future addition of mini-games between bidding rounds without schema changes

### Current Game Flow
1. Initial contestant's row selection
2. Section 1: Bidding rounds
3. Spin the Wheel 1
4. Section 2: Bidding rounds
5. Spin the Wheel 2
6. Showcase Showdown

### Future Game Flow (with mini-games)
1. Initial contestant's row selection
2. Section 1: Bidding round → Mini-game → Bidding round → Mini-game → ...
3. Spin the Wheel 1
4. Section 2: Bidding round → Mini-game → Bidding round → Mini-game → ...
5. Spin the Wheel 2
6. Showcase Showdown

### Design Approach

**Configuration-Driven Game Structure**

The game flow is defined in `data/products.json` using a flexible structure:

```json
{
  "products": { ... },
  "game_structure": {
    "section_1": [
      { "type": "bidding", "product_id": "car-001" },
      { "type": "bidding", "product_id": "tv-001" }
    ],
    "section_1_finale": { "type": "wheel" },
    "section_2": [ ... ],
    "section_2_finale": { "type": "wheel" },
    "finale": { "type": "showcase", "products": [...] }
  }
}
```

**Future Extension** (no schema changes required):
```json
"section_1": [
  { "type": "bidding", "product_id": "car-001" },
  { "type": "mini_game", "game_type": "plinko", "product_id": "prize-001" },
  { "type": "bidding", "product_id": "tv-001" }
]
```

**Database Schema** (`game_workflow` table):
```sql
current_segment TEXT NOT NULL,      -- 'section_1', 'section_2', 'finale'
current_segment_index INTEGER,      -- position within segment sequence
phase_type TEXT NOT NULL,           -- 'bidding', 'mini_game', 'wheel', 'showcase'
phase_metadata TEXT                 -- JSON blob for phase-specific data
```

**Benefits**:
- No schema migrations needed to add mini-games
- Game flow controlled by configuration, not hardcoded logic
- Easy to test different game structures
- Extensible to other phase types in the future

### Phase Advancement Logic

**Decision Date**: November 2024
**Context**: Automatic phase progression based on game_structure configuration

**Typical Game Sequence**:
```
not_started →
bidding (section_1[0]) → bidding (section_1[1]) → ... →
wheel (section_1_finale) →
bidding (section_2[0]) → bidding (section_2[1]) → ... →
wheel (section_2_finale) →
showcase (finale)
```

**Advancement Mechanism**:

`POST /api/game/advance` (no body) automatically:
1. Reads `current_segment` and `current_segment_index` from workflow
2. Looks up next phase in `game_structure[current_segment][current_segment_index + 1]`
3. Increments `current_segment_index`
4. Updates `phase_type` to match the next phase
5. Handles segment transitions:
   - End of section_1 array → section_1_finale (wheel)
   - After section_1_finale → section_2[0] (first bidding)
   - End of section_2 array → section_2_finale (wheel)
   - After section_2_finale → finale (showcase)

**Automatic Contestant Selection During Advancement**:
- If advancing **from** a bidding phase: Auto-select 1 replacement contestant
- New contestant gets `status='pending_reveal'`
- Fills the position of the bidding winner who just left
- Host must reveal before next round starts

**Emergency Override**:
- `POST /api/game/override-phase` allows direct phase jump
- Logs warning message for audit trail
- Use cases: Technical issues, time constraints, edge cases

**Why Config-Driven?**
- Future mini-games (plinko, cliffhanger, etc.) require no code changes
- Just update `game_structure` in JSON
- Host doesn't choose phases (reduces errors during live event)
- Simpler UI: just "Next" button

---

## Role Management During Gameplay

**Decision Date**: November 2024
**Context**: Balance UI access control with preserving contestant reveal surprise

### Player Roles

The `players.role` field has three values:
- **`host`**: Full admin access and game control
- **`player`**: Active game participant (can bid, spin wheel, etc.)
- **`audience`**: View-only (watches game, eligible for selection)

### Role Transitions

**Audience → Player** (when selected for contestant's row):

1. **Selection**: System randomly selects from audience pool
   - Query: `WHERE role='audience' AND active=1`
   - Add to `contestants_row` with `status='pending_reveal'`
   - Player's role remains `'audience'` (preserves surprise)

2. **Reveal**: Host reveals contestant to audience
   - Update `contestants_row.status='active'`
   - Update `contestants_row.revealed_at=CURRENT_TIMESTAMP`
   - **Update `players.role='player'`** (grants game controls)

3. **Permanence**: Once `role='player'`, stays player forever
   - Cannot be randomly selected again
   - Removed from audience eligibility pool
   - Retains game control access for potential manual re-selection

### Manual Contestant Replacement

**Edge Case**: Host manually swaps out a contestant (dropout, technical issue, etc.)

**Manual selection rules**:
- Host can select from **both audience AND existing players**
- Query: `WHERE active=1` (role doesn't matter)
- Use case: Player drops out, shares device with someone who already played

**Reveal behavior differs by role**:
- **Selecting from audience**: Standard flow (pending_reveal → reveal → active + role change)
- **Selecting existing player**: Immediate `status='active'` (no reveal step needed, already known)

**Rationale**: Existing players are already known to the audience, so no surprise to preserve.

---

## Contestant Selection Rules

**Decision Date**: November 2024

### Random Selection (Normal Flow)

**Eligibility Pool**: `WHERE role='audience' AND active=1`

- Only audience members can be randomly selected
- Active flag must be true (admin can deactivate players)
- Once someone becomes `role='player'`, they're excluded

### Manual Selection (Host Override)

**Eligibility Pool**: `WHERE active=1`

- Host can manually select **anyone active** (audience OR players)
- Use case: Handle dropouts, technical issues, shared devices
- Players can be added back to contestant's row multiple times

### Contestant's Row Position Logic

**Position Assignment**: Fill the vacant slot
- Winner leaves position 2 → new contestant fills position 2
- Preserves podium positions for visual continuity

**Bidding Order**: Starts with most recently added contestant
- New contestant in position 2 → bidding order: 2, 3, 4, 5, 1
- "Most recently added" = highest `contestants_row.added_at` timestamp

### Contestant's Row Refresh

**Between Rounds**: Host can refresh entire contestant's row
- Replace all 5 contestants with new random selections
- Gives more people a chance to participate
- Common at the start of section 2 (bidding set 2)

---

## Initial Game Flow & Reveal Surprise

**Decision Date**: November 2024
**Context**: Critical game mechanic - preserving the surprise of contestant reveals

### Game Start Behavior

When the host starts a new game:

1. **Automatic Initial Selection**: System automatically selects 5 random contestants from the audience pool
   - All 5 created with `status='pending_reveal'`
   - Players remain as `role='audience'` (not yet promoted)
   - **CRITICAL**: Names/photos are hidden from EVERYONE including the host

2. **One-at-a-Time Reveal**: Host must manually reveal each contestant
   - Host UI shows "5 contestants selected, 0 revealed"
   - Host clicks "Reveal Next Contestant" button 5 times
   - Each click reveals ONE contestant's name and photo to everyone
   - Updates `status='active'` and `role='player'` for that contestant
   - Creates suspense and surprise for the reveal moment

3. **UI Requirements**:
   - **Host UI**: Must NOT show contestant names/photos until revealed
   - **Audience UI**: Must NOT show contestant names/photos until revealed
   - **Player UI**: Players selected don't know they're selected until revealed
   - Podium positions show "?" or "Pending..." until reveal

### Rationale

This preserves the TV show experience where contestants are surprised when their name is called. It's a critical part of the game's excitement and must never be bypassed.

### Subsequent Contestant Selection

After the initial 5, contestant selection happens automatically:
- **After each bidding round**: Winner is removed, one new contestant auto-selected with `status='pending_reveal'`
- **Host reveals**: Before next bidding round starts, host reveals the new contestant
- **After wheel segments**: Host has option to refresh all 5 (same reveal process)

### Edge Cases

- **Manual replacement**: Host can replace any contestant anytime using replace/manual-select actions
- **Audience member replaced**: New contestant gets `status='pending_reveal'`, must be revealed
- **Existing player replaced**: Gets `status='active'` immediately (already known to audience)

---

## State Persistence Strategy

**Decision Date**: November 2024
**Context**: Support crash recovery during live event with 150 concurrent users

### Persistence Approach: "Persist Everything"

**Rationale**: Server crash mid-round would be highly disruptive. Persist all state changes immediately for perfect recovery.

**What Gets Persisted**:
- Every bid as soon as submitted
- Every wheel spin immediately
- All workflow state transitions
- Contestant's row changes
- Product display state

**Tables**:
- `game_workflow`: Current phase, round number, product being shown
- `contestants_row`: Who's on stage, reveal status, position
- `bids`: Individual bids with locked/winner status
- `wheel_spins`: Spin results including spinoff tracking
- `showcase_bids`: Showcase bids with retry support

**Recovery Behavior**:
- On server startup, check `game_workflow` table
- If `current_phase != 'not_started'`: Auto-resume game
- Reconstruct exact state from database
- No need to derive workflow state from data (stored explicitly)

**Trade-off**: More database writes, but simple and reliable crash recovery.

---

## Products Configuration

**Decision Date**: November 2024

### File Location
- **Active config**: `data/products.json`
- **Example/template**: `data/products.example.json` (committed to git)
- **Archives**: User can create `data/products-2024-holiday.json`, etc.

### Loading Strategy
- Load once at server startup
- Cache in memory for performance
- Requires server restart to change products

### Configuration Structure

```json
{
  "products": {
    "product-id": {
      "name": "Product Name",
      "price": 1000,
      "images": ["image1.jpg", "image2.jpg"]
    }
  },
  "assignments": {
    "bidding_set_1": ["product-id-1", "product-id-2", ...],
    "bidding_set_2": ["product-id-3", ...],
    "showcase_showdown": ["product-id-4", "product-id-5"]
  }
}
```

**Number of Rounds**: Implicit in array length
- `bidding_set_1.length` = number of rounds in section 1
- `bidding_set_2.length` = number of rounds in section 2

### Validation
- All assigned product IDs must exist in products object
- All products must have name, price, at least one image
- Validation happens at server startup (fail fast)

---

## Database Schema Philosophy

**Decision Date**: November 2024

### Hybrid Approach

**Design thoroughly upfront**:
- Database schema (migrations are painful to change)
- Core table structure
- Foreign key relationships

**Build incrementally**:
- Business logic (code is cheap to refactor)
- API endpoints (add per phase)
- Frontend UI (add per phase)

**Rationale**:
- Schema changes mid-project require migrations and data handling
- Code refactoring is low-risk and common during development
- Balance planning with learning-as-you-go

### Flexibility vs. Validation

**Use flexible TEXT fields for enums that might expand**:
- `phase_type`: Could add new types (mini-games, etc.)
- `game_segment`: Could add more sections
- Validate in application code, not database constraints

**Use strict constraints for stable fields**:
- `role`: Will always be host/player/audience
- Foreign keys to enforce referential integrity

---

## Future Considerations

### Mini-Game Implementation

**When ready to implement**:
1. Update `data/products.json` game_structure to include mini-game phases
2. Add mini-game handlers in backend (no schema changes needed)
3. Create mini-game UI components in frontend
4. Leverage existing `phase_type` and `phase_metadata` fields

**No breaking changes**: Existing game flow continues to work.

### WebSocket Enhancement (Phase 8)

Current architecture uses REST APIs with client polling for state updates. This is intentional:
- Offline fallback mode works by default
- Simple to implement and test
- WebSockets added as performance enhancement layer, not core dependency

### Scalability

Target: 150 concurrent users
- Single Node.js/Socket.io server sufficient
- SQLite write performance adequate (one action every few seconds)
- In-memory state for fast reads, immediate DB writes for persistence

---

## References

- Executive Summary: `/executive-summary.md`
- Phase Plans: `/plans/`
- README: `/README.md`
