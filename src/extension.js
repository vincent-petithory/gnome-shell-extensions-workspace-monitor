/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * extension.js
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

let extension = imports.misc.extensionUtils.getCurrentExtension();
let Lib = extension.imports.lib;

const Gettext = imports.gettext.domain(Lib.GETTEXT_DOMAIN);
const _ = Gettext.gettext;

let settings;

const WindowClone = new Lang.Class({
    Name: 'WindowClone',
    
    ICON_SIZE: 24,

    _init: function(realWindow, maxHeight) {
        this.realWindow = realWindow;
        this.metaWindow = realWindow.meta_window;
        this._maxHeight = maxHeight;
        this._texture = this.realWindow.get_texture();
        
        this.actor = new St.Bin({reactive: true});
        
        let group = new Clutter.Group();
        this.actor.add_actor(group);
        
        this._windowClone = new Clutter.Clone({
            source: this._texture,
            reactive: false
        });
        
        this._realWindowDestroyId = this.realWindow.connect('destroy',
            Lang.bind(this, this._disconnectRealWindowSignals));
        this._realWindowSizeChangedId = this.realWindow.connect('size-changed',
            Lang.bind(this, this._onRealWindowSizeChanged));
        this._windowCloneClickedId = this.actor.connect('button-release-event',
            Lang.bind(this, this._onButtonRelease));
        
        group.add_actor(this._windowClone);
        
        if (settings.get_boolean(Lib.Settings.SHOW_APP_ICON_KEY)) {
            let app = Shell.WindowTracker.get_default().get_window_app(this.metaWindow);
            this._icon = app.create_icon_texture(this.ICON_SIZE);
            group.add_actor(this._icon);
        }
    },
    
    adjust_size: function (maxHeight) {
        let [width, height] = this._texture.get_size();
        let scale = Math.min(1.0, settings.get_int(Lib.Settings.THUMBNAIL_MAX_SIZE_KEY)/width, maxHeight/height);
        let [sw, sh] = [Math.round(width*scale), Math.round(height*scale)];
        this.actor.set_size(settings.get_int(Lib.Settings.THUMBNAIL_MAX_SIZE_KEY), sh);
        this._windowClone.set_size(sw, sh);
        if (this._icon) {
            this._icon.set_position(3, sh - this.ICON_SIZE - 3);
        }
        this._maxHeight = maxHeight;
    },
    
    destroy: function() {
        this._disconnectRealWindowSignals();
        if (this._windowClone) {
            this._windowClone.destroy();
        }
        if (this.actor) {
            if (this._windowCloneClickedId > 0) {
                this.actor.disconnect(this._windowCloneClickedId);
            }
            this._windowCloneClickedId = 0;
            this.actor.destroy();
        }
    },
    
    _onButtonRelease: function() {
        Main.activateWindow(this.metaWindow);
    },
    
    _onRealWindowSizeChanged: function () {
        this.adjust_size(this._maxHeight);
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

    _init: function(metaWorkspace) {
        this.monitorIndex = Main.layoutManager.primaryIndex;
        this.request_display = false;

        this.metaWorkspace = metaWorkspace;
        
        this._windowClones = [];
        
        // We use the style class of the workspace thumbnails background
        // seen in the overview, for style consistency.
        this.actor = new St.Bin({reactive: true, style_class: 'workspace-monitor'});
        this._container = new St.Bin({reactive: false, style_class: 'workspace-thumbnails-background'});
        this._box = new St.BoxLayout({name: 'workspace-view',
                                       style_class: 'workspace-monitor-box',
                                       vertical: true,
                                       reactive: false});
        this._container.add_actor(this._box);
        this.actor.add_actor(this._container);
    },
    
    set_meta_workspace: function(metaWorkspace) {
        this.disconnectAll();
        this.metaWorkspace = metaWorkspace;
        this.connectAll();
        this.computeSize();
        this.resetWindows();
        this.position();
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
    
    _addEmptyWindowIfNeeded: function() {
        if (global.get_window_actors().filter(this._isWindowInteresting, this).length == 0) {
            let thumbnailMaxSize = settings.get_int(Lib.Settings.THUMBNAIL_MAX_SIZE_KEY);
            let monitor = Main.layoutManager.primaryMonitor;
            this._emptyWindowActor = Meta.BackgroundActor.new_for_screen(global.screen);
            let s = Math.min(1.0, thumbnailMaxSize/monitor.width, thumbnailMaxSize/monitor.height);
            this._emptyWindowActor.set_scale(s, s);
            this._emptyWindowActor.set_size(s*monitor.width, s*monitor.height);
            
            this._box.add_actor(this._emptyWindowActor);
        }
    },
    
    _windowRemoved: function (metaWorkspace, metaWin) {
        if (!this.request_display) {
            return;
        }
        this._doRemoveWindow(metaWin);
        this._addEmptyWindowIfNeeded();
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
        if (this._emptyWindowActor) {
            this._box.remove_actor(this._emptyWindowActor);
        }
        let windowClone = new WindowClone(realWin, this._maxHeight);
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
        return undefined;
    },
    
    hasWindowClone: function (metaWin) {
        return this.getWindowClone(metaWin) != undefined;
    },

    computeSize: function() {
        let windows = global.get_window_actors().filter(this._isWindowInteresting, this);
        
        let numWindows = windows.length;
        if (numWindows == 0) {
            numWindows = 1;
        }
        
        let monitor = Main.layoutManager.primaryMonitor;
        this._marginTop = monitor.y + Main.panel.actor.height + 10;
        this._marginBottom = 20;
        
        let spacing;
        try {
            spacing = this._box.get_theme_node().get_length('spacing');
        } catch (e) {
            spacing = 0;
        }
        let maxHeight = (monitor.height - 
            (this._marginTop + this._marginBottom + spacing*(numWindows-1))
        ) / numWindows;
        this._maxHeight = maxHeight;
    },
    
    position: function() {
        for (let i = 0; i < this._windowClones.length; i++) {
            this._windowClones[i].adjust_size(this._maxHeight);
        }
        let padding;
        try {
            padding = this.actor.get_theme_node().get_length('padding') + this._container.get_theme_node().get_length('padding');
        } catch (e) {
            padding = 0;
        }
        let monitor = Main.layoutManager.primaryMonitor;
        this.actor.y = this._marginTop;
        let x = monitor.x + monitor.width - settings.get_int(Lib.Settings.THUMBNAIL_MAX_SIZE_KEY) - padding*2;
        // Disable this tween along the X-Axis when we are affecting struts,
        // or the animation will be very laggy.
        if (settings.get_string(Lib.Settings.DISPLAY_MODE_KEY) == 'dock') {
            this.actor.x = x;
        } else {
            if (this.actor.x == 0) {
                this.actor.x = monitor.x + monitor.width - 10;
            }
            Tweener.addTween(this.actor,
             {
               x: x,
               transition: 'easeOutQuad',
               time: Overview.ANIMATION_TIME
             });
        
        }
    },

    // Tests if @win is interesting
    _isWindowInteresting: function (win) {
        let tracker = Shell.WindowTracker.get_default();
        let metaWin = win.get_meta_window();
        return tracker.is_window_interesting(metaWin) &&
               metaWin.showing_on_its_workspace() &&
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
    
    resetWindows: function () {
        // Empty container
        this._box.destroy_all_children();
        
        let windows = global.get_window_actors().filter(this._isWindowInteresting, this);
        for (let i = 0; i < windows.length; i++) {
            this._doAddWindow(windows[i]);
        }
        this._addEmptyWindowIfNeeded();
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
        this.isActivated = false;
        this._workspaceSwitcherComboChangedId = 0;
        this._view = undefined;
        this._lastScrollEventTime = 0;
        
        // Switch visible / hidden
        this._workspaceMonitorVisibilitySwitch = new PopupMenu.PopupSwitchMenuItem(_("Workspace Monitor"));
        this.menu.addMenuItem(this._workspaceMonitorVisibilitySwitch);
        this._workspaceMonitorVisibilitySwitchId = this._workspaceMonitorVisibilitySwitch.connect('toggled',
            Lang.bind(this, this._onWorkspaceMonitorVisibilitySwitchToggled));
        this._workspaceMonitorVisibilitySwitch.setToggleState(false);
        
        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        global.display.add_keybinding(Lib.Settings.TOGGLE_WORKSPACE_MONITOR_PANEL_KEYBINDING_KEY,
            settings,
            Meta.KeyBindingFlags.NONE,
            Lang.bind(this, this._toggleWorkspaceMonitorVisibility));
        
        // Settings events
        this._settingThumbnailMaxSizeChangedId = settings.connect("changed::"+Lib.Settings.THUMBNAIL_MAX_SIZE_KEY,
            Lang.bind(this, this._onThumbnailMaxSizeChanged));
        this._settingDisplayModeChangedId = settings.connect("changed::"+Lib.Settings.DISPLAY_MODE_KEY,
            Lang.bind(this, this._onDisplayModeChanged));
        this._settingUseMouseWheelChangedId = settings.connect("changed::"+Lib.Settings.USE_MOUSE_WHEEL_KEY,
            Lang.bind(this, this._onUseMouseWheelChanged));
        this._settingAlwaysTrackActiveWorkspaceChangedId = settings.connect("changed::"+Lib.Settings.ALWAYS_TRACK_ACTIVE_WORKSPACE_KEY,
            Lang.bind(this, this._onAlwaysTrackActiveWorkspaceChanged));
        this._settingShowAppIconChangedId = settings.connect("changed::"+Lib.Settings.SHOW_APP_ICON_KEY,
            Lang.bind(this, this._onShowAppIconChanged));
        
        this._nWorkspacesChangedId = global.screen.connect('notify::n-workspaces',
            Lang.bind(this, this._numWorkspacesChanged));
        
        this._updateWorkspaceSwitcherCombo();
        this._onAlwaysTrackActiveWorkspaceChanged();
    },
    
    _toggleWorkspaceMonitorVisibility: function() {
        
        this.isActivated = !this.isActivated;
        if (this.isActivated) {
            if (settings.get_boolean(Lib.Settings.ALWAYS_TRACK_ACTIVE_WORKSPACE_KEY)) {
                this._selectedWorkspaceIndex = global.screen.get_active_workspace_index();
                this._workspaceSwitcherCombo.setActiveItem(this._selectedWorkspaceIndex);
            }
            this.updateWorkspaceIndicator();
        } else {
            this.hideWorkspaceIndicator();
            this._view.destroy();
            this._view = undefined;
        }
        this._workspaceMonitorVisibilitySwitch.setToggleState(this.isActivated);
    },
    
    _onThumbnailMaxSizeChanged: function () {
        this.updateWorkspaceIndicator();
    },
    
    _onDisplayModeChanged: function () {
        this.hideWorkspaceIndicator();
        this._view.destroy();
        this._view = undefined;
        this.updateWorkspaceIndicator();
    },
    
    _onUseMouseWheelChanged: function () {
        if (this._viewScrollId > 0 && this._view) {
            if (this._view.actor) {
                this._view.actor.disconnect(this._viewScrollId);
            }
            this._viewScrollId = 0;
        }
        if (this._view && settings.get_boolean(Lib.Settings.USE_MOUSE_WHEEL_KEY)) {
            this._viewScrollId = this._view.actor.connect('scroll-event',
                Lang.bind(this, this._onViewScrollEvent));
        }
    },
    
    _onAlwaysTrackActiveWorkspaceChanged: function() {
        if (this.isActivated) {
            this._disconnectWorkspaceSwitchingEvents();
            if (settings.get_boolean(Lib.Settings.ALWAYS_TRACK_ACTIVE_WORKSPACE_KEY)) {
                this._connectWorkspaceSwitchingEvents();
                this._selectedWorkspaceIndex = global.screen.get_active_workspace_index();
                this._workspaceSwitcherCombo.setActiveItem(this._selectedWorkspaceIndex);
                this.updateWorkspaceIndicator();
            }
        }
    },
    
    _onShowAppIconChanged: function() {
        if (this.isActivated) {
            this.updateWorkspaceIndicator();
        }
    },
    
    _switchWorkspace: function(menuItem, id) {
        this._selectedWorkspaceIndex = id;
        // Close the whole menu right away
        // when the user selected another workspace.
        if (this.isActivated) {
            this.updateWorkspaceIndicator();
            this.menu.close();
        }
    },
    
    _activeWorkspaceChanged: function(wm, from, to, direction) {
        // This may have been triggered by our code (when scrolling, for example)
        // so if the targeted and actual workspaces are the same, just exit
        if (this._selectedWorkspaceIndex != to) {
            this._selectedWorkspaceIndex = to;
            this._workspaceSwitcherCombo.setActiveItem(this._selectedWorkspaceIndex);
            this.updateWorkspaceIndicator();
        }
    },
    
    _numWorkspacesChanged: function() {
        let ourWorkspaceChanged = false;
        if (this._selectedWorkspaceIndex > global.screen.n_workspaces - 1) {
            this._selectedWorkspaceIndex = global.screen.n_workspaces - 1;
            ourWorkspaceChanged = true;
        }
        
        if (this._metaWorkspace) {
            if (this._metaWorkspace != global.screen.get_workspace_by_index(this._selectedWorkspaceIndex)) {
                ourWorkspaceChanged = true;
            }
        }
        
        this._updateWorkspaceSwitcherCombo();
        if (ourWorkspaceChanged) {
            if (this.isActivated) {
                this.updateWorkspaceIndicator();
            }
        }
    },
    
    _updateWorkspaceSwitcherCombo: function() {
        if (this._workspaceSwitcherComboChangedId > 0 && this._workspaceSwitcherCombo) {
            this._workspaceSwitcherCombo.disconnect(this._workspaceSwitcherComboChangedId);
        }
        if (this._workspaceSwitcherCombo) {
            this._workspaceSwitcherCombo.destroy();
        }
        this._workspaceSwitcherCombo = new PopupMenu.PopupComboBoxMenuItem({style_class: 'status-chooser-combo'});
        this.menu.addMenuItem(this._workspaceSwitcherCombo);
        
        for (let i = 0; i < global.screen.n_workspaces; i++) {
            let comboItem = new PopupMenu.PopupMenuItem(_("Workspace")+" "+(i+1).toString());
            this._workspaceSwitcherCombo.addMenuItem(comboItem, i);
            this._workspaceSwitcherCombo.setItemVisible(i, true);
        }
        this._workspaceSwitcherComboChangedId = this._workspaceSwitcherCombo.connect('active-item-changed',
            Lang.bind(this, this._switchWorkspace));
        this._workspaceSwitcherCombo.setActiveItem(this._selectedWorkspaceIndex);
        // deactivate the combo if we are tracking the active workspace
        this._workspaceSwitcherCombo.setSensitive( !settings.get_boolean(Lib.Settings.ALWAYS_TRACK_ACTIVE_WORKSPACE_KEY) );
    },

    _onWorkspaceMonitorVisibilitySwitchToggled: function(item, event) {
        this.isActivated = event;
        if (this.isActivated) {
            if (settings.get_boolean(Lib.Settings.ALWAYS_TRACK_ACTIVE_WORKSPACE_KEY)) {
                this._selectedWorkspaceIndex = global.screen.get_active_workspace_index();
                this._workspaceSwitcherCombo.setActiveItem(this._selectedWorkspaceIndex);
            }
            this.updateWorkspaceIndicator();
        } else {
            this.hideWorkspaceIndicator();
            this._view.destroy();
            this._view = undefined;
        }
    },
    
    _onViewScrollEvent: function(actor, event) {
        // We want to ignore events that are incoming too fast, or it will 
        // eventually crash the shell if the user scrolls like crazy.
        let ignoreEvent = (event.get_time() - this._lastScrollEventTime) < 100;
        this._lastScrollEventTime = event.get_time();
        if (ignoreEvent) {
            return;
        }
        let newSelectedWorkspaceIndex;
        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.DOWN) {
            newSelectedWorkspaceIndex = this._selectedWorkspaceIndex + 1;
        } else if (direction == Clutter.ScrollDirection.UP) {
            newSelectedWorkspaceIndex = this._selectedWorkspaceIndex - 1;
        }
        newSelectedWorkspaceIndex = Math.min(
            Math.max(newSelectedWorkspaceIndex, 0),
            global.screen.n_workspaces - 1
        );
        if (this._selectedWorkspaceIndex == newSelectedWorkspaceIndex) {
            return;
        }
        // If we track the active workspace, move to it upon changing the monitored workspace manually
        if (settings.get_boolean(Lib.Settings.ALWAYS_TRACK_ACTIVE_WORKSPACE_KEY)) {
            let workspace = global.screen.get_workspace_by_index(newSelectedWorkspaceIndex);
            if (workspace) {
                workspace.activate(global.get_current_time());
            }
        } else {
            this._selectedWorkspaceIndex = newSelectedWorkspaceIndex;
            this._workspaceSwitcherCombo.setActiveItem(this._selectedWorkspaceIndex);
            this.updateWorkspaceIndicator();
        }
    },
    
    _connectWorkspaceSwitchingEvents: function() {
        if (this._switchWorkspaceNotifyId > 0) {
            global.window_manager.disconnect(this._switchWorkspaceNotifyId);
            this._switchWorkspaceNotifyId = 0;
        }
        this._switchWorkspaceNotifyId = global.window_manager.connect('switch-workspace',
            Lang.bind(this, this._activeWorkspaceChanged));
        this._workspaceSwitcherCombo.setSensitive(false);
    },
    
    _disconnectWorkspaceSwitchingEvents: function() {
        if (this._switchWorkspaceNotifyId > 0) {
            global.window_manager.disconnect(this._switchWorkspaceNotifyId);
            this._switchWorkspaceNotifyId = 0;
        }
        this._workspaceSwitcherCombo.setSensitive(true);
    },
    
    updateWorkspaceIndicator: function() {
        this._metaWorkspace = global.screen.get_workspace_by_index(this._selectedWorkspaceIndex);
        if (this._view) {
            this._view.set_meta_workspace(this._metaWorkspace);
            this._view.show();
        } else {
            this._view = new WorkspaceMonitor(this._metaWorkspace);
            if (settings.get_boolean(Lib.Settings.USE_MOUSE_WHEEL_KEY)) {
                this._viewScrollId = this._view.actor.connect('scroll-event',
                    Lang.bind(this, this._onViewScrollEvent));
            }
            
            Main.layoutManager.addChrome(
                this._view.actor,
                {affectsStruts: settings.get_string(Lib.Settings.DISPLAY_MODE_KEY) == 'dock'}
            );
            this._view.show();
        }
        if (settings.get_boolean(Lib.Settings.ALWAYS_TRACK_ACTIVE_WORKSPACE_KEY)) {
            this._connectWorkspaceSwitchingEvents();
        }
    },
    
    hideWorkspaceIndicator: function() {
        if (this._view) {
            this._disconnectWorkspaceSwitchingEvents();
            this._view.hide();
        }
    },
    
    destroy: function() {
        if (this._nWorkspacesChangedId > 0) {
            global.disconnect(this._nWorkspacesChangedId);
            this._nWorkspacesChangedId = 0;
        }
        if (this._workspaceMonitorVisibilitySwitchId > 0 && this._workspaceMonitorVisibilitySwitch) {
            this._workspaceMonitorVisibilitySwitch.disconnect(this._workspaceMonitorVisibilitySwitchId);
            this._workspaceMonitorVisibilitySwitchId = 0;
        }
        if (this._workspaceSwitcherComboChangedId > 0 && this._workspaceSwitcherCombo) {
            this._workspaceSwitcherCombo.disconnect(this._workspaceSwitcherComboChangedId);
            this._workspaceSwitcherComboChangedId = 0;
        }
        if (this._settingThumbnailMaxSizeChangedId > 0) {
            settings.disconnect(this._settingThumbnailMaxSizeChangedId);
            this._settingThumbnailMaxSizeChangedId = 0;
        }
        if (this._settingDisplayModeChangedId > 0) {
            settings.disconnect(this._settingDisplayModeChangedId);
            this._settingDisplayModeChangedId = 0;
        }
        if (this._settingUseMouseWheelChangedId > 0) {
            settings.disconnect(this._settingUseMouseWheelChangedId);
            this._settingUseMouseWheelChangedId = 0;
        }
        if (this._settingAlwaysTrackActiveWorkspaceChangedId > 0) {
            settings.disconnect(this._settingAlwaysTrackActiveWorkspaceChangedId);
            this._settingAlwaysTrackActiveWorkspaceChangedId = 0;
        }
        if (this._settingShowAppIconChangedId > 0) {
            settings.disconnect(this._settingShowAppIconChangedId);
            this._settingShowAppIconChangedId = 0;
        }
        if (this._viewScrollId > 0 && this._view) {
            if (this._view.actor) {
                this._view.actor.disconnect(this._viewScrollId);
            }
            this._viewScrollId = 0;
        }
        this.hideWorkspaceIndicator();
        this._view.destroy();
        this._view = undefined;
        PanelMenu.SystemStatusButton.prototype.destroy.call(this);
    }
    
});


let status_button;

function init() {
    Lib.initTranslations(extension);
    settings = Lib.getSettings(extension, 'workspace-monitor');
}

function enable() {
    if (!status_button) {
        status_button = new StatusButton();
        Main.panel.addToStatusArea('workspace_monitor_button', status_button);
    }
}

function disable() {
    status_button.destroy();
    status_button = undefined;
}

