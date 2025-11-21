# PLINYVERSE

**Repository:** [lalomorales22/the_plinyverse](https://github.com/lalomorales22/the_plinyverse)

## Overview
**PLINYVERSE** is a futuristic, 3D Visualization Database (VDB) Operating System that runs in your browser. It reimagines file management and data exploration by transforming your file system into a reactive **3D Neural Globe Matrix**. Instead of navigating boring lists and icons, you explore data nodes, folders, and media as interconnected, glowing entities floating in a digital void.

Powered by **Ollama** (local AI inference) and a persistent **SQLite** backend, the system acts as an intelligent kernel (`PLINY-KERNEL`). It allows you to navigate, create, and manipulate a persistent virtual file system using natural language, drag-and-drop interactions, and immersive 3D navigation.

## What is it for?
The Plinyverse is designed for:
*   **Visual Data Exploration**: Seeing the relationships and hierarchy of your data in 3D space.
*   **Immersive File Management**: A sci-fi interface for organizing code, media, and documents.
*   **AI-Assisted Workflows**: Using local LLMs to generate file structures, summarize content, or assist with coding tasks within the environment.
*   **Repository Visualization**: Cloning GitHub repositories and instantly visualizing their structure as a 3D galaxy of code.

## Key Features

### 🌌 Core Architecture
*   **3D Engine**: Built with **React Three Fiber (R3F)**, featuring custom particle systems, instanced meshes, and post-processing effects for a high-performance, cinematic experience.
*   **Persistent Database**: A **SQLite** backend ensures that all your imported files, folders, and GitHub clones are saved locally and persist between sessions.
*   **Local AI Integration**: Connects directly to your local **Ollama** instance, allowing you to chat with your file system and perform AI-driven operations using models like Llama 3, Mistral, or Gemma.

### 🧭 Navigation & Interaction
*   **Neural Dive**: Seamlessly zoom and "warp" into folders. Clicking a directory node automatically triggers a cinematic camera dive into that cluster, revealing its inner contents.
*   **Smart Navigation**: 
    *   **CL4R1T4S**: Auto-dives into folders for rapid exploration.
    *   **L1B3RT4S**: Navigates to the file's location in 3D space for inspection.
*   **Glassmorphism HUD**: A sleek, draggable, and minimizable OS interface for managing the terminal, imports, and settings.

### 📥 Data Ingestion & Sync
*   **GitHub Cloning**: Paste a GitHub repository URL to instantly clone the entire codebase into your Plinyverse. The system fetches branches, creates the directory structure, and downloads file contents automatically.
*   **Drag & Drop**: Drag *any* file or folder from your computer directly onto the 3D globe to ingest it into the database.
*   **Multi-Format Support**:
    *   **Code**: Syntax-highlighted editor.
    *   **Images**: Holographic gallery viewer.
    *   **Videos**: Embedded media player.
    *   **PDFs**: Integrated document reader.

## Getting Started

### Prerequisites
1.  **Node.js**: Ensure you have Node.js installed (v18+ recommended).
2.  **Ollama (Optional but Recommended)**:
    *   Download from [ollama.com](https://ollama.com).
    *   Pull a model: `ollama run gemma3:1b` (or your preferred model).
    *   Start the server: `ollama serve`.

### Installation & Run
1.  Clone the repository:
    ```bash
    git clone https://github.com/lalomorales22/The_Plinyverse.git
    cd the_plinyverse
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the application (Frontend + Backend):
    ```bash
    npm run dev
    ```
4.  Open your browser to `http://localhost:3000`.

## Project Structure
The system boots with two primary root clusters:
*   **CL4R1T4S**: Represents structure, definitions, and documentation.
*   **L1B3RT4S**: Represents creative works, free-form data, and expansions.

---
*Built with Gemini 3 Pro, Claude Code, React, Three.js, Express, SQLite, Ollama, and friendship*
*Happy Turkey Day Pliny!*
