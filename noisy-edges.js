/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */

'use strict';

const {mixp} = require('./util');

/**
 * Noisy edges is a variant of midpoint subdivision that keeps the lines
 * constrained to a quadrilateral. See the explanation here:
 * http://www.redblobgames.com/maps/noisy-edges/
 */

/**
 * Return the noisy line from a to b, within quadrilateral a-p-b-q,
 * as an array of points, not including a. The recursive subdivision
 * has up to 2^levels segments. Segments below a given length are
 * not subdivided further.
 */
const divisor = 0x10000000;
exports.recursiveSubdivision = function(length, amplitude, randInt) {
    function recur(a, b, p, q) {
        let dx = a[0] - b[0], dy = a[1] - b[1];
        if (dx*dx + dy*dy < length*length) { return [b]; }
        
        let ap = mixp([], a, p, 0.5),
            bp = mixp([], b, p, 0.5),
            aq = mixp([], a, q, 0.5),
            bq = mixp([], b, q, 0.5);

        let division = 0.5 * (1 - amplitude) + randInt(divisor)/divisor * amplitude;
        let center = mixp([], p, q, division);
        
        let results1 = recur(a, center, ap, aq),
            results2 = recur(center, b, bp, bq);

        return results1.concat(results2);
    };
    return recur;
}


// TODO: this allocates lots of tiny arrays; find a data format that
// doesn't have so many allocations

exports.assign_s_segments = function(s_lines, mesh, {amplitude, length}, randInt) {
    const subdivide = exports.recursiveSubdivision(length, amplitude, randInt);
    s_lines.length = mesh.numSides;
    for (let s = 0; s < mesh.numSides; s++) {
        let t0 = mesh.s_inner_t(s),
            t1 = mesh.s_outer_t(s),
            r0 = mesh.s_begin_r(s),
            r1 = mesh.s_end_r(s);
        if (r0 < r1) {
            if (mesh.s_ghost(s)) {
                s_lines[s] = [mesh.t_pos([], t1)];
            } else {
                s_lines[s] = subdivide(
                    mesh.t_pos([], t0),
                    mesh.t_pos([], t1),
                    mesh.r_pos([], r0),
                    mesh.r_pos([], r1)
                );
            }
            // construct line going the other way; since the line is a
            // half-open interval with [p1, p2, p3, ..., pn] but not
            // p0, we want to reverse all but the last element, and
            // then append p0
            let opposite = s_lines[s].slice(0, -1);
            opposite.reverse();
            opposite.push(mesh.t_pos([], t0));
            s_lines[mesh.s_opposite_s(s)] = opposite;
        }
    }
    return s_lines;
};
