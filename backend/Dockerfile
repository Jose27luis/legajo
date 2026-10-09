# syntax=docker/dockerfile:1

FROM node:22-alpine AS dependencias
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencias AS compilacion
WORKDIR /app
COPY . .
RUN pnpm prisma:generate && pnpm build

FROM node:22-alpine AS ejecucion
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S legajos && adduser -S legajos -G legajos
COPY --from=compilacion --chown=legajos:legajos /app/node_modules ./node_modules
COPY --from=compilacion --chown=legajos:legajos /app/dist ./dist
COPY --from=compilacion --chown=legajos:legajos /app/prisma ./prisma
COPY --from=compilacion --chown=legajos:legajos /app/prisma.config.ts ./prisma.config.ts
COPY --from=compilacion --chown=legajos:legajos /app/package.json ./package.json
COPY --chown=legajos:legajos docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
USER legajos
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
