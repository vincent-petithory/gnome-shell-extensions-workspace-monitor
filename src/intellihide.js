/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * intellihide.js
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

const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Tweener = imports.ui.tweener;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

const Intellihide = new Lang.Class({
    Name: 'Intellihide',
    
    _init: function(actor, effect) {
        this.actor = actor;
        this._actorDestroyId = this.actor.connect('destroy',
            Lang.bind(this, this.destroy));
        
        this.effect = effect;
        this.effect.intellihide = this;
        this._hasHiddenActor = false;
        
        this._focusWindowChangedId = global.display.connect('notify::focus-window',
            Lang.bind(this, this._focusWindowChanged));
        
        this._actorRect = undefined;
        this._lastVisibilityActionTime = GLib.get_monotonic_time() / 1000.0;
        this._startupTimeoutId = Mainloop.timeout_add(1000,
            Lang.bind(this, function () {
                this._focusWindowChanged();
                this._startupTimeoutId = 0;
                return false;
            })
        );
    },
    
    _focusWindowChanged: function() {
        this._disconnectFocusWindowSignals();
        this._lastFocusMetaWindow = global.display.focus_window;
        
        if (this._lastFocusMetaWindow) {
            this._lastFocusRealWindow = this._lastFocusMetaWindow.get_compositor_private();
            this._focusWindowPositionChangedId = this._lastFocusRealWindow.connect('position-changed',
                Lang.bind(this, this._focusWindowGeometryChanged));
            this._focusWindowSizeChangedId = this._lastFocusRealWindow.connect('size-changed',
                Lang.bind(this, this._focusWindowGeometryChanged));
            this._focusWindowDestroyedId = this._lastFocusRealWindow.connect('destroy',
                Lang.bind(this, this._disconnectFocusWindowSignals));
        } else {
            this._lastFocusRealWindow = undefined;
        }
        this.adjustActorVisibility();
    },
    
    adjustActorVisibility: function() {
        if (this._lastFocusMetaWindow) {
            // If the window is maximized, hide the actor
            let isMaximized = this._lastFocusMetaWindow.maximized_vertically && this._lastFocusMetaWindow.maximized_horizontally;
            if (isMaximized) {
                if (!this._actorRect) {
                    this._actorRect = this._getActorRect();
                }
                this.hideActor();
            } else { // Otherwise, check for the intersection of the actor and the window
                let intersect = this._checkWindowAndActorIntersect();
                if (intersect) {
                    this.hideActor();
                } else {
                    this.showActor();
                }
            }
        }
    },
    
    _disconnectFocusWindowSignals: function() {
        if (this._lastFocusRealWindow) {
            if (this._focusWindowPositionChangedId > 0) {
                this._lastFocusRealWindow.disconnect(this._focusWindowPositionChangedId);
            }
            if (this._focusWindowSizeChangedId > 0) {
                this._lastFocusRealWindow.disconnect(this._focusWindowSizeChangedId);
            }
            if (this._focusWindowDestroyedId > 0) {
                this._lastFocusRealWindow.disconnect(this._focusWindowDestroyedId);
            }
        }
        this._focusWindowPositionChangedId = 0;
        this._focusWindowSizeChangedId = 0;
        this._focusWindowDestroyedId = 0;
    },
    
    _focusWindowGeometryChanged: function() {
        let now = GLib.get_monotonic_time() / 1000.0;
        if (now > this._lastVisibilityActionTime + this.effect.time*1000.0 + 50.0) {
            this.adjustActorVisibility();
        }
    },
    
    _getActorRect: function() {
        let [actorX, actorY] = this.actor.get_transformed_position();
        let [actorWidth, actorHeight] = this.actor.get_transformed_size();
        let actorRect = new Meta.Rectangle();
        actorRect.x = actorX;
        actorRect.y = actorY;
        actorRect.width = actorWidth;
        actorRect.height = actorHeight;
        return actorRect;
    },
    
    _checkWindowAndActorIntersect: function() {
        if (!this._lastFocusMetaWindow) {
            return false;
        }
        
        let focusWindowRect = this._lastFocusMetaWindow.get_outer_rect();
        
        if (this._actorRect) {
            let [intersect, r] = focusWindowRect.intersect(this._actorRect);
            if (!intersect) {
                // our stored rect that triggered the hide action does not
                // intersect anymore, so we clear it
                this._actorRect = undefined;
            }
            return intersect;
        } else {
            let actorRect = this._getActorRect();
            let [intersect, r] = focusWindowRect.intersect(actorRect);
            // If the actor and the focused window intersect,
            // we store the actor's rectangle that triggered the hide action.
            if (intersect) {
                this._actorRect = actorRect;
            }
            return intersect;
        }
    },
    
    showActor: function() {
        if (this._hasHiddenActor) {
            this._hasHiddenActor = false;
            this._lastVisibilityActionTime = GLib.get_monotonic_time() / 1000.0;
            this.effect.showActor(this.actor);
        }
    },
    
    hideActor: function() {
        if (!this._hasHiddenActor) {
            this._hasHiddenActor = true;
            this._lastVisibilityActionTime = GLib.get_monotonic_time() / 1000.0;
            this.effect.hideActor(this.actor);
        }
    },
    
    restoreActor: function() {
        this.effect.restoreActor(this.actor);
    },
    
    destroy: function() {
        this._disconnectFocusWindowSignals();
        // Restore the actor state if it is not destroyed
        if (this.actor) {
            this.restoreActor();
        }
        if (this.actor && this._actorDestroyId > 0) {
            this.actor.disconnect(this._actorDestroyId);
        }
        this._actorDestroyId = 0;
        
        if (this._focusWindowChangedId > 0) {
            global.display.disconnect(this._focusWindowChangedId);
        }
        this._focusWindowChangedId = 0;
    }

});


const Effect = new Lang.Class({
    Name: 'Effect',
    
    _init: function(time) {
        this.time = time;
    },
    
    set intellihide(intellihide) {
        this._intellihide = intellihide;
    },
    
    get intellihide() {
        return this._intellihide;
    },
    
    _intellihide: undefined,
    
    showActor: function(actor) {
        actor.set_opacity(255);
    },
    
    hideActor: function(actor) {
        actor.set_opacity(0);
    },
    
    restoreActor: function(actor) {
        actor.set_opacity(255);
    }
    
});

const SlideRightScreenEffect = new Lang.Class({
    Name: 'Effect',
    Extends: Effect,
    
    _init: function(time) {
        this.parent(time);
    },
    
    showActor: function(actor) {
        Tweener.addTween(actor, {
            x: this._x,
            transition: 'easeOutQuad',
            time: this.time,
            onComplete: Lang.bind(this, function () {
                this._intellihide.adjustActorVisibility();
            })
        });
    },
    
    hideActor: function(actor) {
        this._x = actor.x;
        let monitor = Main.layoutManager.primaryMonitor;
        Tweener.addTween(actor, {
            x: monitor.x + monitor.width,
            transition: 'easeOutQuad',
            time: this.time,
            onComplete: Lang.bind(this, function () {
                this._intellihide.adjustActorVisibility();
            })
        });
    },
    
    restoreActor: function(actor) {
        actor.x = this._x;
    }
    
});

