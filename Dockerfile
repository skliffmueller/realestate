FROM risingstack/alpine:3.4-v7.0.0-4.1.0

# Set default environment for image
ENV NODE_ENV development-local

# Create app directory
WORKDIR /var/app

# Install Node packages
COPY package.json package.json
RUN npm i
RUN mv /var/app/node_modules /node_modules

# Bundle app source
COPY . .

CMD ["node", "crawl.js"]