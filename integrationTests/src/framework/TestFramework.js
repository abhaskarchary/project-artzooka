import { EventEmitter } from 'events';
import WebSocket from 'ws';
import axios from 'axios';

/**
 * Core testing framework for ConArtist game integration tests
 */
export class TestFramework extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      apiBaseUrl: config.apiBaseUrl || process.env.API_BASE_URL || 'http://localhost:8080',
      wsBaseUrl: config.wsBaseUrl || process.env.WS_BASE_URL || 'ws://localhost:8080',
      defaultTimeout: config.defaultTimeout || parseInt(process.env.TEST_TIMEOUT) || 30000,
      ...config
    };
    
    this.players = new Map(); // playerId -> PlayerContext
    this.rooms = new Map(); // roomCode -> RoomContext
    this.activeConnections = new Set();
    this.eventListeners = new Map(); // eventType -> Set of listeners
  }

  /**
   * Create a new player context for testing
   */
  async createPlayer(name, options = {}) {
    const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const player = new PlayerContext(playerId, name, this, options);
    this.players.set(playerId, player);
    return player;
  }

  /**
   * Create multiple players at once
   */
  async createPlayers(names) {
    const players = [];
    for (const name of names) {
      players.push(await this.createPlayer(name));
    }
    return players;
  }

  /**
   * Clean up all resources
   */
  async cleanup() {
    // Close all WebSocket connections
    for (const connection of this.activeConnections) {
      if (connection.readyState === WebSocket.OPEN) {
        connection.close();
      }
    }
    this.activeConnections.clear();
    
    // Clear all contexts
    this.players.clear();
    this.rooms.clear();
    this.eventListeners.clear();
  }

  /**
   * Wait for a specific WebSocket event across all connections
   */
  async waitForEvent(eventType, timeout = this.config.defaultTimeout, filter = null) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout);

      const listener = (data) => {
        if (!filter || filter(data)) {
          clearTimeout(timer);
          resolve(data);
        }
      };

      if (!this.eventListeners.has(eventType)) {
        this.eventListeners.set(eventType, new Set());
      }
      this.eventListeners.get(eventType).add(listener);

      // Clean up listener after timeout
      setTimeout(() => {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
          listeners.delete(listener);
        }
      }, timeout + 1000);
    });
  }

  /**
   * Emit event to all registered listeners
   */
  emitEvent(eventType, data) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Wait for a specific amount of time
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make HTTP request to the API
   */
  async apiRequest(method, path, data = null, params = {}) {
    const url = `${this.config.apiBaseUrl}${path}`;
    const config = {
      method,
      url,
      params,
      timeout: this.config.defaultTimeout
    };

    if (data) {
      config.data = data;
      if (!(data instanceof FormData)) {
        config.headers = { 'Content-Type': 'application/json' };
      }
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`API Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }
}

/**
 * Context for a single player in the test
 */
export class PlayerContext {
  constructor(id, name, framework, options = {}) {
    this.id = id;
    this.name = name;
    this.framework = framework;
    this.options = options;
    
    this.sessionToken = null;
    this.roomCode = null;
    this.websocket = null;
    this.isAdmin = false;
    this.gameState = {
      phase: null, // 'lobby', 'drawing', 'voting', 'results'
      hasSubmittedDrawing: false,
      hasVoted: false,
      prompt: null
    };
    
    this.receivedEvents = [];
  }

  /**
   * Connect to WebSocket for room updates
   */
  async connectWebSocket(roomCode) {
    if (this.websocket) {
      this.websocket.close();
    }

    const wsUrl = `${this.framework.config.wsBaseUrl}/ws`;
    this.websocket = new WebSocket(wsUrl);
    this.framework.activeConnections.add(this.websocket);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`WebSocket connection timeout for player ${this.name}`));
      }, 10000);

      this.websocket.on('open', () => {
        clearTimeout(timeout);
        console.log(`WebSocket connected for player ${this.name}`);
        
        // Subscribe to room topic
        const subscribeMessage = {
          id: `sub-${Date.now()}`,
          destination: `/topic/rooms/${roomCode}`,
          'accept-version': '1.0,1.1,2.0',
          'heart-beat': '10000,10000'
        };
        
        this.websocket.send(`CONNECT\naccept-version:1.0,1.1,2.0\nheart-beat:10000,10000\n\n\x00`);
        
        setTimeout(() => {
          this.websocket.send(`SUBSCRIBE\nid:${subscribeMessage.id}\ndestination:${subscribeMessage.destination}\n\n\x00`);
          resolve();
        }, 100);
      });

      this.websocket.on('message', (data) => {
        try {
          const message = data.toString();
          if (message.startsWith('MESSAGE')) {
            const lines = message.split('\n');
            const bodyStart = lines.findIndex(line => line === '') + 1;
            const body = lines.slice(bodyStart).join('\n').replace(/\x00$/, '');
            
            if (body) {
              const payload = JSON.parse(body);
              this.receivedEvents.push({
                timestamp: Date.now(),
                type: payload.type,
                data: payload
              });
              
              // Update game state based on events
              this.updateGameState(payload);
              
              // Emit to framework listeners
              this.framework.emitEvent(payload.type, {
                player: this,
                ...payload
              });
            }
          }
        } catch (error) {
          console.error(`WebSocket message parsing error for ${this.name}:`, error);
        }
      });

      this.websocket.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Update internal game state based on WebSocket events
   */
  updateGameState(payload) {
    switch (payload.type) {
      case 'GAME_STARTED':
        this.gameState.phase = 'drawing';
        this.gameState.prompt = payload.promptCommon;
        this.gameState.hasSubmittedDrawing = false;
        this.gameState.hasVoted = false;
        break;
      
      case 'DISCUSS_STARTED':
        this.gameState.phase = 'voting';
        break;
      
      case 'SHOW_RESULTS':
        this.gameState.phase = 'results';
        break;
      
      case 'DRAWING_UPLOADED':
        if (payload.playerId === this.id) {
          this.gameState.hasSubmittedDrawing = true;
        }
        break;
    }
  }

  /**
   * Join a room
   */
  async joinRoom(roomCode) {
    const response = await this.framework.apiRequest('POST', `/api/rooms/${roomCode}/join`, {
      name: this.name
    });
    
    this.sessionToken = response.sessionToken;
    this.roomCode = roomCode;
    this.isAdmin = response.isAdmin || false;
    
    // Connect to WebSocket for real-time updates
    await this.connectWebSocket(roomCode);
    
    return response;
  }

  /**
   * Create a new room
   */
  async createRoom() {
    const response = await this.framework.apiRequest('POST', '/api/rooms');
    const roomCode = response.code;
    
    // Join the created room
    await this.joinRoom(roomCode);
    
    return roomCode;
  }

  /**
   * Start the game (admin only)
   */
  async startGame() {
    if (!this.isAdmin) {
      throw new Error(`Player ${this.name} is not admin and cannot start the game`);
    }
    
    return await this.framework.apiRequest('POST', `/api/rooms/${this.roomCode}/start`);
  }

  /**
   * Submit a drawing
   */
  async submitDrawing(imageData = null) {
    if (!imageData) {
      // Create a simple test image if none provided
      imageData = await this.createTestImage();
    }
    
    const formData = new FormData();
    formData.append('file', imageData, 'drawing.png');
    
    const response = await this.framework.apiRequest(
      'POST', 
      `/api/rooms/${this.roomCode}/drawings?token=${encodeURIComponent(this.sessionToken)}`,
      formData
    );
    
    this.gameState.hasSubmittedDrawing = true;
    return response;
  }

  /**
   * Submit a vote
   */
  async submitVote(targetPlayerId) {
    const response = await this.framework.apiRequest(
      'POST',
      `/api/rooms/${this.roomCode}/votes`,
      null,
      { token: this.sessionToken, targetId: targetPlayerId }
    );
    
    this.gameState.hasVoted = true;
    return response;
  }

  /**
   * Leave the current game
   */
  async leaveGame() {
    return await this.framework.apiRequest(
      'POST',
      `/api/rooms/${this.roomCode}/leave-game?token=${encodeURIComponent(this.sessionToken)}`
    );
  }

  /**
   * Wait for a specific event for this player
   */
  async waitForEvent(eventType, timeout = this.framework.config.defaultTimeout, filter = null) {
    return this.framework.waitForEvent(eventType, timeout, (data) => {
      const matchesFilter = !filter || filter(data);
      return matchesFilter;
    });
  }

  /**
   * Create a simple test image (placeholder)
   */
  async createTestImage() {
    // Create a simple 100x100 PNG with some basic drawing
    const canvas = await import('canvas');
    const canvasInstance = canvas.createCanvas(100, 100);
    const ctx = canvasInstance.getContext('2d');
    
    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 100, 100);
    
    // Draw something simple
    ctx.fillStyle = '#000000';
    ctx.fillRect(20, 20, 60, 60);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(30, 30, 40, 40);
    
    return canvasInstance.toBuffer('image/png');
  }

  /**
   * Get the last received event of a specific type
   */
  getLastEvent(eventType) {
    return this.receivedEvents
      .filter(event => event.type === eventType)
      .pop();
  }

  /**
   * Check if player has received a specific event
   */
  hasReceivedEvent(eventType, since = 0) {
    return this.receivedEvents.some(event => 
      event.type === eventType && event.timestamp >= since
    );
  }

  /**
   * Cleanup player resources
   */
  cleanup() {
    if (this.websocket) {
      this.websocket.close();
      this.framework.activeConnections.delete(this.websocket);
    }
  }
}

/**
 * Context for a game room
 */
export class RoomContext {
  constructor(code, framework) {
    this.code = code;
    this.framework = framework;
    this.players = [];
    this.gameState = {
      status: 'LOBBY', // LOBBY, DRAWING, VOTING, RESULTS
      gameId: null,
      drawSeconds: 60,
      voteSeconds: 60
    };
  }

  addPlayer(player) {
    this.players.push(player);
  }

  removePlayer(player) {
    this.players = this.players.filter(p => p.id !== player.id);
  }

  getAdmin() {
    return this.players.find(p => p.isAdmin);
  }

  getAllPlayers() {
    return [...this.players];
  }

  getPlayerCount() {
    return this.players.length;
  }
}
