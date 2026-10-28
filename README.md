# Deadlock Observer Mod

A collection of observing tools and custom keybinds for **Deadlock**, designed to be used alongside the [Deadlock Observer Guide](https://forums.playdeadlock.com/resources/guide-to-deadlock-esports-and-content-creation-observing-and-camera-controls.28/).

This repository includes the Observer Mod, a Stream Deck preset, and supporting resources to make observing Deadlock easier.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Setting Up the Stream Deck Preset](#setting-up-the-stream-deck-preset)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Observing Guide](#observing-guide)
- [Support and Feedback](#support-and-feedback)
- [Credits](#credits)

---
## Features

The Observer Mod builds on existing functionality from Top Bar Plus while introducing additional UI improvements and broadcast information:

- **Existing Top Bar Plus features** — Includes Mid Boss, Bridge Buff, and Rift timers, along with Rejuvenator buff duration
- **Objective map** — Displays objective indicators on the top bar, making it easier to identify which objectives are still active and which have been taken down
- **Currently spectated player** — Displays the name of the player currently being followed
- **Top bar offset for broadcast overlays** — Adds a 55px offset to the top bar to accommodate broadcast overlays
  - If you need a different offset, refer to the *Offsetting the In-Game UI* section of the [observing guide](https://forums.playdeadlock.com/resources/guide-to-deadlock-esports-and-content-creation-observing-and-camera-controls.28/).
- **Player names above heroes** — Shows player names above their respective heroes to make identification easier during gameplay
  -**Note:** Long player names may not display correctly. For broadcast production, using a solid overlay and manually adding player names is recommended. A transparent section can be used for overlay to durectly show the names fromt he game, but be prepared for some of them to not show properly
- **Removed tooltips** — Removes keybind tooltips for a cleaner gameplay view
- **Reworked pause indicator** — Adjusts the game pause indicator to prevent it from overlapping with the scoreboard when shown
- **Additional scoreboard information** — Provides extra information on the scoreboard to assist the casters and observers deliver the narrative of the game to the audience

![Deadlock Observer Mod Preview](<Mod Preview.png>)

## Installation

**Before installing:** Disable or remove any other active mods to avoid potential conflicts

1. Open **Steam** and navigate to your Library
2. Right-click **Deadlock** and select **Manage → Browse local files**
3. Extract the contents of the `Observer Mod` folder included in this repository
4. Move the extracted `game` folder into the Deadlock installation directory opened in Step 2. This should be the directory containing the existing `game` folder
5. Merge the folders and replace any existing files


## Setting Up the Stream Deck Preset

### 1. Load the keybind configuration

1. Launch Deadlock
2. Press **F7** to open the console
3. Enter the following command and press Enter:

   ```cfg
   exec deadlockobs.cfg
   ```

This loads the additional observing keybinds used by the Stream Deck preset (see below).

### 2. Import the Stream Deck profile

1. Open the **Stream Deck** app
2. Go to settings and navigate to the **Profiles** tab
3. Add the provided **Deadlock Observing** profile template to your profile
4. (Optional) Use the supplied hero portraits to customise the button icons, matching each portrait to the corresponding hero in-game

### Recommended workflow for hero portraits

If you use hero portraits for your Stream Deck buttons, I recommend **duplicating the page template before setting the icons** and keeping the original as a blank template. Set the hero portraits on the new page. After the game, you can delete the customised page and reuse the blank template for your next match without manually clearing the icons or overwriting your existing setup. If anything goes wrong, you can always re-import the profile from the original file.

## Keyboard Shortcuts

The `deadlockobs.cfg` file adds several keybinds which are useful while observing. These can be also be used directly from your keyboard if you don't have access to a Stream Deck

| Key | Function |
|:---:|---|
| `Q` | Set free camera speed to **150** (quarter speed) |
| `E` | Set free camera speed to **300** (half speed) |
| `R` | Set free camera speed to **600** (standard speed) |
| `G` | Set free camera speed to **1200** (double speed) |
| `U` | Hide all UI elements |
| `I` | Show all UI elements |
| `J` | Hide replay UI elements |
| `K` | Show replay UI elements |

## Observing Guide

For more information on how to get started with observing Deadlock, or other useful commands, check out the observer guide:

**[Guide to Deadlock Esports and Content Creation: Observing and Camera Controls](https://forums.playdeadlock.com/resources/guide-to-deadlock-esports-and-content-creation-observing-and-camera-controls.28/)**


## Support and Feedback

If you have any questions, feedback, or requests, feel free to get in touch:

- **Discord:** `kashiwardian`
- **Email:** [kashiwardian@gmail.com](mailto:kashiwardian@gmail.com)


## Credits

- **Observer Mod:** An extension of the [Top Bar Plus]([https://github.com/](https://gamebanana.com/mods/623518)) mod by BreadRollius
- **Implementation, Stream Deck preset, and observing guide:** Kashiwardian

Thanks to everyone contributing to the Deadlock content and esports community!
