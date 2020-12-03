FROM node:10.16

# Download Vale
RUN wget https://github.com/errata-ai/vale/releases/download/v2.6.4/vale_2.6.4_Linux_64-bit.tar.gz

# Unpack tar file
RUN tar -xvf vale_2.6.4_Linux_64-bit.tar.gz

# Move unpacked vale executable to /usr/local
RUN mv vale /bin
ENV PATH=$PATH:/bin/

COPY lib /lib
COPY package.json /package.json

RUN npm install --production

ENTRYPOINT ["node", "/lib/main.js"]