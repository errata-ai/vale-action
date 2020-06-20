#!/bin/sh

echo "Running Vale ..."

matcher_path=`pwd`/vale.json
cp /vale.json "$matcher_path"

echo "::add-matcher::vale.json"

node /lib/main.js
