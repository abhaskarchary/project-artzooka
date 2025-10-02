#!/usr/bin/env node

import { TestParser } from './framework/TestParser.js';
import { TestExecutor } from './framework/TestExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main test runner for ConArtist integration tests
 */
class TestRunner {
  constructor() {
    this.parser = new TestParser();
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * Run all tests
   */
  async run(options = {}) {
    console.log('🎯 ConArtist Integration Test Runner');
    console.log('=====================================\n');

    const config = {
      headless: options.headless !== false,
      slowMo: options.slowMo || 0,
      timeout: options.timeout || 30000,
      shortDrawTime: options.shortDrawTime || 5,
      shortVoteTime: options.shortVoteTime || 5,
      ...options
    };

    console.log('⚙️ Configuration:');
    console.log(`   Headless: ${config.headless}`);
    console.log(`   Slow Motion: ${config.slowMo}ms`);
    console.log(`   Timeout: ${config.timeout}ms`);
    console.log(`   Draw Timer: ${config.shortDrawTime}s`);
    console.log(`   Vote Timer: ${config.shortVoteTime}s\n`);

    try {
      // Parse test files
      const testsDir = path.join(__dirname, '..', 'tests');
      const testCases = await this.parser.parseTestDirectory(testsDir);
      
      if (testCases.length === 0) {
        console.log('⚠️ No test cases found in tests directory');
        return;
      }

      console.log(`📋 Found ${testCases.length} test cases\n`);

      // Execute each test case
      const executor = new TestExecutor(config);
      
      for (const testCase of testCases) {
        // Validate test case
        const validationErrors = this.parser.validateTestCase(testCase);
        if (validationErrors.length > 0) {
          console.error(`❌ Invalid test case: ${testCase.name}`);
          validationErrors.forEach(error => console.error(`   ${error}`));
          this.results.failed++;
          this.results.errors.push({
            testCase: testCase.name,
            error: validationErrors.join(', ')
          });
          continue;
        }

        // Convert to executable actions
        const actions = this.parser.convertToActions(testCase);
        
        // Execute test case
        const result = await executor.executeTestCase(testCase, actions);
        
        this.results.total++;
        if (result.success) {
          this.results.passed++;
        } else {
          this.results.failed++;
          this.results.errors.push({
            testCase: testCase.name,
            error: result.error
          });
        }

        // Add delay between tests
        await this.wait(1000);
      }

      // Print summary
      this.printSummary();

    } catch (error) {
      console.error('💥 Test runner failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }

  /**
   * Print test results summary
   */
  printSummary() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    
    if (this.results.errors.length > 0) {
      console.log('\n💥 Failed Tests:');
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.testCase}`);
        console.log(`   Error: ${error.error}`);
      });
    }

    const successRate = this.results.total > 0 ? 
      Math.round((this.results.passed / this.results.total) * 100) : 0;
    
    console.log(`\n🎯 Success Rate: ${successRate}%`);
    
    if (this.results.failed > 0) {
      process.exit(1);
    }
  }

  /**
   * Wait for specified duration
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--headless':
        options.headless = true;
        break;
      case '--headed':
        options.headless = false;
        break;
      case '--slow-mo':
        options.slowMo = parseInt(args[++i]) || 0;
        break;
      case '--timeout':
        options.timeout = parseInt(args[++i]) || 30000;
        break;
      case '--draw-time':
        options.shortDrawTime = parseInt(args[++i]) || 5;
        break;
      case '--vote-time':
        options.shortVoteTime = parseInt(args[++i]) || 5;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

function printHelp() {
  console.log(`
ConArtist Integration Test Runner

Usage: node src/runner.js [options]

Options:
  --headless          Run browsers in headless mode (default)
  --headed            Run browsers with visible UI
  --slow-mo <ms>      Add delay between actions (default: 0)
  --timeout <ms>      Test timeout in milliseconds (default: 30000)
  --draw-time <sec>   Drawing phase duration in seconds (default: 5)
  --vote-time <sec>   Voting phase duration in seconds (default: 5)
  --help, -h          Show this help message

Examples:
  node src/runner.js                    # Run all tests headless
  node src/runner.js --headed           # Run with visible browsers
  node src/runner.js --slow-mo 500      # Add 500ms delay between actions
  node src/runner.js --draw-time 3      # Use 3 second drawing timer
`);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  const runner = new TestRunner();
  runner.run(options).catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}
