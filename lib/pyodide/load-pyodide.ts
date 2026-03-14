"use client";

const PYODIDE_SCRIPT_ID = "pyodide-runtime-script";
const PYODIDE_SCRIPT_URL = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";
const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/";

type LoadPyodideOptions = {
  indexURL: string;
};

type PyodideInstance = {
  loadPackagesFromImports: (
    code: string,
    options?: { messageCallback?: (message: string) => void }
  ) => Promise<void>;
  runPythonAsync: (code: string) => Promise<void>;
  setStdout: (options: { batched: (output: string) => void }) => void;
};

type PyodideGlobal = typeof globalThis & {
  loadPyodide?: (options: LoadPyodideOptions) => Promise<PyodideInstance>;
};

let scriptPromise: Promise<void> | null = null;
let pyodidePromise: Promise<PyodideInstance> | null = null;

function getPyodideGlobal(): PyodideGlobal {
  return globalThis as PyodideGlobal;
}

function loadPyodideScript(): Promise<void> {
  if (scriptPromise) {
    return scriptPromise;
  }

  const existingScript = document.getElementById(PYODIDE_SCRIPT_ID);
  if (existingScript) {
    scriptPromise = Promise.resolve();
    return scriptPromise;
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = PYODIDE_SCRIPT_ID;
    script.src = PYODIDE_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Pyodide"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function getPyodide() {
  if (pyodidePromise) {
    return pyodidePromise;
  }

  pyodidePromise = (async () => {
    await loadPyodideScript();

    const pyodideGlobal = getPyodideGlobal();
    if (!pyodideGlobal.loadPyodide) {
      throw new Error("Pyodide did not initialize correctly");
    }

    return pyodideGlobal.loadPyodide({
      indexURL: PYODIDE_INDEX_URL,
    });
  })();

  return pyodidePromise;
}
