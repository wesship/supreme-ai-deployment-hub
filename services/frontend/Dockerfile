# Devonn.ai staging frontend adapter
#
# Build context: repo root
# Runtime source: existing root Vite/React application

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run typecheck
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

RUN npm install -g serve@14.2.4

COPY --from=builder /app/dist ./dist

ENV HOST=0.0.0.0
ENV PORT=5173

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5173 >/dev/null 2>&1 || exit 1

CMD ["serve", "-s", "dist", "-l", "5173"]
