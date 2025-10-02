# ConArtist Integration Testing Framework

This framework provides end-to-end testing for the ConArtist drawing game, supporting both API-level and WebSocket-based testing.

## Architecture

- **Framework Core** (`src/framework/`): Core testing engine with actions, assertions, and WebSocket handling
- **Test Cases** (`tests/`): Plain text test definitions following framework syntax
- **Test Runner** (`src/runner.js`): Executes test cases and reports results
- **Game Actions** (`src/actions/`): Reusable game actions (join room, submit drawing, vote, etc.)

## Test Case Format

Test cases are written in plain text using a structured format:

```
TEST: Test case description
SETUP: Prerequisites (e.g., "3 players")
ACTIONS:
  - Action description
  - Another action
EXPECT: Expected outcome
```

## Game Actions Available

- `createRoom()` - Create a new game room
- `joinRoom(roomCode, playerName)` - Join existing room
- `startGame(roomCode)` - Start the game (host only)
- `submitDrawing(roomCode, playerToken, imageData)` - Submit a drawing
- `submitVote(roomCode, playerToken, targetPlayerId)` - Vote for a player
- `leaveGame(roomCode, playerToken)` - Leave active game
- `waitForEvent(eventType, timeout)` - Wait for WebSocket event
- `waitForTimer(phase, timeout)` - Wait for timer expiration

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with file watching
npm run test:watch

# Run specific test file
npm test -- tests/draw-flow.txt
```

## Configuration

Set environment variables:
- `API_BASE_URL` - Backend API URL (default: http://localhost:8080)
- `WS_BASE_URL` - WebSocket URL (default: ws://localhost:8080)
- `TEST_TIMEOUT` - Default test timeout in ms (default: 30000)
