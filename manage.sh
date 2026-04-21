#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_DIR="$PROJECT_DIR/summit-dashboard"
BACKUP_DIR="$PROJECT_DIR/backups"

red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
blue()  { printf '\033[0;34m%s\033[0m\n' "$*"; }

usage() {
  cat <<EOF
Snowflake Summit 2026 Agenda Dashboard — Management Script

Usage: ./manage.sh <command>

Commands:
  install, setup    Install all dependencies (npm + Playwright)
  dev, start        Start the Vite dev server
  stop              Stop the running dev server
  build             Production build
  test              Run test suite
  scrape            Re-scrape sessions, speakers, and types from live catalog
  refresh           Scrape + rebuild CSV + production build
  backup            Create a timestamped backup archive
  download          Alias for backup
  list              Show session stats from the current CSV
  help              Show this help message

Examples:
  ./manage.sh install     # First-time setup
  ./manage.sh dev         # Start developing
  ./manage.sh refresh     # Pull latest data and rebuild
  ./manage.sh backup      # Archive current state
EOF
}

cmd_install() {
  blue "Installing root dependencies (Playwright)..."
  cd "$PROJECT_DIR"
  npm install

  blue "Installing Playwright Chromium browser..."
  npx playwright install chromium

  blue "Installing dashboard dependencies..."
  cd "$DASHBOARD_DIR"
  npm install

  green "Setup complete."
}

cmd_dev() {
  blue "Starting dev server..."
  cd "$DASHBOARD_DIR"
  npx vite --open
}

cmd_stop() {
  blue "Stopping dev server..."
  local pids
  pids=$(pgrep -f "vite.*summit-dashboard" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill 2>/dev/null || true
    green "Dev server stopped."
  else
    echo "No running dev server found."
  fi
}

cmd_build() {
  blue "Building production bundle..."
  cd "$DASHBOARD_DIR"
  npx vite build
  green "Build complete. Output in summit-dashboard/dist/"
}

cmd_test() {
  blue "Running tests..."
  cd "$DASHBOARD_DIR"
  npx vitest run
}

cmd_scrape() {
  blue "Scraping sessions from live catalog..."
  cd "$PROJECT_DIR"

  blue "[1/4] Scraping all sessions across all days (clicking Show More)..."
  node scrape_alldays_showmore.mjs

  blue "[2/4] Scraping speakers..."
  node scrape_speakers3.mjs

  blue "[3/4] Scraping session types from catalog filters..."
  node scrape_types_all.mjs

  blue "[4/4] Building enriched CSV (merging DOM + API + type data)..."
  node build_csv_v3.mjs

  green "Scrape complete. CSV updated with all sessions."
}

cmd_refresh() {
  cmd_scrape
  cmd_build
  green "Refresh complete. Dashboard rebuilt with latest data."
}

cmd_backup() {
  mkdir -p "$BACKUP_DIR"
  local timestamp
  timestamp=$(date +%Y%m%d_%H%M%S)
  local archive="$BACKUP_DIR/summit_backup_${timestamp}.tar.gz"

  blue "Creating backup: $archive"

  local files=()
  # CSV data
  [ -f "$PROJECT_DIR/summit_sessions.csv" ] && files+=("summit_sessions.csv")
  # Scraped JSON (if present)
  for f in scraped_sessions.json scraped_speakers.json session_types.json session_types_all.json api_sessions_all.json; do
    [ -f "$PROJECT_DIR/$f" ] && files+=("$f")
  done
  # Dashboard source
  files+=("summit-dashboard/src" "summit-dashboard/public" "summit-dashboard/tests")
  files+=("summit-dashboard/package.json" "summit-dashboard/vite.config.js" "summit-dashboard/index.html")
  # Build scripts
  for f in build_csv_v3.mjs scrape_alldays_showmore.mjs scrape_speakers3.mjs scrape_types_all.mjs build_csv_v2.mjs scrape_catalog.mjs scrape_types.mjs; do
    [ -f "$PROJECT_DIR/$f" ] && files+=("$f")
  done
  # Config
  [ -f "$PROJECT_DIR/.gitignore" ] && files+=(".gitignore")
  [ -f "$PROJECT_DIR/manage.sh" ] && files+=("manage.sh")
  # Dist (if built)
  [ -d "$DASHBOARD_DIR/dist" ] && files+=("summit-dashboard/dist")

  cd "$PROJECT_DIR"
  tar -czf "$archive" "${files[@]}" 2>/dev/null

  local size
  size=$(du -h "$archive" | cut -f1)
  green "Backup created: $archive ($size)"
}

cmd_list() {
  local csv="$PROJECT_DIR/summit_sessions.csv"
  if [ ! -f "$csv" ]; then
    red "No summit_sessions.csv found. Run ./manage.sh scrape first."
    exit 1
  fi

  cd "$DASHBOARD_DIR"
  node -e "
    const Papa = require('papaparse');
    const fs = require('fs');
    const csv = fs.readFileSync('$csv', 'utf8');
    const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });

    console.log('Summit Sessions CSV: ' + data.length + ' sessions\n');

    const count = (field) => {
      const counts = {};
      data.forEach(r => { const v = r[field] || '(empty)'; counts[v] = (counts[v] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    };

    console.log('Sessions by format:');
    count('format').forEach(([k, v]) => console.log('  ' + v.toString().padStart(3) + '  ' + k));

    console.log('\nSessions by day:');
    count('day').forEach(([k, v]) => console.log('  ' + v.toString().padStart(3) + '  ' + k));

    console.log('\nSessions by track:');
    count('track').forEach(([k, v]) => console.log('  ' + v.toString().padStart(3) + '  ' + k));

    const speakers = '$PROJECT_DIR/scraped_speakers.json';
    if (fs.existsSync(speakers)) {
      const n = JSON.parse(fs.readFileSync(speakers, 'utf8')).length;
      console.log('\nSpeakers: ' + n);
    }
  "
}

# Main dispatch
case "${1:-help}" in
  install|setup)  cmd_install ;;
  dev|start)      cmd_dev ;;
  stop)           cmd_stop ;;
  build)          cmd_build ;;
  test)           cmd_test ;;
  scrape)         cmd_scrape ;;
  refresh)        cmd_refresh ;;
  backup|download) cmd_backup ;;
  list)           cmd_list ;;
  help|--help|-h) usage ;;
  *)
    red "Unknown command: $1"
    usage
    exit 1
    ;;
esac
