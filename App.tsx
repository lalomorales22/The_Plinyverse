import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import MultiClusterVisualizer from './components/MultiClusterVisualizer';
import TerminalOverlay from './components/TerminalOverlay';
import { sendCommandToKernel, listAvailableModels, checkOllamaStatus, OllamaModel } from './services/ollamaService';
import { INITIAL_SYSTEM_PROMPT, ROOT_DIRECTORIES } from './constants';
import { loadInitialProjectFiles } from './utils/fileLoader';
import { SystemMessage, VirtualFile, FileType, DirectoryState, Cluster } from './types';
import { dbService } from './services/dbService';

// SECURITY FIX: Use crypto.randomUUID() instead of Math.random() for secure, collision-resistant IDs
const generateId = () => crypto.randomUUID();

const App: React.FC = () => {
  // --- Persistent File System State ---
  // Initialize with Root Directories + Dynamically Loaded Project Files
const [allFiles, setAllFiles] = useState<VirtualFile[]>([]);

// NEW: Cluster Management
const [allClusters, setAllClusters] = useState<Cluster[]>([]);
const [currentClusterId, setCurrentClusterId] = useState<string>('root');

// Load files and clusters from DB on mount
useEffect(() => {
    const initData = async () => {
        // Load clusters first
        const dbClusters = await dbService.getAllClusters();
        setAllClusters(dbClusters);

        // Load files
        const dbFiles = await dbService.getAllFiles();

        if (dbFiles.length === 0) {
            // First run: Load initial files and save to DB
            const rootDirs = ROOT_DIRECTORIES.map(f => ({
                ...f,
                type: f.type as FileType,
                parentId: f.parentId || 'root',
                clusterId: 'root' // Assign to root cluster
            }));
            const projectFiles = loadInitialProjectFiles().map(f => ({
                ...f,
                clusterId: 'root'
            }));
            const initialFiles = [...rootDirs, ...projectFiles];

            await dbService.saveFilesBatch(initialFiles);
            setAllFiles(initialFiles);
        } else {
            setAllFiles(dbFiles);
        }
    };
    initData();
}, []);

// --- Navigation State (History Stack) ---
const [directoryStack, setDirectoryStack] = useState<DirectoryState[]>([
{ id: 'root', name: 'ROOT' }
]);

// Derived State: Current Folder and Visible Files (filtered by current cluster)
const currentDirectory = directoryStack[directoryStack.length - 1];
const visibleFiles = useMemo(() =>
allFiles.filter(f => f.parentId === currentDirectory.id && (f.clusterId || 'root') === currentClusterId),
[allFiles, currentDirectory.id, currentClusterId]
);

// --- Ollama Model State ---
const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
const [selectedModel, setSelectedModel] = useState<string>('');
const [isOllamaOnline, setIsOllamaOnline] = useState(false);

// --- Messages & Processing ---
const [messages, setMessages] = useState<SystemMessage[]>([
{ id: '0', role: 'system', content: 'Ollama VDB Kernel Initializing...', timestamp: Date.now() },
{ id: '1', role: 'ai', content: 'VDB Online. Persistent file system active.', timestamp: Date.now() + 100 }
]);

const [isProcessing, setIsProcessing] = useState(false);
const [selectedNode, setSelectedNode] = useState<VirtualFile | null>(null);

// Animation State
const [divingNodeId, setDivingNodeId] = useState<string | null>(null);

// Hidden file input ref for "Inject Data"
const fileInputRef = useRef<HTMLInputElement>(null);
const folderInputRef = useRef<HTMLInputElement>(null);
const pendingImportTargetRef = useRef<VirtualFile | null>(null);

// --- Context Menu State ---
const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    file: VirtualFile | null;
}>({ visible: false, x: 0, y: 0, file: null });

const handleNodeContextMenu = (file: VirtualFile, event: any) => {
    // Handle both native DOM events and R3F events
    if (event.nativeEvent) {
        event.nativeEvent.preventDefault();
        event.nativeEvent.stopPropagation();
    } else if (event.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Get coordinates safely
    const x = event.clientX || event.nativeEvent?.clientX || 0;
    const y = event.clientY || event.nativeEvent?.clientY || 0;

    setContextMenu({
        visible: true,
        x: x,
        y: y,
        file: file
    });
};

const handleCloseContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, file: null });
};

// --- Load Ollama Models on Mount ---
useEffect(() => {
const loadModels = async () => {
    const status = await checkOllamaStatus();
    setIsOllamaOnline(status);

    if (status) {
    const models = await listAvailableModels();
    setAvailableModels(models);

    if (models.length > 0) {
        // Set first model as default
        setSelectedModel(models[0].name);
        setMessages(prev => [...prev, {
        id: generateId(),
        role: 'system',
        content: `>> CONNECTED: Ollama detected. ${models.length} model(s) available. Default: ${models[0].name}`,
        timestamp: Date.now()
        }]);
    } else {
        setMessages(prev => [...prev, {
        id: generateId(),
        role: 'system',
        content: '!! WARNING: Ollama is running but no models found. Run "ollama pull <model>" to download a model.',
        timestamp: Date.now()
        }]);
    }
    } else {
    setMessages(prev => [...prev, {
        id: generateId(),
        role: 'system',
        content: '!! ERROR: Cannot connect to Ollama. Please ensure Ollama is running (ollama serve).',
        timestamp: Date.now()
    }]);
    }
};

loadModels();
}, []);

// --- AI Interaction ---

const handleSendMessage = useCallback(async (text: string) => {
const userMsg: SystemMessage = { id: generateId(), role: 'user', content: text, timestamp: Date.now() };
setMessages(prev => [...prev, userMsg]);
setIsProcessing(true);

// Give AI context of current directory only
const contextFiles = visibleFiles.map(f => `[${f.type}] ${f.name}: ${(f.content || "").substring(0, 50)}...`);
const result = await sendCommandToKernel(text, contextFiles, selectedModel);

const aiMsg: SystemMessage = { id: generateId(), role: 'ai', content: result.message, timestamp: Date.now() };
setMessages(prev => [...prev, aiMsg]);

if (result.fileOperations?.length) {
    const newFiles: VirtualFile[] = [];
    result.fileOperations.forEach(op => {
    if (op.action === 'create') {
        const newFile: VirtualFile = {
        id: generateId(),
        parentId: currentDirectory.id, // Create in current folder
        name: op.file.name,
        type: op.file.type as FileType,
        content: op.file.content || "",
        createdAt: Date.now(),
        clusterId: currentClusterId // Assign to current cluster
        };
        newFiles.push(newFile);
        setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `>> CREATED: ${newFile.name}`, timestamp: Date.now() }]);
    }
    });

    if (newFiles.length > 0) {
        await dbService.saveFilesBatch(newFiles);
        setAllFiles(prev => [...prev, ...newFiles]);
    }
}

if (result.suggestedNodes?.length) {
    const newNodes: VirtualFile[] = result.suggestedNodes.map(node => ({
        id: generateId(),
        parentId: currentDirectory.id,
        name: node.name,
        type: FileType.DATA_NODE,
        content: node.description || "",
        createdAt: Date.now(),
        clusterId: currentClusterId // Assign to current cluster
    }));
    await dbService.saveFilesBatch(newNodes);
    setAllFiles(prev => [...prev, ...newNodes]);
}

setIsProcessing(false);
}, [currentDirectory.id, visibleFiles, selectedModel]);

// --- Node Interaction ---

const handleNodeClick = (file: VirtualFile) => {
    if (divingNodeId) return; // Prevent clicks during animation
    
    // Auto-dive for directories
    if (file.type === FileType.DIRECTORY || file.type === FileType.DATA_NODE) {
        setDivingNodeId(file.id);
        setSelectedNode(null); // Ensure modal is closed
    } else {
        setSelectedNode(file);
    }
};

const handleCloseModal = () => {
    setSelectedNode(null);
};

// Step 1: Start Dive (Animation)
const handleDiveIn = () => {
    if (!selectedNode) return;
    
    // Start the animation in the visualizer
    setDivingNodeId(selectedNode.id);
    
    // Close the UI modal immediately so we see the dive
    setSelectedNode(null);
};

// Step 2: Finish Dive (Navigation) - Called by GlobeVisualizer when animation ends
const handleDiveComplete = () => {
    if (!divingNodeId) return;

    // Find the node we were diving into to get its name for the stack
    // (We can't rely on selectedNode here as it's cleared)
    const targetNode = allFiles.find(f => f.id === divingNodeId);
    
    if (targetNode) {
        const nextDir: DirectoryState = {
            id: targetNode.id,
            name: targetNode.name
        };
        setDirectoryStack(prev => [...prev, nextDir]);
        setMessages(prev => [...prev, { 
            id: generateId(), 
            role: 'system', 
            content: `>> NAVIGATING: Entered "${targetNode.name}".`, 
            timestamp: Date.now() 
        }]);
    }

    // Reset animation state
    setDivingNodeId(null);
};

// Handle Zoom Out Navigation
const handleNavigateUp = () => {
    if (directoryStack.length > 1) {
        // Remove last item
        const newStack = directoryStack.slice(0, directoryStack.length - 1);
        const prevDir = newStack[newStack.length - 1];
        setDirectoryStack(newStack);
        setMessages(prev => [...prev, { 
            id: generateId(), 
            role: 'system', 
            content: `>> ASCENDING: Returning to "${prevDir.name}".`, 
            timestamp: Date.now() 
        }]);
    }
};

// --- Auto-Navigation (Jump to File) ---
const handleJumpToFile = (file: VirtualFile) => {
if (!file.parentId) return;

// Find the directory object for the parent
const parentDir = allFiles.find(f => f.id === file.parentId);

// 1. Navigate to the parent directory
if (file.parentId === 'root') {
    setDirectoryStack([{ id: 'root', name: 'ROOT' }]);
} else if (parentDir) {
    // Set stack to [ROOT, PARENT]
    // Note: deeply nested jumps would require recursive path finding. 
    // For now we assume 1 level deep based on current structure.
    setDirectoryStack([
        { id: 'root', name: 'ROOT' },
        { id: parentDir.id, name: parentDir.name }
    ]);
}

// 2. Handle behavior based on file type
if (file.type === FileType.DIRECTORY || file.type === FileType.DATA_NODE) {
    // For folders (e.g. in CL4R1T4S), animate/dive into them immediately
    // Do NOT open the modal
    setDivingNodeId(file.id);
    setSelectedNode(null);
} else {
    // For files (e.g. in L1B3RT4S), just show them in the view (by being in parent dir)
    // Do NOT open the modal immediately (user must click again)
    setSelectedNode(null);
}
};

// --- Remote Sync (GitHub) ---
const handleSyncRepo = async (url: string) => {
    setIsProcessing(true);
    const cleanUrl = url.replace('https://', '').replace('http://', '').replace('www.', '');
    setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `>> CONNECTING: Resolving ${cleanUrl}...`, timestamp: Date.now() }]);

    try {
        const parts = cleanUrl.split('/');
        // Support github.com/owner/repo format
        const owner = parts.length > 1 ? parts[1] : parts[0]; 
        const repo = parts.length > 2 ? parts[2] : parts[1];

        if (!owner || !repo) throw new Error("Invalid URL structure");

        const repoName = `${owner}/${repo}`;
        setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `>> FETCHING: Downloading tree for ${repoName}...`, timestamp: Date.now() }]);

        // 1. Get Default Branch (Try main then master)
        let branch = 'main';
        let apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
        let response = await fetch(apiUrl);
        
        if (!response.ok) {
            branch = 'master';
            apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
            response = await fetch(apiUrl);
        }
        
        if (!response.ok) {
            throw new Error("Repo not accessible via public API (Check branch or privacy)");
        }
        
        const data = await response.json();
        if (!data.tree) throw new Error("Invalid Git Tree");

        // Create a container directory for the repo
        const repoDirId = generateId();
        const newFiles: VirtualFile[] = [{
            id: repoDirId,
            parentId: currentDirectory.id,
            name: repo,
            type: FileType.DIRECTORY,
            content: `Cloned from ${url}`,
            createdAt: Date.now(),
            clusterId: currentClusterId // Assign to current cluster
        }];
        
        const pathMap: {[key: string]: string} = { "": repoDirId }; // path -> nodeId

        // Helper to get parent ID
        const getParentId = (path: string) => {
            const parentPath = path.substring(0, path.lastIndexOf('/'));
            return pathMap[parentPath] || repoDirId;
        }

        // Separate folders and files
        const dirs = data.tree.filter((n: any) => n.type === 'tree').sort((a: any, b: any) => a.path.length - b.path.length);
        const files = data.tree.filter((n: any) => n.type === 'blob');

        // Process Directories First
        dirs.forEach((node: any) => {
            const nodeId = generateId();
            pathMap[node.path] = nodeId;
            const parentId = getParentId(node.path);
            const name = node.path.split('/').pop() || node.path;

            newFiles.push({
                id: nodeId,
                parentId: parentId,
                name: name,
                type: FileType.DIRECTORY,
                content: "Directory",
                createdAt: Date.now(),
                clusterId: currentClusterId // Assign to current cluster
            });
        });

        // Process Files with Content Fetching
        setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `>> DOWNLOADING: Fetching ${files.length} files...`, timestamp: Date.now() }]);

        const processFile = async (node: any) => {
            const nodeId = generateId();
            const parentId = getParentId(node.path);
            const name = node.path.split('/').pop() || node.path;
            
            let type = FileType.TEXT;
            if (name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.js') || name.endsWith('.jsx')) type = FileType.CODE;
            else if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.gif')) type = FileType.IMAGE;
            else if (name.endsWith('.md')) type = FileType.TEXT;
            else if (name.endsWith('.json')) type = FileType.CODE;
            else if (name.endsWith('.css') || name.endsWith('.scss')) type = FileType.CODE;
            else if (name.endsWith('.html')) type = FileType.CODE;
            
            let content = "";
            try {
                // Encode path to handle special characters (spaces, #, etc.)
                const encodedPath = node.path.split('/').map((segment: string) => encodeURIComponent(segment)).join('/');
                const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`;
                
                if (type === FileType.IMAGE) {
                    content = rawUrl; 
                } else {
                    const res = await fetch(rawUrl);
                    if (res.ok) {
                        content = await res.text();
                    } else {
                        content = `Error fetching content: ${res.statusText} (URL: ${rawUrl})`;
                    }
                }
            } catch (err) {
                content = "Failed to fetch content.";
            }

            newFiles.push({
                id: nodeId,
                parentId: parentId,
                name: name,
                type: type,
                content: content,
                createdAt: Date.now(),
                clusterId: currentClusterId // Assign to current cluster
            });
        };

        // Batch process files
        const batchSize = 10;
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            await Promise.all(batch.map(processFile));
            // Update progress message every 50 files
            if (i > 0 && i % 50 === 0) {
                setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `>> PROGRESS: ${i}/${files.length} files downloaded...`, timestamp: Date.now() }]);
            }
        }

        // Save to DB
        await dbService.saveFilesBatch(newFiles);

        setAllFiles(prev => [...prev, ...newFiles]);
        setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `>> SUCCESS: Cloned ${newFiles.length} nodes from ${repoName}.`, timestamp: Date.now() }]);

    } catch (e) {
        console.warn("Sync Error, falling back to sim:", e);
        // Fallback: Simulation
        setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `!! WARNING: API Limited/Private. Simulating structure...`, timestamp: Date.now() }]);
        simulateClone(url);
    }
    
    setIsProcessing(false);
};

// Fallback Simulation for Sync
const simulateClone = (url: string) => {
    const repoName = url.split('/').pop() || 'repo';
    const repoId = generateId();

    const simFiles: VirtualFile[] = [
        { id: repoId, parentId: currentDirectory.id, name: repoName, type: FileType.DIRECTORY, content: "Git Repository", createdAt: Date.now(), clusterId: currentClusterId },
        { id: generateId(), parentId: repoId, name: 'src', type: FileType.DIRECTORY, content: "Source Code", createdAt: Date.now(), clusterId: currentClusterId },
        { id: generateId(), parentId: repoId, name: 'README.md', type: FileType.TEXT, content: `# ${repoName}\n\nCloned to Plinyverse VDB.`, createdAt: Date.now(), clusterId: currentClusterId },
        { id: generateId(), parentId: repoId, name: 'package.json', type: FileType.CODE, content: `{\n  "name": "${repoName}"\n}`, createdAt: Date.now(), clusterId: currentClusterId },
    ];

    setAllFiles(prev => [...prev, ...simFiles]);
    setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `>> SIMULATION COMPLETE: Generated structure for ${repoName}.`, timestamp: Date.now() }]);
};

const handleInjectDataTrigger = () => {
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
};

const handleInjectFolderTrigger = () => {
    if (folderInputRef.current) {
        folderInputRef.current.click();
    }
}

const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    
    // Determine target parent
    let targetParentId = currentDirectory.id;
    
    // Prioritize Context Menu target if active
    if (contextMenu.file && (contextMenu.file.type === FileType.DIRECTORY || contextMenu.file.type === FileType.DATA_NODE)) {
        targetParentId = contextMenu.file.id;
    } else if (selectedNode && (selectedNode.type === FileType.DIRECTORY || selectedNode.type === FileType.DATA_NODE)) {
        targetParentId = selectedNode.id;
    }

    await processFiles(Array.from(uploadedFiles), targetParentId);
    
    setSelectedNode(null); 
    setContextMenu({ ...contextMenu, visible: false, file: null });
    e.target.value = '';
};

const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    
    let targetParentId = currentDirectory.id;
    
    // Prioritize Context Menu target if active
    if (contextMenu.file && (contextMenu.file.type === FileType.DIRECTORY || contextMenu.file.type === FileType.DATA_NODE)) {
        targetParentId = contextMenu.file.id;
    } else if (selectedNode && (selectedNode.type === FileType.DIRECTORY || selectedNode.type === FileType.DATA_NODE)) {
        targetParentId = selectedNode.id;
    }
    
    // For folder inputs, we use webkitRelativePath to reconstruct tree
    await reconstructDirectoryTree(Array.from(uploadedFiles), targetParentId);
    
    setSelectedNode(null);
    setContextMenu({ ...contextMenu, visible: false, file: null });
    e.target.value = '';
}


// --- Breadcrumbs ---

const handleBreadcrumbClick = (index: number) => {
    if (index === directoryStack.length - 1) return;
    const newStack = directoryStack.slice(0, index + 1);
    setDirectoryStack(newStack);
};

// --- Delete File ---
const handleDeleteFile = useCallback(async (fileId: string) => {
    // Remove file from the database
    await dbService.deleteFile(fileId);
    setAllFiles(prev => prev.filter(f => f.id !== fileId));

    // Add system message
    const deletedFile = allFiles.find(f => f.id === fileId);
    if (deletedFile) {
        setMessages(prev => [...prev, {
            id: generateId(),
            role: 'system',
            content: `>> DELETED: "${deletedFile.name}" removed from VDB.`,
            timestamp: Date.now()
        }]);
    }
}, [allFiles]);

// --- Cluster Management ---
const handleCreateCluster = useCallback(async (name: string) => {
    // Generate random position for new cluster (spread them out)
    const angle = Math.random() * Math.PI * 2;
    const distance = 15 + Math.random() * 10;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;

    // Random color from predefined palette
    const colors = ['#00ff9d', '#3b82f6', '#ec4899', '#8b5cf6', '#f59e0b', '#10b981'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const newCluster: Cluster = {
        id: generateId(),
        name: name,
        position: [x, 0, z],
        color: color,
        createdAt: Date.now()
    };

    await dbService.saveCluster(newCluster);
    setAllClusters(prev => [...prev, newCluster]);

    setMessages(prev => [...prev, {
        id: generateId(),
        role: 'system',
        content: `>> CLUSTER CREATED: "${name}" initialized at position [${x.toFixed(1)}, 0, ${z.toFixed(1)}].`,
        timestamp: Date.now()
    }]);
}, []);

const handleClusterClick = useCallback((clusterId: string) => {
    setCurrentClusterId(clusterId);
    setDirectoryStack([{ id: 'root', name: 'ROOT' }]); // Reset to root of new cluster

    const cluster = allClusters.find(c => c.id === clusterId);
    if (cluster) {
        setMessages(prev => [...prev, {
            id: generateId(),
            role: 'system',
            content: `>> CLUSTER SWITCH: Navigating to "${cluster.name}".`,
            timestamp: Date.now()
        }]);
    }
}, [allClusters]);


// --- Drag & Drop / File Processing ---

// Helper to read file content
const readFileContent = (file: File): Promise<{content: string, type: FileType}> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = (event.target?.result as string) || "";
            let fileType = FileType.TEXT;
            if (file.type.startsWith('image/')) fileType = FileType.IMAGE;
            else if (file.type.startsWith('video/')) fileType = FileType.VIDEO;
            else if (file.type === 'application/pdf') fileType = FileType.PDF;
            resolve({ content, type: fileType });
        };
        
        if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type === 'application/pdf') {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    });
}

// Standard flat file processing
const processFiles = async (fileList: File[], targetId: string) => {
    setMessages(prev => [...prev, {
        id: generateId(),
        role: 'system',
        content: `>> INGESTING: Adding ${fileList.length} entities...`,
        timestamp: Date.now()
    }]);

    const newVirtualFiles: VirtualFile[] = [];
    for (const file of fileList) {
        const { content, type } = await readFileContent(file);
        newVirtualFiles.push({
            id: generateId(),
            parentId: targetId,
            name: file.name,
            type: type,
            content: content,
            createdAt: Date.now(),
            clusterId: currentClusterId // Assign to current cluster
        });
    }

    await dbService.saveFilesBatch(newVirtualFiles);
    setAllFiles(prev => [...prev, ...newVirtualFiles]);
};

// Recursive tree reconstruction for folder inputs (webkitRelativePath)
const reconstructDirectoryTree = async (fileList: File[], rootTargetId: string) => {
    setMessages(prev => [...prev, { 
        id: generateId(), 
        role: 'system', 
        content: `>> RECONSTRUCTING: Building directory tree from ${fileList.length} files...`, 
        timestamp: Date.now() 
    }]);
    
    // Temporary cache to avoid re-creating same folder multiple times in this batch
    const folderCache: Record<string, string> = {}; // path -> id
    const newFiles: VirtualFile[] = [];
    
    // Helper to find or create folder ID for a path
    const getFolderId = (pathParts: string[], currentParentId: string): string => {
        if (pathParts.length === 0) return currentParentId;
        
        const currentFolderName = pathParts[0];
        const currentPathStr = pathParts.join('/'); // naive key
        
        // Check locally created new files first
        let existingFolder = newFiles.find(f => f.name === currentFolderName && f.parentId === currentParentId && f.type === FileType.DIRECTORY);
        
        // Check persistent state
        if (!existingFolder) {
            existingFolder = allFiles.find(f => f.name === currentFolderName && f.parentId === currentParentId && f.type === FileType.DIRECTORY);
        }

        if (existingFolder) {
            return getFolderId(pathParts.slice(1), existingFolder.id);
        } else {
            // Create new folder
            const newFolderId = generateId();
            newFiles.push({
                id: newFolderId,
                parentId: currentParentId,
                name: currentFolderName,
                type: FileType.DIRECTORY,
                content: "Imported Directory",
                createdAt: Date.now(),
                clusterId: currentClusterId // Assign to current cluster
            });
            return getFolderId(pathParts.slice(1), newFolderId);
        }
    };

    for (const file of fileList) {
        const path = file.webkitRelativePath;
        if (!path) {
            // Fallback for flat files mixed in
            await processFiles([file], rootTargetId);
            continue;
        }

        const parts = path.split('/');
        const fileName = parts.pop()!;
        const folderParts = parts; // content before file

        // Recursively ensure folders exist
        const finalParentId = getFolderId(folderParts, rootTargetId);

        const { content, type } = await readFileContent(file);
        newFiles.push({
            id: generateId(),
            parentId: finalParentId,
            name: fileName,
            type: type,
            content: content,
            createdAt: Date.now(),
            clusterId: currentClusterId // Assign to current cluster
        });
    }
    
    await dbService.saveFilesBatch(newFiles);
    setAllFiles(prev => [...prev, ...newFiles]);
};

const handleDrop = async (e: React.DragEvent) => {
e.preventDefault();
e.stopPropagation();

// Recursive scanning for D&D
const traverseFileTree = async (item: any, path: string, parentId: string, fileAccumulator: VirtualFile[]) => {
    if (item.isFile) {
        // Get file
        const file: File = await new Promise((resolve) => item.file(resolve));
        const { content, type } = await readFileContent(file);
        fileAccumulator.push({
            id: generateId(),
            parentId: parentId,
            name: file.name,
            type: type,
            content: content,
            createdAt: Date.now(),
            clusterId: currentClusterId // Assign to current cluster
        });
    } else if (item.isDirectory) {
        // Create directory node
        const dirId = generateId();
        fileAccumulator.push({
            id: dirId,
            parentId: parentId,
            name: item.name,
            type: FileType.DIRECTORY,
            content: "Dropped Directory",
            createdAt: Date.now(),
            clusterId: currentClusterId // Assign to current cluster
        });
        
        // Read entries
        const dirReader = item.createReader();
        const entries = await new Promise<any[]>((resolve) => {
            dirReader.readEntries((result: any[]) => resolve(result));
        });
        
        for (const entry of entries) {
            await traverseFileTree(entry, path + item.name + "/", dirId, fileAccumulator);
        }
    }
};

const items = e.dataTransfer?.items;
if (!items) return;

const newFiles: VirtualFile[] = [];

if (items.length > 0) {
        // Need to cast to any to access webkitGetAsEntry which is standard in modern browsers but tricky in TS types
        const itemParams = Array.from(items) as any[];
        
        for (let i = 0; i < itemParams.length; i++) {
            const item = itemParams[i].webkitGetAsEntry();
            if (item) {
                await traverseFileTree(item, "", currentDirectory.id, newFiles);
            } else {
                // Fallback for items that aren't entries (rare)
                const file = itemParams[i].getAsFile();
                if (file) await processFiles([file], currentDirectory.id);
            }
        }
} 

if (newFiles.length > 0) {
    setMessages(prev => [...prev, { 
        id: generateId(), 
        role: 'system', 
        content: `>> RECURSIVE SCAN: Imported ${newFiles.length} items from dropped structure.`, 
        timestamp: Date.now() 
    }]);
    await dbService.saveFilesBatch(newFiles);
    setAllFiles(prev => [...prev, ...newFiles]);
}
};

const handleDragOver = (e: React.DragEvent) => {
e.preventDefault();
e.stopPropagation();
};

return (
<div 
    className="relative w-screen h-screen overflow-hidden bg-black"
    onDrop={handleDrop}
    onDragOver={handleDragOver}
>
    {/* Hidden Input for Files */}
    <input 
    type="file" 
    ref={fileInputRef} 
    style={{ display: 'none' }} 
    multiple 
    onChange={handleFileInputChange}
    />
    {/* Hidden Input for Folders */}
    <input 
    type="file" 
    ref={folderInputRef} 
    style={{ display: 'none' }} 
    {...{ webkitdirectory: "", directory: "" } as any}
    onChange={handleFolderInputChange}
    />

    {/* 3D Background Layer - Multi-Cluster Visualization */}
    <MultiClusterVisualizer
    clusters={allClusters}
    currentClusterId={currentClusterId}
    files={allFiles}
    currentDirectoryId={currentDirectory.id}
    onClusterClick={handleClusterClick}
    onNodeClick={handleNodeClick}
    onNodeContextMenu={handleNodeContextMenu}
    divingNodeId={divingNodeId}
    onDiveComplete={handleDiveComplete}
    canNavigateUp={directoryStack.length > 1}
    onNavigateUp={handleNavigateUp}
    />
    
    {/* Context Menu */}
    {contextMenu.visible && contextMenu.file && (
        <div 
            className="absolute z-50 bg-black/90 border border-green-500/30 rounded-lg shadow-xl backdrop-blur-md flex flex-col gap-1 min-w-[180px] overflow-hidden"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onMouseLeave={handleCloseContextMenu}
        >
            <div className="px-3 py-2 text-xs text-gray-400 border-b border-white/10 font-mono bg-white/5">
                {contextMenu.file.name}
            </div>
            
            <button 
                onClick={() => {
                    pendingImportTargetRef.current = contextMenu.file;
                    handleInjectDataTrigger();
                    handleCloseContextMenu();
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-green-400 hover:bg-green-500/20 transition-colors text-left w-full"
            >
                <span>📥 Import Files Here</span>
            </button>
            
            <button 
                onClick={() => {
                    pendingImportTargetRef.current = contextMenu.file;
                    handleInjectFolderTrigger();
                    handleCloseContextMenu();
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-green-400 hover:bg-green-500/20 transition-colors text-left w-full"
            >
                <span>📂 Import Folder Here</span>
            </button>

            <div className="h-px bg-white/10 my-0.5" />

            <button 
                onClick={() => {
                    if (contextMenu.file) handleDeleteFile(contextMenu.file.id);
                    handleCloseContextMenu();
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-colors text-left w-full"
            >
                <span>🗑️ Delete Node</span>
            </button>
        </div>
    )}
    
    {/* UI Overlay Layer */}
    <TerminalOverlay
    messages={messages}
    onSendMessage={handleSendMessage}
    visibleFiles={visibleFiles}
    allFiles={allFiles}
    isProcessing={isProcessing}
    directoryStack={directoryStack}
    onBreadcrumbClick={handleBreadcrumbClick}
    selectedNode={selectedNode}
    onCloseModal={handleCloseModal}
    onDiveIn={handleDiveIn}
    onInjectData={handleInjectDataTrigger}
    onInjectFolder={handleInjectFolderTrigger}
    onJumpToFile={handleJumpToFile}
    onSyncRepo={handleSyncRepo}
    onDeleteFile={handleDeleteFile}
    availableModels={availableModels}
    selectedModel={selectedModel}
    onModelChange={setSelectedModel}
    isOllamaOnline={isOllamaOnline}
    onCreateCluster={handleCreateCluster}
    clusterCount={allClusters.length}
    />

    {/* Drag Overlay Indicator */}
    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center bg-green-500/10 opacity-0 transition-opacity duration-300 [.drag-active_&]:opacity-100">
        <h1 className="text-4xl font-bold text-green-500 tracking-widest border-4 border-green-500 p-10 rounded-xl backdrop-blur-sm">
            INGEST DATA
        </h1>
    </div>
</div>
);
};

export default App;
