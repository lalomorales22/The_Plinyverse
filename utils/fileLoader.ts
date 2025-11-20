import { VirtualFile, FileType } from '../types';
import { ROOT_CLARITAS_ID, ROOT_LIBERTAS_ID } from '../constants';
import { v4 as uuidv4 } from 'uuid';

// NOTE: In this specific runtime environment, `import.meta.glob` is not supported.
// We are manually defining the content of the files to prevent the crash.
// In a local Vite environment, you could uncomment the glob logic.

const MANIFESTO_CONTENT = `
# CL4R1T4S MANIFESTO

We seek truth in data.
Structure is the foundation of knowledge.

1. Organize.
2. Visualize.
3. Understand.

Data added to this folder in the project root will automatically appear in the CL4R1T4S node.
`;

const WELCOME_CONTENT = `
# Infinite Possibilities

Welcome to the **L1B3RT4S** node.

This sector is dedicated to:
- Creative Expansion
- Unstructured Data
- Experimental Code

> "The void is not empty; it is full of potential."

Add .txt, .md, or .mkd files to the L1B3RT4S folder in your project to populate this space.
`;

export const loadInitialProjectFiles = (): VirtualFile[] => {
    // Manually register the files since we cannot scan the directory at runtime here
    const files: VirtualFile[] = [
        {
            id: `auto_manifesto`,
            parentId: ROOT_CLARITAS_ID,
            name: '00_MANIFESTO.txt',
            type: FileType.TEXT,
            content: MANIFESTO_CONTENT.trim(),
            createdAt: Date.now()
        },
        {
            id: `auto_welcome`,
            parentId: ROOT_LIBERTAS_ID,
            name: '00_WELCOME.md',
            type: FileType.TEXT, // MD is treated as text/doc
            content: WELCOME_CONTENT.trim(),
            createdAt: Date.now()
        }
    ];

    console.log(`[PLINYVERSE] Loaded ${files.length} project files manually.`);

    return files;
};