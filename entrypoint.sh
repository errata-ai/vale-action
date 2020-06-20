#!/bin/sh

echo "Running Vale ..."
echo "::add-matcher::vale.json"

node /lib/main.js
