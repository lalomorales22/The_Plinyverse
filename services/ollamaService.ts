import { INITIAL_SYSTEM_PROMPT } from '../constants';
import { AIOperationResult } from '../types';

// Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

export interface OllamaModelsResponse {
  models: OllamaModel[];
}

/**
 * Fetches the list of available models from the local Ollama instance
 */
export const listAvailableModels = async (): Promise<OllamaModel[]> => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data: OllamaModelsResponse = await response.json();
    return data.models || [];
  } catch (error) {
    console.error("Error fetching Ollama models:", error);
    return [];
  }
};

/**
 * Sends a command to the Ollama kernel for processing
 * @param userPrompt The user's command/prompt
 * @param contextFiles Array of file names for context
 * @param modelName The Ollama model to use (e.g., 'llama2', 'mistral', 'codellama')
 */
export const sendCommandToKernel = async (
  userPrompt: string,
  contextFiles: string[],
  modelName: string = 'llama2'
): Promise<AIOperationResult> => {

  try {
    // Construct the full prompt with context
    const fullPrompt = `User Command: ${userPrompt}\n\nCurrent File Context: ${contextFiles.join(', ')}\n\nRemember to respond ONLY with valid JSON matching the schema.`;

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        prompt: fullPrompt,
        system: INITIAL_SYSTEM_PROMPT,
        format: 'json', // Request JSON output from Ollama
        stream: false,   // Disable streaming for simpler response handling
        options: {
          temperature: 0.7,
          top_p: 0.9,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.response) {
      throw new Error("No response from Ollama Kernel");
    }

    // Parse the JSON response
    const parsedResponse = JSON.parse(data.response) as AIOperationResult;

    // Validate the response structure
    if (!parsedResponse.message) {
      throw new Error("Invalid response format from Ollama");
    }

    return parsedResponse;

  } catch (error) {
    console.error("Ollama Kernel Panic:", error);

    // Check if Ollama is running
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isConnectionError = errorMessage.includes('fetch') || errorMessage.includes('network');

    return {
      message: isConnectionError
        ? "Kernel Error: Unable to connect to Ollama. Please ensure Ollama is running (ollama serve) and accessible at " + OLLAMA_BASE_URL
        : "Kernel Error: Unable to process request. " + errorMessage,
      fileOperations: [],
      suggestedNodes: []
    };
  }
};

/**
 * Checks if Ollama service is available
 */
export const checkOllamaStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    return response.ok;
  } catch (error) {
    return false;
  }
};
