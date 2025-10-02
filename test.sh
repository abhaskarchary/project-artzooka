#!/bin/bash

# ConArtist Integration Test Runner Script

set -e

echo "🧪 ConArtist Integration Tests"
echo "=============================="

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed"
    exit 1
fi

# Function to check if services are running
check_services() {
    echo "🔍 Checking if services are running..."
    
    # Check if main services are up
    if ! docker-compose ps | grep -q "Up"; then
        echo "❌ Docker Compose services are not running"
        echo "Please run 'docker-compose up -d' first"
        exit 1
    fi
    
    # Check frontend health
    if ! curl -s http://localhost > /dev/null; then
        echo "❌ Frontend is not accessible at http://localhost"
        exit 1
    fi
    
    # Check backend health
    if ! curl -s http://localhost:8080/actuator/health > /dev/null; then
        echo "❌ Backend is not accessible at http://localhost:8080"
        exit 1
    fi
    
    echo "✅ All services are running"
}

# Function to run tests
run_tests() {
    echo "🚀 Running integration tests..."
    
    # Build and run integration tests
    docker-compose --profile testing build integration-tests
    docker-compose --profile testing run --rm integration-tests
}

# Function to run tests in development mode (with visible browser)
run_tests_dev() {
    echo "🚀 Running integration tests in development mode..."
    
    cd integrationTests
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        npm install
        npx playwright install
    fi
    
    # Run tests with visible browser
    npm test -- --headed --slow-mo 500
}

# Function to clean up test containers
cleanup() {
    echo "🧹 Cleaning up test containers..."
    docker-compose --profile testing down
}

# Parse command line arguments
case "${1:-}" in
    "dev")
        check_services
        run_tests_dev
        ;;
    "clean")
        cleanup
        ;;
    "")
        check_services
        run_tests
        ;;
    *)
        echo "Usage: $0 [dev|clean]"
        echo ""
        echo "Commands:"
        echo "  (no args)  Run integration tests in Docker"
        echo "  dev        Run tests locally with visible browser"
        echo "  clean      Clean up test containers"
        echo ""
        echo "Examples:"
        echo "  ./test.sh           # Run tests in Docker"
        echo "  ./test.sh dev       # Run tests locally with browser UI"
        echo "  ./test.sh clean     # Clean up"
        exit 1
        ;;
esac
