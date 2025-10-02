import { chromium } from '@playwright/test';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

/**
 * Browser-based integration testing framework for ConArtist game
 */
export class BrowserTestFramework {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || process.env.BASE_URL || 'http://localhost',
      apiBaseUrl: config.apiBaseUrl || process.env.API_BASE_URL || 'http://localhost:8080',
      headless: config.headless !== false, // Default to headless
      slowMo: config.slowMo || 0,
      timeout: config.timeout || 30000,
      shortDrawTime: config.shortDrawTime || 5, // 5 seconds for testing
      shortVoteTime: config.shortVoteTime || 5, // 5 seconds for testing
      ...config
    };
    
    this.browser = null;
    this.players = [];
    this.testImages = new Map();
    this.currentRoomCode = null;
  }

  /**
   * Initialize the test framework
   */
  async initialize() {
    // Check if Docker Compose stack is running
    await this.checkDockerStack();
    
    // Launch browser
    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo
    });

    // Load test images
    await this.loadTestImages();
    
    console.log('✅ Browser test framework initialized');
  }

  /**
   * Check if Docker Compose stack is running
   */
  async checkDockerStack() {
    try {
      // Check frontend
      const frontendResponse = await axios.get(this.config.baseUrl, { timeout: 5000 });
      if (frontendResponse.status !== 200) {
        throw new Error('Frontend not responding');
      }

      // Check backend API
      const backendResponse = await axios.get(`${this.config.apiBaseUrl}/actuator/health`, { timeout: 5000 });
      if (backendResponse.status !== 200) {
        throw new Error('Backend not responding');
      }

      console.log('✅ Docker Compose stack is running');
    } catch (error) {
      throw new Error(`❌ Docker Compose stack is not running or not accessible. Please run 'docker-compose up -d' first.\nError: ${error.message}`);
    }
  }

  /**
   * Load test images for drawing submissions
   */
  async loadTestImages() {
    const testImagesDir = path.join(process.cwd(), 'test-images');
    
    try {
      await fs.access(testImagesDir);
    } catch {
      // Create test images directory and generate basic images
      await fs.mkdir(testImagesDir, { recursive: true });
      await this.generateTestImages(testImagesDir);
    }

    // Load all test images
    const files = await fs.readdir(testImagesDir);
    for (const file of files) {
      if (file.endsWith('.png')) {
        const imagePath = path.join(testImagesDir, file);
        const imageBuffer = await fs.readFile(imagePath);
        this.testImages.set(file.replace('.png', ''), imageBuffer);
      }
    }

    console.log(`✅ Loaded ${this.testImages.size} test images`);
  }

  /**
   * Generate basic test images
   */
  async generateTestImages(dir) {
    // We'll create simple colored rectangles as PNG files
    // For now, create placeholder files - in a real implementation you'd use Canvas
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
    const types = ['drawing', 'blank', 'unfinished'];
    
    for (const color of colors) {
      for (const type of types) {
        const filename = `${color}-${type}.png`;
        // Create a minimal PNG file (this is a placeholder - you'd use Canvas API in real implementation)
        const placeholder = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
        await fs.writeFile(path.join(dir, filename), placeholder);
      }
    }
  }

  /**
   * Create a new player (browser context)
   */
  async createPlayer(name, options = {}) {
    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      ...options
    });
    
    const page = await context.newPage();
    
    const player = new BrowserPlayer(name, page, context, this);
    this.players.push(player);
    
    console.log(`👤 Created player: ${name}`);
    return player;
  }

  /**
   * Create multiple players
   */
  async createPlayers(names) {
    const players = [];
    for (const name of names) {
      players.push(await this.createPlayer(name));
    }
    return players;
  }

  /**
   * Set room timer settings for faster testing
   */
  async setRoomTimers(roomCode, drawSeconds = null, voteSeconds = null) {
    try {
      const admin = this.players.find(p => p.isAdmin);
      if (!admin) {
        console.warn('⚠️ No admin player found to set timers');
        return;
      }

      // Use the admin's session to update room settings
      const params = {};
      if (drawSeconds !== null) params.drawSeconds = drawSeconds;
      if (voteSeconds !== null) params.voteSeconds = voteSeconds;
      
      await axios.post(`${this.config.apiBaseUrl}/api/rooms/${roomCode}/settings`, params, {
        params: { token: admin.sessionToken }
      });
      
      console.log(`⏱️ Set room timers: draw=${drawSeconds}s, vote=${voteSeconds}s`);
    } catch (error) {
      console.warn('⚠️ Could not set room timers:', error.message);
    }
  }

  /**
   * Wait for specified duration
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get test image buffer
   */
  getTestImage(imageName) {
    return this.testImages.get(imageName) || this.testImages.values().next().value;
  }

  /**
   * Clean up all resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up test framework...');
    
    // Close all player contexts
    for (const player of this.players) {
      await player.cleanup();
    }
    this.players = [];

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    console.log('✅ Cleanup completed');
  }
}

/**
 * Browser-based player context
 */
export class BrowserPlayer {
  constructor(name, page, context, framework) {
    this.name = name;
    this.page = page;
    this.context = context;
    this.framework = framework;
    
    this.sessionToken = null;
    this.roomCode = null;
    this.isAdmin = false;
    this.playerId = null;
    
    this.gameState = {
      phase: 'menu', // menu, lobby, drawing, voting, results
      hasSubmittedDrawing: false,
      hasVoted: false,
      prompt: null
    };

    // Set up page error handling
    this.page.on('pageerror', error => {
      console.error(`❌ Page error for ${this.name}:`, error);
    });

    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`❌ Console error for ${this.name}:`, msg.text());
      }
    });
  }

  /**
   * Navigate to the game
   */
  async navigateToGame() {
    await this.page.goto(this.framework.config.baseUrl);
    await this.page.waitForLoadState('networkidle');
    this.gameState.phase = 'menu';
    console.log(`🌐 ${this.name} navigated to game`);
  }

  /**
   * Create a new room
   */
  async createRoom() {
    await this.navigateToGame();
    
    // Click "Create Room" button
    await this.page.click('text=Create Room');
    await this.page.waitForLoadState('networkidle');
    
    // Fill in player name
    await this.page.fill('input[placeholder*="name" i]', this.name);
    
    // Submit
    await this.page.click('button:has-text("Create")');
    
    // Wait for room creation and extract room code
    await this.page.waitForSelector('text=/Room Code:/i');
    const roomCodeElement = await this.page.locator('text=/[A-Z0-9]{6}/').first();
    this.roomCode = await roomCodeElement.textContent();
    this.framework.currentRoomCode = this.roomCode;
    
    this.isAdmin = true;
    this.gameState.phase = 'lobby';
    
    console.log(`🏠 ${this.name} created room: ${this.roomCode}`);
    return this.roomCode;
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomCode) {
    await this.navigateToGame();
    
    // Click "Join Room" button
    await this.page.click('text=Join Room');
    await this.page.waitForLoadState('networkidle');
    
    // Fill in room code and player name
    await this.page.fill('input[placeholder*="room" i]', roomCode);
    await this.page.fill('input[placeholder*="name" i]', this.name);
    
    // Submit
    await this.page.click('button:has-text("Join")');
    
    // Wait for successful join
    await this.page.waitForSelector('text=/Room Code:/i');
    
    this.roomCode = roomCode;
    this.gameState.phase = 'lobby';
    
    console.log(`🚪 ${this.name} joined room: ${roomCode}`);
  }

  /**
   * Start the game (admin only)
   */
  async startGame() {
    if (!this.isAdmin) {
      throw new Error(`${this.name} is not admin and cannot start the game`);
    }

    // Set short timers for testing
    await this.framework.setRoomTimers(
      this.roomCode, 
      this.framework.config.shortDrawTime,
      this.framework.config.shortVoteTime
    );

    // Click start game button
    await this.page.click('button:has-text("Start Game")');
    
    // Wait for game to start (countdown and then drawing phase)
    await this.page.waitForSelector('canvas', { timeout: 10000 });
    
    this.gameState.phase = 'drawing';
    console.log(`🎮 ${this.name} started the game`);
  }

  /**
   * Submit a drawing
   */
  async submitDrawing(imageName = 'red-drawing') {
    if (this.gameState.phase !== 'drawing') {
      throw new Error(`${this.name} cannot submit drawing - not in drawing phase`);
    }

    // Wait for canvas to be ready
    await this.page.waitForSelector('canvas');
    
    // Simulate some drawing activity (click on canvas a few times)
    const canvas = this.page.locator('canvas');
    await canvas.click({ position: { x: 50, y: 50 } });
    await canvas.click({ position: { x: 100, y: 100 } });
    await canvas.click({ position: { x: 150, y: 50 } });
    
    // Wait a moment for drawing
    await this.framework.wait(500);
    
    // Click submit button
    await this.page.click('button:has-text("Submit")');
    
    // Wait for submission confirmation
    await this.page.waitForSelector('text=/submitted/i', { timeout: 5000 });
    
    this.gameState.hasSubmittedDrawing = true;
    console.log(`🎨 ${this.name} submitted drawing`);
  }

  /**
   * Wait for discussion phase to start
   */
  async waitForDiscussionPhase() {
    await this.page.waitForSelector('text=/Discussion/i', { timeout: 15000 });
    this.gameState.phase = 'voting';
    console.log(`💬 ${this.name} entered discussion phase`);
  }

  /**
   * Submit a vote
   */
  async submitVote(targetPlayerName = null) {
    if (this.gameState.phase !== 'voting') {
      throw new Error(`${this.name} cannot vote - not in voting phase`);
    }

    // Wait for voting interface
    await this.page.waitForSelector('button:has-text("Vote")');
    
    // If no specific target, vote for the first available option
    const voteButtons = this.page.locator('button:has-text("Vote")');
    const count = await voteButtons.count();
    
    if (count === 0) {
      throw new Error(`${this.name} found no vote buttons`);
    }

    // Click the first vote button (or find specific player if targetPlayerName provided)
    if (targetPlayerName) {
      // Find the vote button for the specific player
      await this.page.click(`text=${targetPlayerName} >> .. >> button:has-text("Vote")`);
    } else {
      // Click first available vote button
      await voteButtons.first().click();
    }
    
    this.gameState.hasVoted = true;
    console.log(`🗳️ ${this.name} submitted vote`);
  }

  /**
   * Wait for results phase
   */
  async waitForResults() {
    await this.page.waitForSelector('text=/Results/i', { timeout: 15000 });
    this.gameState.phase = 'results';
    console.log(`🏆 ${this.name} viewing results`);
  }

  /**
   * Leave the current game
   */
  async leaveGame() {
    // Look for leave game button
    try {
      await this.page.click('button:has-text("Leave Game")');
      await this.page.waitForSelector('text=/Room Code:/i'); // Back to lobby
      this.gameState.phase = 'lobby';
      console.log(`🚪 ${this.name} left the game`);
    } catch (error) {
      console.warn(`⚠️ ${this.name} could not leave game:`, error.message);
    }
  }

  /**
   * Check if player is on discussion screen
   */
  async isOnDiscussionScreen() {
    try {
      await this.page.waitForSelector('text=/Discussion/i', { timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if player is on drawing screen
   */
  async isOnDrawingScreen() {
    try {
      await this.page.waitForSelector('canvas', { timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if player is on voting screen
   */
  async isOnVotingScreen() {
    try {
      await this.page.waitForSelector('button:has-text("Vote")', { timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for timer to expire (for timer expiration tests)
   */
  async waitForTimerExpiration(phase = 'drawing') {
    const timeout = phase === 'drawing' ? 
      (this.framework.config.shortDrawTime + 2) * 1000 : 
      (this.framework.config.shortVoteTime + 2) * 1000;
    
    console.log(`⏱️ ${this.name} waiting for ${phase} timer to expire...`);
    await this.framework.wait(timeout);
  }

  /**
   * Take a screenshot for debugging
   */
  async screenshot(name) {
    const filename = `screenshot-${this.name}-${name}-${Date.now()}.png`;
    await this.page.screenshot({ path: filename });
    console.log(`📸 Screenshot saved: ${filename}`);
  }

  /**
   * Clean up player resources
   */
  async cleanup() {
    if (this.context) {
      await this.context.close();
    }
  }
}
