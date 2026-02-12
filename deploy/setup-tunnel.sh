#!/usr/bin/env bash
set -euo pipefail

# MoveWhisperer - Cloudflare Tunnel + Server Setup
# Run on your local machine to set up public access via api.dolphinslab.cc
#
# Prerequisites:
#   - pnpm installed
#   - dolphinslab.cc domain on Cloudflare
#
# Usage:
#   chmod +x deploy/setup-tunnel.sh
#   ./deploy/setup-tunnel.sh

DOMAIN="api.dolphinslab.cc"
TUNNEL_NAME="movewhisperer"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== MoveWhisperer Public Server Setup ==="
echo ""

# --- Step 1: Install cloudflared ---
if command -v cloudflared &>/dev/null; then
    echo "[OK] cloudflared is installed: $(cloudflared --version)"
else
    echo "[*] Installing cloudflared..."
    if [[ "$(uname)" == "Linux" ]]; then
        curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
        echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
            | sudo tee /etc/apt/sources.list.d/cloudflared.list
        sudo apt-get update && sudo apt-get install -y cloudflared
    elif [[ "$(uname)" == "Darwin" ]]; then
        brew install cloudflared
    else
        echo "[!] Please install cloudflared manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
        exit 1
    fi
    echo "[OK] cloudflared installed"
fi

# --- Step 2: Login to Cloudflare ---
if [[ -f "$HOME/.cloudflared/cert.pem" ]]; then
    echo "[OK] Already logged in to Cloudflare"
else
    echo "[*] Logging in to Cloudflare (browser will open)..."
    echo "    Select the zone for: dolphinslab.cc"
    cloudflared tunnel login
fi

# --- Step 3: Create tunnel ---
EXISTING_TUNNEL=$(cloudflared tunnel list --output json 2>/dev/null | grep -o "\"id\":\"[^\"]*\"" | head -1 | grep -o '[0-9a-f-]\{36\}' || true)
# Check if our named tunnel exists
TUNNEL_ID=$(cloudflared tunnel list --output json 2>/dev/null \
    | python3 -c "import sys,json; tunnels=json.load(sys.stdin); print(next((t['id'] for t in tunnels if t['name']=='$TUNNEL_NAME'), ''))" 2>/dev/null || true)

if [[ -n "$TUNNEL_ID" ]]; then
    echo "[OK] Tunnel '$TUNNEL_NAME' already exists: $TUNNEL_ID"
else
    echo "[*] Creating tunnel '$TUNNEL_NAME'..."
    cloudflared tunnel create "$TUNNEL_NAME"
    TUNNEL_ID=$(cloudflared tunnel list --output json 2>/dev/null \
        | python3 -c "import sys,json; tunnels=json.load(sys.stdin); print(next((t['id'] for t in tunnels if t['name']=='$TUNNEL_NAME'), ''))" 2>/dev/null || true)
    echo "[OK] Tunnel created: $TUNNEL_ID"
fi

if [[ -z "$TUNNEL_ID" ]]; then
    echo "[!] Failed to get tunnel ID. Run manually:"
    echo "    cloudflared tunnel create $TUNNEL_NAME"
    exit 1
fi

# --- Step 4: Write config ---
CRED_FILE="$HOME/.cloudflared/${TUNNEL_ID}.json"
CONFIG_FILE="$HOME/.cloudflared/config.yml"

if [[ ! -f "$CRED_FILE" ]]; then
    echo "[!] Credentials file not found: $CRED_FILE"
    echo "    This should have been created by 'cloudflared tunnel create'"
    exit 1
fi

cat > "$CONFIG_FILE" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CRED_FILE}

ingress:
  - hostname: ${DOMAIN}
    service: http://localhost:3456
    originRequest:
      connectTimeout: 30s
      noTLSVerify: true
  - service: http_status:404
EOF

echo "[OK] Config written to $CONFIG_FILE"

# --- Step 5: Add DNS route ---
echo "[*] Adding DNS route: $DOMAIN -> tunnel..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN" 2>/dev/null || true
echo "[OK] DNS route configured"

# --- Step 6: Install systemd services ---
echo ""
echo "[*] Installing systemd services..."

sudo cp "$PROJECT_DIR/deploy/movewhisperer-server.service" /etc/systemd/system/movewhisperer.service
sudo cp "$PROJECT_DIR/deploy/cloudflared.service" /etc/systemd/system/cloudflared-movewhisperer.service
sudo systemctl daemon-reload

echo "[OK] Systemd services installed"

# --- Step 7: Enable and start ---
echo ""
echo "[*] Starting services..."
sudo systemctl enable --now movewhisperer
sudo systemctl enable --now cloudflared-movewhisperer

echo ""
echo "=== Setup Complete ==="
echo ""
echo "  MoveWhisperer Server: sudo systemctl status movewhisperer"
echo "  Cloudflare Tunnel:    sudo systemctl status cloudflared-movewhisperer"
echo "  Logs:                 sudo journalctl -u movewhisperer -f"
echo "                        sudo journalctl -u cloudflared-movewhisperer -f"
echo ""
echo "  Public URL:           https://${DOMAIN}"
echo "  Health check:         curl https://${DOMAIN}/health"
echo ""
echo "  To update web UI, set in web/.env:"
echo "    NEXT_PUBLIC_SERVER_URL=https://${DOMAIN}"
echo "  Then rebuild and deploy."
