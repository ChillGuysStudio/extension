#!/bin/bash
# publish.sh — Sign via AMO, push to GitHub, create Release, update updates.json
#
# Requirements:
#   npm install -g web-ext
#   brew install gh && gh auth login
#
# Credentials — copy .env.example to .env and fill in:
#   AMO_JWT_ISSUER   from https://addons.mozilla.org/developers/addon/api/key/
#   AMO_JWT_SECRET   from the same page

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env if present
if [ -f .env ]; then
    # shellcheck disable=SC1091
    set -a; source .env; set +a
fi

# ── Validate prerequisites ────────────────────────────────────────────────────
if [ -z "$AMO_JWT_ISSUER" ] || [ -z "$AMO_JWT_SECRET" ]; then
    echo "Error: AMO_JWT_ISSUER and AMO_JWT_SECRET must be set (copy .env.example → .env)"
    exit 1
fi
command -v web-ext >/dev/null 2>&1 || { echo "Error: web-ext not found. Run: npm install -g web-ext"; exit 1; }
command -v gh      >/dev/null 2>&1 || { echo "Error: gh not found. Run: brew install gh && gh auth login"; exit 1; }
command -v node    >/dev/null 2>&1 || { echo "Error: node not found."; exit 1; }

# ── Read version from manifest ────────────────────────────────────────────────
VERSION=$(node -p "require('./public/manifest.json').version")
TAG="v${VERSION}"
echo "▶ Publishing ${TAG}..."

# ── Build runtime files ───────────────────────────────────────────────────────
bun run build

# ── Sign with AMO ─────────────────────────────────────────────────────────────
rm -rf web-ext-artifacts
web-ext sign \
    --api-key    "$AMO_JWT_ISSUER" \
    --api-secret "$AMO_JWT_SECRET" \
    --channel    unlisted \
    --source-dir dist \
    --artifacts-dir web-ext-artifacts

# Find the signed .xpi
XPI=$(ls web-ext-artifacts/*.xpi 2>/dev/null | head -1)
if [ -z "$XPI" ]; then
    echo "Error: Signing failed — no .xpi in web-ext-artifacts/"
    exit 1
fi
echo "✔ Signed: $XPI"

# Copy to a stable filename for the release asset
cp "$XPI" web-ext-artifacts/extension.xpi

# ── Update updates.json ───────────────────────────────────────────────────────
RELEASE_URL="https://github.com/ChillGuysStudio/extension/releases/download/${TAG}/extension.xpi"
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('updates.json', 'utf8'));
const updates = data.addons['clipboard-manager@tools.browser'].updates;
if (!updates.find(e => e.version === '${VERSION}')) {
    updates.push({ version: '${VERSION}', update_link: '${RELEASE_URL}' });
    fs.writeFileSync('updates.json', JSON.stringify(data, null, 2) + '\n');
    console.log('✔ updates.json updated');
} else {
    console.log('✔ updates.json already has ${VERSION}');
}
"

# ── Commit & push ─────────────────────────────────────────────────────────────
git add public/manifest.json updates.json publish.sh package.json README.md
git diff --cached --quiet || git commit -m "v${VERSION}"
git push
echo "✔ Pushed to GitHub"

# ── Create GitHub Release ─────────────────────────────────────────────────────
if gh release view "$TAG" >/dev/null 2>&1; then
    echo "Release $TAG already exists — uploading asset..."
    gh release upload "$TAG" web-ext-artifacts/extension.xpi --clobber
else
    gh release create "$TAG" web-ext-artifacts/extension.xpi \
        --title "$TAG" \
        --notes "Release ${TAG}"
fi
echo "✔ GitHub Release ${TAG} ready"

echo ""
echo "✅ Done! v${VERSION} is live."
echo "   Install URL: https://github.com/ChillGuysStudio/extension/releases/download/${TAG}/extension.xpi"
