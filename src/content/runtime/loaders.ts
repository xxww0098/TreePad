export interface MarkdownRuntimeModule {
  renderMarkdownToSafeHtml: (text: string) => string
}

export interface ZipRuntimeModule {
  createZipArchive: (files: Record<string, Uint8Array>) => Uint8Array
}

let markdownRuntimePromise: Promise<MarkdownRuntimeModule> | null = null
let zipRuntimePromise: Promise<ZipRuntimeModule> | null = null

async function importExtensionModule<T>(fileName: string): Promise<T> {
  const url = chrome.runtime.getURL(fileName)
  return import(/* @vite-ignore */ url) as Promise<T>
}

export function loadMarkdownRuntime(): Promise<MarkdownRuntimeModule> {
  if (!markdownRuntimePromise) {
    markdownRuntimePromise = importExtensionModule<MarkdownRuntimeModule>('markdown-runtime.js')
  }
  return markdownRuntimePromise
}

export function loadZipRuntime(): Promise<ZipRuntimeModule> {
  if (!zipRuntimePromise) {
    zipRuntimePromise = importExtensionModule<ZipRuntimeModule>('zip-runtime.js')
  }
  return zipRuntimePromise
}
