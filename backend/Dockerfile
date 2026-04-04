FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++ cifs-utils
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
