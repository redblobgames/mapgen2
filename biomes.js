/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */

import * as util from './util';

function biome(ocean, water, coast, temperature, moisture) {
    if (ocean) {
        return 'OCEAN';
    } else if (water) {
        if (temperature > 0.9) return 'MARSH';
        if (temperature < 0.2) return 'ICE';
        return 'LAKE';
    } else if (coast) {
        return 'BEACH';
    } else if (temperature < 0.2) {
        if (moisture > 0.50) return 'SNOW';
        else if (moisture > 0.33) return 'TUNDRA';
        else if (moisture > 0.16) return 'BARE';
        else return 'SCORCHED';
    } else if (temperature < 0.4) {
        if (moisture > 0.66) return 'TAIGA';
        else if (moisture > 0.33) return 'SHRUBLAND';
        else return 'TEMPERATE_DESERT';
    } else if (temperature < 0.7) {
        if (moisture > 0.83) return 'TEMPERATE_RAIN_FOREST';
        else if (moisture > 0.50) return 'TEMPERATE_DECIDUOUS_FOREST';
        else if (moisture > 0.16) return 'GRASSLAND';
        else return 'TEMPERATE_DESERT';
    } else {
        if (moisture > 0.66) return 'TROPICAL_RAIN_FOREST';
        else if (moisture > 0.33) return 'TROPICAL_SEASONAL_FOREST';
        else if (moisture > 0.16) return 'GRASSLAND';
        else return 'SUBTROPICAL_DESERT';
    }
}


/**
 * A coast region is land that has an ocean neighbor
 */
export function assign_coast_r(coast_r, mesh, ocean_r) {
    coast_r.length = mesh.numRegions;
    coast_r.fill(false);
    
    let r_out = [];
    for (let r1 = 0; r1 < mesh.numRegions; r1++) {
        mesh.r_around_r(r1, r_out);
        if (!ocean_r[r1]) {
            for (let r2 of r_out) {
                if (ocean_r[r2]) {
                    coast_r[r1] = true;
                    break;
                }
            }
        }
    }
    return coast_r;
};


/**
 * Temperature assignment
 *
 * Temperature is based on elevation and latitude.
 * The normal range is 0.0=cold, 1.0=hot, but it is not 
 * limited to that range, especially when using temperature bias.
 *
 * The northernmost parts of the map get bias_north added to them;
 * the southernmost get bias_south added; in between it's a blend.
 */
export function assign_temperature_r(
    temperature_r,
    mesh,
    elevation_r,
    bias_north, bias_south
) {
    temperature_r.length = mesh.numRegions;
    for (let r = 0; r < mesh.numRegions; r++) {
        let latitude = mesh.y_of_r(r) / 1000; /* 0.0 - 1.0 */
        let delta_temperature = util.lerp(bias_north, bias_south, latitude);
        temperature_r[r] = 1.0 - elevation_r[r] + delta_temperature;
    }
    return temperature_r;
};


/**
 * Biomes assignment -- see the biome() function above
 */
export function assign_biome_r(
    biome_r,
    mesh,
    ocean_r, water_r, coast_r, temperature_r, moisture_r
) {
    biome_r.length = mesh.numRegions;
    for (let r = 0; r < mesh.numRegions; r++) {
        biome_r[r] = biome(ocean_r[r], water_r[r], coast_r[r],
                           temperature_r[r], moisture_r[r]);
    }
    return biome_r;
};
