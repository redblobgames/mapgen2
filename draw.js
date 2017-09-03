/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */
'use strict';

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
let _noiseCanvas = null;
function makeNoise(randInt) {
    if (_noiseCanvas === null) {
        _noiseCanvas = document.createElement('canvas');
        _noiseCanvas.width = noiseSize;
        _noiseCanvas.height = noiseSize;

        let ctx = _noiseCanvas.getContext('2d');
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
    return _noiseCanvas;
}

    
exports.drawPixelNoise = function(canvas, randInt) {
    let ctx = canvas.getContext('2d');
    let noise = makeNoise(randInt);
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.drawImage(noise, 0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y += noiseSize) {
        for (let x = 0; x < canvas.width; x += noiseSize) {
            ctx.drawImage(noise, x, y, noiseSize, noiseSize);
        }
    }
    ctx.restore();
};


exports.drawNoisyRegions = function(ctx, map) {
    let mesh = map.mesh;
    let out_s = [];

    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'bevel';

    ctx.fillStyle = biomeColors.OCEAN;
    ctx.fillRect(0, 0, 1000, 1000);
    
    for (let s = 0; s < mesh.numSolidSides; s++) {
        let r = mesh.s_begin_r(s);
        if (r > mesh.s_end_r(s)) { continue; }
        ctx.strokeStyle = biomeColoring(map, r);
        let last_t = mesh.s_inner_t(s);
        ctx.beginPath();
        ctx.moveTo(mesh.t_vertex[last_t][0], mesh.t_vertex[last_t][1]);
        if (edgeStyling(map, s) === null) {
            let first_t = mesh.s_outer_t(s);
            ctx.lineTo(mesh.t_vertex[first_t][0], mesh.t_vertex[first_t][1]);
        } else {
            for (let p of map.s_lines[s]) {
                ctx.lineTo(p[0], p[1]);
            }
        }
        ctx.stroke();
    }
    
    for (let r = 0; r < mesh.numSolidRegions; r++) {
        mesh.r_circulate_s(out_s, r);
        let last_t = mesh.s_inner_t(out_s[0]);
        ctx.fillStyle = ctx.strokeStyle = biomeColoring(map, r);
        ctx.beginPath();
        ctx.moveTo(mesh.t_vertex[last_t][0], mesh.t_vertex[last_t][1]);
        for (let s of out_s) {
            if (edgeStyling(map, s) === null) {
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


    for (let s = 0; s < mesh.numSolidSides; s++) {
        let style = edgeStyling(map, s);
        if (style === null) { continue; }
        ctx.strokeStyle = style.strokeStyle;
        ctx.lineWidth = style.lineWidth;
        let last_t = mesh.s_inner_t(s);
        ctx.beginPath();
        ctx.moveTo(mesh.t_vertex[last_t][0], mesh.t_vertex[last_t][1]);
        for (let p of map.s_lines[s]) {
            ctx.lineTo(p[0], p[1]);
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
            strokeStyle: "black",
        };
    }
    return null;
}
