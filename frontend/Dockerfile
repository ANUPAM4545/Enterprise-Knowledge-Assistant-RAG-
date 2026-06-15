FROM node:20-alpine

WORKDIR /app

# Copy lock files and install dependencies
COPY package*.json ./
RUN npm install

# Copy frontend source files
COPY . .

EXPOSE 5173

# Run Vite dev server bound to 0.0.0.0 to enable host machine proxying
CMD ["npm", "run", "dev", "--", "--host"]
