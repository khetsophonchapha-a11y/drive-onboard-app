#!/bin/bash

# Define ports to clean
PORTS=(9002 8787)
NEXT_CACHE_DIR=".next"

echo "🧹 Cleaning up ports: ${PORTS[*]}..."
for PORT in "${PORTS[@]}"; do
  # Find PID using lsof and kill it
  PID=$(lsof -ti:$PORT)
  if [ -n "$PID" ]; then
    echo "Killing process $PID on port $PORT"
    kill -9 $PID 2>/dev/null
  fi
done

if [ -d "$NEXT_CACHE_DIR" ]; then
  echo "🗑️ Clearing stale Next.js cache in $NEXT_CACHE_DIR..."
  rm -rf "$NEXT_CACHE_DIR"
fi

echo "🚀 Starting Services..."

# Start Next.js (Background)
echo "Starting Next.js..."
npm run dev > .next-server.log 2>&1 &
NEXT_PID=$!

# Start Cloudflare Worker (Backend) with specific config
# Use --remote to connect to Real D1/R2
if [ "$USE_REMOTE" = true ]; then
  npx wrangler dev -c wrangler.worker.toml --remote --port 8787 > /dev/null 2>&1 &
  WORKER_PID=$!
else
   npx wrangler dev -c wrangler.worker.toml --port 8787 > /dev/null 2>&1 &
   WORKER_PID=$!
fi

echo "Services started with PIDs: Next.js=$NEXT_PID, Worker=$WORKER_PID"

echo "⏳ Waiting for Next.js to serve HTTP on localhost:9002..."
# Wait up to 60 seconds
TIMEOUT=60
COUNTER=0
until curl -sf "http://localhost:9002/" > /dev/null; do
  sleep 1
  COUNTER=$((COUNTER+1))
  if [ $COUNTER -ge $TIMEOUT ]; then
    echo "❌ Timeout waiting for Next.js HTTP server to become ready."
    kill $NEXT_PID $WORKER_PID 2>/dev/null
    exit 1
  fi
done

echo "✅ Server is ready! Opening browser..."
# Open browser (macOS)
open "http://localhost:9002"

# Trap Ctrl+C to kill all
cleanup() {
  echo ""
  echo "🛑 Stopping all services..."
  kill $NEXT_PID $WORKER_PID 2>/dev/null
  exit
}
trap cleanup SIGINT

# Keep script running
echo "Press Ctrl+C to stop."
wait
