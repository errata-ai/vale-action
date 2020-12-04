FROM devinalgolia/vale:2.6.4

COPY lib /lib
COPY package.json /package.json

RUN npm install --production

ENTRYPOINT ["node", "/lib/main.js"]