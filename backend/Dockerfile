FROM node:alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY normalize.js ./
COPY normalizers ./normalizers