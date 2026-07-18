#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "$0")/.." && pwd)"
fixture_dir="$workspace_dir/fixtures/seat-limit-race"
output_dir="$workspace_dir/dist"
staging_dir="$(mktemp -d "${TMPDIR:-/tmp}/gapwitness-fixture.XXXXXX")"
trap 'rm -rf "$staging_dir"' EXIT

mkdir -p "$output_dir" "$staging_dir/seat-limit-race"
cp -R "$fixture_dir/." "$staging_dir/seat-limit-race/"
(
  cd "$staging_dir/seat-limit-race"
  npm ci --ignore-scripts --no-audit --no-fund
)
(
  cd "$staging_dir"
  zip -qr "$staging_dir/seat-limit-race.zip" seat-limit-race
)
mv "$staging_dir/seat-limit-race.zip" "$output_dir/seat-limit-race.zip"

echo "Created $output_dir/seat-limit-race.zip"
