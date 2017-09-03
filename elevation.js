/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */

'use strict';

/**
 * Coast corners are connected to coast sides, which have
 * ocean on one side and land on the other
 */
function find_coasts_t(mesh, r_ocean) {
    let coasts_t = [];
    for (let s = 0; s < mesh.numSides; s++) {
        let r0 = mesh.s_begin_r(s);
        let r1 = mesh.s_end_r(s);
        let t = mesh.s_inner_t(s);
        if (r_ocean[r0] && !r_ocean[r1]) {
            // It might seem that we also need to check !r_ocean[r0] && r_ocean[r1]
            // and it might seem that we have to add both t and its opposite but
            // each t vertex shows up in *four* directed sides, so we only have to test
            // one fourth of those conditions to get the vertex in the list once.
            coasts_t.push(t);
        }
    }
    return coasts_t;
}


/**
 * Elevation is based on breadth first search from the seed points,
 * which are the coastal graph nodes. Since breadth first search also
 * calculates the 'parent' pointers, return those for use as the downslope
 * graph. To handle lakes, which should have all corners at the same elevation,
 * there are two deviations from breadth first search:
 * 1. Instead of pushing to the end of the queue, push to the beginning.
 * 2. Like uniform cost search, check if the new distance is better than
 *    previously calculated distances. It is possible that one lake corner
 *    was reached with distance 2 and another with distance 3, and we need
 *    to revisit that node and make sure it's set to 2.
 */
exports.assign_t_elevation = function(
    t_elevation, t_coastdistance, t_downslope_s,
    mesh,
    r_ocean, r_water, randInt
) {
    t_coastdistance.length = mesh.numTriangles;
    t_downslope_s.length = mesh.numTriangles;
    t_elevation.length = mesh.numTriangles;
    t_coastdistance.fill(null);
    t_downslope_s.fill(-1);
    
    const t_ocean = (t) => r_ocean[mesh.s_begin_r(3*t)];
    const r_lake = (r) => r_water[r] && !r_ocean[r];
    const s_lake = (s) => r_lake(mesh.s_begin_r(s)) || r_lake(mesh.s_end_r(s));

    let out_s = [];
    let queue_t = find_coasts_t(mesh, r_ocean);
    queue_t.forEach((t) => { t_coastdistance[t] = 0; });
    let minDistance = 1, maxDistance = 1;
    
    while (queue_t.length > 0) {
        let current_t = queue_t.shift();
        mesh.t_circulate_s(out_s, current_t);
        let iOffset = randInt(out_s.length);
        for (let i = 0; i < out_s.length; i++) {
            let s = out_s[(i + iOffset) % out_s.length];
            let lake = s_lake(s);
            let neighbor_t = mesh.s_outer_t(s);
            let newDistance = (lake? 0 : 1) + t_coastdistance[current_t];
            if (t_coastdistance[neighbor_t] === null || newDistance < t_coastdistance[neighbor_t]) {
                t_downslope_s[neighbor_t] = mesh.s_opposite_s(s);
                t_coastdistance[neighbor_t] = newDistance;
                if (t_ocean(neighbor_t) && newDistance > minDistance) { minDistance = newDistance; }
                if (!t_ocean(neighbor_t) && newDistance > maxDistance) { maxDistance = newDistance; }
                if (lake) {
                    queue_t.unshift(neighbor_t);
                } else {
                    queue_t.push(neighbor_t);
                }
            }
        }
    }

    t_coastdistance.forEach((d, t) => {
        t_elevation[t] = t_ocean(t) ? (-d / minDistance) : (d / maxDistance);
    });
};


/** 
 * Set r elevation to the average of the t elevations. There's a
 * corner case though: it is possible for an ocean region (r) to be
 * surrounded by coastline corners (t), and coastlines are set to 0
 * elevation. This means the region elevation would be 0. To avoid
 * this, I subtract a small amount for ocean regions. */
exports.assign_r_elevation = function(r_elevation, mesh, t_elevation, r_ocean) {
    const max_ocean_elevation = -0.01;
    r_elevation.length = mesh.numRegions;
    let out_t = [];
    for (let r = 0; r < mesh.numRegions; r++) {
        mesh.r_circulate_t(out_t, r);
        let elevation = 0.0;
        for (let t of out_t) {
            elevation += t_elevation[t];
        }
        r_elevation[r] = elevation/out_t.length;
        if (r_ocean[r] && r_elevation[r] > max_ocean_elevation) {
            r_elevation[r] = max_ocean_elevation;
        }
    }
    return r_elevation;
};


/**
 * Redistribute elevation values so that lower elevations are more common
 * than higher elevations. Specifically, we want elevation Z to have frequency
 * (1-Z), for all the non-ocean regions.
 */
// TODO: this messes up lakes, as they will no longer all be at the same elevation
exports.redistribute_t_elevation = function(t_elevation, mesh) {
    // NOTE: This is the same algorithm I used in 2010, because I'm
    // trying to recreate that map generator to some extent. I don't
    // think it's a great approach for other games but it worked well
    // enough for that one.
    
    // SCALE_FACTOR increases the mountain area. At 1.0 the maximum
    // elevation barely shows up on the map, so we set it to 1.1.
    const SCALE_FACTOR = 1.1;

    let nonocean_t = [];
    for (let t = 0; t < mesh.numSolidTriangles; t++) {
        if (t_elevation[t] > 0.0) {
            nonocean_t.push(t);
        }
    }
    
    nonocean_t.sort((t1, t2) => t_elevation[t1] - t_elevation[t2]);

    for (let i = 0; i < nonocean_t.length; i++) {
        // Let y(x) be the total area that we want at elevation <= x.
        // We want the higher elevations to occur less than lower
        // ones, and set the area to be y(x) = 1 - (1-x)^2.
        let y = i / (nonocean_t.length-1);
        // Now we have to solve for x, given the known y.
        //  *  y = 1 - (1-x)^2
        //  *  y = 1 - (1 - 2x + x^2)
        //  *  y = 2x - x^2
        //  *  x^2 - 2x + y = 0
        // From this we can use the quadratic equation to get:
        let x = Math.sqrt(SCALE_FACTOR) - Math.sqrt(SCALE_FACTOR*(1-y));
        if (x > 1.0) x = 1.0;
        t_elevation[nonocean_t[i]] = x;
    }
};
