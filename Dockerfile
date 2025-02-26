FROM node:20

# Install Git and build dependencies
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    make \
    g++ \
    build-essential

WORKDIR /app

COPY . .

# Copy .env file

# Rebuild native modules for the current architecture
RUN npm rebuild

RUN npm install && npm run build

CMD ["node", "dist/main"]