FROM node:21 as build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Path: Dockerfile
FROM node:21-alpine

WORKDIR /app

COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./
COPY --from=build /app/dist/views ./views
COPY --from=build /app/dist/public ./public

RUN npm ci

EXPOSE 3000

CMD ["node", "index.bundle.cjs"]
