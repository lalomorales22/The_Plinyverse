# PLINYVERSE

## Overview
**PLINYVERSE** is a conceptual 3D Visualization Database (VDB) Operating System running in the browser. It utilizes a reactive 3D Neural Globe Matrix to visualize data nodes, folders, and media files as interconnected entities in a void.

Powered by **Ollama** (local AI inference), the system acts as an intelligent kernel (`PLINY-KERNEL`), capable of understanding natural language to navigate, create, and manipulate the persistent virtual file system. Users can select from any locally installed Ollama model.

## Progress & Features

### Core Architecture
- [x] **React Three Fiber (R3F) 3D Engine**: A completely custom 3D renderer using particle systems and instanced meshes for high-performance data visualization.
- [x] **Persistent VDB**: A flat-file database structure implemented in state, ensuring files and folders persist during a session.
- [x] **Glassmorphism HUD**: A futuristic "OS-like" interface overlaying the 3D world.

### Navigation & Interaction
- [x] **Neural Dive**: Click to zoom and "warp" into folders (Directories), revealing their inner contents as new explosive clusters.
- [x] **Breadcrumb History**: Track your path through the `CL4R1T4S` and `L1B3RT4S` data structures.
- [x] **Manual Camera Control**: Full orbit, zoom, and pan controls with damping for a smooth feel.
- [x] **Warp Speed Animation**: Cinematic camera effects when transitioning between data layers.

### Data Ingestion & Viewing
- [x] **Drag & Drop Ingestion**: Drag *any* file (Images, Videos, PDF, Text) from your computer directly onto the 3D globe to import it.
- [x] **Contextual Injection**: Use the "Import" tab or "Inject Here" context menu to add files specifically to the node you are inspecting.
- [x] **Multi-Format Support**:
    - **Images**: Opens in a holographic Gallery Viewer.
    - **Videos**: Plays in an embedded media player node.
    - **PDFs**: Renders in an integrated document reader.
    - **Text/Code**: Opens in a syntax-highlighted terminal editor.

### Initial Data State
The system boots with two primary root clusters:
1.  **CL4R1T4S**: Contains structured data, manifestos, and clear-text definitions.
2.  **L1B3RT4S**: Contains creative works, free-form data, and expansions.

## Setup & Usage

### Prerequisites
1.  **Install Ollama**: Download and install Ollama from [https://ollama.com](https://ollama.com)
2.  **Pull a Model**: Run `ollama pull llama2` (or any other model like `mistral`, `codellama`, `phi`, etc.)
3.  **Start Ollama**: Run `ollama serve` to start the local Ollama server (default: http://localhost:11434)

### Usage
1.  **Start the App**: Run `npm install` and `npm run dev`
2.  **Model Selection**: The app will automatically detect available Ollama models. Select your preferred model from the dropdown in the terminal interface.
3.  **Exploration**: Use the mouse to rotate the globe. Click nodes to inspect. Click "Neural Dive" to enter folders.
4.  **Creation**: Use the Console to ask the AI to create folders (e.g., "Create a directory for my python scripts").
5.  **Importing**: Drag files onto the screen to populate your Plinyverse.

### Configuration
- **Custom Ollama URL**: Set the `OLLAMA_BASE_URL` environment variable if Ollama is running on a different host/port (default: http://localhost:11434)
