#!/bin/bash
# Downloads the official Node.js build that goes inside the App, verifying its checksum and signature.
# Usage: scripts/fetch-official-node.sh <version> <directory>
# Prints AGENT_FLOW_NODE=<path>, the variable npm run build:dmg reads.
set -euo pipefail

version="$1"
archive="node-v${version}-darwin-arm64.tar.gz"
base="https://nodejs.org/dist/v${version}"

mkdir -p "$2"
cd "$2"
curl -fsSL --retry 3 -o "$archive" "$base/$archive"
curl -fsSL --retry 3 -o SHASUMS256.txt "$base/SHASUMS256.txt"
grep " ${archive}\$" SHASUMS256.txt | shasum -a 256 -c - >&2
tar -xzf "$archive"

node="$PWD/node-v${version}-darwin-arm64/bin/node"
codesign --verify --strict "$node"
codesign -dv "$node" 2>&1 | grep -q '^TeamIdentifier=HX7739G8FX$' # Node.js Foundation
echo "AGENT_FLOW_NODE=$node"
