# NOTE: `jdkato/vale` installs Python 3 already, so we can simply use `pip3`
# to install other Python libraries.
#
# Vale is installed to `/vale`.
FROM jdkato/vale

RUN apk add --no-cache --update nodejs nodejs-npm

COPY . .

RUN bin/vale -v
RUN npm install --production

ENTRYPOINT ["node", "/lib/main.js"]
