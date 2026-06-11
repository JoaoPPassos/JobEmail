FROM node:22-alpine AS builder

RUN apk update && apk upgrade --no-cache

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build && test -f dist/main.js || (echo "ERROR: dist/main.js not found after build" && exit 1)


FROM node:22-alpine AS production

RUN apk update && apk upgrade --no-cache

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 4240

ENTRYPOINT ["./entrypoint.sh"]
