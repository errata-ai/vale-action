# `jdkato/vale` installs Vale to `/bin/vale`.
FROM jdkato/vale:v2.15.5

ENV REVIEWDOG_VERSION=v0.14.1

RUN apk add --no-cache --update nodejs nodejs-npm git

COPY lib /lib
COPY package.json /package.json

RUN npm install --production
RUN wget -O - -q https://raw.githubusercontent.com/reviewdog/reviewdog/master/install.sh| sh -s -- -b bin ${REVIEWDOG_VERSION}

ENTRYPOINT ["node", "/lib/main.js"]
