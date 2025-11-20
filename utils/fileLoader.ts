import { VirtualFile, FileType } from '../types';
import { ROOT_CLARITAS_ID, ROOT_LIBERTAS_ID } from '../constants';

// Use Vite's glob import to load all files from the project folders
const claritasFiles = import.meta.glob('../CL4R1T4S/**/*', { query: '?raw', import: 'default', eager: true });
const libertasFiles = import.meta.glob('../L1B3RT4S/*', { query: '?raw', import: 'default', eager: true });

const generateId = () => Math.random().toString(36).substring(2, 15);

// Determine file type based on extension
const getFileType = (filename: string): FileType => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    if (['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'].includes(ext)) {
        return FileType.CODE;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
        return FileType.IMAGE;
    }
    if (['mp4', 'avi', 'mov', 'webm'].includes(ext)) {
        return FileType.VIDEO;
    }
    if (ext === 'pdf') {
        return FileType.PDF;
    }
    if (['txt', 'md', 'mkd', 'json'].includes(ext)) {
        return FileType.TEXT;
    }

    return FileType.TEXT; // default
};

export const loadInitialProjectFiles = (): VirtualFile[] => {
    const files: VirtualFile[] = [];
    const processedDirs = new Set<string>();

    // Process CL4R1T4S files (with subdirectories)
    Object.entries(claritasFiles).forEach(([path, content]) => {
        // Parse path: ../CL4R1T4S/FOLDER/file.txt
        const relativePath = path.replace('../CL4R1T4S/', '');
        const parts = relativePath.split('/');

        if (parts.length === 1) {
            // Root level file in CL4R1T4S (like README.md, LICENSE)
            const filename = parts[0];
            if (!filename) return;

            files.push({
                id: `claritas_${generateId()}`,
                parentId: ROOT_CLARITAS_ID,
                name: filename,
                type: getFileType(filename),
                content: content as string,
                createdAt: Date.now()
            });
        } else if (parts.length === 2) {
            // Subdirectory file: FOLDER/file.txt
            const folderName = parts[0];
            const filename = parts[1];
            if (!filename) return;

            const folderId = `claritas_dir_${folderName}`;

            // Create directory entry if not exists
            if (!processedDirs.has(folderId)) {
                processedDirs.add(folderId);
                files.push({
                    id: folderId,
                    parentId: ROOT_CLARITAS_ID,
                    name: folderName,
                    type: FileType.DIRECTORY,
                    content: `${folderName} Documentation`,
                    createdAt: Date.now()
                });
            }

            // Add file to directory
            files.push({
                id: `claritas_${generateId()}`,
                parentId: folderId,
                name: filename,
                type: getFileType(filename),
                content: content as string,
                createdAt: Date.now()
            });
        }
    });

    // Process L1B3RT4S files (flat structure)
    Object.entries(libertasFiles).forEach(([path, content]) => {
        // Parse path: ../L1B3RT4S/file.txt
        const filename = path.replace('../L1B3RT4S/', '');
        if (!filename) return;

        files.push({
            id: `libertas_${generateId()}`,
            parentId: ROOT_LIBERTAS_ID,
            name: filename,
            type: getFileType(filename),
            content: content as string,
            createdAt: Date.now()
        });
    });

    console.log(`[PLINYVERSE] Loaded ${files.length} files from project folders.`);
    console.log(`[PLINYVERSE] CL4R1T4S directories: ${processedDirs.size}`);

    return files;
};