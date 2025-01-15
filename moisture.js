/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */

/**
 * Find regions adjacent to rivers; out_r should be a Set
 */
export function find_riverbanks_r(r_out, mesh, flow_s) {
    for (let s = 0; s < mesh.numSolidSides; s++) {
        if (flow_s[s] > 0) {
            r_out.add(mesh.r_begin_s(s));
            r_out.add(mesh.r_end_s(s));
        }
    }
};


/**
 * Find lakeshores -- regions adjacent to lakes; out_r should be a Set
 */
export function find_lakeshores_r(r_out, mesh, ocean_r, water_r) {
    for (let s = 0; s < mesh.numSolidSides; s++) {
        let r0 = mesh.r_begin_s(s),
            r1 = mesh.r_end_s(s);
        if (water_r[r0] && !ocean_r[r0]) {
            r_out.add(r0);
            r_out.add(r1);
        }
    }
};


/**
 * Find regions that have maximum moisture; returns a Set
 */
export function find_moisture_r_seeds(mesh, flow_s, ocean_r, water_r) {
    let r_seeds = new Set();
    find_riverbanks_r(r_seeds, mesh, flow_s);
    find_lakeshores_r(r_seeds, mesh, ocean_r, water_r);
    return r_seeds;
};


/**
 * Assign moisture level. Oceans and lakes have moisture 1.0. Land
 * regions have moisture based on the distance to the nearest fresh
 * water. Lakeshores and riverbanks are distance 0. Moisture will be
 * 1.0 at distance 0 and go down to 0.0 at the maximum distance.
 */
export function assign_moisture_r(
    moisture_r, waterdistance_r,
    mesh,
    water_r, r_seeds /* Set */
) {
    waterdistance_r.length = mesh.numRegions;
    moisture_r.length = mesh.numRegions;
    waterdistance_r.fill(null);
    
    let r_out = [];
    let r_queue = Array.from(r_seeds);
    let maxDistance = 1;
    r_queue.forEach((r) => { waterdistance_r[r] = 0; });
    while (r_queue.length > 0) {
        let r_current = r_queue.shift();
        mesh.r_around_r(r_current, r_out);
        for (let r_neighbor of r_out) {
            if (!water_r[r_neighbor] && waterdistance_r[r_neighbor] === null) {
                let newDistance = 1 + waterdistance_r[r_current];
                waterdistance_r[r_neighbor] = newDistance;
                if (newDistance > maxDistance) { maxDistance = newDistance; }
                r_queue.push(r_neighbor);
            }
        }
    }

    waterdistance_r.forEach((d, r) => {
        moisture_r[r] = water_r[r]? 1.0 : 1.0 - Math.pow(d / maxDistance, 0.5);
    });
};


/**
 * Redistribute moisture values evenly so that all moistures
 * from min_moisture to max_moisture are equally represented.
 */
export function redistribute_moisture_r(moisture_r, mesh, water_r, min_moisture, max_moisture) {
    let r_land = [];
    for (let r = 0; r < mesh.numSolidRegions; r++) {
        if (!water_r[r]) {
            r_land.push(r);
        }
    }

    r_land.sort((r1, r2) => moisture_r[r1] - moisture_r[r2]);
    
    for (let i = 0; i < r_land.length; i++) {
        moisture_r[r_land[i]] = min_moisture + (max_moisture-min_moisture) * i / (r_land.length - 1);
    }
};
