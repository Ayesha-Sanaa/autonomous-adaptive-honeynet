FROM docker.io/library/node@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216
WORKDIR /app
COPY backend/package.json ./
RUN npm install --omit=dev
COPY backend/src ./
COPY rl/features.json /rl/features.json
COPY decoys/honeytokens.json /decoys/honeytokens.json
