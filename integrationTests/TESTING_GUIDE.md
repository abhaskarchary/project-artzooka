# ConArtist Integration Testing Guide

## 🎯 Overview

This integration testing framework provides comprehensive end-to-end testing for the ConArtist drawing game using browser automation and plain-text test definitions.

## 🏗️ Architecture

```
integrationTests/
├── src/
│   ├── framework/
│   │   ├── BrowserTestFramework.js    # Core browser automation
│   │   ├── TestParser.js              # Gherkin test parser
│   │   └── TestExecutor.js            # Test execution engine
│   └── runner.js                      # Main test runner
├── tests/
│   ├── basic-flow.txt                 # Basic game flow tests
│   ├── draw-flow.txt                  # Drawing phase tests
│   ├── timer-expiration.txt           # Timer expiration tests
│   └── leave-game.txt                 # Player leaving tests
├── Dockerfile                         # Docker container for tests
├── package.json                       # Dependencies and scripts
└── setup.sh                          # Development setup script
```

## 🚀 Quick Start

### 1. Setup (First Time)
```bash
cd integrationTests
./setup.sh
```

### 2. Start Application
```bash
# From project root
docker-compose up -d
```

### 3. Run Tests
```bash
# Run all tests (headless)
npm test

# Run with visible browser (development)
npm test -- --headed

# Run with slow motion for debugging
npm test -- --headed --slow-mo 1000

# Run specific test file
npm test tests/draw-flow.txt
```

## 📝 Writing Tests

Tests use Gherkin syntax with Given/When/Then structure:

```gherkin
SCENARIO: Test description
GIVEN: Prerequisites
WHEN: Actions to perform
AND: Additional actions
THEN: Expected outcomes
```

### Example Test Case
```gherkin
SCENARIO: All Players submit drawing before timer expires
GIVEN: 3 players are needed
WHEN: Player1 creates a room
AND: Player2 joins the room
AND: Player3 joins the room
AND: Player1 starts the game
AND: Player1 submits drawing
AND: Player2 submits drawing
AND: Player3 submits drawing
THEN: All players must be taken to Discussion Screen
```

## 🎮 Available Actions

### Setup Actions
- `3 players are needed` - Creates 3 test players
- `Player1 creates a room` - Creates a new game room
- `Player2 joins the room` - Joins existing room

### Game Actions
- `Player1 starts the game` - Starts the game (admin only)
- `Player1 draws` - Draws on canvas without submitting
- `Player1 submits drawing` - Submits the drawing
- `Player1 votes` - Votes for another player
- `Player1 leaves game` - Leaves the current game

### Timer Actions
- `drawing timer expires` - Waits for drawing phase to end
- `voting timer expires` - Waits for voting phase to end

### Verification Actions
- `All players must be taken to Discussion Screen`
- `Player1's drawing should be shown in voting screen`
- `Player2's unfinished drawing should be shown`
- `Player3's blank drawing must be shown`

## ⚙️ Configuration

### Command Line Options
```bash
--headless          Run browsers in headless mode (default)
--headed            Run browsers with visible UI
--slow-mo <ms>      Add delay between actions
--timeout <ms>      Test timeout in milliseconds
--draw-time <sec>   Drawing phase duration
--vote-time <sec>   Voting phase duration
```

### Environment Variables
```bash
BASE_URL=http://localhost              # Frontend URL
API_BASE_URL=http://localhost:8080     # Backend API URL
TEST_TIMEOUT=30000                     # Default timeout
```

## 🐛 Debugging

### Screenshots
Failed tests automatically capture screenshots:
- `screenshot-PlayerName-TestName-failure.png`

### Verbose Logging
Run with debug output:
```bash
DEBUG=* npm test
```

### Manual Debugging
```bash
# Run single test with visible browser and slow motion
npm test tests/basic-flow.txt -- --headed --slow-mo 2000
```

## 🔄 CI/CD Integration

### GitHub Actions
The framework includes a GitHub Actions workflow:
```yaml
# .github/workflows/integration-tests.yml
- name: Run Integration Tests
  run: ./test.sh
```

### Docker Integration
Tests run in Docker containers:
```bash
# Run tests in Docker
docker-compose --profile testing run --rm integration-tests

# Build and run
docker-compose --profile testing up --build integration-tests
```

## 📊 Test Results

### Success Output
```
🧪 Executing test: All Players submit drawing before timer expires
📁 File: tests/draw-flow.txt:1
  1. 3 players are needed
    👥 Created 3 players
  2. Player1 creates a room
    🏠 Player1 created room ABC123
  ...
✅ Test passed: All Players submit drawing before timer expires
```

### Failure Output
```
❌ Test failed: Player leaves during drawing phase
   Error: Step 5 failed: Player2 is not on discussion screen
📸 Screenshot saved: screenshot-Player2-failure-1234567890.png
```

## 🛠️ Extending the Framework

### Adding New Actions
1. Add action parsing in `TestParser.js`:
```javascript
else if (stepLower.includes('new action')) {
  action.action = 'newAction';
}
```

2. Implement action in `TestExecutor.js`:
```javascript
case 'newAction':
  await this.performNewAction(action.player);
  break;
```

3. Add method to `BrowserPlayer` class:
```javascript
async performNewAction() {
  // Implementation
}
```

### Adding New Assertions
Add verification methods to `TestExecutor.js`:
```javascript
async verifyCustomCondition(playerName) {
  const player = this.getPlayer(playerName);
  const condition = await player.checkCustomCondition();
  if (!condition) {
    throw new Error(`Custom condition not met for ${player.name}`);
  }
}
```

## 🎯 Best Practices

1. **Keep tests focused** - One scenario per test case
2. **Use descriptive names** - Clear test and step descriptions
3. **Test edge cases** - Timer expiration, player leaving, etc.
4. **Verify end states** - Always check final screen/state
5. **Use short timers** - Fast execution with 3-5 second timers
6. **Clean test data** - Each test starts fresh

## 🚨 Troubleshooting

### Common Issues

**Tests timeout**
- Check if Docker Compose services are running
- Verify frontend/backend accessibility
- Increase timeout values

**Browser crashes**
- Reduce parallel test execution
- Check system resources
- Use headless mode

**WebSocket connection fails**
- Verify network connectivity
- Check WebSocket proxy configuration
- Ensure proper service startup order

**Screenshots not captured**
- Check file permissions
- Verify screenshot directory exists
- Ensure sufficient disk space
