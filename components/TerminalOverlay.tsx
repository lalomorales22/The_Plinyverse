
import React, { useState, useEffect, useRef } from 'react';
import { Send, HardDrive, Activity, Layers, Terminal as TerminalIcon, ChevronRight, Database, ZoomIn, Upload, X, FilePlus, Video as VideoIcon, Image as ImageIcon, FileText, GripHorizontal, Shield, Zap, FolderPlus, GitBranch, Cloud, RefreshCw, CheckCircle, Cpu, Trash2 } from 'lucide-react';
import { SystemMessage, VirtualFile, FileType, DirectoryState } from '../types';
import { ROOT_CLARITAS_ID, ROOT_LIBERTAS_ID } from '../constants';
import { OllamaModel } from '../services/ollamaService';

interface TerminalOverlayProps {
  messages: SystemMessage[];
  onSendMessage: (msg: string) => void;
  visibleFiles: VirtualFile[];
  allFiles: VirtualFile[];
  isProcessing: boolean;
  directoryStack: DirectoryState[];
  onBreadcrumbClick: (index: number) => void;
  selectedNode: VirtualFile | null;
  onCloseModal: () => void;
  onDiveIn: () => void;
  onInjectData: () => void;
  onInjectFolder: () => void;
  onJumpToFile: (file: VirtualFile) => void;
  onSyncRepo: (url: string) => void;
  onDeleteFile: (fileId: string) => void;
  availableModels: OllamaModel[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  isOllamaOnline: boolean;
}

const TerminalOverlay: React.FC<TerminalOverlayProps> = ({
    messages,
    onSendMessage,
    visibleFiles,
    allFiles,
    isProcessing,
    directoryStack,
    onBreadcrumbClick,
    selectedNode,
    onCloseModal,
    onDiveIn,
    onInjectData,
    onInjectFolder,
    onJumpToFile,
    onSyncRepo,
    onDeleteFile,
    availableModels,
    selectedModel,
    onModelChange,
    isOllamaOnline
}) => {
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'terminal' | 'import' | 'claritas' | 'libertas' | 'sync'>('terminal');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [repoUrl, setRepoUrl] = useState('github.com/ollama/ollama'); // Example default
  const [isSyncing, setIsSyncing] = useState(false);

  // Draggable State
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleSyncClick = () => {
      if (!repoUrl) return;
      setIsSyncing(true);

      // Trigger sync in App (async)
      onSyncRepo(repoUrl);

      // UI loading state reset after a timeout or could be controlled by props
      // For now we just reset button state after 2s to allow re-click
      setTimeout(() => {
          setIsSyncing(false);
      }, 2000);
  }

  const handleDeleteFile = () => {
      if (!selectedNode) return;
      if (confirm(`Are you sure you want to delete "${selectedNode.name}"? This action cannot be undone.`)) {
          onDeleteFile(selectedNode.id);
          onCloseModal();
      }
  }

  // Drag Logic
  const handleMouseDown = (e: React.MouseEvent) => {
      // Only drag if clicking the header
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (isDragging) {
          setPosition({
              x: e.clientX - dragStartRef.current.x,
              y: e.clientY - dragStartRef.current.y
          });
      }
  };

  const handleMouseUp = () => {
      setIsDragging(false);
  };

  useEffect(() => {
      if (isDragging) {
          window.addEventListener('mousemove', handleMouseMove as any);
          window.addEventListener('mouseup', handleMouseUp);
      } else {
          window.removeEventListener('mousemove', handleMouseMove as any);
          window.removeEventListener('mouseup', handleMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove as any);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isDragging]);


  const getFileIcon = (type: FileType) => {
      switch(type) {
          case FileType.CODE: return 'text-blue-400';
          case FileType.IMAGE: return 'text-pink-400';
          case FileType.VIDEO: return 'text-purple-400';
          case FileType.PDF: return 'text-red-300';
          case FileType.SYSTEM: return 'text-red-400';
          case FileType.DIRECTORY: return 'text-purple-400';
          case FileType.DATA_NODE: return 'text-yellow-400';
          default: return 'text-gray-400';
      }
  };

  const filterFilesByParent = (parentId: string) => {
      return allFiles.filter(f => f.parentId === parentId);
  };

  const renderTabContent = () => {
      switch (activeTab) {
          case 'terminal':
              return (
                <div className="flex-1 flex flex-col min-h-0">
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[90%] p-2 rounded-lg ${msg.role === 'user' ? 'bg-green-500/20 text-green-100 border border-green-500/30' : 'bg-blue-500/10 text-blue-100 border border-blue-500/20'}`}>
                                    {msg.role === 'system' && <span className="text-xs text-red-400 block mb-1">[SYSTEM ALERT]</span>}
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                </div>
                                <span className="text-[10px] text-gray-600 mt-1">
                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                        {isProcessing && (
                             <div className="flex items-start animate-pulse">
                                <div className="max-w-[90%] p-2 rounded-lg bg-blue-500/10 text-blue-100 border border-blue-500/20">
                                    <p>Thinking...</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Model Selector */}
                    <div className="px-3 py-2 bg-black/60 border-t border-white/10 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Cpu size={12} className={isOllamaOnline ? "text-cyan-400" : "text-red-400"} />
                            <span className="text-[10px] text-gray-400 uppercase font-mono">Model:</span>
                        </div>
                        <select
                            value={selectedModel}
                            onChange={(e) => onModelChange(e.target.value)}
                            disabled={!isOllamaOnline || availableModels.length === 0}
                            className="bg-black/50 border border-white/20 rounded px-2 py-1 text-xs font-mono text-cyan-100 outline-none focus:border-cyan-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {availableModels.length === 0 ? (
                                <option value="">No models available</option>
                            ) : (
                                availableModels.map(model => (
                                    <option key={model.name} value={model.name}>
                                        {model.name}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    <div className="p-3 bg-black/40 border-t border-white/10 flex items-center space-x-2">
                        <span className="text-green-500 animate-pulse">{'>'}</span>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Execute command..."
                            className="flex-1 bg-transparent border-none outline-none text-green-100 placeholder-gray-600 font-mono text-sm"
                        />
                        <button onClick={handleSend} disabled={isProcessing} className="text-gray-400 hover:text-green-400 transition disabled:opacity-50">
                            <Send size={16} />
                        </button>
                    </div>
                </div>
              );
          
          case 'claritas':
              const claritasFiles = filterFilesByParent(ROOT_CLARITAS_ID);
              return (
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      <div className="text-[10px] text-gray-500 uppercase font-mono p-2 border-b border-white/5 mb-2">
                          Repository: CL4R1T4S
                      </div>
                      {claritasFiles.length === 0 && <div className="text-gray-600 text-center p-4 text-xs">Void Empty.</div>}
                      {claritasFiles.map(file => (
                          <div key={file.id} onClick={() => onJumpToFile(file)} className="flex items-center justify-between p-2 hover:bg-white/5 rounded group border border-transparent hover:border-green-500/30 cursor-pointer transition">
                              <div className="flex items-center space-x-3 overflow-hidden">
                                  <div className={`w-2 h-2 rounded-full ${getFileIcon(file.type).replace('text-', 'bg-')}`} />
                                  <span className="text-sm text-gray-200 font-mono truncate">{file.name}</span>
                              </div>
                              <Zap size={12} className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                      ))}
                  </div>
              );

          case 'libertas':
              const libertasFiles = filterFilesByParent(ROOT_LIBERTAS_ID);
              return (
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      <div className="text-[10px] text-gray-500 uppercase font-mono p-2 border-b border-white/5 mb-2">
                          Repository: L1B3RT4S
                      </div>
                      {libertasFiles.length === 0 && <div className="text-gray-600 text-center p-4 text-xs">Void Empty.</div>}
                      {libertasFiles.map(file => (
                          <div key={file.id} onClick={() => onJumpToFile(file)} className="flex items-center justify-between p-2 hover:bg-white/5 rounded group border border-transparent hover:border-purple-500/30 cursor-pointer transition">
                              <div className="flex items-center space-x-3 overflow-hidden">
                                  <div className={`w-2 h-2 rounded-full ${getFileIcon(file.type).replace('text-', 'bg-')}`} />
                                  <span className="text-sm text-gray-200 font-mono truncate">{file.name}</span>
                              </div>
                              <Zap size={12} className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                      ))}
                  </div>
              );

          case 'import':
               return (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                     <div className="p-4 rounded-full bg-green-500/10 mb-4">
                         <Upload size={32} className="text-green-400" />
                     </div>
                     <h3 className="text-green-400 font-bold font-mono mb-2">DATA INGESTION</h3>
                     <p className="text-xs text-gray-400 mb-6 max-w-[200px]">
                         Upload local files or entire directory structures to the current node.
                     </p>
                     <div className="flex flex-col gap-3 w-full max-w-[200px]">
                        <button 
                            onClick={onInjectData}
                            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-mono text-xs rounded uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.3)] transition flex items-center justify-center gap-2"
                        >
                            <FilePlus size={14} />
                            Select Files
                        </button>
                        <button 
                            onClick={onInjectFolder}
                            className="px-6 py-2 bg-transparent border border-green-500/50 hover:bg-green-500/10 text-green-100 font-mono text-xs rounded uppercase tracking-widest transition flex items-center justify-center gap-2"
                        >
                            <FolderPlus size={14} />
                            Select Folder
                        </button>
                     </div>
                </div>
            );
        
        case 'sync':
            return (
                <div className="flex-1 flex flex-col p-4">
                    <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-2 text-blue-400">
                             <Cloud size={16} />
                             <span className="font-bold font-mono text-sm">REMOTE CONNECTION</span>
                         </div>
                         <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-2 py-0.5 rounded">HTTPS</span>
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="w-full max-w-[250px] space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-400 font-mono uppercase">Repository URL</label>
                                <div className="flex items-center bg-black/50 border border-white/10 rounded px-2 py-1.5">
                                    <GitBranch size={12} className="text-gray-500 mr-2" />
                                    <input 
                                        value={repoUrl}
                                        onChange={(e) => setRepoUrl(e.target.value)}
                                        className="bg-transparent border-none outline-none text-xs font-mono text-white w-full placeholder-gray-700"
                                        placeholder="username/repo"
                                    />
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleSyncClick}
                                disabled={isSyncing}
                                className={`w-full py-2 font-mono text-xs uppercase tracking-widest rounded flex items-center justify-center gap-2 transition ${isSyncing ? 'bg-blue-500/20 text-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]'}`}
                            >
                                {isSyncing ? (
                                    <>
                                        <RefreshCw size={12} className="animate-spin" />
                                        Cloning...
                                    </>
                                ) : (
                                    <>
                                        <Cloud size={12} />
                                        Clone to VDB
                                    </>
                                )}
                            </button>
                        </div>
                        
                        <div className="mt-8 border-t border-white/5 pt-4 w-full">
                             <div className="flex items-center gap-2 mb-2">
                                 <CheckCircle size={12} className="text-gray-600" />
                                 <span className="text-[10px] text-gray-500">Public Repositories</span>
                             </div>
                             <div className="flex items-center gap-2 mb-2">
                                 <CheckCircle size={12} className="text-gray-600" />
                                 <span className="text-[10px] text-gray-500">Auto-Structure Detection</span>
                             </div>
                             <div className="flex items-center gap-2">
                                 <X size={12} className="text-red-900" />
                                 <span className="text-[10px] text-gray-700">Private (Needs Token)</span>
                             </div>
                        </div>
                    </div>
                </div>
            )
      }
  };

  const renderModalContent = () => {
      if (!selectedNode) return null;

      const isFolder = selectedNode.type === FileType.DIRECTORY || selectedNode.type === FileType.DATA_NODE;
      const isImage = selectedNode.type === FileType.IMAGE;
      const isVideo = selectedNode.type === FileType.VIDEO;
      const isPdf = selectedNode.type === FileType.PDF;
      const isText = selectedNode.type === FileType.TEXT || selectedNode.type === FileType.CODE || selectedNode.type === FileType.SYSTEM;

      if (isFolder) {
          return (
            <>
                <div className="mb-6">
                    <div className="text-xs text-green-500 mb-1 tracking-widest uppercase font-mono">Node Controller</div>
                    <h2 className="text-2xl font-bold text-white break-words">{selectedNode.name}</h2>
                    <p className="text-gray-400 text-xs mt-2 font-mono border-l-2 border-gray-700 pl-3 py-1">
                        {selectedNode.content || "Container Node"}
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={onDiveIn}
                        className="flex flex-col items-center justify-center p-4 bg-green-900/20 border border-green-500/30 rounded-lg hover:bg-green-500/20 hover:border-green-500 transition group"
                    >
                        <ZoomIn size={24} className="text-green-400 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-bold text-green-100">Neural Dive</span>
                        <span className="text-[10px] text-green-400/70 mt-1">Open Directory</span>
                    </button>
                    <button 
                        onClick={onInjectData}
                        className="flex flex-col items-center justify-center p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 hover:border-blue-500 transition group"
                    >
                        <FilePlus size={24} className="text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-bold text-blue-100">Inject Here</span>
                        <span className="text-[10px] text-blue-400/70 mt-1">Add to Node</span>
                    </button>
                </div>
            </>
          );
      }

      if (isImage) {
          return (
              <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-pink-400 flex items-center gap-2">
                          <ImageIcon size={18} />
                          {selectedNode.name}
                      </h2>
                      <button
                          onClick={handleDeleteFile}
                          className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 border border-red-500/30 rounded hover:bg-red-500/20 hover:border-red-500 transition text-red-400 text-sm"
                      >
                          <Trash2 size={14} />
                          Delete
                      </button>
                  </div>
                  <div className="flex-1 bg-black/50 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden p-2">
                      <img src={selectedNode.content} alt={selectedNode.name} className="max-w-full max-h-[60vh] object-contain rounded" />
                  </div>
              </div>
          );
      }

      if (isVideo) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                        <VideoIcon size={18} />
                        {selectedNode.name}
                    </h2>
                    <button
                        onClick={handleDeleteFile}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 border border-red-500/30 rounded hover:bg-red-500/20 hover:border-red-500 transition text-red-400 text-sm"
                    >
                        <Trash2 size={14} />
                        Delete
                    </button>
                </div>
                <div className="flex-1 bg-black/50 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden p-2">
                    <video controls src={selectedNode.content} className="max-w-full max-h-[60vh] rounded" />
                </div>
            </div>
        );
      }

      if (isPdf) {
        return (
             <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                        <FileText size={18} />
                        {selectedNode.name}
                    </h2>
                    <button
                        onClick={handleDeleteFile}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 border border-red-500/30 rounded hover:bg-red-500/20 hover:border-red-500 transition text-red-400 text-sm"
                    >
                        <Trash2 size={14} />
                        Delete
                    </button>
                </div>
                <div className="flex-1 bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                    <iframe src={selectedNode.content} className="w-full h-[60vh]" title="PDF Viewer"></iframe>
                </div>
            </div>
        )
      }

      if (isText) {
          return (
              <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                          <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                              <FileText size={18} />
                              {selectedNode.name}
                          </h2>
                          <div className="text-xs text-gray-500 font-mono">{selectedNode.content.length} chars</div>
                      </div>
                      <button
                          onClick={handleDeleteFile}
                          className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 border border-red-500/30 rounded hover:bg-red-500/20 hover:border-red-500 transition text-red-400 text-sm"
                      >
                          <Trash2 size={14} />
                          Delete
                      </button>
                  </div>
                  <div className="flex-1 bg-gray-900/80 border border-white/10 rounded-lg overflow-hidden flex flex-col">
                       <div className="bg-white/5 px-3 py-1 border-b border-white/5 text-[10px] text-gray-400 font-mono flex gap-4">
                           <span>UTF-8</span>
                           <span>READ-ONLY</span>
                       </div>
                       <textarea
                          readOnly
                          value={selectedNode.content}
                          className="w-full h-[50vh] bg-transparent text-green-50 font-mono text-xs p-4 outline-none resize-none"
                       />
                  </div>
              </div>
          );
      }

      return <div className="text-white">Unknown File Type</div>;
  };


  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
      {/* Unified Draggable Widget */}
      <div 
        style={{ 
            transform: `translate(${position.x}px, ${position.y}px)`,
            touchAction: 'none'
        }}
        className="pointer-events-auto absolute flex flex-col w-[360px] bg-black/85 backdrop-blur-xl border border-white/10 rounded-lg shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden max-h-[80vh]"
      >
          {/* Draggable Handle / Header */}
          <div 
            onMouseDown={handleMouseDown}
            className="bg-white/5 p-3 border-b border-white/10 cursor-grab active:cursor-grabbing select-none flex items-center justify-between group"
          >
               <div className="flex items-center gap-2">
                   <GripHorizontal size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                   <h1 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-500 tracking-widest">
                        PLINYVERSE
                    </h1>
               </div>
               <div className="flex items-center space-x-2 text-[10px] text-gray-500 font-mono">
                   <Activity size={10} className="text-green-500 animate-pulse" />
                   <span>ONLINE</span>
               </div>
          </div>

          {/* VDB Stats Row */}
          <div className="px-4 py-2 border-b border-white/10 bg-black/20 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-green-400">
                    <HardDrive size={12} />
                    <span className="font-bold font-mono text-[10px]">VDB STORAGE</span>
                </div>
                <div className="flex space-x-3 text-[10px] font-mono text-gray-400">
                    <span>Nodes: {allFiles.length}</span>
                    <span>Depth: {directoryStack.length}</span>
                </div>
          </div>

          {/* Breadcrumbs Row */}
          <div className="px-3 py-2 border-b border-white/10 bg-white/5 flex items-center space-x-1 overflow-x-auto scrollbar-hide">
                <Database size={12} className="text-gray-500 flex-shrink-0" />
                {directoryStack.map((dir, idx) => (
                    <React.Fragment key={`breadcrumb-${idx}-${dir.id}`}>
                        {idx > 0 && <ChevronRight size={10} className="text-gray-600 flex-shrink-0" />}
                        <button
                            onClick={() => onBreadcrumbClick(idx)}
                            className={`text-[10px] font-mono tracking-wider uppercase whitespace-nowrap transition ${idx === directoryStack.length -1 ? 'text-green-400 font-bold cursor-default' : 'text-gray-400 hover:text-white cursor-pointer'}`}
                        >
                            {dir.name}
                        </button>
                    </React.Fragment>
                ))}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10">
                <button 
                    onClick={() => setActiveTab('terminal')}
                    className={`flex-1 p-3 text-[10px] font-mono uppercase tracking-wider hover:bg-white/5 transition flex justify-center items-center ${activeTab === 'terminal' ? 'bg-white/10 text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}
                >
                    <TerminalIcon size={12} />
                </button>
                 <button 
                    onClick={() => setActiveTab('import')}
                    className={`flex-1 p-3 text-[10px] font-mono uppercase tracking-wider hover:bg-white/5 transition flex justify-center items-center ${activeTab === 'import' ? 'bg-white/10 text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}
                >
                    <Upload size={12} />
                </button>
                <button 
                    onClick={() => setActiveTab('sync')}
                    className={`flex-1 p-3 text-[10px] font-mono uppercase tracking-wider hover:bg-white/5 transition flex justify-center items-center ${activeTab === 'sync' ? 'bg-white/10 text-blue-400 border-b-2 border-blue-400' : 'text-gray-500'}`}
                >
                    <GitBranch size={12} />
                </button>
                <button
                    onClick={() => setActiveTab('claritas')}
                    className={`flex-1 p-3 text-[10px] font-mono uppercase tracking-wider hover:bg-white/5 transition flex justify-center items-center ${activeTab === 'claritas' ? 'bg-white/10 text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}
                >
                    <Shield size={12} className="mr-1.5" />
                    CL4R1T4S
                </button>
                <button
                    onClick={() => setActiveTab('libertas')}
                    className={`flex-1 p-3 text-[10px] font-mono uppercase tracking-wider hover:bg-white/5 transition flex justify-center items-center ${activeTab === 'libertas' ? 'bg-white/10 text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'}`}
                >
                    <Zap size={12} className="mr-1.5" />
                    L1B3RT4S
                </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 flex flex-col min-h-[250px] max-h-[400px] bg-black/40">
              {renderTabContent()}
          </div>
      </div>

      {/* Modal Viewer (Context Aware) */}
      {selectedNode && (
          <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8 animate-fadeIn" onClick={onCloseModal}>
              <div className="w-full max-w-4xl h-[80vh] bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col relative overflow-hidden animate-scaleIn" onClick={(e) => e.stopPropagation()}>
                  <button
                      onClick={onCloseModal}
                      className="absolute top-4 right-4 text-gray-400 hover:text-white transition z-10 bg-black/50 rounded-full p-2 hover:bg-black/70"
                  >
                      <X size={20} />
                  </button>

                  <div className="flex-1 p-6 overflow-auto">
                      {renderModalContent()}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TerminalOverlay;
