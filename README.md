# Price Is Right Game

A real-time, multiplayer game application that emulates aspects of "The Price is Right" TV show. Built for live events with up to 150 concurrent players.

## Overview

This application provides an interactive game experience with three distinct roles:
- **Hosts** - Control game flow, manage players, and moderate the event
- **Players** - Actively participate in bidding rounds, wheel spins, and showcases
- **Audience** - Watch the game unfold in real-time

The game features:
- Contestant's Row selection and bidding rounds
- Spin the Wheel competitions
- Showcase Showdown finale
- Real-time updates for all participants
- Host admin controls for player management and game oversight
- Offline fallback mode for emergencies

## What's New in Phase 4 (Admin UI)

**Phase 4 is now complete!** The application now includes a comprehensive admin panel for hosts with the following capabilities:

### Player Management
- ✅ **Sortable & Searchable Table** - View all players with real-time search and filtering by role/status
- ✅ **Access Code Management** - View and reset individual player access codes
- ✅ **Player Actions** - Activate, deactivate, edit details, and change roles for individual players
- ✅ **Photo Upload** - Upload and manage player photos (JPG, PNG, GIF up to 5MB)
- ✅ **Manual Player Addition** - Add new players directly through the UI with photo upload
- ✅ **Role Management** - Promote players to host or demote to player/audience roles

### Bulk Operations
- ✅ **Reset All Access Codes** - Regenerate codes for all players simultaneously
- ✅ **Delete All Players** - Remove all non-host players (with strong confirmations)

### Game Control
- ✅ **Game Toggle** - Enable/disable game availability for maintenance
- ✅ **Maintenance Mode** - Show maintenance message to users while keeping them logged in

### Disaster Recovery
- ✅ **Database Export** - Download complete database backup as timestamped JSON file
- ✅ **Database Import** - Restore from backup with transaction-based all-or-nothing import
- ✅ **Security** - Session tokens never exported; users must re-login after import

### Security & Access Control
- ✅ **Host-Only Access** - All admin endpoints require host role (403 for non-hosts)
- ✅ **Role-Based UI** - Admin elements only visible to hosts
- ✅ **Confirmation Dialogs** - All destructive actions require explicit confirmation

**Test Coverage**: 453/453 tests passing (100%)
- Backend: 324 tests
- Frontend: 129 tests (including 4 export validation tests)

See the [Admin Panel](#admin-panel-host-only) section below for detailed usage instructions.

## Technology Stack

- **Backend**: Node.js, Fastify, Socket.io, SQLite
- **Frontend**: React, TypeScript, Vite, Chakra UI, Zustand
- **Development**: Docker Compose, Vitest, ESLint, Prettier
- **Real-time Communication**: WebSockets via Socket.io

## Prerequisites

- **Docker** and **Docker Compose** installed on your machine
- **Git** for version control
- A code editor (VS Code recommended)

**That's it!** All other dependencies run inside Docker containers.

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd price-is-right
```

### 2. Start the Application

```bash
./scripts/start.sh
```

This will:
- Build Docker containers for frontend and backend
- Start all services
- Enable hot-reload for development

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

### 3. Stop the Application

```bash
docker-compose down
```

## Development Workflow

### Editing Code

- Edit files on your local machine using your preferred editor
- Changes are mounted into Docker containers via volumes
- Hot-reload automatically refreshes the application

### Running Tests

```bash
./scripts/test.sh
```

Runs the full test suite (unit and integration tests) for both frontend and backend.

### Running Linter

```bash
./scripts/lint.sh
```

Runs ESLint and Prettier to check code quality and formatting.

### Importing Players

```bash
./scripts/import-players.sh path/to/players.xlsx
```

Bulk imports players from an XLSX file into the database.

### Resetting the Database

```bash
./scripts/reset-db.sh
```

Clears all data and resets the database to a clean state.

## Project Structure

```
price-is-right/
├── backend/               # Fastify backend application
│   ├── src/
│   │   ├── routes/       # REST API endpoints
│   │   ├── services/     # Business logic layer
│   │   ├── sockets/      # Socket.io event handlers
│   │   ├── db/           # Database schema and queries
│   │   └── utils/        # Helper functions
│   ├── tests/            # Backend tests
│   └── Dockerfile
├── frontend/             # React frontend application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page-level components
│   │   ├── store/        # Zustand state management
│   │   ├── hooks/        # Custom React hooks
│   │   └── utils/        # Helper functions
│   ├── tests/            # Frontend tests
│   └── Dockerfile
├── public/               # Static files
│   └── images/
│       ├── players/      # Player photos
│       └── products/     # Product photos
├── scripts/              # Helper scripts
├── docker-compose.yml    # Docker orchestration
├── .env.example          # Environment variables template
├── agents.md             # Development methodology guide
├── executive-summary.md  # Project overview and implementation plan
└── README.md             # This file
```

## Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update values in `.env` as needed:
   - Database configuration
   - API keys (if any)
   - Host/port settings

**Never commit `.env` to version control!**

## Player & Product Setup

### Player Photos

1. Place player photos in `public/images/players/`
2. Name files to match player names (e.g., `john-smith.jpg`)
3. Supported formats: JPG, PNG, GIF

### Product Configuration

Products are configured via JSON (structure to be defined during implementation). Product images go in `public/images/products/`.

### Importing Players

Create an XLSX file with columns:
- Name
- Role (host/player/audience)
- (Additional columns TBD)

Then run:
```bash
./scripts/import-players.sh your-file.xlsx
```

## Game Roles & Access

### Access Codes

All users (hosts, players, audience) access the game via unique codes:
- Codes are 6-character alphanumeric strings (e.g., `ABC123`)
- Access via URL: `http://localhost:3000/?code=ABC123`
- Codes are reusable but only allow one active session at a time
- Session persists across page refreshes

### Host Privileges

Hosts have special permissions to:
- Access the admin panel for player management
- Manage players (activate/deactivate, reset codes, edit details)
- Control game flow (advance phases, select contestants)
- Override game state (replace players, unlock bids)
- Toggle game availability (enable/disable for maintenance)
- Export/import game state for disaster recovery

## Admin Panel (Host Only)

The Admin Panel provides comprehensive tools for hosts to manage the game before and during the event. Only users with the **host** role can access these features.

### Accessing the Admin Panel

1. Log in with a host access code
2. Click **"Admin Tools"** on the welcome page
3. The admin panel is available at `/admin` (automatically protected)

If you're not a host, you'll be redirected with an error message.

### Player Management

#### Viewing Players

- **Search**: Filter players by name in real-time
- **Columns**: View ID, name, email, access code, photo, role, and active status
- **Visual Indicators**:
  - Active players shown in green
  - Inactive players shown in red

#### Individual Player Actions

Each player row has an action menu with the following options:

**View Access Code**
- Displays the player's current access code
- Useful for helping players log in during the event

**Reset Access Code**
- Generates a new random 6-character alphanumeric code
- Use when a code is compromised or forgotten
- Old code immediately stops working

**Edit Player**
- Update name, email, and role
- Upload or change player photo (JPG, PNG, GIF - max 5MB)
- Photo appears in player selection screens during the game

**Deactivate/Activate Player**
- Deactivate: Prevents player from logging in (sessions terminated)
- Activate: Re-enables access for previously deactivated players
- Useful for managing no-shows or late arrivals

**Promote/Demote Role**
- Change between **host**, **player**, and **audience** roles
- Promote to host: Grants full admin access
- Demote to player: Returns to standard player permissions
- Demote to audience: View-only access

#### Bulk Operations

**Reset All Access Codes**
- Regenerates codes for ALL active players simultaneously
- Requires confirmation (destructive action)
- Use case: Security measure if codes were publicly exposed

**Delete All Players**
- Removes ALL players from the database
- Requires confirmation (highly destructive)
- Use case: Starting fresh for a new event

#### Manual Player Addition

Click **"Add Player"** to manually create a new player:
- Enter first name, last name, and email
- Select role (host/player/audience)
- Upload a photo (optional, defaults to `default.jpg`)
- Access code is automatically generated
- Immediately appears in the player table

### Role Management

The system supports three roles with different permissions:

| Role | Access Level | Capabilities |
|------|-------------|--------------|
| **Host** | Full admin access | All features including admin panel, game control, player management |
| **Player** | Standard gameplay | Participate in bidding, wheel spins, showcases |
| **Audience** | View-only | Watch the game in real-time without participating |

**Changing Roles:**
- Use the action menu on any player row
- Select "Promote to Host" or "Demote to Player/Audience"
- Changes take effect immediately (active sessions updated)

### Game Control

**Enable/Disable Game**
- Toggle switch in the admin panel header
- When **disabled**:
  - All users see "Game Currently Disabled" maintenance message
  - Entry buttons are disabled for players
  - Hosts can still access admin tools
- When **enabled**: Normal game operation
- Use case: Pre-event setup, intermissions, or emergency maintenance

### Export/Import (Disaster Recovery)

Protect against data loss with database backup and restore capabilities.

#### Exporting Database

1. Click **"Export Database"** (blue button)
2. Confirm the export action
3. Downloads a JSON file named `price-is-right-backup-YYYY-MM-DD.json`
4. File contains:
   - All players (excluding session tokens for security)
   - Game state settings
   - Export timestamp and version metadata

**When to export:**
- Before major game events
- After significant player data changes
- Regularly as part of backup procedures

#### Importing Database

1. Click **"Import Database"** (purple button)
2. **⚠️ WARNING**: This **deletes ALL existing data** and replaces it
3. Select a previously exported JSON file
4. Review the warning message
5. Click **"Import & Replace"** (red button)
6. Success message shows counts of imported players and game state
7. Player table and game status automatically refresh

**When to import:**
- Recovering from database corruption
- Restoring after accidental data deletion
- Moving game state between environments
- Rolling back to a previous state

**Important notes:**
- Session tokens are never exported (users must re-login after import)
- Import is transactional (all-or-nothing, no partial imports)
- Always test imports on a development environment first
- Keep recent backups stored securely offsite

## Testing Strategy

### Unit Tests
- Written alongside feature implementation (test-first approach)
- Focus on game logic, state transitions, calculations
- Target: 80%+ coverage for backend, 50%+ for frontend

### Integration Tests
- API endpoints and Socket.io event flows
- Database persistence and recovery
- Multi-user scenarios

### Performance Tests
- Mock 150 concurrent Socket.io connections
- Measure broadcast latency and resource usage
- Validate scalability before live event

### Running Tests

```bash
# Run all tests
./scripts/test.sh

# Run tests in watch mode (inside Docker)
docker-compose exec backend npm run test:watch
docker-compose exec frontend npm run test:watch

# Run specific test file
docker-compose exec backend npm test -- path/to/test
```

## Troubleshooting

### Docker Issues

**Containers won't start:**
```bash
docker-compose down
docker-compose up --build
```

**Permission errors:**
- Ensure Docker has access to your project directory
- Check file permissions on scripts: `chmod +x scripts/*.sh`

### Hot Reload Not Working

On macOS, file watching in Docker can be slow. If changes aren't reflecting:
1. Save the file again
2. Check Docker container logs: `docker-compose logs -f frontend`
3. Restart the container: `docker-compose restart frontend`

### Database Issues

**Reset database:**
```bash
./scripts/reset-db.sh
```

**Database locked errors:**
- Ensure only one instance is running
- Restart Docker containers

### Port Conflicts

If ports 3000 or 3001 are already in use:
1. Update ports in `docker-compose.yml`
2. Update corresponding URLs in `.env`
3. Restart: `docker-compose down && docker-compose up`

## Deployment

Deployment instructions will be added closer to the event date. The same Docker Compose setup used for development will deploy to production with minimal configuration changes.

## Documentation

- **`agents.md`** - Development methodology and working principles
- **`executive-summary.md`** - Full project overview and implementation plan
- **`plan.md`** - Current development status and next tasks (to be created)

## Contributing

When contributing to this project:

1. **Follow the methodology** described in `agents.md`
2. **Write tests** alongside feature implementation
3. **Run linting** before committing: `./scripts/lint.sh`
4. **Test your changes** thoroughly: `./scripts/test.sh`
5. **Commit frequently** with clear, descriptive messages
6. **Ask questions** when uncertain - better to clarify than assume

## Support

For questions or issues:
- Check the documentation in `agents.md` and `executive-summary.md`
- Review troubleshooting section above
- Contact the project maintainer

## License

[To be determined]
