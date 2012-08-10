/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * dim.js
 * This file is part of workspace-monitor
 *
 * Copyright (C) 2012 - Vincent Petithory <vincent.petithory@gmail.com>
 *
 * workspace-monitor is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * workspace-monitor is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with workspace-monitor. If not, see <http://www.gnu.org/licenses/>.
 */

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;

let extension = imports.misc.extensionUtils.getCurrentExtension();

var dimShader = undefined;

function getDimShaderSource() {
    if (!dimShader) {
        dimShader = Shell.get_file_contents_utf8_sync(
            extension.dir.get_child('dim.glsl').get_path()
        );
    }
    return dimShader;
}

const DimEffectPool = new Lang.Class({
    Name: 'DimEffectPool',
    
    _init: function(n) {
        this._pool = [];
        while (--n > -1) {
            this._pool.push(this.createEffect());
        }
    },
    
    getDimEffect: function(actor) {
        let n = this._pool.length;
        for (let i = 0; i < n; i++) {
            if (!this._pool[i]._used) {
                return new DimEffect(actor, this._pool[i]);
            }
        }
        // Allocate a new effect
        global.log("allocated an effect");
        let e = this.createEffect();
        this._pool.push(e);
        return new DimEffect(actor, e);
    },
    
    createEffect: function() {
        let effect;
        if (Clutter.feature_available(Clutter.FeatureFlags.SHADERS_GLSL)) {
            effect = new Clutter.ShaderEffect({ shader_type: Clutter.ShaderType.FRAGMENT_SHADER });
            effect.set_shader_source(getDimShaderSource());
        } else {
            effect = undefined;
        }
        return effect;
    },
    
    destroy: function() {
        this._pool = undefined;
    }
    
});

const DimEffect = new Lang.Class({
    Name: 'DimEffect',

    _init: function(actor, effect) {
        this._effect = effect;
        this.actor = actor;
        this._effect._used = true;
    },
    
    destroy: function() {
        if (this._effect.actor && this.actor) {
            this.actor.remove_effect(this._effect);
        }
        this._effect._used = false;
        this._effect = undefined;
    },

    set dimFraction(fraction) {
        this._dimFraction = fraction;

        if (this._effect == undefined)
            return;

        if (fraction > 0.01) {
            Shell.shader_effect_set_double_uniform(this._effect, 'fraction', fraction);

            if (!this._effect.actor)
                this.actor.add_effect(this._effect);
        } else {
            if (this._effect.actor)
                this.actor.remove_effect(this._effect);
        }
    },

    get dimFraction() {
        return this._dimFraction;
    },

    _dimFraction: 0.0
});
