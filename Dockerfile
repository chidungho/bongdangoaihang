FROM node:22-alpine

WORKDIR /app

# Server runtime does not need Puppeteer's bundled Chromium.
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
