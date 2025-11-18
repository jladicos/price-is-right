# Executive summary
We're going to create a node / React based, real-time game that emulates aspects of the price is right.

The game needs to be completely dockerized - I don't want to install any libraries or tooling outside of Docker on my local machine. That said, I should be able to edit the code on my local machine, and commit changes to GitHub.

The game needs to support up to 150 concurrent users. I'll want to set up the users before we play, and the tooling should be capable of sending each player a link to the game (once it's installed on a server) including a code they can use to access the game. They should not need to create accounts, or have ongoing passwords. There should also be tooling for quickly deleting all of the accounts, and for resetting those one time use codes.

The game should store the name, an access code, and a photo for each player. The photos will be pre-loaded into a folder, and named for each player.

I should be able to define products that people playing the game will need to specify a price for. This could be though a json file to start. I should be able to define one or more images for the products, to be stored in a photos directory, in the json.

There are three roles that someone might have during the course of the game:
- the host
  - this person controls movement through the game, and can invite people, reset passwords, etc
  - we can have multiple hosts to help administrate the game as we go along
- the audience
  - most people have this role - they can watch what is happening, but they are not active participants
- players
  - these are people who are currently actively playing the game
  - they might be
	- in contestant's row, bidding when asked
	- spinning the wheel
	- bidding on a showcase showdown

The game should consist of:
- an initial randomized choice of 5 contestants
  - these players are considered to be in contestant's row
  - the players should be selected one at a time
  - the host will choose when to move on to the next selection
- an initial set of 2-5 rounds of gameplay (exact number based on the configuration)
  - every player who is in contestant's row plays, starting with the player most recently added to the contestant's row group
  - we display the name of one of the products, and it's photo(s)
  - each player in contestant's bids enters their bid, one at a time
	- a player cannot enter their bid until the player before them has bid
  - the player who bids the closest to the value of the product without going over "wins" the round
  - players may not choose what another player has chosen
  - if all players are over the value of the product, they all get a chance to try again, in the same order
  - after a player wins, then a new player who has not yet been on contestant's row is chosen
- a spin the wheel game
  - for players who have won one of the bidding rounds
  - the players spin a wheel containing values from $.05 to $1.00 in $.05 increments
  - the player can spin up to two times (but they only have to spin once)
  - the player closest to $1.00 wins
  - if a player goes beyond $1.00 they are immediately eliminated
  - if a player gets exactly $1.00 we want to display a message that says $1.00!!
  - if multiple players get $1.00, then there is a 1 turn spin off
	- repeat the spin-off if necessary until there is a clear winner
- a second set of 2-5 rounds of bidding game play
  - players already in contestant's row stay there as this second set starts
- a second spin the wheel game
  - only for players who won bidding in the second set of bidding game play
- a final "showcase showdown"
  - in this case the player with the lowest dollar value from the spinning games goes first
	- if both players got exactly the same, then the first player to spin the wheel goes first
  - the game should show the name and photo(s) of a product
  - the first player can either choose to big on that product, or pass to the other player
	- if the first player passes, then the second player must immediately bid on the product
	- if the first player does not pass, then they must immediately bid on the product
  - then the second product is shown, and the player who has not yet bid does so

Interface for the audience:
During the initial player selection, and the bidding rounds
- the audience should see five podiums, with the names and photos of players in each spot, as they are chosen.
- As players bid, the audience should see each player's bid.
- the audience should see clearly which player won a round
- the audience should see clearly when all of the players have gone over
- the audience should see the name and photo of the products being bid on when shown by the host

During the spin the wheel sections
- the audience should see the wheel, and the list of players who will be spinning, in order
- as each player spins, the audience should see the result of their most recent spin, and the total value of that player's two spins, if applicable
- as players are eliminated, those players should be removed from the view
- the audience should see clearly which player won the spin the wheel section

During the showcase showdown
- the audience should see two podiums, one for each player, with their name and photo
- the value that each player has bid, as they bid
- the name and photo of the products being bid on when shown by the host
- the audience should see clearly which player won

Interface for players:
During the the bidding rounds
- the players should see the five podiums, with the names and photos of themselves and the other players in each spot.
- As players bid, the players should see each player's bid.
- Players should be notified when it is their turn to bid, and be able to type in a whole dollar amount
- Players should be notified if they win
- Players should be notified if all players have gone over
- bids are automatically cleared when we move between betting rounds, or when all players have gone over

During the spin the wheel sections
- players who are currently in contestant's row see the same view as the audience
- players playing see the same view as the audience, but have some extra controls
  - they can choose when to start their spin
  - in the case of a second spin, they can choose not to spin and stay where they are

During the showcase showdown section
- players who did not win either of the spin the wheel sections should see the same view as the audience
- players playing see the same view as the audience, but have some extra controls
  - when prompted, they can choose to bid or pass on a showcase product
	- note that the person bidding second won't be able to pass

Interface for the host
At all times
- the host can navigate to a sortable, and searchable table with all players, and find the code for a given player
  - from this UI the host can manually add an audience member
  - manually reset the code for a given player or audience member
- the host has a second admin page where they can
  - enable or disable the game for all players and audience members
  - reset codes for all players and audience members

During the initial setup
- the host chooses when to choose the first person for contestant's row, and when to choose the next person for contestant's row
- when to start the first bidding round

During the bidding rounds
- the host can see the same view as the audience, but has some extra controls
- the host can choose when to display the product information and when to hide it
  - they can bring it up again if required after hiding it
- the host can choose when to move between each person on contestant's row
- the host can unlock any contestant's bid so it can be re-entered (in case the person made a mistake)
- the host can choose when to reveal the actual value of the product, revealing the winner, and ending the bidding round
- the host chooses when to move to the spin the wheel after the last bidding round in the section ends

During the spin the wheel section
- the host can see the same view as the audience, but has some extra controls
- the host can choose when to move to the next person
- the host decides when the person can spin the wheel the second time (if the person chooses to do so)
- the host decides when to move on to the next activity (another section of bidding rounds, or the showcase showdown)

During the showcase showdown
- the host can see the same view as the audience, but has some extra controls
- the host can choose when to display the product information and when to hide it
  - they can bring it up again if required after hiding it
- the host can choose when to ask the person for their bid
- the host can unlock either contestan'ts bid so it can be re-entered (in case the person made a mistake)
- the host chooses when to reveal the actual value of the products, revealing the winner

---

## High-Level Implementation Plan

### Technology Stack & Architecture Decisions

#### Project Structure
- **Monorepo with separate frontend and backend**
  - Backend: Node.js with Fastify + Socket.io
  - Frontend: React with Vite
  - Both services run in separate Docker containers via Docker Compose
  - Shared TypeScript types across frontend/backend

#### Backend Technology
- **Fastify** - Modern Node.js framework with built-in validation and excellent TypeScript support
- **Socket.io** - Real-time bidirectional communication for 150+ concurrent users
- **SQLite** - Lightweight, file-based database for persistence
- **Service layer architecture** - Business logic separated from transport layer (REST/Socket.io)

#### Frontend Technology
- **React** with **TypeScript** in strict mode
- **Vite** - Fast build tool with hot module replacement
- **Chakra UI** - Component library for admin UI, forms, buttons, tables
- **CSS Modules** - Scoped CSS for custom game components (podiums, wheel, etc.)
- **Zustand** - Lightweight state management for game state

#### Code Quality & Testing
- **TypeScript** with strict mode enabled
- **ESLint + Prettier** - Linting and code formatting
- **Vitest** - Fast testing framework for both frontend and backend
- **Testing approach**: Write tests as we build features (test-first or alongside implementation)
  - Backend game logic: 80%+ coverage target
  - Frontend components: 50%+ coverage target
- Linting and tests run inside Docker for consistency

### Development Environment

#### Docker Setup
- **Fully containerized** - No libraries or tooling installed on host machine
- Code edited on host (macOS), mounted into Docker containers via volumes
- Hot-reload enabled for both frontend and backend during development
- `docker-compose.yml` for orchestration

#### Helper Scripts
- `scripts/` directory with convenience scripts:
  - `scripts/start.sh` - Start all services
  - `scripts/test.sh` - Run test suite
  - `scripts/lint.sh` - Run linting
  - `scripts/reset-db.sh` - Reset database
  - `scripts/import-players.sh` - Import players from XLSX

### Data Management

#### Database Schema (SQLite)
- **Players table**: name, access code, photo path, role (host/player/audience), active status, session info
- **Products table**: name, price, image paths (array), game segment assignment
- **Game state tables**: current phase, contestant's row lineup, active bids, wheel spins, winners
- **Full persistence** - All game state written to database in real-time for crash recovery

#### Photo Management
- Player photos: `/public/images/players/` (e.g., `john-smith.jpg`)
- Product photos: `/public/images/products/` (e.g., `car-001.jpg`)
- Both directories mounted from host into Docker
- Served as static files by Fastify backend
- Import script matches player names to photo filenames automatically

#### Player Import
- **CLI script** for bulk import from XLSX file
- Reads XLSX → creates players in database → matches photos by filename
- XLSX columns: First Name, Last Name, Role (host/player/audience), Photo (optional), Email (optional)
- Can designate hosts during import or via admin UI later

#### Product Configuration
- Products defined with name, price, images array, and game segment assignment
- JSON structure: product library with IDs mapped to product objects, plus assignment arrays for bidding_set_1, bidding_set_2, and showcase_showdown
- Products loaded from JSON file at runtime (not stored in database)

### Authentication & Session Management

#### Access Code System
- **6-character alphanumeric codes** (e.g., `ABC123`)
- Players access via URL: `https://yourgame.com/?code=ABC123`
- Codes are **reusable** (valid forever, not consumed on first use)
- **One active session per code** - logging in on second device kicks first session
- Session persists on page refresh via localStorage

#### Host Authentication
- Hosts use same access code system as players
- Database `role` field designates host privileges
- Multiple hosts can be logged in simultaneously
- Hosts can be designated in XLSX import or promoted via admin UI

#### Session Security
- Session tokens stored in localStorage (survives refresh)
- Socket.io validates session on connection
- Backend tracks active sessions per access code
- New login automatically disconnects previous session for that code

### API Architecture

#### REST APIs (Admin & Setup Operations)
- Player management (list, create, update, deactivate)
- Access code reset (individual or bulk)
- Product management
- Game configuration
- Used by host admin UI

#### Socket.io Events (Real-Time Gameplay)
- Player bids
- Wheel spins
- Host game phase advancement
- Real-time state broadcasts to all connected clients
- Used during active gameplay

#### Service Layer Pattern
- Business logic lives in service classes (transport-agnostic)
- Both REST endpoints and Socket.io handlers call services
- Services are fully unit-testable without spinning up servers
- Clear separation of concerns: transport layer vs. business logic

### Implementation Order

#### Phase 1: Foundation ✅
- [x] Project scaffolding (Docker Compose, monorepo structure)
- [x] Backend setup (Fastify, TypeScript, basic routing)
- [x] Frontend setup (Vite, React, TypeScript, Chakra UI)
- [x] ESLint + Prettier configuration
- [x] Vitest setup for both frontend and backend
- [x] Helper scripts in `scripts/` directory

#### Phase 2: Database & Data Import ✅
- [x] SQLite database setup and schema design
- [x] Database connection and query layer (better-sqlite3, no ORM)
- [x] Simple migration system (numbered SQL files with tracking)
- [x] Player import CLI script (XLSX → database)
- [x] Photo matching logic (filename to player name)
- [x] Product configuration system
- [x] Unit tests for import logic

#### Phase 3: Authentication & Sessions
- [ ] Session token generation and validation
- [ ] Auth service and REST API endpoints (login, logout, session validation)
- [ ] One-session-per-code enforcement
- [ ] Zustand auth store with localStorage persistence
- [ ] Authentication middleware for protected routes
- [ ] Root page (/) for login with URL parameter support (`?code=ABC123`)
- [ ] Welcome page showing player info with role-specific navigation (placeholders)
- [ ] Protected route infrastructure
- [ ] Unit and integration tests for auth logic

#### Phase 4: Host Admin UI
- [ ] Player management table (sortable, searchable)
- [ ] Individual player actions (view code, reset code, deactivate)
- [ ] Bulk operations (reset all codes, delete all players)
- [ ] Manual player add/edit forms
- [ ] Role management (promote to host, demote)
- [ ] Admin UI integration tests

#### Phase 5: Real-Time Foundation
- [ ] Socket.io server setup
- [ ] Client connection handling
- [ ] Room management (separate channels for host/players/audience)
- [ ] Session validation on Socket.io connection
- [ ] Real-time state broadcast system
- [ ] Connection/disconnection handling
- [ ] Integration tests for Socket.io events

#### Phase 6: Game State Management
- [ ] Backend state machine for game phases
- [ ] State transition logic and validation
- [ ] Database persistence for all state changes
- [ ] Auto-resume on server restart (detect in-progress game)
- [ ] Host UI to choose resume vs. new game (lower priority)
- [ ] Unit tests for state machine

#### Phase 7: Contestant's Row Selection
- [ ] Backend: Random selection from logged-in players
- [ ] Backend: Track contestant's row lineup (5 players)
- [ ] Host controls to trigger selection and advance
- [ ] Player/audience view: Display 5 podiums with names/photos
- [ ] Real-time updates as contestants are selected
- [ ] Host override: Remove player and select replacement
- [ ] Unit and integration tests

#### Phase 8: Bidding Rounds (Core Gameplay)
- [ ] Backend: Bidding logic (sequential, duplicate detection, winner calculation)
- [ ] Backend: "All over" detection and retry logic
- [ ] Product display system (show/hide on host command)
- [ ] Player input form (bid entry, validation)
- [ ] Host controls (advance between players, unlock bids, reveal winner)
- [ ] Player/audience view: Podiums with real-time bid display
- [ ] Winner announcement and visual indication
- [ ] Bid clearing between rounds
- [ ] Unit tests for bidding logic
- [ ] Integration tests for bid submission flow

#### Phase 9: Spin the Wheel
- [ ] Backend: Wheel spin logic (values $.05 to $1.00 in $.05 increments)
- [ ] Backend: Two-spin limit, $1.00 detection, elimination logic
- [ ] Backend: Spin-off for ties at $1.00
- [ ] Player controls (spin button, choose to stay or spin again)
- [ ] Host controls (advance to next player, move to next phase)
- [ ] Player/audience view: Wheel visualization, current/total values
- [ ] Winner calculation (closest to $1.00 without going over)
- [ ] Eliminated player removal from display
- [ ] Unit tests for wheel logic and winner calculation
- [ ] Integration tests for spin flow

#### Phase 10: Showcase Showdown
- [ ] Backend: Showcase logic (order based on wheel results)
- [ ] Backend: Pass/bid decision handling
- [ ] Product display for showcases (2 products)
- [ ] Player controls (bid or pass on first product)
- [ ] Host controls (show/hide products, unlock bids, reveal winner)
- [ ] Player/audience view: Two podiums with names/photos/bids
- [ ] Winner announcement
- [ ] Unit tests for showcase logic
- [ ] Integration tests for showcase flow

#### Phase 11: Host Override & Edge Case Tools
- [ ] Manual contestant's row replacement during setup
- [ ] Swap player in/out during gameplay (scenarios C & D)
- [ ] Random selection from available logged-in players
- [ ] Host UI for all override actions
- [ ] Database tracking of manual interventions
- [ ] Integration tests for override scenarios

#### Phase 12: Offline/Fallback Mode
- [ ] Offline mode toggle in host UI
- [ ] Manual data entry for bids/spins when offline
- [ ] Game state preserved during mode switch
- [ ] Host UI serves as both control panel and visual display
- [ ] Screen-share friendly layout for Zoom
- [ ] Testing of offline mode functionality

#### Phase 13: Polish & Performance
- [ ] Performance testing with mock users (up to 150 concurrent connections)
- [ ] Load testing Socket.io broadcast performance
- [ ] UI polish and responsive design
- [ ] Error handling and user-friendly messages
- [ ] Connection loss recovery for players
- [ ] Final integration testing of complete game flow

### Testing Strategy

#### Unit Tests (Written Alongside Features)
- Game state machine transitions
- Bid validation and winner calculation
- Wheel spin logic and elimination
- Showcase showdown ordering and pass/bid logic
- Access code generation and validation
- Photo matching algorithm

#### Integration Tests
- REST API endpoints
- Socket.io event flows
- Database persistence and recovery
- Multi-user scenarios (concurrent bids, spins)

#### Performance Tests
- Mock 150 concurrent Socket.io connections
- Broadcast message delivery time
- Database write performance under load
- Memory usage with 150+ active sessions

#### Manual Testing Checklist
- Complete game flow from start to finish
- Host override scenarios
- Player disconnect/reconnect
- Server crash and auto-resume
- Offline mode toggle
- Cross-browser compatibility

### Fallback & Recovery Features

#### Auto-Resume After Crash
- On server startup, check database for in-progress game
- If found, reconstruct game state from database
- Auto-resume by default (host can manually choose to start new game - lower priority)
- All connected clients receive current state on reconnection

#### Offline/Fallback Mode
- Toggle to disable remote player connections
- Host manually enters bids/spins on behalf of players
- Visual display still works for screen sharing (Zoom)
- Database and game logic continue to function normally
- Can switch to offline mode mid-game if needed

#### Player Replacement Tools
- Remove from contestant's row and select new random player
- Swap out player who left mid-game with random replacement
- Only select from currently logged-in, active players
- Host has full manual control over replacements

### Performance & Scalability

#### Target: 150 Concurrent Users
- Single Node.js/Socket.io server sufficient for this scale
- SQLite write performance adequate for game pace (one action every few seconds)
- In-memory state representation for fast reads, immediate database writes for persistence
- Socket.io rooms for efficient targeted broadcasts (host/players/audience)

#### Performance Validation
- Load testing with mock Socket.io clients before live event
- Measure broadcast latency, database write times, memory usage
- Identify and fix bottlenecks before deployment

### Future Considerations

#### Deployment (To Be Determined)
- VPS options: DigitalOcean, AWS, Linode, etc.
- Platform services: Railway, Render, Fly.io
- Same `docker-compose.yml` used for local development deploys to production
- Update `.env` file with production domain and ports
- SSL/TLS certificate setup for HTTPS (required for secure WebSockets)
- Deployment specifics to be defined closer to event date

#### Potential Enhancements (Post-MVP)
- Game history/statistics export after event
- Leaderboard or summary report
- Replay or review mode for completed games
- Email/SMS distribution of access code links
- Custom branding and theming
