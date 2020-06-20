# `jdkato/vale` installs Vale to `/bin/vale`.
FROM jdkato/vale

RUN apk add --no-cache --update nodejs nodejs-npm

COPY lib /lib
COPY package.json /package.json
COPY vale.json /vale.json
COPY entrypoint.sh /entrypoint.sh

RUN npm install --production

ENTRYPOINT ["/entrypoint.sh"]
