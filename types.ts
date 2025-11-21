
export enum FileType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  PDF = 'PDF',
  CODE = 'CODE',
  SYSTEM = 'SYSTEM',
  DATA_NODE = 'DATA_NODE',
  DIRECTORY = 'DIRECTORY'
}

export interface VirtualFile {
  id: string;
  parentId?: string | null; // For hierarchy/drilling down
  name: string;
  type: FileType;
  content: string;
  createdAt: number;
  coordinates?: [number, number, number]; // 3D position
  clusterId?: string; // Which cluster this file belongs to
}

export interface Cluster {
  id: string;
  name: string;
  position: [number, number, number]; // Position in the multi-cluster canvas
  color: string; // Visual color for the cluster
  createdAt: number;
}

export interface SystemMessage {
  id: string;
  role: 'user' | 'system' | 'ai';
  content: string;
  timestamp: number;
}

export interface AIOperationResult {
  message: string;
  fileOperations?: {
    action: 'create' | 'update' | 'delete' | 'rename';
    file: VirtualFile;
  }[];
  suggestedNodes?: {
    name: string;
    description: string;
    type: string;
  }[];
}

export interface DirectoryState {
  id: string;
  name: string;
}
