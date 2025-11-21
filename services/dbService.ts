import { VirtualFile } from '../types';

const API_URL = 'http://localhost:3001/api';

export const dbService = {
    async getAllFiles(): Promise<VirtualFile[]> {
        try {
            const response = await fetch(`${API_URL}/files`);
            if (!response.ok) throw new Error('Failed to fetch files');
            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('DB Fetch Error:', error);
            return [];
        }
    },

    async saveFile(file: VirtualFile): Promise<void> {
        try {
            await fetch(`${API_URL}/files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(file)
            });
        } catch (error) {
            console.error('DB Save Error:', error);
        }
    },

    async saveFilesBatch(files: VirtualFile[]): Promise<void> {
        try {
            await fetch(`${API_URL}/files/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(files)
            });
        } catch (error) {
            console.error('DB Batch Save Error:', error);
        }
    },

    async deleteFile(id: string): Promise<void> {
        try {
            await fetch(`${API_URL}/files/${id}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('DB Delete Error:', error);
        }
    }
};
