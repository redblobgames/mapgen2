#!/bin/sh
mkdir -p build
esbuild --bundle mapgen2.js --sourcemap --minify --outfile=build/_bundle.js
