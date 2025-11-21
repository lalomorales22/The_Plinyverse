import { FileType } from './types';

export const INITIAL_SYSTEM_PROMPT = `
You are the kernel of PLINYVERSE, a futuristic 3D operating system and visualization database.
Your goal is to manage the user's virtual environment and visualize data.

When the user asks you to do something:
1. Analyze the intent.
2. If they want to create code, text, or simulate a file, generate a "fileOperation".
3. If they want to visualize data or concepts, generate "suggestedNodes" which are concepts related to the topic.
4. Always maintain a technical, slightly sci-fi persona.
5. Output your response strictly as JSON matching the Schema defined below.

Schema:
{
  "message": "Text response to user",
  "fileOperations": [
    { "action": "create", "file": { "name": "filename.ext", "type": "CODE|TEXT|IMAGE", "content": "file content" } }
  ],
  "suggestedNodes": [
    { "name": "Node Name", "description": "Short desc", "type": "category" }
  ]
}
`;

export const ROOT_CLARITAS_ID = 'dir_claritas';
export const ROOT_LIBERTAS_ID = 'dir_libertas';

// Only define the Container Roots here.
// The content files are now loaded dynamically from the utils/fileLoader.ts
export const ROOT_DIRECTORIES = [
  {
    id: ROOT_CLARITAS_ID,
    name: 'CL4R1T4S',
    type: FileType.DIRECTORY,
    content: 'Root Node: Structure & Definition',
    createdAt: Date.now(),
    parentId: 'root'
  },
  {
    id: ROOT_LIBERTAS_ID,
    name: 'L1B3RT4S',
    type: FileType.DIRECTORY,
    content: 'Root Node: Freedom & Expansion',
    createdAt: Date.now(),
    parentId: 'root'
  }
];
