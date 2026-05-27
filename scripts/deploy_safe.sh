#!/bin/bash
# deploy_safe.sh - Build in a clean /tmp directory to avoid macOS metadata (._ files) from external drives

set -e # Exit on error

SOURCE_DIR=$(pwd)
BUILD_DIR="/tmp/driver_daily_report_build_$(date +%s)"

echo "🚀 Starting Safe Zone Deployment..."
echo "📂 Source: $SOURCE_DIR"
echo "Target: $BUILD_DIR"

# 1. Create Clean Build Zone
mkdir -p "$BUILD_DIR"

# 2. Copy Project Files (Excluding node_modules, .next, .git to be fast and clean)
echo "📦 Copying source code to Safe Zone..."
rsync -av \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.open-next' \
  --exclude '.git' \
  --exclude '._*' \
  --exclude 'src/app/api/proxy-image' \
  --exclude 'src/app/api/r2/proxy-upload' \
  "$SOURCE_DIR/" "$BUILD_DIR/"

# 3. Enter Safe Zone
cd "$BUILD_DIR"

# 4. Clean any residual metadata (just in case rsync brought some)
echo "👻 Scrubbing Safe Zone..."
find . -name "._*" -delete

# 5. Install Dependencies (Fast Install)
echo "⚡ Installing dependencies in Safe Zone..."
npm install --no-audit --no-fund

# 5.5 Verify remote D1 schema before deploying the app bundle.
# If the trash feature column is missing, the dashboard can go blank on production.
echo "🗄️ Verifying remote D1 schema..."
set +e
D1_DELETED_AT_CHECK=$(npx wrangler d1 execute driver_management --remote --config wrangler.worker.toml --json --command "SELECT COUNT(*) AS count FROM pragma_table_info('applications') WHERE name = 'deleted_at'" 2>/dev/null)
D1_CHECK_STATUS=$?
D1_EXTRA_UPLOAD_CHECK=$(npx wrangler d1 execute driver_management --remote --config wrangler.worker.toml --json --command "SELECT COUNT(*) AS count FROM pragma_table_info('daily_report_summary') WHERE name = 'extra_uploaded_count'" 2>/dev/null)
set -e

if [ $D1_CHECK_STATUS -eq 0 ] && printf '%s' "$D1_DELETED_AT_CHECK" | grep -q '"count":[[:space:]]*0'; then
  echo "   ⚠️ Remote D1 is missing applications.deleted_at. Applying repair..."
  npx wrangler d1 execute driver_management --remote --config wrangler.worker.toml --yes --command "ALTER TABLE applications ADD COLUMN deleted_at TEXT"
elif [ $D1_CHECK_STATUS -ne 0 ]; then
  echo "   ⚠️ Unable to verify remote D1 schema automatically. Continuing deploy."
else
  echo "   ✅ Remote D1 schema looks up to date"
fi

if [ $D1_CHECK_STATUS -eq 0 ] && printf '%s' "$D1_EXTRA_UPLOAD_CHECK" | grep -q '"count":[[:space:]]*0'; then
  echo "   ⚠️ Remote D1 is missing daily_report_summary.extra_uploaded_count. Applying repair..."
  npx wrangler d1 execute driver_management --remote --config wrangler.worker.toml --yes --command "ALTER TABLE daily_report_summary ADD COLUMN extra_uploaded_count INTEGER NOT NULL DEFAULT 0"
fi

echo "   🔎 Ensuring daily_report_summary date index exists..."
npx wrangler d1 execute driver_management --remote --config wrangler.worker.toml --yes --command "CREATE INDEX IF NOT EXISTS idx_daily_report_summary_date ON daily_report_summary(date)" >/dev/null

# 6. Build
echo "🏗️ Building Project..."
# Remove better-sqlite3 just in case
rm -rf node_modules/better-sqlite3 
npx @opennextjs/cloudflare build

# OpenNext may leave a node_modules symlink inside server-functions/default.
# Copying that into Pages assets explodes the worker bundle size and breaks publish.
rm -rf .open-next/server-functions/default/node_modules

# 6.5 Prepare for Cloudflare Pages (Bundle Everything into 'assets')
echo "🔧 Preparing Cloudflare Pages Bundle..."
if [ -f ".open-next/worker.js" ]; then
    # 1. Move/Rename Worker
    cp .open-next/worker.js .open-next/assets/_worker.js
    
    # 2. Copy Dependencies (Server Functions & Build Artifacts)
    # The worker imports from relative paths "../server-functions" typically, 
    # but relative path resolution depends on where it sits.
    # If OpenNext generates worker.js at root, it expects folders at root.
    # So if we put it in assets/, we need folders in assets/.
    
    # DEBUG: List structure to verify existence
    echo "🔎 Listing .open-next structure:"
    find .open-next -maxdepth 2 -not -path '*/.*'
    
    # 2. Copy Dependencies (Force Copy, No Silent Fail)
    echo "   📦 Merging backend folders into assets/..."
    cp -r .open-next/server-functions .open-next/assets/
    cp -r .open-next/middleware .open-next/assets/
    cp -r .open-next/cloudflare .open-next/assets/
    # Don't forget .build (hidden folder)
    cp -r .open-next/.build .open-next/assets/
    
    echo "   ✅ Bundled _worker.js + dependencies (server, middleware, cf, .build)"
else
    echo "   ⚠️ WARNING: worker.js not found! This deployment might be static-only."
fi

# 6.6 Generate _routes.json (CRITICAL for Static Assets)
# In "Advanced Mode" (_worker.js exists), all requests go to Worker by default.
# The generated worker DOES NOT fallback to env.ASSETS for static files automatically.
# We MUST use _routes.json to tell Cloudflare to serve static assets directly.
echo "routes: Generating _routes.json..."
cat > .open-next/assets/_routes.json <<EOF
{
  "version": 1,
  "include": ["/*"],
  "exclude": [
    "/_next/static/*",
    "/fonts/*",
    "/forms/*",
    "/favicon.ico"
  ]
}
EOF
echo "   ✅ Generated _routes.json (Excluding /_next/static/*, /fonts/*, etc.)"

# 7. Deploy
echo "☁️ Deploying to Cloudflare Pages..."
# Ensure we are in the right directory structure for the relative imports to work
npx wrangler pages deploy .open-next/assets --project-name drive-onboard-app --branch main

# 8. Cleanup
echo "🧹 Cleaning up Safe Zone..."
cd "$SOURCE_DIR"
rm -rf "$BUILD_DIR"

echo "✅ Safe Deployment Complete!"
