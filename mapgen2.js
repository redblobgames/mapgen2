/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *      http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const SimplexNoise = require('simplex-noise');
const DualMesh =     require('@redblobgames/dual-mesh');
const createMesh =   require('@redblobgames/dual-mesh/create');
const Map =          require('@redblobgames/mapgen2');
const Draw =         require('./draw');
const {makeRandInt, makeRandFloat} = require('./prng');


let uiState = {
    seed: 24,
    size: 'medium',
    output: 'biomes',
    noisyFills: true,
    noisyEdges: true,
};
   

let _mapCache = [];
function getMap(size) {
    const spacing = {
        small: 38,
        medium: 26,
        large: 18,
        huge: 12.8,
        ginormous: 9,
    };
    if (!_mapCache[size]) {
        _mapCache[size] = new Map(
            new DualMesh(createMesh(spacing[size], makeRandFloat(12345))),
            {amplitude: 0.2, length: 4, seed: 12345},
            makeRandInt
        );
        console.log(`Map size "${size}" has ${_mapCache[size].mesh.r_vertex.length} regions`);
    }
    return _mapCache[size];
}


function draw() {
    let map = getMap(uiState.size);
    map.calculate({
        noise: new SimplexNoise(makeRandFloat(uiState.seed)),
    });

    let canvas = document.getElementById('map');
    let ctx = canvas.getContext('2d');

    let size = Math.min(canvas.parentNode.clientWidth, canvas.parentNode.clientHeight);
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    if (window.devicePixelRatio && window.devicePixelRatio != 1) {
        canvas.width = size * window.devicePixelRatio;
        canvas.height = size * window.devicePixelRatio;
    }
    ctx.save();
    ctx.scale(canvas.width / 1000, canvas.height / 1000);
    Draw.background(ctx);
    Draw.noisyRegionsBase(ctx, map, uiState.noisyEdges);
    Draw.noisyRegionsMain(ctx, map, uiState.noisyEdges);
    Draw.noisyEdges(ctx, map, uiState.noisyEdges);
    if (uiState.noisyFills) {
        Draw.noisyFill(ctx, 1000, 1000, makeRandInt(12345));
    }
    ctx.restore();
    
}


function initUi() {
    document.querySelectorAll("input[type='radio']").forEach(
        (element) => { element.addEventListener('click', getUiState); }
    );
    document.querySelectorAll("input[type='checkbox']").forEach(
        (element) => { element.addEventListener('click', getUiState); }
    );
}

function setUiState() {
    document.getElementById('seed').value = uiState.seed;
    document.querySelector("input#size-" + uiState.size).checked = true;
    document.querySelector("input#output-" + uiState.output).checked = true;
    document.querySelector("input#noisy-edges").checked = uiState.noisyEdges;
    document.querySelector("input#noisy-fills").checked = uiState.noisyFills;
}

function getUiState() {
    uiState.seed = document.getElementById('seed').valueAsNumber;
    uiState.size = document.querySelector("input[name='size']:checked").value;
    uiState.output = document.querySelector("input[name='output']:checked").value;
    uiState.noisyEdges = document.querySelector("input#noisy-edges").checked;
    uiState.noisyFills = document.querySelector("input#noisy-fills").checked;
    requestAnimationFrame(draw);
}

function setSeed(seed) {
    uiState.seed = seed & 0x7fffffff;
    setUiState();
    requestAnimationFrame(draw);
}

global.readSeed = function() { getUiState(); };
global.prevSeed = function() { setSeed(uiState.seed - 1); };
global.nextSeed = function() { setSeed(uiState.seed + 1); };


initUi();
setUiState();
getUiState();
