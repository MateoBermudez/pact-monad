#!/usr/bin/env bash
set -euo pipefail

forge inspect PactEscrow abi --json > ../app/abi/PactEscrow.json
echo "ABI exportado a app/abi/PactEscrow.json"
