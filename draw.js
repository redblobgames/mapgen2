/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */
'use strict';

const util = require('@redblobgames/mapgen2/util');

const biomeColors = {
    OCEAN: "#44447a",
    COAST: "#33335a",
    LAKESHORE: "#225588",
    LAKE: "#336699",
    RIVER: "#225588",
    MARSH: "#2f6666",
    ICE: "#99ffff",
    BEACH: "#a09077",
    SNOW: "#ffffff",
    TUNDRA: "#bbbbaa",
    BARE: "#888888",
    SCORCHED: "#555555",
    TAIGA: "#99aa77",
    SHRUBLAND: "#889977",
    TEMPERATE_DESERT: "#c9d29b",
    TEMPERATE_RAIN_FOREST: "#448855",
    TEMPERATE_DECIDUOUS_FOREST: "#679459",
    GRASSLAND: "#88aa55",
    SUBTROPICAL_DESERT: "#d2b98b",
    TROPICAL_RAIN_FOREST: "#337755",
    TROPICAL_SEASONAL_FOREST: "#559944",
};

const noiseSize = 100;
let noiseCanvas = null;
function makeNoise(randInt) {
    if (noiseCanvas === null) {
        noiseCanvas = document.createElement('canvas');
        noiseCanvas.width = noiseSize;
        noiseCanvas.height = noiseSize;

        let ctx = noiseCanvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, noiseSize, noiseSize);
        const pixels = imageData.data;

        for (let y = 0, p = 0; y < noiseSize; y++) {
            for (let x = 0; x < noiseSize; x++) {
                let value = 128 + randInt(16) - 8;
                pixels[p++] = value;
                pixels[p++] = value;
                pixels[p++] = value;
                pixels[p++] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }
}


exports.noisyFill = function(ctx, width, height, randInt) {
    makeNoise(randInt);
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.drawImage(noiseCanvas, 0, 0, width, height);
    ctx.globalCompositeOperation = 'hard-light';
    for (let y = 0; y < height; y += noiseSize) {
        for (let x = 0; x < width; x += noiseSize) {
            ctx.drawImage(noiseCanvas, x, y, noiseSize, noiseSize);
        }
    }
    ctx.restore();
};


const islandShapeSize = 200;
let islandShapeCanvas = null;
function makeIsland(noise, params) {
    if (!islandShapeCanvas) {
        islandShapeCanvas = document.createElement('canvas');
        islandShapeCanvas.width = islandShapeSize;
        islandShapeCanvas.height = islandShapeSize;
    }
    
    let ctx = islandShapeCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, islandShapeSize, islandShapeSize);
    const pixels = imageData.data;

    for (let y = 0, p = 0; y < islandShapeSize; y++) {
        let ny = 2 * y/islandShapeSize - 1;
        for (let x = 0; x < islandShapeSize; x++) {
            let nx = 2 * x/islandShapeSize - 1;
            let distance = Math.max(Math.abs(nx), Math.abs(ny));
            let n = util.fbm_noise(noise, nx, ny);
            n = util.mix(n, 0.5, params.round);
            if (n - (1.0 - params.inflate) * distance*distance < 0) {
                // water color uses biomeColors.OCEAN
                pixels[p++] = 0x44;
                pixels[p++] = 0x44;
                pixels[p++] = 0x7a;
            } else {
                // land color uses biomeColors.BEACH
                pixels[p++] = 0xa0;
                pixels[p++] = 0x90;
                pixels[p++] = 0x77;
            }
            pixels[p++] = 255;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

exports.approximateIslandShape = function(ctx, width, height, noise, params) {
    makeIsland(noise, params);
    ctx.drawImage(islandShapeCanvas, 0, 0, width, height);
};


exports.background = function(ctx) {
    ctx.fillStyle = biomeColors.OCEAN;
    ctx.fillRect(0, 0, 1000, 1000);
};


exports.noisyRegionsBase = function(ctx, map, noisyEdge) {
    let {mesh} = map;

    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'bevel';
    for (let s = 0; s < mesh.numSolidSides; s++) {
        let r = mesh.s_begin_r(s);
        if (r > mesh.s_end_r(s)) { continue; }
        ctx.strokeStyle = biomeColoring(map, r);
        let last_t = mesh.s_inner_t(s);
        ctx.beginPath();
        ctx.moveTo(mesh.t_vertex[last_t][0], mesh.t_vertex[last_t][1]);
        if (!noisyEdge || edgeStyling(map, s) === null) {
            let first_t = mesh.s_outer_t(s);
            ctx.lineTo(mesh.t_vertex[first_t][0], mesh.t_vertex[first_t][1]);
        } else {
            for (let p of map.s_lines[s]) {
                ctx.lineTo(p[0], p[1]);
            }
        }
        ctx.stroke();
    }
};


exports.noisyRegionsMain = function(ctx, map, noisyEdge) {
    let {mesh} = map;
    let out_s = [];
    
    for (let r = 0; r < mesh.numSolidRegions; r++) {
        mesh.r_circulate_s(out_s, r);
        let last_t = mesh.s_inner_t(out_s[0]);
        ctx.fillStyle = ctx.strokeStyle = biomeColoring(map, r);
        ctx.beginPath();
        ctx.moveTo(mesh.t_vertex[last_t][0], mesh.t_vertex[last_t][1]);
        for (let s of out_s) {
            if (!noisyEdge || edgeStyling(map, s) === null) {
                let first_t = mesh.s_outer_t(s);
                ctx.lineTo(mesh.t_vertex[first_t][0], mesh.t_vertex[first_t][1]);
            } else {
                for (let p of map.s_lines[s]) {
                    ctx.lineTo(p[0], p[1]);
                }
            }
        }
        ctx.fill();
    }
};


exports.noisyEdges = function(ctx, map, noisyEdge) {
    let {mesh} = map;
    ctx.lineJoin = 'bevel';
    
    for (let s = 0; s < mesh.numSolidSides; s++) {
        let style = edgeStyling(map, s);
        if (style === null) { continue; }
        ctx.strokeStyle = style.strokeStyle;
        ctx.lineWidth = style.lineWidth;
        let last_t = mesh.s_inner_t(s);
        ctx.beginPath();
        ctx.moveTo(mesh.t_vertex[last_t][0], mesh.t_vertex[last_t][1]);
        if (!noisyEdge) {
            let first_t = mesh.s_outer_t(s);
            ctx.lineTo(mesh.t_vertex[first_t][0], mesh.t_vertex[first_t][1]);
        } else {
            for (let p of map.s_lines[s]) {
                ctx.lineTo(p[0], p[1]);
            }
        }
        ctx.stroke();
    }
};


function biomeColoring(map, r) {
    return biomeColors[map.r_biome[r]];
}


function edgeStyling(map, s) {
    let r0 = map.mesh.s_begin_r(s),
        r1 = map.mesh.s_end_r(s);
    if (map.r_ocean[r0] !== map.r_ocean[r1]) {
        // Coastlines are thick
        return {
            lineWidth: 3,
            strokeStyle: biomeColors.COAST,
        };
    } else if (map.r_water[r0] !== map.r_water[r1]
               && map.r_biome[r0] !== 'ICE'
               && map.r_biome[r1] !== 'ICE') {
        // Lake boundary
        return {
            lineWidth: 1.5,
            strokeStyle: biomeColors.LAKESHORE,
        };
    } else if (map.r_water[r0] || map.r_water[r1]) {
        // Lake interior
        return null;
    } else if (map.s_flow[s] > 0 || map.s_flow[map.mesh.s_opposite_s(s)] > 0) {
        // River
        return {
            lineWidth: 2.0 * Math.sqrt(map.s_flow[s]),
            strokeStyle: biomeColors.RIVER,
        };
    } else if (map.r_biome[r0] !== map.r_biome[r1]) {
        return {
            lineWidth: 0.05,
            strokeStyle: "white",
        };
    }
    return null;
}
