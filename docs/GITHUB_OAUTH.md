# GitHub OAuth For TreePad

TreePad uses GitHub OAuth Device Flow for the extension login path. This is the safest option for a published browser extension because it only requires the OAuth App `client_id`; the standard web authorization flow still needs a `client_secret`, which should not be embedded in a client-side extension.

## Register The OAuth App

Open GitHub Developer Settings and create an OAuth App:

- Application name: your release name, for example `TreePad`
- Homepage URL: the public project URL for the extension
- Authorization callback URL: `https://<chrome-extension-id>.chromiumapp.org/github`
- Device Flow: enable it for the OAuth App

Useful docs:

- https://docs.github.com/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app
- https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow

## Release Configuration

Put the GitHub OAuth defaults into `.env.production.local`:

```bash
VITE_GITHUB_OAUTH_CLIENT_ID=Iv1.your_client_id
VITE_GITHUB_OAUTH_APP_NAME=TreePad
VITE_GITHUB_OAUTH_APP_HOMEPAGE=https://github.com/your-org/TreePad
TREEPAD_EXTENSION_ID=your_chrome_extension_id
```

`VITE_GITHUB_OAUTH_CLIENT_ID` is compiled into the published build so OAuth is available immediately in Settings.

`TREEPAD_EXTENSION_ID` is not consumed by the extension at runtime. It is used by the release helper docs to render the final callback URL in the packaged output.

## Build And Verify

1. Add the env vars above.
2. Run `./build.sh` or `./build.sh --zip`.
3. Load unpacked from `TreePad-unpacked/` if you update the extension locally. Reusing the same directory helps Chrome keep the same extension ID and storage.
4. Open the generated `TreePad-vX.Y.Z/GITHUB_OAUTH_SETUP.md`.
5. Confirm the packaged callback URL and client ID match the GitHub OAuth App registration.
