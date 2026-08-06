FROM node:20-alpine
WORKDIR /app
ENV NODE_OPTIONS=--openssl-legacy-provider
RUN apk add --no-cache python3 make g++ samba-client
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
