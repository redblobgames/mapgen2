/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */
'use strict';

const hashInt = require('hash-int');

exports.makeRandInt = function(seed) {
    let i = 0;
    return function(N) {
        i++;
        return hashInt(seed + i) % N;
    };
};

exports.makeRandFloat = function(seed) {
    let randInt = exports.makeRandInt(seed);
    let divisor = 0x10000000;
    return function() {
        return randInt(divisor) / divisor;
    };
};
