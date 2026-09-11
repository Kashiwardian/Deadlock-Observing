"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

class Panel {
    constructor(id, classes, text) {
        this.id = id || "";
        this.classes = new Set(classes || []);
        this.text = text || "";
        this.children = [];
        this.parent = null;
        this.style = {};
        this.visible = true;
        this.valid = true;
        this.actualxoffset = 0;
        this.actuallayoutwidth = 120;
        this.contentheight = 40;
        this.dialogVariables = {};
    }

    append(child) {
        child.parent = this;
        this.children.push(child);
        return child;
    }

    IsValid() { return this.valid; }
    GetParent() { return this.parent; }
    Children() { return this.children.slice(); }
    GetChildCount() { return this.children.length; }
    GetChild(index) { return this.children[index] || null; }
    BHasClass(name) { return this.classes.has(name); }
    AddClass(name) { this.classes.add(name); }
    RemoveClass(name) { this.classes.delete(name); }
    SetHasClass(name, enabled) { enabled ? this.classes.add(name) : this.classes.delete(name); }
    SetParent(parent) {
        if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
        this.parent = null;
        if (parent) parent.append(this);
    }
    SetDialogVariableInt(name, value) { this.dialogVariables[name] = Number(value); }
    DeleteAsync() {
        this.valid = false;
        if (this.parent) {
            this.parent.children = this.parent.children.filter((child) => child !== this);
            this.parent = null;
        }
    }
    GetAttributeString(name, fallback) {
        return name === "class" ? Array.from(this.classes).join(" ") : fallback;
    }

    FindChildTraverse(id) {
        for (const child of this.children) {
            if (child.id === id) return child;
            const nested = child.FindChildTraverse(id);
            if (nested) return nested;
        }
        return null;
    }

    FindChildrenWithClassTraverse(className) {
        const result = [];
        for (const child of this.children) {
            if (child.BHasClass(className)) result.push(child);
            result.push(...child.FindChildrenWithClassTraverse(className));
        }
        return result;
    }
}

const root = new Panel("Hud");
const topBar = root.append(new Panel("TopBar"));
const topBarPlayer = topBar.append(new Panel("TopBarPlayer0"));
const boundNickname = topBarPlayer.append(new Panel("", ["AlwaysPlayerName"], "{s:player_name}"));
const sourceNickname = topBarPlayer.append(new Panel("", ["PlayerName"], "Test Observer"));
const fallbackTopBarPlayer = topBar.append(new Panel("TopBarPlayer1"));
const immediateBoundNickname = fallbackTopBarPlayer.append(new Panel("", ["AlwaysPlayerName"], "Bound Immediately"));
fallbackTopBarPlayer.append(new Panel("", ["PlayerName"], "{s:player_name}"));
const runtimeFallbackPlayer = topBar.append(new Panel("TopBarPlayer2"));
runtimeFallbackPlayer.append(new Panel("", ["PlayerName"], "Runtime Fallback"));
const lateBoundPlayer = topBar.append(new Panel("TopBarPlayer4"));
const lateBoundDisplay = lateBoundPlayer.append(new Panel("", ["AlwaysPlayerName"], "{s:player_name}"));
lateBoundPlayer.append(new Panel("", ["PlayerName"], "{s:player_name}"));
const heroCard = topBar.append(new Panel("HeroCard"));
const heroBadge = heroCard.append(new Panel("HeroBadge"));
heroBadge.heroid = 1;
heroCard.append(new Panel("", ["HeroNameHidden"], "Haze"));
const teamNetworth = topBar.append(new Panel("", ["TeamNetworth"]));
const teams = topBar.append(new Panel("TeamsContainer"));
const friendly = teams.append(new Panel("TeamFriendly", ["team1"]));
const enemy = teams.append(new Panel("TeamEnemy", ["team2"]));
friendly.append(new Panel("", ["hiddenGoldValue"], "1,000"));
friendly.append(new Panel("", ["hiddenGoldValue"], "2,000"));
enemy.append(new Panel("", ["hiddenGoldValue"], "1,000"));
enemy.append(new Panel("", ["hiddenGoldValue"], "1,000"));
topBar.append(new Panel("GameTime", [], "10:00"));
const recentPurchasesPanel = root.append(new Panel("RecentPurchasesPanel"));
const recentPurchasesContainer = recentPurchasesPanel.append(new Panel("RecentPurchasesContainer"));

const messages = [];
let virtualTime = 0;
let scheduleSequence = 0;
const scheduled = [];

function advanceTo(targetTime) {
    while (true) {
        let nextIndex = -1;
        for (let i = 0; i < scheduled.length; i++) {
            if (scheduled[i].at > targetTime) continue;
            if (nextIndex < 0 || scheduled[i].at < scheduled[nextIndex].at ||
                    (scheduled[i].at === scheduled[nextIndex].at && scheduled[i].sequence < scheduled[nextIndex].sequence)) {
                nextIndex = i;
            }
        }
        if (nextIndex < 0) break;
        const next = scheduled.splice(nextIndex, 1)[0];
        virtualTime = next.at;
        next.callback();
    }
    virtualTime = targetTime;
}

const context = {
    console,
    $: {
        Msg(message) { messages.push(String(message)); },
        GetContextPanel() { return root; },
        FrameTime() { return virtualTime; },
        Schedule(delay, callback) {
            scheduled.push({
                at: virtualTime + Math.max(0, Number(delay) || 0),
                sequence: scheduleSequence++,
                callback
            });
        },
        CreatePanel(type, parent, id, attrs) {
            const classes = attrs && attrs.class ? String(attrs.class).split(/\s+/) : [];
            const panel = new Panel(id, classes, attrs && attrs.text ? String(attrs.text) : "");
            if (attrs && attrs.visible !== undefined) panel.visible = attrs.visible !== "false";
            return parent.append(panel);
        }
    }
};
vm.createContext(context);

const packRoot = path.resolve(__dirname, "..");
const requestedModules = process.argv.slice(2);
const scriptPaths = [
    path.join(packRoot, "panorama/scripts/observer/observer_core.js"),
    path.join(packRoot, "panorama/scripts/observer/observer_nicknames.js"),
    ...(requestedModules.length === 4 ? requestedModules.map((value) => path.resolve(value)) : [
        path.join(packRoot, "panorama/scripts/qollock/ql_recent_purchases_data.js"),
        path.join(packRoot, "panorama/scripts/qollock/ql_feat_rejuvtimers.js"),
        path.join(packRoot, "panorama/scripts/qollock/ql_feat_urntimer.js"),
        path.join(packRoot, "panorama/scripts/qollock/ql_feat_recentpurchases.js")
    ])
];
if (requestedModules.length !== 0 && requestedModules.length !== 4) {
    throw new Error("Pass the staged purchase data and all three QOL module paths, or none");
}
for (const scriptPath of scriptPaths) {
    vm.runInContext(fs.readFileSync(scriptPath, "utf8"), context, { filename: scriptPath });
}

if (!context.QOL.featureRegistry.nicknames || !context.QOL.featureRegistry.rejuvTimers || !context.QOL.featureRegistry.urnTimer ||
        !context.QOL.featureRegistry.recentPurchases) {
    throw new Error("Expected QOL observer modules were not registered");
}
if (context.QOL.featureRegistry.nicknames.gate({ ENABLE_NICKNAMES: 0 }) !== true) {
    throw new Error("Top-bar nicknames are not hard-enabled");
}
if (messages.some((message) => message.includes("[bridge] Missing") || message.includes("self-test"))) {
    throw new Error("Bridge or module self-test error: " + messages.join(" | "));
}

context.OBSERVER_PACK.applyStaticRootClasses(root);
context.QOL.featureRegistry.nicknames.update(root, context.OBSERVER_PACK.config, 0);
if (!topBarPlayer.BHasClass("qol_nickname_active") || boundNickname.text !== "Test Observer" ||
        boundNickname.style.visibility !== "visible" || boundNickname.style.opacity !== "1") {
    throw new Error("Always-on top-bar nickname was not resolved and displayed");
}
if (!fallbackTopBarPlayer.BHasClass("qol_nickname_active") ||
        immediateBoundNickname.text !== "Bound Immediately" ||
        immediateBoundNickname.style.visibility !== "visible") {
    throw new Error("Bound top-bar nickname was hidden while its secondary source was unresolved");
}
const runtimeFallbackNickname = runtimeFallbackPlayer.FindChildrenWithClassTraverse("AlwaysPlayerName")[0];
if (!runtimeFallbackNickname || runtimeFallbackNickname.text !== "Runtime Fallback" ||
        runtimeFallbackNickname.style.visibility !== "visible" ||
        !runtimeFallbackNickname.BHasClass("QOLNickRuntime")) {
    throw new Error("Missing nickname layout label did not receive a runtime fallback");
}
lateBoundDisplay.text = "Late Bound";
context.QOL.featureRegistry.nicknames.update(root, context.OBSERVER_PACK.config, 1000);
if (lateBoundDisplay.text !== "Late Bound" || lateBoundDisplay.style.visibility !== "visible") {
    throw new Error("A late-resolving nickname binding waited for the slower source retry");
}
sourceNickname.text = "Renamed Observer";
context.QOL.featureRegistry.nicknames.update(root, context.OBSERVER_PACK.config, 6000);
if (boundNickname.text !== "Renamed Observer") {
    throw new Error("Top-bar nickname did not refresh after the source name changed");
}

// A Panorama rebuild can leave the old panel object valid but detached. The
// feature must follow the current TopBarPlayer slot rather than its old cache.
topBar.children = topBar.children.filter((child) => child !== topBarPlayer);
topBarPlayer.parent = null;
const replacementPlayer = topBar.append(new Panel("TopBarPlayer0"));
const replacementDisplay = replacementPlayer.append(new Panel("", ["AlwaysPlayerName"], "{s:player_name}"));
replacementPlayer.append(new Panel("", ["PlayerName"], "Replacement Observer"));
context.QOL.featureRegistry.nicknames.update(root, context.OBSERVER_PACK.config, 11000);
if (!replacementPlayer.BHasClass("qol_nickname_active") ||
        replacementDisplay.text !== "Replacement Observer" ||
        boundNickname.style.visibility !== "collapse" ||
        topBarPlayer.BHasClass("qol_nickname_active")) {
    throw new Error("Top-bar nickname did not recover from a valid-but-detached player panel");
}

root.AddClass("connectedToHideout");
context.QOL.featureRegistry.nicknames.update(root, context.OBSERVER_PACK.config, 12000);
if (replacementPlayer.BHasClass("qol_nickname_active") ||
        replacementDisplay.style.visibility !== "collapse") {
    throw new Error("Top-bar nickname was not hidden in the hideout");
}
const hideoutPlayer = topBar.append(new Panel("TopBarPlayer3"));
const hideoutDisplay = hideoutPlayer.append(new Panel("", ["AlwaysPlayerName"], "Hideout Player"));
hideoutPlayer.append(new Panel("", ["PlayerName"], "Hideout Player"));
context.QOL.featureRegistry.nicknames.update(root, context.OBSERVER_PACK.config, 13100);
if (hideoutPlayer.BHasClass("qol_nickname_active") ||
        hideoutDisplay.style.visibility !== "collapse") {
    throw new Error("A top-bar panel rebuilt in the hideout exposed its nickname");
}
root.RemoveClass("connectedToHideout");
context.QOL.featureRegistry.nicknames.update(root, context.OBSERVER_PACK.config, 13200);
if (!replacementPlayer.BHasClass("qol_nickname_active") ||
        replacementDisplay.text !== "Replacement Observer") {
    throw new Error("Top-bar nicknames did not recover after leaving the hideout");
}
if (!root.BHasClass("shop_item_notifications_active") ||
        !root.BHasClass("shop_recent_purchases_redux") ||
        root.BHasClass("shop_recent_purchases_active")) {
    throw new Error("Per-player purchase notification root classes were not applied");
}
if (context.OBSERVER_PACK.config.ENABLE_MINIMALISTIC_PAUSE !== 1 ||
        !root.BHasClass("minimal_pause_active") ||
        !topBar.BHasClass("minimal_pause_active")) {
    throw new Error("Compact pause mode was not hard-enabled");
}

context.OBSERVER_PACK.updateSoulDifference(root, 1000);
const tracker = teamNetworth.FindChildTraverse("UrnTracker");
const label = tracker && tracker.FindChildTraverse("UrnTrackerLabel");
if (!tracker || !label) throw new Error("Soul-difference panel was not created");
if (label.text !== "+33.3%") throw new Error("Unexpected soul difference: " + label.text);
if (!tracker.BHasClass("good") || !tracker.BHasClass("show")) {
    throw new Error("Soul-difference visual classes were not applied");
}

root.AddClass("connectedToHideout");
context.OBSERVER_PACK.updateSoulDifference(root, 2000);
if (tracker.visible !== false) throw new Error("Soul difference was not hidden in hideout");

root.RemoveClass("connectedToHideout");
root.AddClass("gamemode_streetbrawl");
tracker.visible = true;
context.OBSERVER_PACK.updateSoulDifference(root, 3000);
if (tracker.visible !== false) throw new Error("Soul difference was not hidden in Street Brawl");

root.RemoveClass("gamemode_streetbrawl");
const recentPurchasesFeature = context.QOL.featureRegistry.recentPurchases;
const purchaseConfig = context.OBSERVER_PACK.config;

// The first update clears stale engine history. Its delayed second clear also
// resets the asynchronously-built hero map, so rebuild once that settles.
recentPurchasesFeature.update(root, purchaseConfig, 0);
advanceTo(0.5);
recentPurchasesFeature.update(root, purchaseConfig, 600);
advanceTo(0.8);
recentPurchasesFeature.update(root, purchaseConfig, 900);

const itemName = vm.runInContext("Object.keys(MOD_ICONS)[0]", context);
if (!itemName) throw new Error("Purchase icon data was not loaded");
const purchase = recentPurchasesContainer.append(new Panel("", ["recentPurchase", "isTier2Purchase"]));
purchase.append(new Panel("", ["recentModPurchaseName"], itemName));
purchase.append(new Panel("", ["recentTimePurchased"], "00:01"));
purchase.append(new Panel("", ["recentModPurchaserHero"], "Haze"));

advanceTo(1.0);
recentPurchasesFeature.update(root, purchaseConfig, 1000);
const heroPopup = heroCard.FindChildrenWithClassTraverse("QuickPurchasesPanel")[0];
const toast = heroPopup && heroPopup.FindChildrenWithClassTraverse("quickPurchase")[0];
const toastName = toast && toast.FindChildrenWithClassTraverse("quickPurchaseName")[0];
if (!heroPopup || !toast || !toastName) throw new Error("Per-player purchase toast was not created");
if (toastName.text !== itemName || !toast.BHasClass("isTier2Purchase")) {
    throw new Error("Purchase toast did not retain the source item data");
}

advanceTo(6.0);
if (!toast.BHasClass("quickFading")) throw new Error("Purchase toast did not begin fading after five seconds");
advanceTo(6.4);
if (toast.IsValid()) throw new Error("Purchase toast was not removed after its fade");

if (context.RECENT_PURCHASE_QUICK_MAX_DEFAULT !== 3 ||
        context.RECENT_PURCHASE_QUICK_DISPLAY_SEC_DEFAULT !== 5) {
    throw new Error("Purchase fallback defaults were not exposed by the observer bridge");
}

const spectateCss = fs.readFileSync(path.join(packRoot, "panorama/styles/hud_spectate_bar.css"), "utf8");
for (const panelId of ["fow_view_section", "camera_section"]) {
    const blockPattern = new RegExp("#" + panelId + "\\s*\\{([\\s\\S]*?)\\}");
    const blockMatch = spectateCss.match(blockPattern);
    const block = blockMatch ? blockMatch[1] : "";
    if (!/visibility\s*:\s*collapse\s*;/.test(block) || !/hittest\s*:\s*false\s*;/.test(block)) {
        throw new Error("Spectator helper panel is not fully disabled: #" + panelId);
    }
}

const observerTopBarCss = fs.readFileSync(
    path.join(packRoot, "panorama/styles/observer/citadel_hud_top_bar.css"), "utf8"
);
const nicknameBlockMatch = observerTopBarCss.match(
    /CitadelHudTopBarPlayer\s+\.AlwaysPlayerName\s*\{([\s\S]*?)\}/
);
const nicknameBlock = nicknameBlockMatch ? nicknameBlockMatch[1] : "";
if (!/margin-top\s*:\s*-15px\s*;/.test(nicknameBlock) ||
        !/height\s*:\s*16px\s*;/.test(nicknameBlock) ||
        !/font-size\s*:\s*16px\s*;/.test(nicknameBlock)) {
    throw new Error("Always-on top-bar nickname position contract is incomplete");
}
if (/#[Pp]layerDetailsContainer\s*,\s*#SpectatePlayerButtonPanel\s*\{[\s\S]*?margin-top\s*:\s*18px\s*;/.test(observerTopBarCss) ||
        !/CitadelHudTopBarPlayer\.qol_nickname_active\s+\.QOLNickRuntime\s*\{[\s\S]*?margin-top\s*:\s*-15px\s*;[\s\S]*?\}/.test(observerTopBarCss)) {
    throw new Error("Nickname spacing moved the portraits or exceeded Panorama's safe offset");
}
if (!/CitadelHudTopBarPlayer\.qol_nickname_active\s+\.AlwaysPlayerName\s*\{[\s\S]*?visibility\s*:\s*visible\s*;[\s\S]*?opacity\s*:\s*1\s*;[\s\S]*?\}/.test(observerTopBarCss) ||
        !/CitadelHudTopBarPlayer\.qol_nickname_active\s+\.AlwaysPlayerName\.qol-hidden\s*\{[\s\S]*?visibility\s*:\s*collapse\s*;[\s\S]*?opacity\s*:\s*0\s*;[\s\S]*?\}/.test(observerTopBarCss)) {
    throw new Error("Always-on top-bar nickname visibility contract is incomplete");
}

const topBarLayout = fs.readFileSync(
    path.join(packRoot, "panorama/layout/citadel_hud_top_bar.xml"), "utf8"
);
const coreInclude = topBarLayout.indexOf("scripts/observer/observer_core.vjs_c");
const nicknameInclude = topBarLayout.indexOf("scripts/observer/observer_nicknames.vjs_c");
const startInclude = topBarLayout.indexOf("scripts/observer/observer_start.vjs_c");
if (coreInclude < 0 || nicknameInclude <= coreInclude || startInclude <= nicknameInclude) {
    throw new Error("Top-bar nickname runtime is not included between the observer bridge and dispatcher");
}

const topBarPlayerLayout = fs.readFileSync(
    path.join(packRoot, "panorama/layout/citadel_hud_top_bar_player.xml"), "utf8"
);
if (!topBarPlayerLayout.includes('class="AlwaysPlayerName" text="{s:player_name}"')) {
    throw new Error("Top-bar nickname binding was removed from the player layout");
}
if (!topBarPlayerLayout.includes('class="HeroNameHidden"')) {
    throw new Error("Purchase-popup HeroNameHidden binding was removed with portrait nicknames");
}

const pausedLayout = fs.readFileSync(path.join(packRoot, "panorama/layout/hud_paused.xml"), "utf8");
const pausedEntryCss = fs.readFileSync(path.join(packRoot, "panorama/styles/hud_paused.css"), "utf8");
const pausedQollockCss = fs.readFileSync(path.join(packRoot, "panorama/styles/qollock/hud_paused.css"), "utf8");
const pausedObserverCss = fs.readFileSync(path.join(packRoot, "panorama/styles/observer/hud_paused.css"), "utf8");
if (!pausedLayout.includes('id="PausedLabel"') || !pausedLayout.includes('text="II"') ||
        !pausedLayout.includes('id="QLPausedText"')) {
    throw new Error("Compact pause layout contract is incomplete");
}
if (!pausedEntryCss.includes('styles/qollock/hud_paused.vcss_c') ||
        !pausedEntryCss.includes('styles/observer/hud_paused.vcss_c')) {
    throw new Error("Compact pause CSS layers are not imported in order");
}
if (!pausedQollockCss.includes('.minimal_pause_active CitadelPaused') ||
        !pausedQollockCss.includes('.minimal_pause_active #PausedLabel')) {
    throw new Error("Compact pause CSS contract is incomplete");
}
if (!/\.minimal_pause_active\s+CitadelPaused\s*\{[\s\S]*?margin-top\s*:\s*205px\s*;[\s\S]*?\}/.test(pausedObserverCss)) {
    throw new Error("Compact pause does not include the 55px observer offset");
}

console.log("observer_core_smoke: OK");
