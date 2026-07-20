#!/usr/bin/env bash
# Browser QA — drives a REAL headless Chromium through the journeys a status-code
# crawler can't see: back-nav landing, login/join state, follow state, JS errors.
# This is the QA layer that kept missing bugs when we only had unit tests + a
# crawler. Every assertion here is the result of an actual click in a browser.
#
# Requires: playwright-core + a chromium build. In this sandbox chromium needs a
# tiny libXdamage stub (headless never calls it) on LD_LIBRARY_PATH. Locally,
# with chromium's system deps installed, plain `node _bqa.ts` works too.
export LD_LIBRARY_PATH="${LD_LIBRARY_PATH:-/tmp/xlibs}"
node _bqa.ts
