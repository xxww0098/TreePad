import type { FlatNode } from '../../shared/types'

export interface MentionNodeBuckets {
  files: FlatNode[]
  folders: FlatNode[]
}

interface MentionScoredItem {
  node: FlatNode
  score: number
}

const DEFAULT_MENTION_LIMIT = 10

export function partitionMentionNodes(nodes: FlatNode[]): MentionNodeBuckets {
  const files: FlatNode[] = []
  const folders: FlatNode[] = []

  for (const node of nodes) {
    if (node.isDir) {
      folders.push(node)
    } else {
      files.push(node)
    }
  }

  return { files, folders }
}

export function scoreMentionMatch(path: string, name: string, query: string): number {
  const lowerName = name.toLowerCase()
  const lowerPath = path.toLowerCase()

  if (lowerName === query) return 0
  if (lowerName.startsWith(query)) return 1
  if (lowerName.includes(query)) return 2
  if (lowerPath.endsWith(query)) return 3
  if (lowerPath.includes(query)) return 4
  return Number.POSITIVE_INFINITY
}

export function buildMentionItems(
  buckets: MentionNodeBuckets,
  attachedFiles: ReadonlySet<string>,
  rawQuery: string,
  limit = DEFAULT_MENTION_LIMIT,
): FlatNode[] {
  const query = rawQuery.trim()

  if (!query) {
    const initial: FlatNode[] = []

    for (const file of buckets.files) {
      if (attachedFiles.has(file.path)) continue
      initial.push(file)
      if (initial.length >= limit) return initial
    }

    for (const folder of buckets.folders) {
      initial.push(folder)
      if (initial.length >= limit) return initial
    }

    return initial
  }

  const matches: MentionScoredItem[] = []

  for (const file of buckets.files) {
    if (attachedFiles.has(file.path)) continue
    const score = scoreMentionMatch(file.path, file.name, query)
    if (Number.isFinite(score)) {
      matches.push({ node: file, score })
    }
  }

  for (const folder of buckets.folders) {
    const score = scoreMentionMatch(folder.path, folder.name, query)
    if (Number.isFinite(score)) {
      matches.push({ node: folder, score })
    }
  }

  matches.sort((a, b) => a.score - b.score || a.node.path.length - b.node.path.length)
  return matches.slice(0, limit).map(({ node }) => node)
}
