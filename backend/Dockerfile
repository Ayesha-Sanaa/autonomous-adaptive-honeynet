FROM node:alpine
WORKDIR /app
COPY backend/package.json ./
RUN npm install --omit=dev
COPY backend/src ./
COPY rl/features.json /rl/features.json