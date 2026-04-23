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

echo "🔌 Installing plugins..."
# Extract plugin IDs
PLUGINS=$(jq -r '.plugins[].id' "$CONFIG_FILE")
for plugin in $PLUGINS; do
    echo "Ensuring plugin $plugin..."
    claude -c "/plugin marketplace add $plugin" || true
    claude -c "/plugin install $plugin --global" || true
done

# ... existing code ...
echo "🎓 Installing skills..."
SKILLS=$(jq -r '.skills[]' "$CONFIG_FILE")
for skill in $SKILLS; do
    if [[ "$skill" == *":"* ]]; then
        PROVIDER="${skill%%:*}"
        SKILL_NAME="${skill#*:}"
        echo "Installing $SKILL_NAME from $PROVIDER..."
        npx skills add "$PROVIDER" --skill "$SKILL_NAME"
    else
        echo "Installing skill collection $skill..."
        npx skills add "$skill"
    fi
done

echo "⚙️ Configuring Runtime..."
MODEL=$(jq -r '.runtime.ollama_model' "$CONFIG_FILE")
CMD=$(jq -r '.runtime.ollama_serve_command' "$CONFIG_FILE")

if ! command -v ollama &> /dev/null; then
    curl -fsSL https://ollama.com/install.sh | sh
fi

# Start server if not running
if ! pgrep -x "ollama" > /dev/null; then
    eval "$CMD"
    sleep 5
fi

echo "Pulling model $MODEL..."
ollama pull "$MODEL"

echo "🔍 Verifying environment..."
echo "--------------------------------------"
printf "%-20s | %-10s\n" "Component" "Status"
echo "--------------------------------------"

# System Deps Check
ALL_DEPS_OK=true
for dep in $(jq -r '.system_dependencies[]' "$CONFIG_FILE"); do
    if dpkg -l | grep -q " $dep "; then
        printf "%-20s | ✅ OK\n" "$dep"
    else
        printf "%-20s | ❌ MISSING\n" "$dep"
        ALL_DEPS_OK=false
    fi
done

# Skill Audit
echo "Checking skills..."
SKILL_LIST=$(claude -c "list skills" 2>/dev/null || echo "")
for skill in $(jq -r '.skills[]' "$CONFIG_FILE"); do
    CLEAN_SKILL="${skill%%:*}"
    if echo "$SKILL_LIST" | grep -iq "$CLEAN_SKILL"; then
        printf "%-20s | ✅ OK\n" "$skill"
    else
        printf "%-20s | ❌ MISSING\n" "$skill"
    fi
done
echo "--------------------------------------"

if [ "$ALL_DEPS_OK" = true ]; then
    echo "✅ AI Environment is fully synchronized."
else
    echo "⚠️ Environment synchronization incomplete."
fi

