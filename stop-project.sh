#!/bin/bash

echo "🛑 Stopping Galina Legal Assistant..."

# Stop all Node.js processes related to the project
echo "🔄 Stopping API servers..."
pkill -f "node.*index.js" 2>/dev/null && echo "✅ API servers stopped" || echo "ℹ️  No API servers were running"

echo "🔄 Stopping frontend servers..."
pkill -f "vite" 2>/dev/null && echo "✅ Frontend servers stopped" || echo "ℹ️  No frontend servers were running"

echo "🔄 Stopping npm processes..."
pkill -f "npm.*dev" 2>/dev/null && echo "✅ NPM processes stopped" || echo "ℹ️  No npm processes were running"

# Wait a moment for processes to terminate
sleep 2

# Check if ports are free now
echo ""
echo "📋 Checking port status:"
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Port 3000 still in use"
else
    echo "✅ Port 3000 is free"
fi

if lsof -Pi :3004 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Port 3004 still in use"
else
    echo "✅ Port 3004 is free"
fi

echo ""
echo "🎉 All project servers have been stopped!"
