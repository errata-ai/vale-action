# `jdkato/vale` installs Vale to `/bin/vale`.
FROM jdkato/vale:v2.15.5

RUN apk add --no-cache --update nodejs nodejs-npm git openjdk11 libxslt

COPY lib /lib
COPY package.json /package.json

RUN npm install --production
RUN wget -O - -q https://raw.githubusercontent.com/reviewdog/reviewdog/master/install.sh| sh -s -- -b bin ${REVIEWDOG_VERSION}

RUN wget https://github.com/dita-ot/dita-ot/releases/download/3.6/dita-ot-3.6.zip
RUN unzip dita-ot-3.6.zip > /dev/null 2>&1

ENV REVIEWDOG_VERSION=v0.14.1
ENV PATH="/dita-ot-3.6/bin:${PATH}"

ENTRYPOINT ["node", "/lib/main.js"]
