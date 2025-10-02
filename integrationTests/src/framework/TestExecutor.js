import { BrowserTestFramework } from './BrowserTestFramework.js';

/**
 * Executes parsed test cases using the browser framework
 */
export class TestExecutor {
  constructor(config = {}) {
    this.config = config;
    this.framework = null;
    this.players = new Map(); // playerName -> BrowserPlayer
    this.currentRoomCode = null;
  }

  /**
   * Execute a single test case
   */
  async executeTestCase(testCase, actions) {
    console.log(`\n🧪 Executing test: ${testCase.name}`);
    console.log(`📁 File: ${testCase.file}:${testCase.line}`);
    
    try {
      // Initialize framework for this test
      this.framework = new BrowserTestFramework(this.config);
      await this.framework.initialize();

      // Execute all actions in sequence
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        console.log(`  ${i + 1}. ${action.originalText}`);
        
        try {
          await this.executeAction(action);
        } catch (error) {
          throw new Error(`Step ${i + 1} failed: ${error.message}`);
        }
      }

      console.log(`✅ Test passed: ${testCase.name}`);
      return { success: true, testCase };

    } catch (error) {
      console.error(`❌ Test failed: ${testCase.name}`);
      console.error(`   Error: ${error.message}`);
      
      // Take screenshots of all players for debugging
      await this.takeDebugScreenshots(testCase.name);
      
      return { success: false, testCase, error: error.message };
    } finally {
      // Clean up
      if (this.framework) {
        await this.framework.cleanup();
        this.framework = null;
      }
      this.players.clear();
      this.currentRoomCode = null;
    }
  }

  /**
   * Execute a single action
   */
  async executeAction(action) {
    switch (action.action) {
      case 'requirePlayers':
        await this.requirePlayers(action.params.count);
        break;
        
      case 'createRoom':
        await this.createRoom(action.player);
        break;
        
      case 'joinRoom':
        await this.joinRoom(action.player);
        break;
        
      case 'startGame':
        await this.startGame(action.player);
        break;
        
      case 'draw':
        await this.draw(action.player);
        break;
        
      case 'submitDrawing':
        await this.submitDrawing(action.player);
        break;
        
      case 'vote':
        await this.vote(action.player);
        break;
        
      case 'leaveGame':
        await this.leaveGame(action.player);
        break;
        
      case 'waitForTimerExpiration':
        await this.waitForTimerExpiration(action.params.phase);
        break;
        
      case 'verifyDiscussionScreen':
        await this.verifyDiscussionScreen(action.player);
        break;
        
      case 'verifyDrawingScreen':
        await this.verifyDrawingScreen(action.player);
        break;
        
      case 'verifyVotingScreen':
        await this.verifyVotingScreen(action.player);
        break;
        
      case 'custom':
        console.log(`⚠️ Custom action not implemented: ${action.params.description}`);
        break;
        
      default:
        throw new Error(`Unknown action: ${action.action}`);
    }
  }

  /**
   * Create required number of players
   */
  async requirePlayers(count) {
    const playerNames = [];
    for (let i = 1; i <= count; i++) {
      playerNames.push(`Player${i}`);
    }
    
    const browserPlayers = await this.framework.createPlayers(playerNames);
    
    for (let i = 0; i < browserPlayers.length; i++) {
      this.players.set(playerNames[i], browserPlayers[i]);
    }
    
    console.log(`    👥 Created ${count} players`);
  }

  /**
   * Create room with specified player
   */
  async createRoom(playerName) {
    const player = this.getPlayer(playerName || 'Player1');
    this.currentRoomCode = await player.createRoom();
    console.log(`    🏠 ${player.name} created room ${this.currentRoomCode}`);
  }

  /**
   * Join room with specified player
   */
  async joinRoom(playerName) {
    const player = this.getPlayer(playerName);
    
    if (!this.currentRoomCode) {
      throw new Error('No room code available - create room first');
    }
    
    await player.joinRoom(this.currentRoomCode);
    console.log(`    🚪 ${player.name} joined room`);
  }

  /**
   * Start game
   */
  async startGame(playerName) {
    const player = this.getPlayer(playerName || 'Player1');
    await player.startGame();
    console.log(`    🎮 ${player.name} started the game`);
  }

  /**
   * Draw (without submitting)
   */
  async draw(playerName) {
    const player = this.getPlayer(playerName);
    
    // Wait for canvas and do some drawing actions
    await player.page.waitForSelector('canvas');
    const canvas = player.page.locator('canvas');
    
    // Simulate drawing
    await canvas.click({ position: { x: 50, y: 50 } });
    await canvas.click({ position: { x: 100, y: 100 } });
    await this.framework.wait(500);
    
    console.log(`    🎨 ${player.name} drew on canvas`);
  }

  /**
   * Submit drawing
   */
  async submitDrawing(playerName) {
    const player = this.getPlayer(playerName);
    await player.submitDrawing();
    console.log(`    📤 ${player.name} submitted drawing`);
  }

  /**
   * Submit vote
   */
  async vote(playerName) {
    const player = this.getPlayer(playerName);
    await player.submitVote();
    console.log(`    🗳️ ${player.name} voted`);
  }

  /**
   * Leave game
   */
  async leaveGame(playerName) {
    const player = this.getPlayer(playerName);
    await player.leaveGame();
    console.log(`    🚪 ${player.name} left the game`);
  }

  /**
   * Wait for timer expiration
   */
  async waitForTimerExpiration(phase = 'drawing') {
    console.log(`    ⏱️ Waiting for ${phase} timer to expire...`);
    
    // Get the first player to wait with
    const firstPlayer = this.players.values().next().value;
    if (firstPlayer) {
      await firstPlayer.waitForTimerExpiration(phase);
    } else {
      // Fallback to framework wait
      const timeout = phase === 'drawing' ? 
        this.framework.config.shortDrawTime : 
        this.framework.config.shortVoteTime;
      await this.framework.wait((timeout + 2) * 1000);
    }
    
    console.log(`    ⏰ ${phase} timer expired`);
  }

  /**
   * Verify all players are on discussion screen
   */
  async verifyDiscussionScreen(playerName) {
    const playersToCheck = playerName ? [this.getPlayer(playerName)] : Array.from(this.players.values());
    
    for (const player of playersToCheck) {
      const isOnDiscussion = await player.isOnDiscussionScreen();
      if (!isOnDiscussion) {
        throw new Error(`${player.name} is not on discussion screen`);
      }
    }
    
    const playerList = playersToCheck.map(p => p.name).join(', ');
    console.log(`    ✅ ${playerList} on discussion screen`);
  }

  /**
   * Verify players are on drawing screen
   */
  async verifyDrawingScreen(playerName) {
    const playersToCheck = playerName ? [this.getPlayer(playerName)] : Array.from(this.players.values());
    
    for (const player of playersToCheck) {
      const isOnDrawing = await player.isOnDrawingScreen();
      if (!isOnDrawing) {
        throw new Error(`${player.name} is not on drawing screen`);
      }
    }
    
    const playerList = playersToCheck.map(p => p.name).join(', ');
    console.log(`    ✅ ${playerList} on drawing screen`);
  }

  /**
   * Verify players are on voting screen
   */
  async verifyVotingScreen(playerName) {
    const playersToCheck = playerName ? [this.getPlayer(playerName)] : Array.from(this.players.values());
    
    for (const player of playersToCheck) {
      const isOnVoting = await player.isOnVotingScreen();
      if (!isOnVoting) {
        throw new Error(`${player.name} is not on voting screen`);
      }
    }
    
    const playerList = playersToCheck.map(p => p.name).join(', ');
    console.log(`    ✅ ${playerList} on voting screen`);
  }

  /**
   * Get player by name, with fallback logic
   */
  getPlayer(playerName) {
    if (!playerName) {
      // Return first player if no name specified
      const firstPlayer = this.players.values().next().value;
      if (!firstPlayer) {
        throw new Error('No players available');
      }
      return firstPlayer;
    }

    const player = this.players.get(playerName);
    if (!player) {
      throw new Error(`Player ${playerName} not found`);
    }
    
    return player;
  }

  /**
   * Take debug screenshots of all players
   */
  async takeDebugScreenshots(testName) {
    try {
      for (const [name, player] of this.players) {
        await player.screenshot(`${testName}-failure`);
      }
    } catch (error) {
      console.warn('Could not take debug screenshots:', error.message);
    }
  }
}
