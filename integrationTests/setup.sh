#!/bin/bash

# Setup script for ConArtist Integration Tests

set -e

echo "🔧 Setting up ConArtist Integration Tests"
echo "========================================"

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install Playwright browsers
echo "🎭 Installing Playwright browsers..."
npx playwright install

# Create test-images directory if it doesn't exist
if [ ! -d "test-images" ]; then
    echo "🖼️ Creating test images directory..."
    mkdir -p test-images
fi

# Make runner executable
chmod +x src/runner.js

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "🚀 Quick start:"
echo "   1. Start the application: docker-compose up -d"
echo "   2. Run tests: npm test"
echo "   3. Run with visible browser: npm test -- --headed"
echo ""
echo "📚 More options:"
echo "   npm test -- --help"
