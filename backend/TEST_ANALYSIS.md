# Showcase Test Coverage Analysis

## Issues Found

### 1. **CRITICAL: Integration Tests Use Heavy Mocking**
**Location:** `src/routes/showcase.integration.test.ts` lines 11-33

**Problem:**
- `getCurrentLeader` and `getWinnersForSegment` are fully mocked at module level
- Tests never actually query wheel_spins or bids tables
- This means integration tests aren't testing real integration!

**Impact:** We could have SQL errors or missing foreign keys and tests would still pass.

**Fix:** Remove mocks and set up real wheel spins and bidding wins in the database for each test.

---

### 2. **Missing Test: Locked Bid Rejection**
**Location:** `submitBid` function line 202-204

**Problem:**
```typescript
if (existingBid && existingBid.locked === 1) {
  throw new Error("Bid already submitted and locked");
}
```
This error path is never tested!

**Missing Test:**
- Submit a bid
- Try to submit again (should fail with "already submitted and locked")
- Unlock the bid
- Submit again (should succeed)

---

### 3. **Missing Test: Exact Value Bid**
**Problem:** What happens when someone bids EXACTLY the showcase value? (diff = 0)

**Questions:**
- Does bonus trigger? (threshold check: `winnerDiff >= 0 && winnerDiff <= threshold`)
- Is this a valid win?

**Missing Test:**
```javascript
it("should handle exact showcase value bid", () => {
  // Showcase 1 = 8.99
  submitBid(1, 1, 8.99); // Exact!
  submitBid(1, 2, 100);  // Other over

  const result = calculateWinner(1);
  expect(result.winnerId).toBe(1);
  expect(result.player1Diff).toBe(0);
  expect(result.bonusWon).toBe(true); // Should get bonus!
});
```

---

### 4. **Missing Test: Winner on Tie**
**Location:** `calculateWinner` line 338

**Problem:**
```typescript
if (player1Diff <= player2Diff) {  // <= means player1 wins on tie!
```

**Missing Test:**
```javascript
it("should award win to player1 when differences are equal", () => {
  // Both players are 0.50 away from their showcase values
  submitBid(1, 1, 8.49);  // diff = 0.50
  submitBid(1, 2, 14.52); // diff = 0.50

  const result = calculateWinner(1);
  expect(result.winnerId).toBe(1); // Player 1 wins tie
});
```

---

### 5. **Missing Test: Bid After Pass**
**Problem:** We test `handlePass()` but don't verify bids go to the correct showcase after passing.

**Missing Test:**
```javascript
it("should assign correct showcases after pass", () => {
  await initializeShowcase(1);

  // Get initial assignments
  let state = getShowcaseState(1)!;
  const player1InitialShowcase = state.finale_player1_showcase;

  // Player 1 passes
  handlePass(1);

  // Get new assignments
  state = getShowcaseState(1)!;
  expect(state.finale_player1_showcase).not.toBe(player1InitialShowcase);

  // Submit bids and verify they use the NEW assignments
  submitBid(1, 1, 10);

  const db = getDatabase();
  const bid = db.prepare("SELECT * FROM showcase_bids WHERE player_id = 1").get();
  expect(bid.showcase_number).toBe(state.finale_player1_showcase); // Uses new assignment!
});
```

---

### 6. **Missing Test: Retry Flow**
**Problem:** We test `initiateRetry()` increments retry_number, but don't test:
- Submitting NEW bids after retry (retry_number = 1)
- Old bids being ignored during retry
- calculateWinner using correct retry bids

**Missing Test:**
```javascript
it("should use correct retry_number for new bids", () => {
  await initializeShowcase(1);

  // First attempt - both over
  submitBid(1, 1, 100);
  submitBid(1, 2, 100);

  // Initiate retry
  const retryNum = initiateRetry(1);
  expect(retryNum).toBe(1);

  // Submit NEW bids for retry
  submitBid(1, 1, 8.5);
  submitBid(1, 2, 14.0);

  // Verify bids have retry_number = 1
  const db = getDatabase();
  const bids = db.prepare("SELECT * FROM showcase_bids WHERE retry_number = 1").all();
  expect(bids.length).toBe(2);

  // Verify winner calculation uses retry bids
  const result = calculateWinner(1);
  expect(result.winnerId).toBeGreaterThan(0); // Should have winner now
});
```

---

### 7. **Missing Test: Missing Bids Error**
**Location:** `calculateWinner` line 290-292

**Problem:**
```typescript
if (!player1Bid || !player2Bid) {
  throw new Error("Both players must have bids");
}
```

**Missing Test:**
```javascript
it("should throw error when bids are missing", () => {
  await initializeShowcase(1);

  // Only submit one bid
  submitBid(1, 1, 8.5);

  // Try to calculate winner
  expect(() => calculateWinner(1)).toThrow("Both players must have bids");
});
```

---

### 8. **Missing Test: Update Non-Existent Bid**
**Location:** `updateBid` line 252-254

**Problem:**
```typescript
if (!bid) {
  throw new Error("Bid not found");
}
```

**Missing Test:**
```javascript
it("should throw error when updating non-existent bid", () => {
  await initializeShowcase(1);

  // Try to update bid that was never submitted
  expect(() => updateBid(1, 1, 10)).toThrow("Bid not found");
});
```

---

### 9. **Test Quality Issue: Using Wrong Product Prices**
**Location:** Service tests lines 209, 224

**Problem:**
```javascript
submitBid(1, 1, 50000);  // Testing with $50,000
submitBid(1, 2, 30000);  // Testing with $30,000
```

But showcase values are ~$9 and ~$15 (juice products). This makes tests unrealistic.

**Fix:** Use realistic bid amounts that make sense for juice products (not cars).

---

### 10. **Missing Edge Case: Bid on Uninitialized Showcase**
**Problem:** What happens if you call submitBid before initializeShowcase?

**Existing Coverage:** ✅ Line 178 throws "Showcase state not initialized"

**Test Status:** ✅ Covered by trying to submit bid without initialization

---

### 11. **Missing Edge Case: Null Showcase Assignments**
**Location:** Line 192-193

**Problem:**
```typescript
const showcaseNumber =
  playerId === state.finale_player1_id
    ? state.finale_player1_showcase!  // Using ! assumes it's not null
    : state.finale_player2_showcase!;
```

**Question:** Can these be null? Should we validate?

**Check Database Migration:** Lines 41-42 in migration don't have NOT NULL constraint.

**Missing Validation:**
```javascript
if (!state.finale_player1_showcase || !state.finale_player2_showcase) {
  throw new Error("Showcase assignments not set");
}
```

---

## Summary

### Critical Issues
1. ❌ **Integration tests are mocked** - Not testing real DB integration
2. ❌ **Missing locked bid test** - Critical user flow untested

### Missing Test Coverage
3. ❌ Exact value bid (diff = 0)
4. ❌ Tie-breaker scenario (both players same diff)
5. ❌ Showcase assignment after pass
6. ❌ Complete retry flow with new bids
7. ❌ Missing bids error
8. ❌ Update non-existent bid error

### Test Quality Issues
9. ⚠️ Unrealistic bid amounts in service tests
10. ✅ Uninitialized showcase error (covered)
11. ⚠️ Null showcase assignments (potential bug, no validation)

### Metrics
- **Current Test Count:** 90 tests
- **Passing:** 90 (100%)
- **Actual Coverage:** ~75% (due to mocking and missing edge cases)
- **Tests Needed:** +8-10 additional tests

## Recommendations

### Priority 1 (Critical)
1. **Fix integration tests** - Remove mocks, use real DB data
2. **Add locked bid test** - Important user flow

### Priority 2 (Important)
3. Add exact value bid test
4. Add retry flow test
5. Add missing bids error test
6. Fix unrealistic bid amounts

### Priority 3 (Nice to have)
7. Add tie-breaker test
8. Add pass + bid assignment test
9. Consider adding null showcase validation
