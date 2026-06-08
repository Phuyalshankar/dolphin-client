const path = require('path');
const fs = require('fs');

// This script runs automatically after npm install dolphin-client.
// It sets up the VS Code Custom HTML Data configuration in the host project's .vscode folder
// so autocomplete for Dolphin Client attributes works instantly out-of-the-box!

try {
    const currentPath = __dirname;
    // Check if we are inside a node_modules folder (production installation)
    if (currentPath.includes('node_modules')) {
        // Resolve host project root (e.g. node_modules/dolphin-client/scripts -> hostRoot)
        const hostRoot = path.resolve(__dirname, '../../..');
        const vscodeDir = path.join(hostRoot, '.vscode');

        // 1. Ensure the host's .vscode directory exists
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
            console.log('[Dolphin Client] Created .vscode directory in project root.');
        }

        // 2. Copy the dolphin-tags.json file to the host's .vscode folder
        const sourceTags = path.resolve(__dirname, '../.vscode/dolphin-tags.json');
        const destTags = path.join(vscodeDir, 'dolphin-tags.json');
        if (fs.existsSync(sourceTags)) {
            fs.copyFileSync(sourceTags, destTags);
            console.log('[Dolphin Client] Copied HTML custom data configuration to .vscode/dolphin-tags.json');
        }

        // 3. Update the host's settings.json to include the custom data file path
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
            console.log('[Dolphin Client] Registered dolphin-tags.json in .vscode/settings.json');
        }
        
        console.log('\x1b[36m%s\x1b[0m', '🐬 [Dolphin Client] VS Code Autocomplete successfully configured!');
        console.log('\x1b[33m%s\x1b[0m', '👉 Note: Please run "Developer: Reload Window" in VS Code to activate suggestions.');
    }
} catch (err) {
    console.warn('[Dolphin Client] Failed to auto-configure VS Code autocomplete:', err.message);
}
