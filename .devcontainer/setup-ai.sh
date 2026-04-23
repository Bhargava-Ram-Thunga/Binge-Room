#!/bin/bash
set -e

CONFIG_FILE=".devcontainer/skills.json"

# Bootstrap: Ensure jq and curl are present to read the config
echo "🚀 Bootstrapping setup tools..."
sudo apt-get update && sudo apt-get install -y jq curl

echo "📦 Installing system dependencies..."
DEPS=$(jq -r '.system_dependencies[]' "$CONFIG_FILE")
for dep in $DEPS; do
    if ! dpkg -l | grep -q " $dep "; then
        echo "Installing $dep..."
        sudo apt-get install -y "$dep"
    else
        echo "✅ $dep already installed"
    fi
done

echo "📦 Installing global npm packages..."
PKGS=$(jq -r '.global_npm_packages[]' "$CONFIG_FILE")
for pkg in $PKGS; do
    if ! npm list -g "$pkg" > /dev/null 2>&1; then
        echo "Installing $pkg..."
        npm install -g "$pkg"
    else
        echo "✅ $pkg already installed"
    fi
done
