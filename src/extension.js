/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * extension.js
 * Copyright (C) 2012 Vincent Petithory <vincent.petithory@gmail.com>
 *
 * workspace-monitor is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * workspace-monitor is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Gtk = imports.gi.Gtk;
const Overview = imports.ui.overview;

// TODO I18N

// TODO PREFS : THUMBNAIL_MAX_SIZE + affectsStruts

// TODO Handle workspace destroyed

function _(s) {
    return s;
}


let THUMBNAIL_MAX_SIZE = Main.layoutManager.primaryMonitor.width*0.2;
let AFFECTS_STRUTS = true;

const WindowClone = new Lang.Class({
    Name: 'WindowClone',

    _init: function(realWindow, maxSize) {
        this.realWindow = realWindow;
        this.metaWindow = realWindow.meta_window;
//        this.metaWindow._delegate = this;
        
        this.actor = new St.Bin({ reactive: true });
        
        this._texture = this.realWindow.get_texture();
        this._windowClone = new Clutter.Clone({
            source: this._texture,
            reactive: false
        });
        
//        // Destroy the clone upon source destruction
//        this._windowClone.source.connect('destroy', Lang.bind(this, function() {
//            this._windowClone.destroy();
//        }));
        this._realWindowDestroyId = this.realWindow.connect('destroy',
            Lang.bind(this, this._disconnectRealWindowSignals));
        this._realWindowSizeChangedId = this.realWindow.connect('size-changed',
            Lang.bind(this, this._onRealWindowSizeChanged));
        this._windowCloneClickedId = this.actor.connect('button-release-event',
            Lang.bind(this, this._onButtonRelease));
        
        this.adjust_size(maxSize);
        this.actor.add_actor(this._windowClone);
    },
    
    adjust_size: function (maxSize) {
        let [width, height] = this._texture.get_size();
        let scale = Math.min(1.0, maxSize/width, maxSize/height);
        this._windowClone.set_size(width*scale, height*scale);
        this.actor.set_size(maxSize, maxSize);
        this._maxSize = maxSize;
    },
    
    destroy: function() {
        this._disconnectRealWindowSignals();
        if (this._windowClone) {
            this._windowClone.destroy();
        }
        if (this.actor) {
            this.actor.destroy();
        }
    },
    
    _onButtonRelease: function() {
        Main.activateWindow(this.metaWindow);
    },
    
    _onRealWindowSizeChanged: function () {
        this.adjust_size(this._maxSize);
    },
    
    _disconnectRealWindowSignals: function() {
        if (!this.realWindow)
            return;
        if (this._realWindowSizeChangedId > 0)
            this.realWindow.disconnect(this._realWindowSizeChangedId);
        this._realWindowSizeChangedId = 0;

        if (this._realWindowDestroyId > 0)
            this.realWindow.disconnect(this._realWindowDestroyId);
        this._realWindowDestroyId = 0;
    }
    

});

const WorkspaceMonitor = new Lang.Class({
    Name: 'WorkspaceMonitor',

    _init: function(metaWorkspace, affectsStruts) {
        this.monitorIndex = Main.layoutManager.primaryIndex;
        this.request_display = false;

        this.metaWorkspace = metaWorkspace;
        this.affectsStruts = affectsStruts;
        
        this._windowClones = [];
        
        // We use the style class of the workspace thumbnails background
        // seen in the overview, for style consistency.
        this.actor = new St.Bin({ reactive: false, style_class: 'workspace-thumbnails-background' });
        this._box = new St.BoxLayout({ name: 'workspace-view',
                                       vertical: true,
                                       reactive: false/*,
                                       clip_to_allocation: true*/ });
        this._box._delegate = this;
        this.actor.add_actor(this._box);
        
        this.computeSize();
    },
    
    _overviewShowing: function() {
        if (this.request_display) {
            this.actor.opacity = 255;
            this.actor.hide();
            Tweener.addTween(this.actor, {
                opacity: 0,
                transition: 'easeOutQuad',
                time: Overview.ANIMATION_TIME
            });
        }
    },
    
    _overviewHiding: function() {
        if (this.request_display) {
            this.actor.opacity = 0;
            this.actor.show();
            Tweener.addTween(this.actor, {
                opacity: 255,
                transition: 'easeOutQuad',
                time: Overview.ANIMATION_TIME
            });
        }
    },
    
    _windowAdded: function (metaWorkspace, metaWin) {
        if (!this.request_display) {
            return;
        }
        if (this.metaWorkspace != metaWorkspace) {
            return;
        }
        let realWin = metaWin.get_compositor_private();
        if (!realWin) {
            // Newly-created windows are added to a workspace before
            // the compositor finds out about them...
            Mainloop.idle_add(Lang.bind(this,
                                        function () {
                                            if (this.actor &&
                                                metaWin.get_compositor_private())
                                                this._windowAdded(metaWorkspace, metaWin);
                                            return false;
                                        }));
        } else {
            if (!this._isWindowInteresting(realWin)) {
                return;
            }
            this.computeSize();
            this._doAddWindow(realWin);
            this.position();
        }
    },
    
    _windowRemoved: function (metaWorkspace, metaWin) {
        if (!this.request_display) {
            return;
        }
        this._doRemoveWindow(metaWin);
        this.computeSize();
        this.position();
    },
    
    _windowEnteredMonitor : function(metaScreen, monitorIndex, metaWin) {
        if (monitorIndex == this.monitorIndex) {
            this._windowAdded(metaWin.get_workspace(), metaWin);
        }
    },

    _windowLeftMonitor : function(metaScreen, monitorIndex, metaWin) {
        if (monitorIndex == this.monitorIndex) {
            this._doRemoveWindow(metaWin);
        }
    },

    _doAddWindow: function (realWin) {
        let windowClone = new WindowClone(realWin, this._maxSize);
        this._windowClones.push(windowClone);
        this._box.add_actor(windowClone.actor);
    },
    
    _doRemoveWindow: function (metaWin) {
        for (let i = 0; i < this._windowClones.length; i++) {
            let metaWindow = this._windowClones[i].metaWindow;
            if (metaWin == metaWindow) {
                let windowClone = this._windowClones.splice(i,1)[0];
                if (windowClone.actor) {
                    this._box.remove_actor(windowClone.actor);
                }
                windowClone.destroy();
            }
        }
    },
    
    getWindowClone: function (metaWin) {
        for (let i = 0; i < this._windowClones.length; i++) {
            let metaWindow = this._windowClones[i].metaWindow;
            if (metaWin == metaWindow) {
                return this._windowClones[i];
            }
        }
        return null;
    },
    
    hasWindowClone: function (metaWin) {
        return this.getWindowClone(metaWin) != null;
    },

    computeSize: function() {
        let windows = global.get_window_actors().filter(this._isWindowInteresting, this);
        
        let monitor = Main.layoutManager.primaryMonitor;
        this._marginTop = monitor.y + Main.panel.actor.height + 10;
        this._marginBottom = 60;
        let maxHeight = (monitor.height - (this._marginTop + this._marginBottom) ) / windows.length;
        this._maxSize = Math.min(THUMBNAIL_MAX_SIZE, maxHeight);
    },
    
    position: function() {
        for (let i = 0; i < this._windowClones.length; i++) {
            this._windowClones[i].adjust_size(this._maxSize);
        }
        
        let monitor = Main.layoutManager.primaryMonitor;
        this.actor.y = this._marginTop;
        let x = monitor.x + monitor.width - this._maxSize;
        // Disable this tween along the X-Axis when we are affecting struts,
        // or the animation will be very laggy.
        if (this.affectsStruts) {
            this.actor.x = x;
        } else {
            if (this.actor.x == 0) {
                this.actor.x = monitor.x + monitor.width - 10;
            }
            Tweener.addTween(this.actor,
             { x: x,
               transition: 'easeOutQuad',
               time: Overview.ANIMATION_TIME
             });
        
        }
        
        
    },

    // Tests if @win is interesting
    _isWindowInteresting: function (win) {
        let tracker = Shell.WindowTracker.get_default();
        return tracker.is_window_interesting(win.get_meta_window()) &&
               win.get_meta_window().showing_on_its_workspace() &&
               Main.isWindowActorDisplayedOnWorkspace(win, this.metaWorkspace.index());
    },
    
    show: function() {
        if (!this.request_display) {
            this.connectAll();
            this.computeSize();
            this.resetWindows();
            this.position();
            // Do not show the actor if we are in the Overview
            if (Main.overview.visible) {
                this.actor.hide();
            } else {
                this.actor.show();
            }
        }
        this.request_display = true;
    },
    
    refresh: function() {
        this.hide();
        this.show();
    },
    
    resetWindows: function () {
        // Empty container
        this._box.destroy_all_children();
        
        let windows = global.get_window_actors().filter(this._isWindowInteresting, this);
        for (let i = 0; i < windows.length; i++) {
            this._doAddWindow(windows[i], this._maxSize);
        }
    },

    hide: function() {
        if (this.request_display) {
            this.disconnectAll();
            this.actor.hide();
        }
        this.request_display = false;
    },
    
    connectAll: function () {
        // Listen to hide / show events of the Overview, to hide / show our panel accordingly
        this._overviewShowingId = Main.overview.connect('showing',
            Lang.bind(this, this._overviewShowing));
        this._overviewHidingId = Main.overview.connect('hidden',
            Lang.bind(this, this._overviewHiding));
        
        this._windowAddedId = this.metaWorkspace.connect('window-added',
              Lang.bind(this, this._windowAdded));
        this._windowRemovedId = this.metaWorkspace.connect('window-removed',
              Lang.bind(this, this._windowRemoved));
    },
    
    disconnectAll: function () {
        if (this._overviewShowingId) {
            Main.overview.disconnect(this._overviewShowingId);
            this._overviewShowingId = 0;
        }

        if (this._overviewHidingId) {
            Main.overview.disconnect(this._overviewHidingId);
            this._overviewHidingId = 0;
        }
        
        if (this._windowAddedId && this.metaWorkspace) {
            this.metaWorkspace.disconnect(this._windowAddedId);
            this._windowAddedId = 0;
        }
        
        if (this._windowRemovedId && this.metaWorkspace) {
            this.metaWorkspace.disconnect(this._windowRemovedId);
            this._windowRemovedId = 0;
        }
    },

    destroy: function() {
        this.disconnectAll();
        this.actor.destroy();
    }

});

const StatusButton = new Lang.Class({
    Name: 'StatusButton',
    Extends: PanelMenu.SystemStatusButton,

    _init: function() {
        this.parent('preferences-desktop-remote-desktop');
        this._selectedWorkspaceIndex = 0;
        this._workspaceSwitcherComboChangedId = 0;
        this._nWorkspacesChangedId = global.screen.connect('notify::n-workspaces',
            Lang.bind(this, this._updateWorkspaceSwitcherCombo));
        
        this._workspaceMonitorVisibilitySwitch = new PopupMenu.PopupSwitchMenuItem(_("Visible"));
        this.menu.addMenuItem(this._workspaceMonitorVisibilitySwitch);
        this._workspaceMonitorVisibilitySwitch.connect('toggled',
            Lang.bind(this, this._toggleWorkspaceMonitorVisibility));
        this._workspaceMonitorVisibilitySwitch.setToggleState(false);
    },
    
    _switchWorkspace: function(menuItem, id) {
        
    },
    
    _updateWorkspaceSwitcherCombo: function() {
        
    },

    _toggleWorkspaceMonitorVisibility: function(item, event) {
        if (this._view && !event) {
            this._view.hide();
            this._view.destroy();
            this._view = null;
        } else if (!this._view && event) {
            let metaWorkspace = global.screen.get_workspace_by_index(this._selectedWorkspaceIndex);
            this._view = new WorkspaceMonitor(metaWorkspace, AFFECTS_STRUTS);
            Main.layoutManager.addChrome(this._view.actor, {affectsStruts: AFFECTS_STRUTS});
//            Main.uiGroup.add_actor(this._view.actor);
            this._view.show();
        }
    }
    
});


let status_button;

function init() {
    // Nothing
}

function enable() {
    if (!status_button) {
        status_button = new StatusButton();
        Main.panel.addToStatusArea('activator_button', status_button);
    }
}

function disable() {
    status_button.destroy();
    status_button = null;
}
