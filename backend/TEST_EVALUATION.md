# Game Routes Test Quality Evaluation

## Current Coverage: 38 integration tests

## Test Quality Analysis

### ✅ What We're Testing Well

1. **Authentication & Authorization**
   - All endpoints test host-only access
   - All endpoints test authentication requirement
   - Consistent 401/403 responses

2. **Basic Happy Paths**
   - Game start creates 5 contestants
   - Reveal updates status and role
   - Replacement works
   - Override works

3. **Parameter Validation**
   - Missing required fields return 400
   - Invalid segment names rejected

### ⚠️ Critical Gaps Identified

#### 1. POST /api/game/start
**Missing:**
- [ ] What happens with insufficient audience (< 5 people)?
- [ ] Does it properly reset previous game data?
- [ ] Are selected contestants unique (no duplicates)?
- [ ] What if products.json is invalid/missing?

**Current Test Issues:**
- Only tests happy path
- Doesn't verify database cleanup from previous game

#### 2. POST /api/game/reveal-contestant
**Missing:**
- [ ] Revealing an already-active contestant (idempotent?)
- [ ] Revealing a non-existent contestant ID
- [ ] Revealing a contestant from wrong segment
- [ ] Transaction rollback if role update fails

**Current Test Issues:**
- Only tests one successful reveal
- Doesn't verify player role was audience before reveal

#### 3. POST /api/game/replace-contestant-random
**Missing:**
- [ ] What happens when no eligible audience members?
- [ ] Verify old contestant status changed to 'replaced'
- [ ] New contestant is different from old one
- [ ] Position preserved correctly

**Current Test Issues:**
- Doesn't check database state of replaced contestant

#### 4. POST /api/game/replace-contestant-manual
**Missing:**
- [ ] Replacing with already-selected contestant (should fail)
- [ ] Replacing with inactive player (should fail)
- [ ] Audience member gets pending_reveal status
- [ ] Existing player gets active status (no reveal needed)
- [ ] Host role gets active status immediately

**Current Test Issues:**
- Doesn't test the crucial status difference based on role
- Doesn't test error cases

#### 5. POST /api/game/refresh-contestants-row
**Missing:**
- [ ] What happens with < 5 eligible audience?
- [ ] Verify all old contestants marked 'replaced'
- [ ] All 5 new contestants are unique
- [ ] Wrong segment parameter

**Current Test Issues:**
- Only tests happy path

#### 6. POST /api/game/advance (MOST CRITICAL GAPS)
**Missing:**
- [ ] **Auto-select when position IS empty** (we only test when full!)
- [ ] Segment transition: section_1 → section_1_finale
- [ ] Segment transition: section_1_finale → section_2
- [ ] Segment transition: section_2 → section_2_finale
- [ ] Segment transition: section_2_finale → finale
- [ ] Advancing beyond finale (should return 400)
- [ ] Phase metadata set correctly for each transition
- [ ] Current segment updated correctly

**Current Test Issues:**
- **CHEATING ALERT**: We test that auto-selection doesn't happen when full, but never test that it DOES happen when there's space!
- No comprehensive segment flow testing
- No edge case for finale

#### 7. POST /api/game/override-phase
**Missing:**
- [ ] Verify it logs warning (audit trail)
- [ ] Actually check that workflow changed
- [ ] Invalid segment/phase combinations

**Current Test Issues:**
- Tests are superficial

### 🔴 "Cheating" Detected

1. **POST /api/game/advance**: We changed the test expectation when we added the graceful handling of full positions. The test now only verifies it doesn't fail when positions are full, but we NEVER test that auto-selection actually works when there's an empty position. This is a major gap!

2. **Missing error scenario verification**: Many tests just check status code 400/500 without verifying the actual error message makes sense.

3. **Database state verification**: We rarely verify the actual database state after operations (e.g., is old contestant marked 'replaced'?).

## Recommended Additions (High Priority)

### Must-Have Tests (Critical)
1. POST /api/game/advance with empty position (auto-select works)
2. POST /api/game/advance segment transitions
3. POST /api/game/start with insufficient audience
4. POST /api/game/replace-contestant-manual status differences (audience vs player)
5. Verify 'replaced' status is set in database

### Should-Have Tests (Important)
6. All error cases with proper error message verification
7. Transaction rollback scenarios
8. Idempotent operations (reveal same contestant twice)
9. Invalid contestant IDs / non-existent entities
10. Database state verification after mutations

### Nice-to-Have Tests
11. Concurrent operations
12. Large audience pools (100+ people)
13. Edge cases (empty strings, very long names, etc.)

## Test Smell Analysis

- **Over-reliance on happy paths**: 90% of tests are success cases
- **Weak assertions**: Often just checking status code, not actual behavior
- **Missing DB verification**: Not checking side effects in database
- **Limited error coverage**: Error cases mostly just check 400/500 status

## Action Items

1. Add critical missing tests (especially advance with auto-selection)
2. Verify database state in mutation tests
3. Test segment transition flow comprehensively
4. Add error message assertions
5. Test edge cases and boundary conditions
