import { ref, readonly } from 'vue'
import type { FlatNode, RepoInfo } from '../../shared/types'
import { base64ToBytes, toPlainArrayBuffer } from '../../shared/encoding'
import { useI18n } from './useI18n'
import { collectSubtreeFiles } from '../../shared/tree-utils'
import { loadZipRuntime } from '../runtime/loaders'

export interface DownloadProgress {
  folderName: string
  total: number
  done: number
  status: 'downloading' | 'zipping' | 'done' | 'cancelled' | 'error'
  errorCount: number
}

const CONCURRENCY = 6
const LARGE_FOLDER_THRESHOLD = 500

export function useDownloadFolder() {
  const { t } = useI18n()
  const progress = ref<DownloadProgress | null>(null)
  let abortController: AbortController | null = null

  async function fetchFileViaBackground(
    owner: string,
    repo: string,
    branch: string,
    path: string,
  ): Promise<Uint8Array> {
    const res = await chrome.runtime.sendMessage({
      type: 'FETCH_RAW',
      owner,
      repo,
      branch,
      path,
    })
    if (res.error) throw new Error(res.error)
    return base64ToBytes(res.base64)
  }

  function triggerDownload(data: ArrayBuffer, fileName: string, mimeType = 'application/octet-stream') {
    const blob = new Blob([data], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function clearProgressAfterDelay() {
    setTimeout(() => {
      progress.value = null
    }, 2000)
  }

  async function download(
    allNodes: FlatNode[],
    dirNode: FlatNode,
    repoInfo: RepoInfo,
  ) {
    const files = collectSubtreeFiles(allNodes, dirNode)
    const folderName = dirNode.name
    const zipName = `${repoInfo.repo}-${folderName}.zip`

    if (files.length === 0) return

    // Confirm for large folders
    if (files.length > LARGE_FOLDER_THRESHOLD) {
      const ok = confirm(t.value('download.confirm', { count: files.length }))
      if (!ok) return
    }

    abortController = new AbortController()
    const { signal } = abortController

    progress.value = {
      folderName,
      total: files.length,
      done: 0,
      status: 'downloading',
      errorCount: 0,
    }

    const zipData: Record<string, Uint8Array> = {}
    // Use parent dir as base so the folder itself is the zip root
    const lastSlash = dirNode.path.lastIndexOf('/')
    const basePath = lastSlash > 0 ? dirNode.path.slice(0, lastSlash) : ''

    // Concurrent fetch with pool
    let idx = 0
    const errors: string[] = []

    async function worker() {
      while (idx < files.length) {
        if (signal.aborted) return
        const fileIdx = idx++
        const file = files[fileIdx]
        try {
          const data = await fetchFileViaBackground(
            repoInfo.owner,
            repoInfo.repo,
            repoInfo.branch,
            file.path,
          )
          // Strip base folder path for zip-internal path
          const relativePath = basePath
            ? file.path.slice(basePath.length + 1)
            : file.path
          zipData[relativePath] = data
        } catch {
          errors.push(file.path)
          if (progress.value) progress.value.errorCount++
        }
        if (progress.value) progress.value.done++
      }
    }

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, files.length) },
      () => worker(),
    )
    await Promise.all(workers)

    if (signal.aborted) {
      progress.value = { ...progress.value!, status: 'cancelled' }
      clearProgressAfterDelay()
      return
    }

    // Zip
    if (progress.value) progress.value.status = 'zipping'
    const zipRuntime = await loadZipRuntime()
    const zipped = zipRuntime.createZipArchive(zipData)

    triggerDownload(toPlainArrayBuffer(zipped), zipName, 'application/zip')

    if (progress.value) {
      progress.value.status = errors.length > 0 ? 'error' : 'done'
    }
    clearProgressAfterDelay()
  }

  async function downloadFile(
    fileNode: FlatNode,
    repoInfo: RepoInfo,
  ) {
    abortController = new AbortController()
    const { signal } = abortController

    progress.value = {
      folderName: fileNode.name,
      total: 1,
      done: 0,
      status: 'downloading',
      errorCount: 0,
    }

    try {
      const data = await fetchFileViaBackground(
        repoInfo.owner,
        repoInfo.repo,
        repoInfo.branch,
        fileNode.path,
      )

      if (signal.aborted) {
        progress.value = { ...progress.value!, status: 'cancelled' }
        clearProgressAfterDelay()
        return
      }

      if (progress.value) progress.value.done = 1
      triggerDownload(toPlainArrayBuffer(data), fileNode.name)

      if (progress.value) progress.value.status = 'done'
    } catch {
      if (signal.aborted) {
        progress.value = { ...progress.value!, status: 'cancelled' }
      } else if (progress.value) {
        progress.value.done = 1
        progress.value.errorCount = 1
        progress.value.status = 'error'
      }
    }

    clearProgressAfterDelay()
  }

  function cancel() {
    abortController?.abort()
  }

  return {
    progress: readonly(progress),
    download,
    downloadFile,
    cancel,
  }
}
