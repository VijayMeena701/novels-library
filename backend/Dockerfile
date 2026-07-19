# syntax=docker/dockerfile:1

# Build stage: compile TypeScript from backend source
FROM node:20-slim AS build

WORKDIR /app

# Skip Puppeteer's Chromium download at install time; we use the system Chrome in the runtime image
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN npm ci

# Copy source and compile
COPY . ./
RUN npm run build

# Runtime stage: lean image with system Chrome for Puppeteer
FROM node:20-slim

# Install Google Chrome and fonts for Puppeteer
RUN apt-get update \
    && apt-get install -y wget gnupg ca-certificates \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

# Copy compiled output and dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

RUN npm ci --omit=dev

# Storage directory for cover images and scraper profile
RUN mkdir -p /app/storage /app/.scraper-profile && chown -R node:node /app

USER node

EXPOSE 5050

CMD ["node", "dist/app.js"]
