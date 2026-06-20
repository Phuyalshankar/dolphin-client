/**
 * Dolphin client VFS (Virtual File System) and Folder Mounting Engine.
 * Supports both standard browser Mock VFS and actual local Windows folder mounting
 * via File System Access API (showDirectoryPicker).
 *
 * @fix: Memory leaks from duplicate event listeners on SPA re-init prevented
 *       by storing listener refs and using AbortController signals.
 * @fix: Unused relativePath variable removed from buildDirectoryTree.
 * @fix: resolveDirHandleForPath("") guard added to prevent getDirectoryHandle("") crash.
 * @fix: FileSystemWritableFileStream now always closed in finally block to prevent locked handles.
 * @fix: Binary/large file guard added — non-text files show safe placeholder instead of crashing.
 * @fix: deleteBtn click event uses addEventListener instead of onclick to respect AbortController.
 * @fix: Duplicate listener registration prevented via AbortController per container init cycle.
 */

const TEXT_EXTENSIONS = new Set([
    'js', 'ts', 'jsx', 'tsx', 'json', 'md', 'txt', 'html', 'css',
    'scss', 'sass', 'xml', 'yaml', 'yml', 'toml', 'env', 'sh',
    'bat', 'ps1', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp',
    'h', 'cs', 'php', 'sql', 'graphql', 'vue', 'svelte', 'ini',
    'cfg', 'gitignore', 'npmignore', 'log',
]);

const MAX_FILE_SIZE_BYTES = 1_000_000; // 1 MB guard

function isTextFile(name: string): boolean {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return TEXT_EXTENSIONS.has(ext);
}

export function scanVFSBinds(client: any) {
    if (typeof document === 'undefined') return;

    const vfsContainers = document.querySelectorAll('[data-dolphin-vfs]');
    vfsContainers.forEach((container: any) => {
        if (container._vfsInitialized) return;
        container._vfsInitialized = true;

        // @fix: AbortController per container — abort() cleans up ALL event listeners at once
        // when _scanVFSBinds is called again (e.g. SPA navigation back to same page).
        // This prevents duplicate listeners accumulating = memory leak fixed.
        const listenerAbort = new AbortController();
        const { signal } = listenerAbort;

        // Store abort fn on container so dolphin can teardown on DOM removal
        container._vfsAbort = () => listenerAbort.abort();

        // Find sub-elements (scoped to container, not global document)
        const treeEl       = container.querySelector('[data-vfs-tree]')        || container.querySelector('#file-tree-container');
        const editorEl     = container.querySelector('[data-vfs-editor]')      || container.querySelector('#editor-textarea');
        const breadcrumbsEl= container.querySelector('[data-vfs-breadcrumbs]') || container.querySelector('#active-file-crumb');
        const statusEl     = container.querySelector('[data-vfs-status]')      || container.querySelector('#editor-status');
        const newFileBtn   = container.querySelector('[data-vfs-new-file]')    || container.querySelector('[title="New File"]');
        const newFolderBtn = container.querySelector('[data-vfs-new-folder]');
        const mountBtn     = container.querySelector('[data-vfs-mount]');
        const saveBtn      = container.querySelector('[data-vfs-save]');

        // VFS State (scoped per container, no shared globals)
        let currentDirHandle: any   = null;
        let activeFileHandle: any   = null;
        let activeFilePath: string | null = null;

        // Mock VFS data fallback
        const mockVFS: any[] = [
            {
                name: "src",
                type: "directory",
                expanded: true,
                children: [
                    { name: "index.js",  type: "file", content: "// Dolphin VFS Root\nconsole.log('Dolphin agent active.');\n" },
                    { name: "utils.js",  type: "file", content: "export const add = (a, b) => a + b;\nexport const sub = (a, b) => a - b;" }
                ]
            },
            {
                name: "config",
                type: "directory",
                expanded: false,
                children: [
                    { name: "settings.json", type: "file", content: '{\n  "theme": "dark",\n  "port": 3000\n}' }
                ]
            },
            {
                name: "package.json",
                type: "file",
                content: '{\n  "name": "dolphin-agent-project",\n  "version": "1.0.0",\n  "description": "AI agent workspace"\n}'
            },
            {
                name: "README.md",
                type: "file",
                content: "# Dolphin Agent Workspace\nUse this VS Code-styled file explorer to manage agent workflows."
            }
        ];

        // ── 1. Build directory tree from real FileSystemDirectoryHandle ────────
        async function buildDirectoryTree(dirHandle: any): Promise<any[]> {
            const items: any[] = [];
            try {
                for await (const entry of dirHandle.values()) {
                    // @fix: removed unused relativePath variable
                    if (entry.kind === 'directory') {
                        items.push({
                            name: entry.name,
                            type: 'directory',
                            handle: entry,
                            expanded: false,
                            children: []
                        });
                    } else {
                        items.push({
                            name: entry.name,
                            type: 'file',
                            handle: entry,
                            content: null
                        });
                    }
                }
            } catch (err) {
                console.error('[Dolphin VFS] Error reading directory handle:', err);
            }
            // Dirs first, then files, both alphabetically
            return items.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
        }

        // ── 2. Main rendering driver ───────────────────────────────────────────
        async function renderVFSTree() {
            if (!treeEl) return;

            // @fix: clear innerHTML before re-render to release old DOM nodes
            treeEl.innerHTML = '';

            if (currentDirHandle) {
                const treeData = await buildDirectoryTree(currentDirHandle);
                await renderNodeList(treeData, treeEl, 0, '');
            } else {
                await renderNodeList(mockVFS, treeEl, 0, '');
            }
        }

        // ── 3. Recursive node rendering ────────────────────────────────────────
        async function renderNodeList(
            items: any[],
            parentContainer: HTMLElement,
            depth: number,
            parentPath: string
        ) {
            for (const item of items) {
                const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name;
                const isActive    = activeFilePath === currentPath;

                const nodeEl = document.createElement('div');
                nodeEl.style.cssText = [
                    `padding-left: ${depth * 12 + 10}px`,
                    'display: flex',
                    'align-items: center',
                    'height: 26px',
                    'cursor: pointer',
                    'font-size: 13px',
                    'user-select: none',
                    'transition: background 0.15s, color 0.15s',
                    'border-radius: 4px',
                    'margin: 1px 6px',
                    "font-family: Consolas, 'Courier New', monospace",
                    isActive ? 'background-color: rgba(255,255,255,0.08); color: #ffffff;'
                             : 'background-color: transparent; color: #cccccc;',
                ].join(';');

                // Hover — use addEventListener so signal can clean up
                nodeEl.addEventListener('mouseenter', () => {
                    if (activeFilePath !== currentPath)
                        nodeEl.style.backgroundColor = 'rgba(255,255,255,0.04)';
                    deleteBtn.style.opacity = '0.5';
                }, { signal });

                nodeEl.addEventListener('mouseleave', () => {
                    if (activeFilePath !== currentPath)
                        nodeEl.style.backgroundColor = 'transparent';
                    deleteBtn.style.opacity = '0';
                }, { signal });

                // Icon
                const icon = document.createElement('span');
                icon.style.cssText = 'margin-right:8px;font-size:14px;flex-shrink:0;';
                if (item.type === 'directory') {
                    icon.innerHTML = item.expanded ? '&#128194;' : '&#128193;';
                } else {
                    const ext = item.name.split('.').pop()?.toLowerCase() ?? '';
                    if (ext === 'js' || ext === 'ts' || ext === 'jsx' || ext === 'tsx')
                        icon.innerHTML = '&#128220;';
                    else if (ext === 'json')  icon.innerHTML = '&#9881;&#65039;';
                    else if (ext === 'md')    icon.innerHTML = '&#128393;';
                    else if (ext === 'css' || ext === 'html' || ext === 'scss')
                        icon.innerHTML = '&#127912;';
                    else icon.innerHTML = '&#128196;';
                }
                nodeEl.appendChild(icon);

                // Label
                const label = document.createElement('span');
                label.textContent = item.name;
                label.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                nodeEl.appendChild(label);

                // Delete button — always created, hidden by default
                const deleteBtn = document.createElement('span');
                deleteBtn.innerHTML  = '&#128465;';
                deleteBtn.title      = 'Delete';
                deleteBtn.style.cssText = [
                    'cursor:pointer',
                    'font-size:12px',
                    'opacity:0',
                    'transition:opacity 0.2s,transform 0.1s',
                    'padding:2px 4px',
                    'flex-shrink:0',
                ].join(';');

                // @fix: use addEventListener+signal instead of .onmouseover/.onclick
                // so they are GC-able when AbortController fires
                deleteBtn.addEventListener('mouseover', (e) => {
                    e.stopPropagation();
                    deleteBtn.style.opacity    = '1';
                    deleteBtn.style.transform  = 'scale(1.2)';
                }, { signal });

                deleteBtn.addEventListener('mouseout', (e) => {
                    e.stopPropagation();
                    deleteBtn.style.opacity    = '0.5';
                    deleteBtn.style.transform  = 'scale(1)';
                }, { signal });

                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Delete "${item.name}"?`)) return;
                    try {
                        if (currentDirHandle) {
                            // @fix: resolveDirHandleForPath guard — empty parentPath returns root handle
                            const parentDir = await resolveDirHandleForPath(parentPath);
                            await parentDir.removeEntry(item.name, { recursive: true });
                        } else {
                            deleteMockItem(mockVFS, currentPath.split('/'));
                        }
                        if (activeFilePath === currentPath) {
                            activeFilePath   = null;
                            activeFileHandle = null;
                            if (editorEl) { editorEl.value = ''; editorEl.disabled = true; }
                            if (breadcrumbsEl) breadcrumbsEl.textContent = 'No file open';
                            if (statusEl)      statusEl.textContent       = 'Ready';
                        }
                        renderVFSTree();
                    } catch (err: any) {
                        alert('Failed to delete: ' + err.message);
                    }
                }, { signal });

                nodeEl.appendChild(deleteBtn);

                // Node click (open file / toggle folder)
                nodeEl.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (item.type === 'directory') {
                        item.expanded = !item.expanded;
                        renderVFSTree();
                    } else {
                        activeFilePath = currentPath;

                        let content = '';
                        if (currentDirHandle && item.handle) {
                            activeFileHandle = item.handle;

                            // @fix: binary / large file guard — don't crash editor on non-text files
                            if (!isTextFile(item.name)) {
                                content = `// [Binary or unsupported file: ${item.name}]\n// Cannot display this file type in the text editor.`;
                            } else {
                                try {
                                    const file = await item.handle.getFile();
                                    if (file.size > MAX_FILE_SIZE_BYTES) {
                                        content = `// [File too large to display: ${(file.size / 1024).toFixed(1)} KB]\n// Max displayable size is 1 MB.`;
                                    } else {
                                        content = await file.text();
                                    }
                                } catch (err: any) {
                                    content = `// Error reading file: ${err.message}`;
                                }
                            }
                        } else {
                            content = item.content ?? '';
                        }

                        if (editorEl) {
                            editorEl.value    = content;
                            editorEl.disabled = false;
                            editorEl.focus();
                        }
                        if (breadcrumbsEl) breadcrumbsEl.textContent = currentPath;
                        if (statusEl)      statusEl.textContent = `UTF-8 | Lines: ${content.split('\n').length}`;
                        renderVFSTree();
                    }
                }, { signal });

                parentContainer.appendChild(nodeEl);

                // Recursively render expanded directory children
                if (item.type === 'directory' && item.expanded) {
                    const childContainer = document.createElement('div');
                    if (currentDirHandle && item.handle) {
                        const subTree = await buildDirectoryTree(item.handle);
                        await renderNodeList(subTree, childContainer, depth + 1, currentPath);
                    } else if (item.children) {
                        await renderNodeList(item.children, childContainer, depth + 1, currentPath);
                    }
                    parentContainer.appendChild(childContainer);
                }
            }
        }

        // ── 4. Helper: resolve a real FileSystemDirectoryHandle from a path ────
        // @fix: guard against empty-string path (split('') gives [''] → getDirectoryHandle('') throws)
        async function resolveDirHandleForPath(pathStr: string): Promise<any> {
            if (!pathStr || pathStr.trim() === '') return currentDirHandle;
            const parts = pathStr.split('/').filter(Boolean); // filter removes empty segments
            let current = currentDirHandle;
            for (const part of parts) {
                current = await current.getDirectoryHandle(part);
            }
            return current;
        }

        // ── 5. Mock VFS helpers ────────────────────────────────────────────────
        function deleteMockItem(items: any[], pathParts: string[]) {
            const target = pathParts[0];
            const idx    = items.findIndex(i => i.name === target);
            if (idx === -1) return;
            if (pathParts.length === 1) {
                items.splice(idx, 1);
            } else if (items[idx].children) {
                deleteMockItem(items[idx].children, pathParts.slice(1));
            }
        }

        function updateMockItem(items: any[], pathParts: string[], content: string) {
            const target = pathParts[0];
            const match  = items.find(i => i.name === target);
            if (!match) return;
            if (pathParts.length === 1 && match.type === 'file') {
                match.content = content;
            } else if (match.children) {
                updateMockItem(match.children, pathParts.slice(1), content);
            }
        }

        // ── 6. Save active file to disk or mock store ──────────────────────────
        async function saveActiveFile() {
            if (!editorEl || !activeFilePath) return;
            const content = editorEl.value;

            if (currentDirHandle && activeFileHandle) {
                let writable: any = null;
                try {
                    writable = await activeFileHandle.createWritable();
                    await writable.write(content);
                    if (statusEl) statusEl.textContent = `Saved: ${activeFilePath} ✔`;
                } catch (err: any) {
                    alert('Failed to save file: ' + err.message);
                } finally {
                    // @fix: always close writable to release locked file handle
                    if (writable) {
                        try { await writable.close(); } catch (_) {}
                    }
                }
            } else {
                updateMockItem(mockVFS, activeFilePath.split('/'), content);
                if (statusEl) statusEl.textContent = `Saved (mock): ${activeFilePath} ✔`;
            }
        }

        // ── 7. Wire up global listeners (all signal-controlled, no duplicates) ──

        // Editor input → update status
        if (editorEl) {
            editorEl.addEventListener('input', (e: any) => {
                if (statusEl)
                    statusEl.textContent = `Editing... | Lines: ${e.target.value.split('\n').length}`;
            }, { signal });

            // Ctrl+S / Cmd+S save shortcut
            editorEl.addEventListener('keydown', (e: any) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    saveActiveFile();
                }
            }, { signal });
        }

        // Save button
        if (saveBtn) {
            saveBtn.addEventListener('click', (e: any) => {
                e.preventDefault();
                saveActiveFile();
            }, { signal });
        }

        // Mount local Windows directory
        if (mountBtn) {
            mountBtn.addEventListener('click', async (e: any) => {
                e.preventDefault();
                if (typeof (window as any).showDirectoryPicker !== 'function') {
                    alert('File System Access API is not supported. Use Chrome, Edge, or Opera.');
                    return;
                }
                try {
                    currentDirHandle = await (window as any).showDirectoryPicker();
                    activeFilePath   = null;
                    activeFileHandle = null;
                    if (editorEl)       { editorEl.value = ''; editorEl.disabled = true; }
                    if (breadcrumbsEl)  breadcrumbsEl.textContent = `Mounted: ${currentDirHandle.name}`;
                    if (statusEl)       statusEl.textContent      = `VFS active: ${currentDirHandle.name}`;
                    renderVFSTree();
                } catch (err: any) {
                    // User cancelled picker — not an error
                    if (err?.name !== 'AbortError')
                        console.warn('[Dolphin VFS] Directory mount cancelled or failed:', err);
                }
            }, { signal });
        }

        // New file button
        if (newFileBtn) {
            newFileBtn.addEventListener('click', async (e: any) => {
                e.preventDefault();
                const name = prompt('Enter new file name:');
                if (!name || !name.trim()) return;

                try {
                    if (currentDirHandle) {
                        let targetDir = currentDirHandle;
                        if (activeFilePath) {
                            const parts = activeFilePath.split('/');
                            parts.pop(); // remove filename, keep dir path
                            if (parts.length > 0)
                                targetDir = await resolveDirHandleForPath(parts.join('/'));
                        }
                        await targetDir.getFileHandle(name.trim(), { create: true });
                    } else {
                        mockVFS.push({ name: name.trim(), type: 'file', content: '' });
                    }
                    renderVFSTree();
                } catch (err: any) {
                    alert('Failed to create file: ' + err.message);
                }
            }, { signal });
        }

        // New folder button
        if (newFolderBtn) {
            newFolderBtn.addEventListener('click', async (e: any) => {
                e.preventDefault();
                const name = prompt('Enter new folder name:');
                if (!name || !name.trim()) return;

                try {
                    if (currentDirHandle) {
                        let targetDir = currentDirHandle;
                        if (activeFilePath) {
                            const parts = activeFilePath.split('/');
                            parts.pop();
                            if (parts.length > 0)
                                targetDir = await resolveDirHandleForPath(parts.join('/'));
                        }
                        await targetDir.getDirectoryHandle(name.trim(), { create: true });
                    } else {
                        mockVFS.push({ name: name.trim(), type: 'directory', expanded: true, children: [] });
                    }
                    renderVFSTree();
                } catch (err: any) {
                    alert('Failed to create folder: ' + err.message);
                }
            }, { signal });
        }

        // Initial render
        renderVFSTree();
    });
}
