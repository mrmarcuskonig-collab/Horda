# Horda — SSR app on Node 22 (native TypeScript, embedded Postgres via PGlite).
FROM node:22-slim
WORKDIR /app
# Fonts for the matchday-card rasteriser (src/web/raster.ts). node:22-slim ships
# with NO fonts: without these, every share card renders as a valid, correctly
# sized, completely EMPTY rectangle — no error, no log line, just a blank picture
# in someone's WhatsApp. tests/card.test.ts guards the same failure.
RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-liberation fontconfig \
  && fc-cache -f \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
# persist the embedded DB across restarts (mount a volume at /data)
# set HORDA_DEMO=0 in production to disable the demo fallback account
ENV PORT=8787
ENV HORDA_DATA=/data
ENV HORDA_DEMO=1
EXPOSE 8787
VOLUME ["/data"]
CMD ["node", "src/web/server.ts"]
