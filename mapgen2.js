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
    majorSeed: 24,
    minorSeed: 1,
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
        // NOTE: the seeds here are constant so that I can reuse the same
        // mesh and noisy edges for all maps, but you could get more variety
        // by creating a new Map object each time
        _mapCache[size] = new Map(
            new DualMesh(createMesh(spacing[size], makeRandFloat(12345))),
            {amplitude: 0.2, length: 4, seed: 12345},
            makeRandInt
        );
        console.log(`Map size "${size}" has ${_mapCache[size].mesh.r_vertex.length} regions`);
    }
    return _mapCache[size];
}


/**
 * Manage drawing with requestAnimationFrame
 *
 * 1. Each frame call one function from the queue.
 * 2. If the queue empties, stop calling requestAnimationFrame.
 */
const processingPerFrameInMs = 1000/60;
let requestAnimationFrameId = null;
let requestAnimationFrameQueue = [];
function requestAnimationFrameHandler() {
    requestAnimationFrameId = null;
    let timeStart = performance.now();
    while (requestAnimationFrameQueue.length > 0
           && performance.now() - timeStart < processingPerFrameInMs) {
        let f = requestAnimationFrameQueue.shift();
        f();
    }
    console.log(performance.now() - timeStart, 'milliseconds');
    if (requestAnimationFrameQueue.length > 0) {
        requestAnimationFrameId = requestAnimationFrame(requestAnimationFrameHandler);
    }
}


function draw() {
    let map = getMap(uiState.size);

    let canvas = document.getElementById('map');
    let ctx = canvas.getContext('2d');

    let size = Math.min(canvas.parentNode.clientWidth, canvas.parentNode.clientHeight);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    //size = 1024;
    if (window.devicePixelRatio && window.devicePixelRatio != 1) {
        size *= window.devicePixelRatio;
    }
    canvas.width = size;
    canvas.height = size;
    
    requestAnimationFrameQueue = [
        () => {
            map.calculate({
                noise: new SimplexNoise(makeRandFloat(uiState.majorSeed)),
                drainageSeed: uiState.minorSeed,
                riverSeed: uiState.minorSeed,
            });
            Draw.background(ctx);
        },
        () => Draw.noisyRegionsBase(ctx, map, uiState.noisyEdges),
        () => Draw.noisyRegionsMain(ctx, map, uiState.noisyEdges),
        () => Draw.noisyEdges(ctx, map, uiState.noisyEdges),
        () => {
            if (uiState.noisyFills) {
                Draw.noisyFill(ctx, 1000, 1000, makeRandInt(12345));
            }
        },
    ].map((layer, i) => () => {
        console.time("layer "+i);
        ctx.save();
        ctx.scale(canvas.width / 1000, canvas.height / 1000);
        layer();
        ctx.restore();
        console.timeEnd("layer "+i);
    });

    if (!requestAnimationFrameId) {
        requestAnimationFrameId = requestAnimationFrame(requestAnimationFrameHandler);
    }
}


function initUi() {
    function onclick(element) {
        element.addEventListener('click', getUiState);
    }
    function onchange(element) {
        element.addEventListener('change', getUiState);
    }
    document.querySelectorAll("input[type='radio']").forEach(onclick);
    document.querySelectorAll("input[type='checkbox']").forEach(onclick);
    document.querySelectorAll("input[type='number']").forEach(onchange);
}

function setUiState() {
    document.getElementById('major-seed').value = uiState.majorSeed;
    document.getElementById('minor-seed').value = uiState.minorSeed;
    document.querySelector("input#size-" + uiState.size).checked = true;
    document.querySelector("input#output-" + uiState.output).checked = true;
    document.querySelector("input#noisy-edges").checked = uiState.noisyEdges;
    document.querySelector("input#noisy-fills").checked = uiState.noisyFills;
}

function getUiState() {
    uiState.majorSeed = document.getElementById('major-seed').valueAsNumber;
    uiState.minorSeed = document.getElementById('minor-seed').valueAsNumber;
    uiState.size = document.querySelector("input[name='size']:checked").value;
    uiState.output = document.querySelector("input[name='output']:checked").value;
    uiState.noisyEdges = document.querySelector("input#noisy-edges").checked;
    uiState.noisyFills = document.querySelector("input#noisy-fills").checked;
    draw();
}

function setMajorSeed(seed) {
    uiState.majorSeed = seed & 0x7fffffff;
    setUiState();
    draw();
}

function setMinorSeed(seed) {
    uiState.minorSeed = ((seed % 10) + 10) % 10;
    setUiState();
    draw();
}

global.prevMajorSeed = function() { setMajorSeed(uiState.majorSeed - 1); };
global.nextMajorSeed = function() { setMajorSeed(uiState.majorSeed + 1); };
global.prevMinorSeed = function() { setMinorSeed(uiState.minorSeed - 1); };
global.nextMinorSeed = function() { setMinorSeed(uiState.minorSeed + 1); };


initUi();
setUiState();
getUiState();
