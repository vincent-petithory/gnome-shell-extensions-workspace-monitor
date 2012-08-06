Workspace Monitor
=================

A panel to view live-previews of a selected workspace's windows, and more.

Features / options
------------------

- Displays all the windows of a selected workspace.
- Go to the window, on click.
- Option in extension's preferences to adjust the maximum size of the panel.
- Option in extension's preferences to select the display mode:
  - Overlay mode: the panel will overlay above other windows of the active workspace,
  - Dock mode: the panel will reserve space (as the gnome shell's top bar does).
- Switch of workspace with mouse wheel when hovering the panel (optional)
- Keyboard shortcut to show / hide the panel (shortcut can be changed in prefs)
- Option to always show the active workspace (turns the workspace monitor to work like a classic window list)
- Display the window's application icon on top of its thumbnail (optional)
- Add a dim effect to highlight the focused window (optional)
- Option to select how the monitor behaves:
  - displays all the windows of the selected workspace,
  - or reverse: show all the windows that are not on the selected workspace
- PT translation, updated FR translation.
- Compact layout for the window list
- Add Intellihide when in overlay mode


Use cases
---------

- You want to have visible windows at all times, but you dont have a dual monitor. This is for you.
- You want a window list that actually displays the real window, not only an icon and/or a title.


Install from gnome website
--------------------------

Visit [Workspace Monitor on Gnome Extensions website](https://extensions.gnome.org/extension/404/workspace-monitor/)


Install from source
-------------------

First, get your copy of the git repo by running:

```bash
git clone git://github.com/vincent-petithory/gnome-shell-extensions-workspace-monitor.git
```

Enter the directory and compile:

```bash
cd gnome-shell-extensions-workspace-monitor
./autogen.sh --prefix=/usr
make
```

Finally, install as superuser to make a system-wide install:

```bash
make install
```

Alternatively, you can install in your $HOME/.local/ (that is what gnome shell extensions' website does):

```bash
make local-install
```


