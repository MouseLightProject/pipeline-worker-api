FROM node:7.10

WORKDIR /app

COPY dist .

RUN yarn global add knex@0.13.0

RUN yarn install

CMD ["./docker-entry.sh"]

EXPOSE  3500
