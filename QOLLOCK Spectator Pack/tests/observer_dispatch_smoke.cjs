"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const scheduled = [];
const messages = [];
const calls = [];
const root = { streetBrawl: true };
const contextPanel = { IsValid() { return true; } };

const context = {
    QOL: {
        featureRegistry: {
            nicknames: {
                gate() { return true; },
                update() { calls.push("nicknames"); }
            },
            rejuvTimers: {
                gate() { return true; },
                update() { calls.push("rejuv"); }
            },
            urnTimer: {
                gate(cfg) { return cfg.ENABLE_URN_TIMER === 1; },
                update(unusedRoot, cfg) { calls.push("rift:" + cfg.ENABLE_URN_TIMER); }
            },
            recentPurchases: {
                gate(cfg) { return cfg.ENABLE_SHOP_ITEM_NOTIFICATIONS === 1; },
                update() { calls.push("purchases"); }
            }
        },
        isStreetBrawlModeActive(value) { return value.streetBrawl; }
    },
    OBSERVER_PACK: {
        config: { ENABLE_URN_TIMER: 1, ENABLE_SHOP_ITEM_NOTIFICATIONS: 1 },
        state: {},
        isPanelValid(panel) { return panel === contextPanel; },
        resolveRuntimeRoot() { return root; },
        nowMs() { return 1000; },
        applyStaticRootClasses() {},
        updateSoulDifference() { throw new Error("transient panel race"); }
    },
    $: {
        GetContextPanel() { return contextPanel; },
        Msg(message) { messages.push(String(message)); },
        Schedule(delay, callback) { scheduled.push({ delay, callback }); }
    }
};

vm.createContext(context);
const source = fs.readFileSync(path.resolve(__dirname,
    "../panorama/scripts/observer/observer_start.js"), "utf8");
vm.runInContext(source, context, { filename: "observer_start.js" });

if (scheduled.length !== 1 || scheduled[0].delay !== 0) {
    throw new Error("Dispatcher did not schedule its initial tick");
}

scheduled.shift().callback();
if (scheduled.length !== 1 || scheduled[0].delay !== 0.2) {
    throw new Error("Dispatcher stopped after a feature exception");
}
if (!calls.includes("nicknames") || !calls.includes("rejuv") ||
        !calls.includes("purchases") || !calls.includes("rift:0")) {
    throw new Error("Street Brawl feature dispatch was incorrect: " + calls.join(","));
}
if (!messages.some((message) => message.includes("soulDifference") &&
        message.includes("transient panel race"))) {
    throw new Error("Soul-difference exception was not isolated and reported");
}

root.streetBrawl = false;
scheduled.shift().callback();
if (!calls.includes("rift:1")) {
    throw new Error("Rift timer was not restored outside Street Brawl");
}

console.log("observer_dispatch_smoke: OK");
