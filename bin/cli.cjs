#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// This CLI runs when users execute: npx dolphin-client
// It sets up the VS Code HTML Custom Data configurations for autocomplete automatically!

try {
    const hostRoot = process.cwd();
    const vscodeDir = path.join(hostRoot, '.vscode');

    console.log('🐬 [Dolphin Client CLI] Setting up VS Code autocomplete...');

    // 1. Ensure .vscode directory exists in user's current directory
    if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir, { recursive: true });
        console.log('   - Created .vscode directory.');
    }

    // 2. Copy the dolphin-tags.json file from the npm package to the user's project
    const sourceTags = path.resolve(__dirname, '../.vscode/dolphin-tags.json');
    const destTags = path.join(vscodeDir, 'dolphin-tags.json');

    if (fs.existsSync(sourceTags)) {
        fs.copyFileSync(sourceTags, destTags);
        console.log('   - Copied dolphin-tags.json config.');
    } else {
        console.warn('   ⚠️  Warning: dolphin-tags.json source file not found.');
    }

    // 3. Register the path in the user's project settings.json
    const settingsPath = path.join(vscodeDir, 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
        try {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } catch (e) {
            settings = {};
        }
    }

    if (!settings['html.customData']) {
        settings['html.customData'] = [];
    }

    const relativePath = '.vscode/dolphin-tags.json';
    if (!settings['html.customData'].includes(relativePath)) {
        settings['html.customData'].push(relativePath);
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        console.log('   - Registered custom HTML data in settings.json.');
    } else {
        console.log('   - dolphin-tags.json was already registered.');
    }

    console.log('\n\x1b[36m%s\x1b[0m', '✅ [Success] VS Code autocomplete successfully set up for Dolphin Client!');
    console.log('\x1b[33m%s\x1b[0m', '👉 Tip: Run "Developer: Reload Window" in VS Code to activate autocomplete.');
} catch (err) {
    console.error('❌ [Error] Failed to set up VS Code autocomplete:', err.message);
}
