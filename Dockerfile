FROM node:24-bookworm-slim AS manifests
WORKDIR /app
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
COPY --from=build /app/frontend/dist /app/frontend/dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js", "--serve-frontend"]
