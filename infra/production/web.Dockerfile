FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace frontend --include-workspace-root
COPY frontend frontend
ARG APP_DOMAIN
RUN test -n "$APP_DOMAIN" && VITE_API_URL="https://$APP_DOMAIN" VITE_WS_URL="wss://$APP_DOMAIN/ws" npm run build:frontend

FROM caddy:2-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b
RUN setcap -r /usr/bin/caddy
COPY --from=build /app/frontend/dist /srv
COPY infra/production/Caddyfile /etc/caddy/Caddyfile
USER 1000:1000
