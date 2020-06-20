#!/bin/sh

echo "Running Vale ..."
<<<<<<< HEAD

matcher_path=`pwd`/vale.json
cp /vale.json "$matcher_path"

=======
>>>>>>> origin/master
echo "::add-matcher::vale.json"

node /lib/main.js
