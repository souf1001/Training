# Builds the web app and runs the server in one small container.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/lib ./src/lib
# the SQLite database lives in /data, mount a volume there so it survives restarts
RUN mkdir -p /data && chown node:node /data
VOLUME /data
# don't run as root
USER node
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.ts"]
