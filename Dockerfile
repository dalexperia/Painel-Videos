# Etapa de build
FROM oven/bun:1 AS build
WORKDIR /app
COPY package*.json ./
COPY bun.lock* ./
RUN bun install
COPY . .
RUN bun run build

# Etapa final
FROM oven/bun:1
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package*.json ./
COPY --from=build /app/bun.lock* ./
RUN bun add serve
EXPOSE 4173
CMD ["bunx", "serve", "-s", "dist", "-l", "4175"]
