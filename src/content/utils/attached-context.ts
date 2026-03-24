import { base64ToText } from '../../shared/encoding'
import { collectSubtreeFiles } from '../../shared/tree-utils'
import type { FlatNode, RepoInfo } from '../../shared/types'
import type { AttachedFile } from '../composables/useConversationHistory'

export const ATTACHED_CONTEXT_CONCURRENCY = 6

interface BuildAttachedFilesContextOptions {
  repo: RepoInfo | null
  allNodes: FlatNode[]
  files: AttachedFile[]
  folders: AttachedFile[]
  fetchFileContent: (path: string) => Promise<string | null>
}

interface AttachedContextEntry {
  path: string
  content: string
}

function collectAttachedFileTargets(
  allNodes: FlatNode[],
  files: AttachedFile[],
  folders: AttachedFile[],
): AttachedFile[] {
  const uniqueTargets = new Map<string, AttachedFile>()

  for (const file of files) {
    uniqueTargets.set(file.path, file)
  }

  for (const folder of folders) {
    const folderNode = allNodes.find((node) => node.path === folder.path && node.isDir)
    if (!folderNode) continue

    const subtreeFiles = collectSubtreeFiles(allNodes, folderNode)
    for (const fileNode of subtreeFiles) {
      uniqueTargets.set(fileNode.path, { path: fileNode.path, name: fileNode.name })
    }
  }

  return [...uniqueTargets.values()]
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++
      results[currentIndex] = await mapper(items[currentIndex])
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

export async function buildAttachedFilesContext(
  options: BuildAttachedFilesContextOptions,
): Promise<string> {
  if (!options.repo || (options.files.length === 0 && options.folders.length === 0)) {
    return ''
  }

  const fileTargets = collectAttachedFileTargets(options.allNodes, options.files, options.folders)
  if (fileTargets.length === 0) return ''

  const entries = await mapWithConcurrency(
    fileTargets,
    ATTACHED_CONTEXT_CONCURRENCY,
    async (file): Promise<AttachedContextEntry | null> => {
      try {
        const content = await options.fetchFileContent(file.path)
        if (!content) return null
        return { path: file.path, content }
      } catch {
        return null
      }
    },
  )

  const results = entries.filter(Boolean) as AttachedContextEntry[]
  if (results.length === 0) return ''

  return results
    .map((result) => `File: ${result.path}\n\`\`\`\n${result.content}\n\`\`\``)
    .join('\n\n')
}

export async function fetchAttachedFileContentViaBackground(
  repo: RepoInfo,
  path: string,
): Promise<string | null> {
  const res = await chrome.runtime.sendMessage({
    type: 'FETCH_RAW',
    owner: repo.owner,
    repo: repo.repo,
    branch: repo.branch,
    path,
  })

  if (res.error || !res.base64) return null
  return base64ToText(res.base64)
}
