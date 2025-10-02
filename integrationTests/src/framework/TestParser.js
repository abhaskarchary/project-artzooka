import fs from 'fs/promises';
import path from 'path';

/**
 * Parser for Gherkin-style test cases
 */
export class TestParser {
  constructor() {
    this.keywords = {
      scenario: ['SCENARIO:', 'TEST:'],
      given: ['GIVEN:', 'SETUP:'],
      when: ['WHEN:', 'AND:'],
      then: ['THEN:', 'EXPECT:', 'VERIFY:'],
      comment: ['#', '//']
    };
  }

  /**
   * Parse a test file into structured test cases
   */
  async parseTestFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const testCases = [];
    let currentTest = null;
    let currentSection = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip comments
      if (this.isComment(line)) {
        continue;
      }

      // Check for scenario start
      if (this.isKeyword(line, 'scenario')) {
        if (currentTest) {
          testCases.push(currentTest);
        }
        currentTest = {
          name: this.extractContent(line, 'scenario'),
          file: filePath,
          line: i + 1,
          given: [],
          when: [],
          then: []
        };
        currentSection = null;
        continue;
      }

      if (!currentTest) {
        continue; // Skip lines before first scenario
      }

      // Check for section keywords
      if (this.isKeyword(line, 'given')) {
        currentSection = 'given';
        const content = this.extractContent(line, 'given');
        if (content) {
          currentTest.given.push(content);
        }
      } else if (this.isKeyword(line, 'when')) {
        currentSection = 'when';
        const content = this.extractContent(line, 'when');
        if (content) {
          currentTest.when.push(content);
        }
      } else if (this.isKeyword(line, 'then')) {
        currentSection = 'then';
        const content = this.extractContent(line, 'then');
        if (content) {
          currentTest.then.push(content);
        }
      } else if (currentSection && line.startsWith('-')) {
        // Continuation line with bullet point
        currentTest[currentSection].push(line.substring(1).trim());
      } else if (currentSection) {
        // Continuation line without bullet point
        currentTest[currentSection].push(line);
      }
    }

    // Add the last test case
    if (currentTest) {
      testCases.push(currentTest);
    }

    return testCases;
  }

  /**
   * Parse all test files in a directory
   */
  async parseTestDirectory(dirPath) {
    const allTests = [];
    
    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        if (file.endsWith('.txt') || file.endsWith('.feature')) {
          const filePath = path.join(dirPath, file);
          const tests = await this.parseTestFile(filePath);
          allTests.push(...tests);
        }
      }
    } catch (error) {
      console.error(`Error reading test directory ${dirPath}:`, error.message);
    }

    return allTests;
  }

  /**
   * Check if line is a comment
   */
  isComment(line) {
    return this.keywords.comment.some(keyword => line.startsWith(keyword));
  }

  /**
   * Check if line starts with a specific keyword type
   */
  isKeyword(line, type) {
    const keywords = this.keywords[type] || [];
    return keywords.some(keyword => line.toUpperCase().startsWith(keyword));
  }

  /**
   * Extract content after keyword
   */
  extractContent(line, type) {
    const keywords = this.keywords[type] || [];
    
    for (const keyword of keywords) {
      if (line.toUpperCase().startsWith(keyword)) {
        return line.substring(keyword.length).trim();
      }
    }
    
    return line;
  }

  /**
   * Convert parsed test case to executable actions
   */
  convertToActions(testCase) {
    const actions = [];

    // Process GIVEN steps (setup)
    for (const step of testCase.given) {
      actions.push(this.parseStep(step, 'setup'));
    }

    // Process WHEN steps (actions)
    for (const step of testCase.when) {
      actions.push(this.parseStep(step, 'action'));
    }

    // Process THEN steps (assertions)
    for (const step of testCase.then) {
      actions.push(this.parseStep(step, 'assertion'));
    }

    return actions;
  }

  /**
   * Parse individual step into action object
   */
  parseStep(step, type) {
    const action = {
      type,
      originalText: step,
      action: null,
      params: {},
      player: null
    };

    // Extract player name if mentioned
    const playerMatch = step.match(/Player(\d+|[A-Za-z]+)/i);
    if (playerMatch) {
      action.player = playerMatch[1];
    }

    // Parse different action types
    const stepLower = step.toLowerCase();

    if (stepLower.includes('players') && (stepLower.includes('needed') || stepLower.includes('required'))) {
      const numberMatch = step.match(/(\d+)/);
      action.action = 'requirePlayers';
      action.params.count = numberMatch ? parseInt(numberMatch[1]) : 3;
    } else if (stepLower.includes('create') && stepLower.includes('room')) {
      action.action = 'createRoom';
    } else if (stepLower.includes('join') && stepLower.includes('room')) {
      action.action = 'joinRoom';
    } else if (stepLower.includes('start') && stepLower.includes('game')) {
      action.action = 'startGame';
    } else if (stepLower.includes('submit') && stepLower.includes('drawing')) {
      action.action = 'submitDrawing';
    } else if (stepLower.includes('draw') && !stepLower.includes('submit')) {
      action.action = 'draw';
    } else if (stepLower.includes('vote')) {
      action.action = 'vote';
    } else if (stepLower.includes('leave') && stepLower.includes('game')) {
      action.action = 'leaveGame';
    } else if (stepLower.includes('timer') && stepLower.includes('expire')) {
      action.action = 'waitForTimerExpiration';
      if (stepLower.includes('drawing')) {
        action.params.phase = 'drawing';
      } else if (stepLower.includes('voting')) {
        action.params.phase = 'voting';
      }
    } else if (stepLower.includes('discussion') && stepLower.includes('screen')) {
      action.action = 'verifyDiscussionScreen';
    } else if (stepLower.includes('drawing') && stepLower.includes('screen')) {
      action.action = 'verifyDrawingScreen';
    } else if (stepLower.includes('voting') && stepLower.includes('screen')) {
      action.action = 'verifyVotingScreen';
    } else if (stepLower.includes('moved to') || stepLower.includes('taken to')) {
      if (stepLower.includes('discussion')) {
        action.action = 'verifyDiscussionScreen';
      } else if (stepLower.includes('voting')) {
        action.action = 'verifyVotingScreen';
      }
    } else {
      // Generic action - try to infer from keywords
      action.action = 'custom';
      action.params.description = step;
    }

    return action;
  }

  /**
   * Validate parsed test case
   */
  validateTestCase(testCase) {
    const errors = [];

    if (!testCase.name || testCase.name.trim() === '') {
      errors.push('Test case must have a name');
    }

    if (testCase.given.length === 0) {
      errors.push('Test case must have at least one GIVEN step');
    }

    if (testCase.when.length === 0) {
      errors.push('Test case must have at least one WHEN step');
    }

    if (testCase.then.length === 0) {
      errors.push('Test case must have at least one THEN step');
    }

    return errors;
  }
}
