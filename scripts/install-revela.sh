#!/bin/bash

# =============================================================================
# Revela (move-decompiler) Installation Script
# High-quality Move bytecode decompiler for Sui
#
# Usage:
#   ./install-revela.sh          # Interactive install
#   ./install-revela.sh --force  # Force reinstall without prompts
#   ./install-revela.sh --check  # Check if installed, exit 0 if yes
# =============================================================================

set -e

# Parse arguments
FORCE_INSTALL=false
CHECK_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force|-f)
            FORCE_INSTALL=true
            shift
            ;;
        --check|-c)
            CHECK_ONLY=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          Revela (move-decompiler) Installer                   ║"
echo "║          High-quality Move bytecode decompiler                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if already installed
if command -v move-decompiler &> /dev/null; then
    EXISTING_VERSION=$(move-decompiler --version 2>/dev/null || echo "unknown version")

    # Check-only mode: just report and exit
    if [[ "$CHECK_ONLY" == true ]]; then
        print_success "move-decompiler is installed: $EXISTING_VERSION"
        exit 0
    fi

    print_success "move-decompiler is already installed: $EXISTING_VERSION"

    # Force mode: skip prompt
    if [[ "$FORCE_INSTALL" == true ]]; then
        print_warning "Force reinstall requested..."
    else
        echo ""
        read -p "Do you want to reinstall? [y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Installation skipped."
            exit 0
        fi
    fi
    echo ""
else
    # Check-only mode: not installed
    if [[ "$CHECK_ONLY" == true ]]; then
        print_error "move-decompiler is not installed"
        exit 1
    fi
fi

# Check if Git is installed
print_step "Checking prerequisites..."

if ! command -v git &> /dev/null; then
    print_error "Git is required but not installed. Please install git first."
    exit 1
fi
print_success "Git found: $(git --version)"

if ! command -v cargo &> /dev/null; then
    print_warning "Cargo not found. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    print_success "Rust installed"
else
    print_success "Cargo found: $(cargo --version)"
fi

print_success "Prerequisites OK"

# Get project root directory (where this script lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REVELA_DIR="$PROJECT_ROOT/sui-revela"

# Clone or update revela
if [[ -d "$REVELA_DIR" ]]; then
    print_step "sui-revela directory exists, pulling latest..."
    cd "$REVELA_DIR"
    git pull --ff-only || print_warning "Could not pull updates, using existing version"
else
    print_step "Cloning sui-revela repository..."
    git clone --depth 1 https://github.com/verichains/revela.git "$REVELA_DIR"
    cd "$REVELA_DIR"
fi

# Build
print_step "Building move-decompiler (this may take several minutes)..."
cd "$REVELA_DIR/external-crates/move"
cargo build --release -p move-decompiler

# Find the binary
BINARY_PATH="$REVELA_DIR/external-crates/move/target/release/move-decompiler"

if [[ ! -f "$BINARY_PATH" ]]; then
    print_error "Build failed: binary not found at $BINARY_PATH"
    exit 1
fi

# Determine install location
INSTALL_DIR="$HOME/.cargo/bin"
if [[ ! -d "$INSTALL_DIR" ]]; then
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"
fi

print_step "Installing binary to $INSTALL_DIR..."
cp "$BINARY_PATH" "$INSTALL_DIR/move-decompiler"
chmod +x "$INSTALL_DIR/move-decompiler"

print_success "move-decompiler installed to $INSTALL_DIR"
print_success "Source kept at: $REVELA_DIR"

# Verify installation
print_step "Verifying installation..."

if command -v move-decompiler &> /dev/null; then
    DECOMPILER_VERSION=$(move-decompiler --version 2>/dev/null || echo "installed")
    print_success "move-decompiler $DECOMPILER_VERSION"
else
    print_warning "move-decompiler installed but not in PATH"
    print_warning "Add this to your shell config:"
    echo ""
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
    echo ""
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    Installation Complete!                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Usage:"
echo "  move-decompiler -b <bytecode_file.mv> [more_files...]"
echo ""
echo "Example:"
echo "  move-decompiler -b module.mv"
echo ""
echo "Note: The CLI decompiles .mv bytecode files."
echo "Use the web UI to fetch bytecode from Sui network automatically."
echo ""
