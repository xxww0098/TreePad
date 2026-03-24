import { describe, expect, it } from 'vitest'
import { parseGitHubURL, resolveMatchedGitHubRef } from './useGitHub'

describe('resolveMatchedGitHubRef', () => {
  it('chooses the longest matching branch and derives the remaining file path', () => {
    expect(
      resolveMatchedGitHubRef(
        'feature/deep/experiment/src/app.ts',
        ['feature', 'feature/deep', 'feature/deep/experiment'],
      ),
    ).toEqual({
      branch: 'feature/deep/experiment',
      path: 'src/app.ts',
    })
  })

  it('returns an empty path when the raw ref exactly matches a branch', () => {
    expect(
      resolveMatchedGitHubRef(
        'release/2026.03',
        ['main', 'release/2026.03'],
      ),
    ).toEqual({
      branch: 'release/2026.03',
      path: '',
    })
  })

  it('returns null when no branch prefix matches the raw ref', () => {
    expect(
      resolveMatchedGitHubRef(
        'feature/deep/src/app.ts',
        ['main', 'release/2026.03'],
      ),
    ).toBeNull()
  })
})

describe('parseGitHubURL', () => {
  it('keeps the full raw ref for later branch resolution', () => {
    expect(
      parseGitHubURL('https://github.com/acme/treepad/blob/feature/deep/src/app.ts'),
    ).toEqual({
      owner: 'acme',
      repo: 'treepad',
      type: 'blob',
      branch: 'feature',
      path: 'deep/src/app.ts',
      rawRef: 'feature/deep/src/app.ts',
    })
  })
})
