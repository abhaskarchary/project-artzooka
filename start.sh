#!/bin/bash

# Artzooka Docker Compose Startup Script

set -e

echo "🎨 Starting Artzooka..."
echo "======================="

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Start services
echo "🚀 Starting all services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service status
echo "📊 Service Status:"
docker-compose ps

# Test backend health
echo ""
echo "🔍 Testing backend health..."
if curl -s http://localhost:8080/actuator/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy!"
else
    echo "⚠️  Backend may still be starting up. Check logs with: docker-compose logs backend"
fi

# Test frontend
echo ""
echo "🔍 Testing frontend..."
if curl -s http://localhost > /dev/null 2>&1; then
    echo "✅ Frontend is accessible!"
else
    echo "⚠️  Frontend may still be starting up. Check logs with: docker-compose logs frontend"
fi

echo ""
echo "🎉 Artzooka is starting up!"
echo "📱 Open your browser and go to: http://localhost"
echo "🔧 Backend API available at: http://localhost:8080"
echo ""
echo "📋 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart: docker-compose restart"
echo ""
echo "🐛 If you encounter issues, check the troubleshooting section in README.md"
