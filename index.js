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

const SEED = 123456789;

const util =         require('./util');
const Water =        require('./water');
const Elevation =    require('./elevation');
const Rivers =       require('./rivers');
const Moisture =     require('./moisture');
const Biomes =       require('./biomes');
const NoisyEdges =   require('./noisy-edges');

/**
 * Map generator
 *
 * mesh: DualMesh
 * noise: function(nx, ny) -> a number from -1 to +1
 * makeRandInt: function(seed) -> function(N) -> an int from 0 to N-1
 * options: see code
 */
class Map {
    constructor(mesh, noise, makeRandInt, options) {
        this.mesh = mesh;
        this.noise = noise;
        this.makeRandInt = makeRandInt;
        this.options = {
            seed: SEED,
            shape: {round: 0.5, inflate: 0.3},
            numRivers: 30,
            drainageSeed: SEED,
            riverSeed: SEED,
            noisyEdge: {levels: 0, amplitude: 0.2, seed: SEED},
            biomeBias: {temperature: 0, moisture: 0},
        };
        Object.assign(this.options, options);
        this.s_lines = NoisyEdges.assign_s_segments(this.mesh, this.options.noisyEdge, this.makeRandInt(this.options.noisyEdge.seed));
    }

    calculate() {
        this.r_water = Water.assign_r_water(this.mesh, this.noise, this.options.shape);
        this.r_ocean = Water.assign_r_ocean(this.mesh, this.r_water);
        this.elevationdata = Elevation.assign_t_elevation(this.mesh, this.r_ocean, this.r_water, this.makeRandInt(this.options.drainageSeed));
        this.t_coastdistance = this.elevationdata.t_distance;
        this.t_elevation = this.elevationdata.t_elevation;
        this.t_downslope_s = this.elevationdata.t_downslope_s;
        this.r_elevation = Elevation.assign_r_elevation(this.mesh, this.t_elevation, this.r_ocean);
        this.spring_t = util.randomShuffle(Rivers.find_spring_t(this.mesh, this.r_water, this.t_elevation, this.t_downslope_s), this.makeRandInt(this.options.riverSeed));
        this.river_t = this.spring_t.slice(0, this.options.numRivers);
        this.s_flow = Rivers.assign_s_flow(this.mesh, this.t_downslope_s, this.river_t, this.t_elevation);
        this.r_moisture = Moisture.assign_r_moisture(this.mesh, this.r_water, Moisture.find_moisture_seeds_r(this.mesh, this.s_flow, this.r_ocean, this.r_water));
        this.r_biome = Biomes.assign_r_biome(this.mesh, this.r_ocean, this.r_water, this.r_elevation, this.r_moisture, this.options.biomeBias);
    }
}

module.exports = Map;
