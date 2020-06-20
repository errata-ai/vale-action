#!/bin/sh

echo "Running Vale ..."

cp /vale.json "$HOME/"
echo "::add-matcher::$HOME/vale.json"

node /lib/main.js
