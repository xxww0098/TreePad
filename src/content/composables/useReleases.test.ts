import { describe, it, expect } from 'vitest'
import { classifyAssets } from './useReleases'
import type { GitHubReleaseAsset } from '../../shared/types'

describe('classifyAssets', () => {
  const createAsset = (name: string): GitHubReleaseAsset => ({
    id: 1,
    name,
    size: 1024,
    browser_download_url: `https://github.com/foo/bar/releases/download/v1.0.0/${name}`,
    content_type: 'application/octet-stream',
  })

  it('classifies source code archives correctly', () => {
    const assets = [
      createAsset('app-mac.dmg'),
      createAsset('Source.code.zip'),
      createAsset('source-code.tar.gz'),
      createAsset('app-linux.deb')
    ]

    const result = classifyAssets(assets, 'mac', 'arm64')
    expect(result.source.map(a => a.name)).toEqual(['Source.code.zip', 'source-code.tar.gz'])
    expect(result.matched.map(a => a.name)).toEqual(['app-mac.dmg'])
    expect(result.other.map(a => a.name)).toEqual(['app-linux.deb'])
  })

  it('matches mac arm64 correctly', () => {
    const assets = [
      createAsset('App-macOS-arm64.dmg'),
      createAsset('App-macOS-x64.dmg'),
      createAsset('App-Windows.exe'),
      createAsset('App-macOS-universal.dmg') // universal should match both architectures
    ]

    const result = classifyAssets(assets, 'mac', 'arm64')
    expect(result.matched.map(a => a.name)).toEqual(['App-macOS-arm64.dmg', 'App-macOS-universal.dmg'])
    expect(result.other.map(a => a.name)).toEqual(['App-macOS-x64.dmg', 'App-Windows.exe'])
  })

  it('matches mac x64 correctly', () => {
    const assets = [
      createAsset('App-macOS-arm64.dmg'),
      createAsset('App-macOS-x64.dmg'),
      createAsset('App-Windows.exe'),
      createAsset('App-macOS-universal.dmg')
    ]

    const result = classifyAssets(assets, 'mac', 'x64')
    expect(result.matched.map(a => a.name)).toEqual(['App-macOS-x64.dmg', 'App-macOS-universal.dmg'])
    expect(result.other.map(a => a.name)).toEqual(['App-macOS-arm64.dmg', 'App-Windows.exe'])
  })
  
  it('matches windows x64 correctly', () => {
    const assets = [
      createAsset('App-macos.dmg'),
      createAsset('App-win32-x64.exe'),
      createAsset('App-win32-arm64.exe'),
      createAsset('App-windows-amd64.msi'),
      createAsset('App-linux.AppImage')
    ]
    
    // Test windows x64
    const resX64 = classifyAssets(assets, 'win', 'x64')
    expect(resX64.matched.map(a => a.name)).toEqual(['App-win32-x64.exe', 'App-windows-amd64.msi'])
    expect(resX64.other.length).toBe(3)
    
    // Test windows arm64
    const resArm64 = classifyAssets(assets, 'win', 'arm64')
    expect(resArm64.matched.map(a => a.name)).toEqual(['App-win32-arm64.exe'])
  })

  it('matches windows generic (no explicit arch) to user arch', () => {
    const assets = [
      createAsset('App-Windows.exe'), // Should match any Windows arch
      createAsset('App-macOS.dmg')
    ]

    const result = classifyAssets(assets, 'win', 'x64')
    expect(result.matched.map(a => a.name)).toEqual(['App-Windows.exe'])
    
    const result2 = classifyAssets(assets, 'win', 'arm64')
    expect(result2.matched.map(a => a.name)).toEqual(['App-Windows.exe'])
  })

  it('matches linux correctly', () => {
    const assets = [
      createAsset('App-ubuntu-headless.deb'),
      createAsset('App-x86_64.AppImage'),
      createAsset('App.rpm'),
      createAsset('App-win.exe')
    ]

    const result = classifyAssets(assets, 'linux', 'x64')
    expect(result.matched.map(a => a.name)).toEqual(['App-ubuntu-headless.deb', 'App-x86_64.AppImage', 'App.rpm'])
    expect(result.other.map(a => a.name)).toEqual(['App-win.exe'])
  })

  it('handles unknown platform gracefully', () => {
    const assets = [
      createAsset('App-mac.dmg'),
      createAsset('App-win.exe')
    ]

    const result = classifyAssets(assets, 'unknown', 'x64')
    expect(result.matched.length).toBe(0)
    expect(result.other.length).toBe(2)
  })
})

import { useReleases } from './useReleases'
import { ref } from 'vue'

describe('useReleases composable formatters', () => {
  const repoInfoRef = ref({ owner: 'a', repo: 'b', branch: 'main', path: '' })
  const { formatFileSize, formatDate } = useReleases(repoInfoRef)

  it('formats file sizes correctly', () => {
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(1500)).toBe('1.5 KB')
    expect(formatFileSize(1500000)).toBe('1.4 MB')
  })

  it('formats dates correctly', () => {
    // using a fixed timezone or string match can be tricky depending on locale,
    // but we check if it produces a valid non-empty string.
    expect(formatDate(null)).toBe('')
    const dateStr = formatDate('2023-01-15T10:00:00Z')
    expect(dateStr).toContain('2023')
    expect(dateStr.length).toBeGreaterThan(5)
  })
})
