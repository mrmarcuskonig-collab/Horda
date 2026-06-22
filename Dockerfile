# Horda — SSR app on Node 22 (native TypeScript, embedded Postgres via PGlite).
FROM node:22-slim
WORKDIR /app
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
