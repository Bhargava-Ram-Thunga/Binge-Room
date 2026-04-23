#!/bin/bash

# 1. Install missing dependencies (zstd is mandatory for Ollama extraction)
sudo apt-get update && sudo apt-get install -y zstd pciutils lshw

# 2. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 3. Start Ollama Server (Background)
# We use 'nohup' to ensure it stays alive even if the shell flickers
nohup ollama serve > /tmp/ollama.log 2>&1 &
sleep 5

# 4. Install Claude Code & Skills
npm install -g @anthropic-ai/claude-code

# 5. Install Superpowers & Skills
npx antigravity-awesome-skills --claude
npx skills add OthmanAdi/planning-with-files
npx skills add anthropics/claude-code --skill frontend-design
npx skills add anthropics/claude-code --skill simplify
npx skills add anthropics/claude-code --skill batch
npx skills add addyosmani/web-quality-skills
npx skills add unicodeveloper/shannon

echo "✅ AI Environment Loaded."
echo "To start coding, run: ollama launch claude --model gemma4:31b-cloud"

# 6. Install Superpowers Plugin automatically via Claude CLI
echo "Installing Superpowers v5..."
# Create the config directory if it doesn't exist
mkdir -p ~/.claude/plugins
# Force Claude to run the plugin install commands and exit
claude -c "/plugin marketplace add obra/superpowers-marketplace"
claude -c "/plugin install superpowers@superpowers-marketplace --global"

echo "✅ Superpowers installed and ready."