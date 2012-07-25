/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * prefs.js
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

const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;

let extension = imports.misc.extensionUtils.getCurrentExtension();
let Lib = extension.imports.lib;

const Gettext = imports.gettext.domain(Lib.GETTEXT_DOMAIN);
const _ = Gettext.gettext;

let settings;

function _createThumbnailMaxSizeSetting() {
    let thumbnailMaxSize = settings.get_int(Lib.Settings.THUMBNAIL_MAX_SIZE_KEY);
    
    let container = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, margin_top: 5, margin_bottom: 5});

    let settingLabel = new Gtk.Label({label: "<b>"+_("Window thumbnail maximum size")+"</b>",
                                       use_markup: true,
                                       xalign: 0});
    
    let box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                             margin_left: 20, margin_top: 5});
    
    let label = new Gtk.Label({label: _('Value:'), margin_right: 5});
    
    let spinButton = new Gtk.SpinButton({adjustment:
        new Gtk.Adjustment ({
            value: thumbnailMaxSize,
            lower: 50,
            upper: Gdk.Screen.get_default().get_width()*0.5,
            step_increment: 1,
            page_increment: 10})
    });
    
    
    spinButton.connect ("value-changed", function(button) {
        settings.set_int(Lib.Settings.THUMBNAIL_MAX_SIZE_KEY, button.get_value());
    });
    
    box.add(label);
    box.add(spinButton);
    container.add(settingLabel);
    container.add(box);

    return container;
}

function _createDisplayModeSetting() {
    let container = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, margin_top: 5, margin_bottom: 5});

    let settingLabel = new Gtk.Label({label: "<b>"+_("Display mode")+"</b>",
                                use_markup: true,
                                xalign: 0});
    
    let vbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                             margin_left: 20, margin_top: 5});
    
    let dock = new Gtk.RadioButton({label: _("Dock")});
    let overlay = new Gtk.RadioButton({label: _("Overlay"),
                                               group: dock});

    let displayMode = settings.get_string(Lib.Settings.DISPLAY_MODE_KEY);

    if (displayMode == 'dock')
        dock.set_active(true);
    else if (displayMode == 'overlay')
        overlay.set_active(true);

    dock.connect('toggled', function(button) {
        if (button.get_active())
            settings.set_string(Lib.Settings.DISPLAY_MODE_KEY, 'dock');
    });
    overlay.connect('toggled', function(button) {
        if (button.get_active())
            settings.set_string(Lib.Settings.DISPLAY_MODE_KEY, 'overlay');
    });

    vbox.add(dock);
    vbox.add(overlay);

    container.add(settingLabel);
    container.add(vbox);

    return container;
}

/*
   Shell-extensions handlers
*/

function init() {
    settings = Lib.getSettings(extension, 'workspace-monitor');
    Lib.initTranslations(extension);
}

function buildPrefsWidget() {
    let frame = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, border_width: 10});

    let box;

    box = _createThumbnailMaxSizeSetting();
    frame.add(box);

    box = _createDisplayModeSetting();
    frame.add(box);

    frame.show_all();

    return frame;
}
