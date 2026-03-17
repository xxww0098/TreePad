import fs from 'node:fs'
import path from 'node:path'

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  const result = {}
  const text = fs.readFileSync(filePath, 'utf8')

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    result[key] = value
  }

  return result
}

function loadEnv(root) {
  const files = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.production.local',
  ]

  return files.reduce((acc, file) => {
    return {
      ...acc,
      ...parseEnvFile(path.join(root, file)),
    }
  }, {})
}

function valueFrom(env, key, fallback = '') {
  const direct = process.env[key]
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const loaded = env[key]
  if (typeof loaded === 'string' && loaded.trim()) return loaded.trim()
  return fallback
}

const root = path.resolve(process.argv[2] || process.cwd())
const outDir = process.argv[3] ? path.resolve(process.argv[3]) : null
const env = loadEnv(root)
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8'))

const appName = valueFrom(env, 'VITE_GITHUB_OAUTH_APP_NAME', 'TreePad')
const homepageUrl = valueFrom(env, 'VITE_GITHUB_OAUTH_APP_HOMEPAGE', 'https://github.com/')
const clientId = valueFrom(env, 'VITE_GITHUB_OAUTH_CLIENT_ID')
const extensionId = valueFrom(env, 'TREEPAD_EXTENSION_ID')
const callbackUrl = extensionId
  ? `https://${extensionId}.chromiumapp.org/github`
  : 'https://<chrome-extension-id>.chromiumapp.org/github'

const notes = []
if (!clientId) {
  notes.push('- Missing `VITE_GITHUB_OAUTH_CLIENT_ID`: default OAuth will not be enabled until you add it.')
}
if (!extensionId) {
  notes.push('- Missing `TREEPAD_EXTENSION_ID`: replace `<chrome-extension-id>` with the published extension ID from the Chrome Web Store item.')
}

const markdown = `# GitHub OAuth Release Setup

Use these values when registering the GitHub OAuth App for TreePad's published build.

## GitHub OAuth App fields

- Application name: \`${appName}\`
- Homepage URL: \`${homepageUrl}\`
- Authorization callback URL: \`${callbackUrl}\`
- Device Flow: Enable it for this OAuth App

## Release build config

- Client ID: \`${clientId || '<set VITE_GITHUB_OAUTH_CLIENT_ID>'}\`
- Recommended env file: \`.env.production.local\`

\`\`\`bash
VITE_GITHUB_OAUTH_CLIENT_ID=${clientId || 'Iv1.your_client_id'}
VITE_GITHUB_OAUTH_APP_NAME=${appName}
VITE_GITHUB_OAUTH_APP_HOMEPAGE=${homepageUrl}
TREEPAD_EXTENSION_ID=${extensionId || 'your_chrome_extension_id'}
\`\`\`

## Notes

${notes.length > 0 ? notes.join('\n') : '- OAuth default config is present. The published build should show OAuth as ready in Settings.'}

## Docs

- GitHub OAuth App creation: https://docs.github.com/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app
- GitHub OAuth Device Flow: https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
`

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'GITHUB_OAUTH_SETUP.md'), markdown)
} else {
  process.stdout.write(markdown)
}
