FROM node:24-bookworm-slim AS manifests
WORKDIR /app
# Mesma versão de packageManager no package.json da raiz; atualize os dois juntos.
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

FROM manifests AS build
RUN pnpm install --frozen-lockfile
COPY backend/ backend/
COPY frontend/ frontend/
RUN pnpm build

FROM manifests AS production-deps
RUN pnpm --filter tcc-evasao-backend install --prod --frozen-lockfile

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HTTP_HOST=0.0.0.0 PORT=3000
WORKDIR /app/backend
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=production-deps /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/sql/migrations ./sql/migrations
COPY --from=build /app/frontend/dist /app/frontend/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/server.js", "--serve-frontend"]
