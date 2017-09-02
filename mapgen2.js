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

const hashInt =      require('hash-int');
const SimplexNoise = require('simplex-noise');
const DualMesh =     require('@redblobgames/dual-mesh');
const createMesh =   require('@redblobgames/dual-mesh/create');
const Map =          require('@redblobgames/mapgen2');

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


function makeRandInt(seed) {
    let i = 0;
    return function(N) {
        i++;
        return hashInt(seed + i) % N;
    };
}
function makeRandFloat(seed) {
    let randInt = makeRandInt(seed);
    let divisor = 0x10000000;
    return function() {
        return randInt(divisor) / divisor;
    };
}

const SEED = 12345;
let map = new Map(
    new DualMesh(createMesh(18.0, makeRandFloat(SEED))),
    new SimplexNoise(makeRandFloat(SEED)),
    makeRandInt,
    // TODO: number of levels should depend on the resolution, or it should be dynamic
    {noisyEdge: {levels: 4, amplitude: 0.2, seed: SEED}}
);
map.calculate();

global.regenerate = function() {
    map.options.seed = makeRandInt(map.options.seed)(100000);
    map.noise = new SimplexNoise(makeRandFloat(map.options.seed));
    map.calculate();
    requestAnimationFrame(draw);
}

console.log(`${map.mesh.r_vertex.length} regions`);

function draw() {
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
    ctx.clearRect(0, 0, 1000, 1000);
    ctx.fillStyle = "blue";
    ctx.fillRect(0, 0, 500, 500);
    ctx.fillRect(500, 500, 500, 500);

    // TODO: performance -- don't need noisy boundary when the biomes are the same

    function drawNoisyRegions(ctx, map) {
        let mesh = map.mesh;
        let out_s = [];

        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'bevel';

        for (let s = 0; s < mesh.numSolidSides; s++) {
            let r = mesh.s_begin_r(s);
            if (r > mesh.s_end_r(s)) { continue; }
            ctx.strokeStyle = biomeColoring(r);
            let last_t = mesh.s_inner_t(s);
            ctx.beginPath();
            ctx.moveTo(mesh.t_vertex[last_t][0], mesh.t_vertex[last_t][1]);
            if (edgeStyling(s) === null) {
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
            ctx.fillStyle = ctx.strokeStyle = biomeColoring(r);
            ctx.beginPath();
            ctx.moveTo(mesh.t_vertex[last_t][0], mesh.t_vertex[last_t][1]);
            for (let s of out_s) {
                if (edgeStyling(s) === null) {
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
            let style = edgeStyling(s);
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
    }

    function biomeColoring(r) {
        return biomeColors[map.r_biome[r]];
    }

    function edgeStyling(s) {
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


    drawNoisyRegions(ctx, map);

    ctx.restore();
}


requestAnimationFrame(draw);

