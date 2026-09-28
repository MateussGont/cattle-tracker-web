FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace frontend --include-workspace-root
COPY frontend frontend
RUN VITE_API_URL=http://localhost:8080 VITE_WS_URL=ws://localhost:8080/ws npm run build:frontend

FROM caddy:2-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b
COPY --from=build /app/frontend/dist /srv
COPY infra/production/Caddyfile.internal /etc/caddy/Caddyfile
USER 1000:1000
