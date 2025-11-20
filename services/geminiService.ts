import { GoogleGenAI, Type } from "@google/genai";
import { INITIAL_SYSTEM_PROMPT } from '../constants';
import { AIOperationResult } from '../types';

const apiKey = process.env.API_KEY || ''; 
// Note: In a real production app, we would handle missing keys more gracefully in the UI.
// For this demo, we assume the environment provides it.

const ai = new GoogleGenAI({ apiKey });

export const sendCommandToKernel = async (
  userPrompt: string, 
  contextFiles: string[]
): Promise<AIOperationResult> => {
  
  try {
    const modelId = 'gemini-2.5-flash';
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `User Command: ${userPrompt}\n\nCurrent File Context: ${contextFiles.join(', ')}`,
      config: {
        systemInstruction: INITIAL_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                message: { type: Type.STRING },
                fileOperations: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            action: { type: Type.STRING, enum: ["create", "update", "delete", "rename"] },
                            file: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ["TEXT", "CODE", "IMAGE", "DATA_NODE", "DIRECTORY"] },
                                    content: { type: Type.STRING }
                                }
                            }
                        }
                    }
                },
                suggestedNodes: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            description: { type: Type.STRING },
                            type: { type: Type.STRING }
                        }
                    }
                }
            }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini Kernel");
    
    return JSON.parse(text) as AIOperationResult;

  } catch (error) {
    console.error("Gemini Kernel Panic:", error);
    return {
      message: "Kernel Error: Unable to process request. Check neural link (API Key).",
      fileOperations: [],
      suggestedNodes: []
    };
  }
};