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
const urlUtils =     require('url-search-utils');
const {makeRandInt, makeRandFloat} = require('./prng');


let defaultUiState = {
    seed: 24,
    variant: 0,
    size: 'medium',
    'noisy-fills': true,
    'noisy-edges': true,
    temperature: 0,
    rainfall: 0,
    canvasSize: 0,
};

let uiState = {};
Object.assign(uiState, defaultUiState);


let _mapCache = [];
function getMap(size) {
    const spacing = {
        tiny: 38,
        small: 26,
        medium: 18,
        large: 12.8,
        huge: 9,
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
    if (requestAnimationFrameQueue.length > 0) {
        requestAnimationFrameId = requestAnimationFrame(requestAnimationFrameHandler);
    }
}


let _lastUiState = {};
function draw() {
    let map = getMap(uiState.size);
    let noisyEdges = uiState['noisy-edges'],
        noisyFills = uiState['noisy-fills'];
    
    let canvas = document.getElementById('map');
    let ctx = canvas.getContext('2d');

    let size = Math.min(canvas.parentNode.clientWidth, canvas.parentNode.clientHeight);
    if (size != uiState.canvasSize) {
        // Don't assign to width,height if the size hasn't changed because
        // it will blank out the canvas and we'd like to reuse the previous draw
        uiState.canvasSize = size;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        size = 1024;
        if (window.devicePixelRatio && window.devicePixelRatio != 1) {
            size *= window.devicePixelRatio;
        }
        canvas.width = size;
        canvas.height = size;
    }
    
    let noise = new SimplexNoise(makeRandFloat(uiState.seed));
    let queue = [];
    if ((!noisyEdges || uiState.size === 'large' || uiState.size === 'huge')
        && (_lastUiState.seed !== uiState.seed
            || _lastUiState.size !== uiState.size
            || _lastUiState.canvasSize !== uiState.canvasSize)) {
        // Noisy edges are slow enough that it'd be nice to have a
        // quick approximation drawn first, but if the last time we
        // drew something was with the same essential parameters let's
        // reuse the drawing from last time
        queue.push(() => Draw.approximateIslandShape(ctx, 1000, 1000, noise, {round: 0.5, inflate: 0.4}));
        // TODO: the if() test is too convoluted; rewrite that expression
    }
    Object.assign(_lastUiState, uiState);

    queue.push(
        () => map.calculate({
            noise: noise,
            drainageSeed: uiState.variant,
            riverSeed: uiState.variant,
            biomeBias: {temperature: uiState.temperature, moisture: uiState.rainfall},
        }),
        () => {
            Draw.background(ctx);
            Draw.noisyRegions(ctx, map, noisyEdges);
            // Draw the rivers early for better user experience
            Draw.rivers(ctx, map, noisyEdges, true);
        }
    );

    for (let phase = 0; phase < 16; phase++) {
        queue.push(() => Draw.noisyEdges(ctx, map, noisyEdges, phase));
    }

    // Have to draw the rivers and coastlines again because the noisy
    // edges might overwrite them, and these should take priority over
    // the other noisy edges. Otherwise it leaves little gaps that look
    // ugly when zoomed in.
    queue.push(() => Draw.rivers(ctx, map, noisyEdges, false));
    queue.push(() => Draw.coastlines(ctx, map, noisyEdges));

    if (noisyFills) {
        queue.push(
            () => Draw.noisyFill(ctx, 1000, 1000, makeRandInt(12345))
        );
    }

    requestAnimationFrameQueue = queue.map(
        (layer, i) => () => {
            //console.time("layer "+i);
            ctx.save();
            ctx.scale(canvas.width / 1000, canvas.height / 1000);
            layer();
            ctx.restore();
            //console.timeEnd("layer "+i);
        });

    if (!requestAnimationFrameId) {
        requestAnimationFrameId = requestAnimationFrame(requestAnimationFrameHandler);
    }
}


function initUi() {
    function oninput(element) { element.addEventListener('input', getUiState); }
    function onclick(element) { element.addEventListener('click', getUiState); }
    function onchange(element) { element.addEventListener('change', getUiState); }
    document.querySelectorAll("input[type='radio']").forEach(onclick);
    document.querySelectorAll("input[type='checkbox']").forEach(onclick);
    document.querySelectorAll("input[type='number']").forEach(onchange);
    document.querySelectorAll("input[type='range']").forEach(oninput);
}

function setUiState() {
    document.getElementById('seed').value = uiState.seed;
    document.getElementById('variant').value = uiState.variant;
    document.querySelector("input#size-" + uiState.size).checked = true;
    document.querySelector("input#noisy-edges").checked = uiState['noisy-edges'];
    document.querySelector("input#noisy-fills").checked = uiState['noisy-fills'];
    document.querySelector("input#temperature").value = uiState.temperature;
    document.querySelector("input#rainfall").value = uiState.rainfall;
}

function getUiState() {
    uiState.seed = document.getElementById('seed').valueAsNumber;
    uiState.variant = document.getElementById('variant').valueAsNumber;
    uiState.size = document.querySelector("input[name='size']:checked").value;
    uiState['noisy-edges'] = document.querySelector("input#noisy-edges").checked;
    uiState['noisy-fills'] = document.querySelector("input#noisy-fills").checked;
    uiState.temperature = document.querySelector("input#temperature").valueAsNumber;
    uiState.rainfall = document.querySelector("input#rainfall").valueAsNumber;
    setUrlFromState();
    draw();
}

function setSeed(seed) {
    uiState.seed = seed & 0x7fffffff;
    setUiState();
    getUiState();
}

function setVariant(variant) {
    uiState.variant = ((variant % 10) + 10) % 10;
    setUiState();
    getUiState();
}

global.prevSeed = function() { setSeed(uiState.seed - 1); };
global.nextSeed = function() { setSeed(uiState.seed + 1); };
global.prevVariant = function() { setVariant(uiState.variant - 1); };
global.nextVariant = function() { setVariant(uiState.variant + 1); };


function setUrlFromState() {
    let fragment = urlUtils.stringifyParams(uiState, {}, {
        'canvasSize': 'exclude',
        'noisy-edges': 'include-if-falsy',
        'noisy-fills': 'include-if-falsy',
    });
    let url = window.location.pathname + "#" + fragment;
    window.history.replaceState({}, null, url);
}
    
function getStateFromUrl() {
    let hashState = urlUtils.parseQuery(
        window.location.hash.slice(1),
        {
            'seed': 'number',
            'variant': 'number',
            'temperature': 'number',
            'rainfall': 'number',
            'noisy-edges': (value) => value === 'true',
            'noisy-fills': (value) => value === 'true',
        }
    );
    Object.assign(uiState, hashState);
    setUrlFromState();
    setUiState();
    draw();
}
window.addEventListener('hashchange', getStateFromUrl);
window.addEventListener('resize', draw);

initUi();
getStateFromUrl();
setUiState();
