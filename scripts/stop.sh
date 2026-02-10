#!/bin/bash

# Stop serve (port 3456) and web frontend (port 3000)

echo "Stopping services..."

# Kill process on port 3456 (local server)
if lsof -ti:3456 > /dev/null 2>&1; then
  kill $(lsof -ti:3456) 2>/dev/null
  echo "✓ Stopped local server (port 3456)"
else
  echo "- Local server not running (port 3456)"
fi

# Kill process on port 3000 (Next.js frontend)
if lsof -ti:3000 > /dev/null 2>&1; then
  kill $(lsof -ti:3000) 2>/dev/null
  echo "✓ Stopped web frontend (port 3000)"
else
  echo "- Web frontend not running (port 3000)"
fi

echo "Done."
