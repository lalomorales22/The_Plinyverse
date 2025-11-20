
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import GlobeVisualizer from './components/GlobeVisualizer';
import TerminalOverlay from './components/TerminalOverlay';
import { sendCommandToKernel, listAvailableModels, checkOllamaStatus, OllamaModel } from './services/ollamaService';
import { INITIAL_SYSTEM_PROMPT, ROOT_DIRECTORIES } from './constants';
import { loadInitialProjectFiles } from './utils/fileLoader';
import { SystemMessage, VirtualFile, FileType, DirectoryState } from './types';

const generateId = () => Math.random().toString(36).substring(2, 9);

const App: React.FC = () => {
  // --- Persistent File System State ---
  // Initialize with Root Directories + Dynamically Loaded Project Files
  const [allFiles, setAllFiles] = useState<VirtualFile[]>(() => {
      const rootDirs = ROOT_DIRECTORIES.map(f => ({
          ...f, 
          type: f.type as FileType, 
          parentId: f.parentId || 'root' 
      }));
      const projectFiles = loadInitialProjectFiles();
      return [...rootDirs, ...projectFiles];
  });

  // --- Navigation State (History Stack) ---
  const [directoryStack, setDirectoryStack] = useState<DirectoryState[]>([
    { id: 'root', name: 'ROOT' }
  ]);

  // Derived State: Current Folder and Visible Files
  const currentDirectory = directoryStack[directoryStack.length - 1];
  const visibleFiles = useMemo(() => 
    allFiles.filter(f => f.parentId === currentDirectory.id),
    [allFiles, currentDirectory.id]
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
            createdAt: Date.now()
          };
          newFiles.push(newFile);
          setMessages(prev => [...prev, { id: generateId(), role: 'system', content: `>> CREATED: ${newFile.name}`, timestamp: Date.now() }]);
        }
      });
      
      if (newFiles.length > 0) {
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
            createdAt: Date.now()
        }));
        setAllFiles(prev => [...prev, ...newNodes]);
    }

    setIsProcessing(false);
  }, [currentDirectory.id, visibleFiles, selectedModel]);

  // --- Node Interaction ---

  const handleNodeClick = (file: VirtualFile) => {
      if (divingNodeId) return; // Prevent clicks during animation
      setSelectedNode(file);
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
    
    // If parent is root, just go to root
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

    // Trigger selection/inspection
    setSelectedNode(file);
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

          // Attempt to fetch from Public GitHub API
          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
              // Fallback to simulation if private or rate-limited or branch is master
               throw new Error("Repo not accessible via public API");
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
              createdAt: Date.now()
          }];
          
          // Map GitHub Tree to VirtualFiles
          // Note: Flattening strict hierarchy for VDB visualization
          // We create folders for top-level dirs, but deeply nested files might get flattened into them for simplicity in this demo
          // Or we could be more rigorous. Let's be rigorous.
          
          const pathMap: {[key: string]: string} = { "": repoDirId }; // path -> nodeId

          // Helper to get parent ID
          const getParentId = (path: string) => {
              const parentPath = path.substring(0, path.lastIndexOf('/'));
              return pathMap[parentPath] || repoDirId;
          }

          for (const node of data.tree) {
             const nodeId = generateId();
             pathMap[node.path] = nodeId;
             
             const parentId = getParentId(node.path);
             const name = node.path.split('/').pop() || node.path;
             
             let type = FileType.TEXT;
             if (node.type === 'tree') type = FileType.DIRECTORY;
             else if (name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.js')) type = FileType.CODE;
             else if (name.endsWith('.png') || name.endsWith('.jpg')) type = FileType.IMAGE;
             else if (name.endsWith('.md')) type = FileType.TEXT;
             
             newFiles.push({
                 id: nodeId,
                 parentId: parentId,
                 name: name,
                 type: type,
                 content: node.url || "Remote Content", // Real content requires another fetch per file
                 createdAt: Date.now()
             });
          }

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
          { id: repoId, parentId: currentDirectory.id, name: repoName, type: FileType.DIRECTORY, content: "Git Repository", createdAt: Date.now() },
          { id: generateId(), parentId: repoId, name: 'src', type: FileType.DIRECTORY, content: "Source Code", createdAt: Date.now() },
          { id: generateId(), parentId: repoId, name: 'README.md', type: FileType.TEXT, content: `# ${repoName}\n\nCloned to Plinyverse VDB.`, createdAt: Date.now() },
          { id: generateId(), parentId: repoId, name: 'package.json', type: FileType.CODE, content: `{\n  "name": "${repoName}"\n}`, createdAt: Date.now() },
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
      if (selectedNode && (selectedNode.type === FileType.DIRECTORY || selectedNode.type === FileType.DATA_NODE)) {
          targetParentId = selectedNode.id;
      }

      await processFiles(Array.from(uploadedFiles), targetParentId);
      
      setSelectedNode(null); 
      e.target.value = '';
  };
  
  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const uploadedFiles = e.target.files;
      if (!uploadedFiles || uploadedFiles.length === 0) return;
      
      let targetParentId = currentDirectory.id;
      if (selectedNode && (selectedNode.type === FileType.DIRECTORY || selectedNode.type === FileType.DATA_NODE)) {
          targetParentId = selectedNode.id;
      }
      
      // For folder inputs, we use webkitRelativePath to reconstruct tree
      await reconstructDirectoryTree(Array.from(uploadedFiles), targetParentId);
      
      setSelectedNode(null);
      e.target.value = '';
  }


  // --- Breadcrumbs ---

  const handleBreadcrumbClick = (index: number) => {
      if (index === directoryStack.length - 1) return;
      const newStack = directoryStack.slice(0, index + 1);
      setDirectoryStack(newStack);
  };

  // --- Delete File ---
  const handleDeleteFile = useCallback((fileId: string) => {
      // Remove file from the database
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
              createdAt: Date.now()
          });
      }
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
                  createdAt: Date.now()
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
              createdAt: Date.now()
          });
      }
      
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
                createdAt: Date.now()
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
                createdAt: Date.now()
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

      {/* 3D Background Layer */}
      <GlobeVisualizer 
        files={visibleFiles} 
        onNodeClick={handleNodeClick}
        divingNodeId={divingNodeId}
        onDiveComplete={handleDiveComplete}
        canNavigateUp={directoryStack.length > 1}
        onNavigateUp={handleNavigateUp}
      />
      
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
