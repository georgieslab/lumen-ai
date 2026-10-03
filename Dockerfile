# Multi-stage Dockerfile for Lumen AI
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/services ./services
COPY --from=builder /app/src/components/ParticleOrb.css ./src/components/ParticleOrb.css

EXPOSE 3000

CMD ["node", "server.js"]
