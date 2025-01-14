/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */
'use strict';

exports.discreteColors = {
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

function smoothColoring(e, t, m) {
    // adapted from <https://www.redblobgames.com/maps/terrain-from-noise/>
    if (e < 0.0) {
        return `rgb(${(48 + 48*e) | 0}, ${(64 + 64*e) | 0}, ${(127 + 128*e) | 0})`;
    }

    // Green or brown at low elevation, and make it more white-ish
    // as you get colder
    let white = (1-t) * (1-t);
    m = 1.0 - ((1-m)*(1-m));
    var red = 210 - 100*m, grn = 185 - 45*m, blu = 139 - 45*m;
    return `rgb(${(255 * white + red * (1-white)) | 0}, 
                ${(255 * white + grn * (1-white)) | 0}, 
                ${(255 * white + blu * (1-white)) | 0})`;
}


class Coloring {
    constructor() {
    }

    draw_coast_s(map, s) {
        return map.r_ocean[map.mesh.s_begin_r(s)] !== map.r_ocean[map.mesh.s_end_r(s)];
    }

    draw_lakeside_s(map, s) {
        let r0 = map.mesh.s_begin_r(s),
            r1 = map.mesh.s_end_r(s);
        return (map.r_water[r0] !== map.r_water[r1]
                && !map.r_ocean[r0]
                && map.r_biome[r0] !== 'ICE'
                && map.r_biome[r1] !== 'ICE');
    }
    
    draw_river_s(map, s) {
        let r0 = map.mesh.s_begin_r(s),
            r1 = map.mesh.s_end_r(s);
        return ((map.s_flow[s] > 0 || map.s_flow[map.mesh.s_opposite_s(s)] > 0)
                && !map.r_water[r0] && !map.r_water[r1]);
    }

    biome(map, r) {
        return "red";
    }

    side(map, s) {
        let r0 = map.mesh.s_begin_r(s),
            r1 = map.mesh.s_end_r(s);
        if (this.draw_coast_s(map, s)) {
            // Coastlines are thick
            return {
                noisy: true,
                lineWidth: 3,
                strokeStyle: exports.discreteColors.COAST,
            };
        } else if (this.draw_lakeside_s(map, s)) {
            // Lake boundary
            return {
                noisy: true,
                lineWidth: 1.5,
                strokeStyle: exports.discreteColors.LAKESHORE,
            };
        } else if (this.draw_river_s(map, s)) {
            // River
            return {
                noisy: true,
                lineWidth: 2.0 * Math.sqrt(map.s_flow[s]),
                strokeStyle: exports.discreteColors.RIVER,
            };
        } else if (map.r_biome[r0] === map.r_biome[r1]) {
            return {
                noisy: false,
                lineWidth: 1.0,
                strokeStyle: this.biome(map, r0),
            };
        } else {
            return {
                noisy: true,
                lineWidth: 1.0,
                strokeStyle: this.biome(map, r0),
            };
        }
    }
}

class Discrete extends Coloring {
    biome(map, r) {
        return exports.discreteColors[map.r_biome[r]];
    }
}

class Smooth extends Coloring {
    biome(map, r) {
        if (map.r_water[r] && !map.r_ocean[r]) {
            return exports.discreteColors[map.r_biome[r]];
        } else {
            return smoothColoring(
                map.r_elevation[r],
                Math.min(1, Math.max(0, map.r_temperature[r])),
                Math.min(1, Math.max(0, map.r_moisture[r]))
            );
        }
    }
}

exports.Discrete = Discrete;
exports.Smooth = Smooth;
