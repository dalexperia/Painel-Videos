# Etapa de build
FROM oven/bun:1 AS build

WORKDIR /app
COPY package*.json bun.lockb ./
RUN bun install
COPY . .
RUN bun run build

# Etapa final
FROM oven/bun:1
WORKDIR /app

# Copia apenas o build final
COPY --from=build /app/dist ./dist
COPY package*.json bun.lockb ./

# Instala o servidor leve
RUN bun add serve

EXPOSE 4173
CMD ["bunx", "serve", "-s", "dist", "-l", "4173"]
