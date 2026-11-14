FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8787 \
    GH_AUTHORITY_DATA=/data/rooms.json
WORKDIR /app
COPY package.json ./
COPY js/ ./js/
COPY server/ ./server/
RUN mkdir -p /data && chown -R node:node /app /data
USER node
VOLUME ["/data"]
EXPOSE 8787
CMD ["npm", "run", "start:authority"]
