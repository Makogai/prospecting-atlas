# Build context is the REPO ROOT, not bot/ — the bot reads src/data/*.json and
# public/sprites/ from the same commit the website is built from.
#   docker build -f bot/Dockerfile -t prospecting-atlas-bot .
FROM node:22-slim
WORKDIR /app

COPY bot/package.json bot/package-lock.json* ./bot/
RUN cd bot && npm install --omit=dev

# Shared formatting, the generated database, and the sprites the cards draw.
COPY shared/        ./shared/
COPY src/data/      ./src/data/
COPY public/sprites/ ./public/sprites/
COPY bot/src/       ./bot/src/
COPY bot/assets/    ./bot/assets/

ENV NODE_ENV=production
WORKDIR /app/bot

# No inbound port: the bot holds an outbound gateway websocket.
CMD ["node", "src/index.js"]
