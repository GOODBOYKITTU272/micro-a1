#!/bin/bash
# ==============================================================================
# Helper script to launch Google Chrome on macOS with remote debugging enabled.
# This allows Playwright to connect to your real Chrome session where you
# are already logged into LinkedIn.
# ==============================================================================

CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=9222

if [ ! -f "$CHROME_PATH" ]; then
  echo "❌ Google Chrome was not found at: $CHROME_PATH"
  exit 1
fi

echo "🚀 Launching Google Chrome with remote debugging on port $PORT..."
echo "ℹ️  Note: If Chrome is already running, please quit Chrome completely (Cmd + Q) first,"
echo "   or run this script to launch a dedicated debugging instance."
echo ""

# Launch Chrome with remote debugging and preserve session
"$CHROME_PATH" --remote-debugging-port=$PORT --restore-last-session "$@" >/dev/null 2>&1 &

sleep 2

# Check if port 9222 is responding
if curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
  echo "✅ Chrome is ready with Remote Debugging on port $PORT!"
  echo "👉 You can now run: npm run bot"
else
  echo "⚠️ Chrome was started. If it connected to an existing Chrome instance without debugging,"
  echo "   quit Chrome completely (Cmd + Q) and run this script again."
fi
