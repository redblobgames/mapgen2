/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */

const MIN_SPRING_ELEVATION = 0.3;
const MAX_SPRING_ELEVATION = 0.9;

/**
 * Find candidates for river sources
 *
 * Unlike the assign_* functions this does not write into an existing array
 */
export function find_t_spring(mesh, water_r, elevation_t) {
    const is_water_t = (t) =>
          (  water_r[mesh.r_begin_s(3*t)]
          || water_r[mesh.r_begin_s(3*t+1)]
          || water_r[mesh.r_begin_s(3*t+2)] );

    let t_spring = new Set();
    // Add everything above some elevation, but not lakes
    for (let t = 0; t < mesh.numSolidTriangles; t++) {
        if (elevation_t[t] >= MIN_SPRING_ELEVATION &&
            elevation_t[t] <= MAX_SPRING_ELEVATION &&
            !is_water_t(t)) {
            t_spring.add(t);
        }
    }
    return Array.from(t_spring);
};


export function assign_flow_s(flow_s, mesh, s_downslope_t, t_river) {
    // Each river in river_t contributes 1 flow down to the coastline
    flow_s.length = mesh.numSides;
    flow_s.fill(0);
    for (let t of t_river) {
        for (;;) {
            let s = s_downslope_t[t];
            if (s === -1) { break; }
            flow_s[s]++;
            let next_t = mesh.t_outer_s(s);
            if (next_t === t) { break; }
            t = next_t;
        }
    }
    return flow_s;
};
