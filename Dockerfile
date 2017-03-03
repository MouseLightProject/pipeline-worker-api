FROM node:7

WORKDIR /app

# Bundle app source
COPY . .

# Have native modules - get rid of current platform, if present
RUN rm -rf node_modules

# Local/build misc
RUN rm -rf .idea .git .DS_Store internal-data

# Build tools
RUN npm install -g typescript@2.1.6 knex && npm cache clean

# Install app dependencies
RUN npm install && npm cache clean

# Compile
RUN tsc

EXPOSE  3001
