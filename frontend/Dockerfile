# syntax=docker/dockerfile:1

FROM node:22-alpine AS compilacion
WORKDIR /app
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY infra/nginx/legajos.conf /etc/nginx/conf.d/legajos.conf
COPY --from=compilacion /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
