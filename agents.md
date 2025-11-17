# agents.md

## 🎯 Purpose of This Document

This document provides a **framework for how to approach** building tools. It does NOT prescribe specific implementations. Instead, it emphasizes:

- **Working methodology** - How to break down work and make progress
- **Decision-making principles** - When to ask questions vs. when to proceed
- **Critical constraints** - Non-negotiable requirements that must be met
- **Risk avoidance** - Common pitfalls and how to avoid them

The *what* is captured plan.md documents. This document is about the *how*.

## 📚 Essential Documentation

**When starting a new session on this project, review these documents:**

1. **`executive-summary.md`** - Provides a high level overview of what this library is for
2. **`plan.md`** - Current development status, completed work, next tasks
3. **`README.md`** - How to run the project, testing commands, dev scripts
4. **`plans/`** - Historical detailed implementation plans for completed features

---

## ⚠️ Critical Operating Principles

### 1. Plan Before You Code

**Never start coding without a plan approved by the developer.**

For any feature or task:
1. **Analyze** the requirement and identify what needs to be built
2. **Break it down** into small increments
3. **Propose the plan** to the developer with:
   - Sequence of steps
   - What will be built in each step
   - How you'll verify each step works
   - Any assumptions or questions
4. **Update the shared plan document** with the pending steps so everyone can review progress
5. **Wait for approval** before writing code
6. **Execute one step at a time**, verifying before proceeding

**Always clarify uncertainty.** If the developer suggests an approach and you're unsure it's the best option, ask follow-up questions and share best-practice alternatives instead of blindly agreeing.

**Prioritize convenience scripts.** Assume the developer prefers simple helper scripts over long Docker or tooling commands; add or update scripts rather than asking them to run complex shell invocations.

**Capture recurring warnings.** When a warning resurfaces after a fix (example: API deprecation), document the permanent remedy in README/plan and bake it into future steps so it doesn’t regress again.

**Organize the plan.** The plan should be organized into logical chunks, in the order they should be tackled. Use checklist items with sub-checklist items as needed to document the work.

**Example:**
❌ "I'll build a tool to fetch roadmap items" (too vague, no plan)
✅ "Here's my plan for the fetching roadmap items:
   1. Create basic structure following guidance
   2. Add filtering options
   3. Add options for saving in different formats
   Does this approach work?"

### 2. Ask Questions First

**When you encounter uncertainty, STOP and ASK before proceeding.**

Ask questions when you're unsure about:
- **Requirements**: "What filters do you need to apply this call?"
- **Architecture**: "Should I use WebSockets for real-time updates, or is polling sufficient?"
- **Priorities**: "We're running short on time - should I focus on polish or add conflict detection?"
- **Trade-offs**: "I can do X quickly but it's less flexible, or Y which takes longer but is more robust. Which matters more for the demo?"

**Present options with trade-offs** rather than just picking one:
✅ "For the data store, I see three options:
   1. In-memory only (fast, simple, data lost on restart)
   2. SQLite (persistent, slightly more complex)
   3. JSON files (persistent, very simple, but slower)
   For a demo that needs data reset capability, which approach do you prefer?"

### 3. Small, Incremental Changes

**Make ONE logical change at a time.**

- Each increment should be **testable independently**
- Aim for **small chunks of work**
- **Commit frequently** with clear messages
- If something breaks, it should be **easy to identify and revert**

Think of it like building with LEGO blocks, not pouring concrete.

### 4. Verify Before Proceeding

**After each increment, demonstrate it works before moving on.**

- Show what you built
- Explain what it does
- Demo that it works
- Get confirmation before continuing

**Don't stack unverified changes.** Each layer should be solid before adding the next.

## 🔒 Non-Negotiable Requirements

These constraints MUST be met regardless of implementation approach:

### Security & Configuration
- ✅ **Environment variables** for all sensitive data (API keys, etc.)
- ✅ **`.env` file is git-ignored** from the start
- ✅ **`.env.example`** provided as template with placeholder values
- ✅ **No secrets in code** ever

### Architecture
- ✅ **Dockerized** - entire project runs via Docker Compose
- ✅ **Container-only dependencies** - install libraries inside Docker images, not on the host (never run `npm install`, Homebrew, etc. on the maintainer’s machine without explicit approval)

### Code Quality
- ✅ **Clear separation of concerns** (don't mix UI, business logic, and data access)
- ✅ **Error handling** - user-friendly messages, not stack traces
- ✅ **Consistent code style** throughout
- ✅ **Fix root causes, not symptoms** - NEVER ignore or suppress errors without attempting proper fixes first
  - ❌ BAD: Adding `// eslint-disable-next-line` to hide type errors
  - ❌ BAD: Using `as any` to bypass TypeScript checks
  - ✅ GOOD: Properly typing function parameters (e.g., `(url: RequestInfo | URL)` instead of `(url)`)
  - ✅ GOOD: Handling all type cases explicitly (type guards, conditional logic)
  - **Only suppress warnings** when the proper fix is genuinely impractical AND you document why

### Performance & Scalability
- ✅ **Performance testing is mandatory** - This application must support 150 concurrent users for a live event
- ✅ **Test with realistic load** - Mock Socket.io connections to validate performance before deployment
- ✅ **Measure key metrics** - Broadcast latency, database write times, memory usage under load
- ✅ **Fix bottlenecks early** - Performance issues discovered late could jeopardize the live event
  
  ---
  
  ## 🎨 Implementation Philosophy
  
  ✅ **DO:**
  - Focus on features that will help attain our working goal
  - Build the happy path thoroughly
  - Keep it simple and understandable
  
  ❌ **DON'T:**
  - Over-engineer for scale
  - Handle every edge case
  - Build features not in requirements
  - Optimize for performance beyond reasonable needs
  
  ### Choose Simplicity Over Cleverness
  
  When faced with multiple approaches:
  - **Simple** beats elegant
  - **Working** beats perfect  
  - **Boring** beats exciting
  - **Maintainable** beats optimized
  
### Make Assumptions Explicit
  
  When you make a design decision, **document your reasoning**:
  
  ---
  
  ## 🚨 Common Pitfalls to Avoid
  
  ### 1. The "Big Bang" Approach
  ❌ Writing lots of code without testing
  ✅ Small increments with verification after each change
  
  ### 2. Assuming You Know What They Want
  ❌ "I think they probably want X"
  ✅ "Should I implement X or Y?" - ask with trade-offs presented
  
  ### 3. Skipping Verification
  ❌ "It should work" (without testing)
  ✅ "Here's a demo of it working" - show, don't just tell
  
  ### 4. Unclear Communication
  ❌ "It's done" (without showing anything)
  ✅ "Here's what I built, how it works, and what's next"
  
  ### 5. Over-Engineering
  ❌ Building abstractions for "future flexibility"
  ✅ Build what's needed now, refactor later if required
  
  ### 6. Suppressing Errors Instead of Fixing Them
  ❌ Adding `eslint-disable` or `@ts-ignore` comments to hide problems
  ✅ Fixing the underlying type/lint issue properly
  
  ---
  
  ## 🛠️ Working Methodology
  
  ### Starting a New Task
  
  1. **Read the requirement** from requirements doc
  2. **Understand the goal** - what problem does this solve?
  3. **Identify dependencies** - what needs to exist first?
  4. **Create a plan** broken into small steps
  5. **Present the plan** for approval
  6. **Execute incrementally** with verification
  
  ### During Implementation
  
  - **Stay focused** on the current increment
  - **Test as you go** - don't wait until "finished"
  - **Ask questions** when stuck or uncertain
  - **Document non-obvious decisions** in code comments
  - **Keep the developer informed** of progress
  
  ### When Stuck
  
  1. **Clearly explain the problem** - what are you trying to do?
  2. **Show what you've tried** - what approaches failed?
  3. **Identify the blocker** - what's preventing progress?
  4. **Propose options** - what are possible ways forward?
  5. **Ask for guidance** - which approach should you take?
  
  ### Completing a Task
  
  1. **Demo the functionality** - show it working
  2. **Explain what you built** - at a high level
  3. **Note any limitations** - what doesn't work yet?
  4. **Propose next steps** - what should come next?
  5. **Get confirmation** before moving on
  
  ---
  
  ## 💬 Communication Guidelines
  
  ### 1. Be Clear and Specific
  State exactly what you're working on, not vague generalities.
  - ❌ "Working on the backend"
  - ✅ "Implementing the POST /phases endpoint to create new phases"
  
  ### 2. Show Your Work
  Demonstrate results, don't just describe them.
  - ❌ "The chat interface is done"
  - ✅ "Here's the chat interface working [demo/screenshot]. Next I'll add loading states."
  
  ### 3. Ask Productive Questions
  Present options with trade-offs, not open-ended "how" questions.
  - ❌ "How should I do this?"
  - ✅ "Should I prioritize X or Y? X is faster but less flexible, Y handles edge cases but takes longer."
  
  ---
  
  ## 🎓 Learning as You Go
  
  ### When Encountering New Technology
  1. **Check the requirements doc** - is it specified?
  2. **Research briefly** - what are the basics?
  3. **Ask if unsure** - "I see we need X, should I use approach A or B?"
  4. **Start simple** - get something working, refine later
  
  ### When Facing Technical Challenges
  1. **Try the obvious solution first** - don't overthink
  2. **Search for examples** - has someone solved this?
  3. **Test incrementally** - verify each piece works
  4. **Ask for help** when truly stuck
  
  ### When Making Design Decisions
  1. **Weigh complexity** - is the benefit worth the added complexity?
  2. **Document your choice** - explain why you picked this approach
  3. **Stay flexible** - be ready to change if needed
  
---
  
  ## 🎬 Final Reminders
  
  **This is not a product:**
  - Working features > perfect code
  - Happy path > edge cases  
  - Simple > clever
  - Done > perfect
  
  **You're not alone:**
  - Ask questions liberally
  - Show your work frequently
  - Admit when uncertain
  - Collaborate, don't guess
  
  **Break it down:**
  - Small steps
  - Frequent verification
  - One thing at a time
  - Always have a plan
  
  **You've got this! 🚀**
  
  The requirements are clear, the framework is here, and the developer is ready to collaborate. Take it one increment at a time, ask questions when needed, and build something great.