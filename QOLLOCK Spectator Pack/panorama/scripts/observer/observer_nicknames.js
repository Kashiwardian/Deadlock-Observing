// Always-on top-bar player nicknames, adapted from qollock-codex.
(function() {
    "use strict";

    var MAX_PLAYERS = 13;
    var REFRESH_MS = 1000;
    var STABLE_REFRESH_MS = 4200;
    var UNRESOLVED_RETRY_MS = 4000;
    var players = new Array(MAX_PLAYERS);
    var sourceLabels = new Array(MAX_PLAYERS);
    var displayLabels = new Array(MAX_PLAYERS);
    var resolvedTexts = new Array(MAX_PLAYERS);
    var resolveStates = new Array(MAX_PLAYERS);
    var retryNextMs = new Array(MAX_PLAYERS);
    var nextRefreshMs = 0;
    var wasInHideout = false;

    function IsPanelValid(panel) {
        return OBSERVER_PACK.isPanelValid(panel);
    }

    function NormalizeText(rawText) {
        var text = "";
        try {
            text = (rawText === undefined || rawText === null) ? "" : String(rawText || "").trim();
        } catch (e) {
            text = "";
        }
        return (!text || text === "{s:player_name}") ? "" : text;
    }

    function ReadLabelText(label) {
        if (!IsPanelValid(label)) return "";
        try { return NormalizeText(label.text); } catch (e) { return ""; }
    }

    function ResolveSource(playerPanel, cachedLabel) {
        var source = IsPanelValid(cachedLabel) ? cachedLabel : null;
        var text = ReadLabelText(source);
        if (text) return { label: source, text: text };
        if (!playerPanel || !playerPanel.FindChildrenWithClassTraverse) {
            return { label: source, text: "" };
        }

        var labels = playerPanel.FindChildrenWithClassTraverse("PlayerName") || [];
        for (var i = 0; i < labels.length; i++) {
            if (!IsPanelValid(labels[i])) continue;
            if (!source) source = labels[i];
            text = ReadLabelText(labels[i]);
            if (text) return { label: labels[i], text: text };
        }
        return { label: source, text: "" };
    }

    function ResetSlot(index, keepDisplayLabel) {
        players[index] = null;
        sourceLabels[index] = null;
        resolvedTexts[index] = "";
        resolveStates[index] = "unknown";
        retryNextMs[index] = 0;
        if (!keepDisplayLabel) displayLabels[index] = null;
    }

    function ResetAll(keepDisplayLabels) {
        for (var i = 0; i < MAX_PLAYERS; i++) ResetSlot(i, keepDisplayLabels);
        nextRefreshMs = 0;
    }

    function FindPlayerPanel(root, index) {
        if (!root || !root.FindChildTraverse) return null;
        try {
            var panel = root.FindChildTraverse("TopBarPlayer" + String(index));
            return IsPanelValid(panel) ? panel : null;
        } catch (e) {
            return null;
        }
    }

    function EnsureDisplayLabel(playerPanel, index) {
        var display = IsPanelValid(displayLabels[index]) ? displayLabels[index] : null;
        try {
            if (display && display.GetParent && display.GetParent() !== playerPanel && display.SetParent) {
                display.SetParent(playerPanel);
            }
        } catch (e0) {
            display = null;
        }
        if (!display && playerPanel && playerPanel.FindChildrenWithClassTraverse) {
            var labels = playerPanel.FindChildrenWithClassTraverse("AlwaysPlayerName") || [];
            for (var i = 0; i < labels.length; i++) {
                if (!IsPanelValid(labels[i])) continue;
                if (!labels[i].BHasClass || !labels[i].BHasClass("QOLNickRuntime")) {
                    display = labels[i];
                    break;
                }
            }
            if (!display && labels.length > 0 && IsPanelValid(labels[0])) display = labels[0];
        }
        if (!display && playerPanel && $.CreatePanel) {
            display = $.CreatePanel("Label", playerPanel, "QOLNickRuntime_" + String(index));
            if (display) {
                display.AddClass("AlwaysPlayerName");
                display.AddClass("QOLAlwaysPlayerNameFallback");
            }
        }
        displayLabels[index] = display || null;
        if (display && display.SetHasClass) display.SetHasClass("QOLNickRuntime", true);
        return display;
    }

    function Render(display, show, text) {
        if (!IsPanelValid(display)) return;
        var nextText = show ? String(text || "") : "";
        if (display.text !== nextText) display.text = nextText;
        if (display.SetHasClass) display.SetHasClass("qol-hidden", !show);
        if (display.style) {
            display.style.visibility = show ? "visible" : "collapse";
            display.style.opacity = show ? "1" : "0";
            display.style.zIndex = show ? "1200" : "0";
        }
    }

    function ProcessSlot(root, nowMs, index) {
        var previousPlayer = players[index] || null;
        var playerPanel = FindPlayerPanel(root, index);
        if (previousPlayer !== playerPanel) {
            if (IsPanelValid(previousPlayer) && previousPlayer.SetHasClass) {
                try { previousPlayer.SetHasClass("qol_nickname_active", false); } catch (e0) {}
            }
            Render(displayLabels[index], false, "");
            ResetSlot(index, false);
        }
        players[index] = playerPanel || null;

        var display = playerPanel ? EnsureDisplayLabel(playerPanel, index) : null;
        if (!playerPanel || !playerPanel.SetHasClass) {
            Render(display, false, "");
            ResetSlot(index, false);
            return { sawPlayer: false, resolved: false };
        }
        playerPanel.SetHasClass("qol_nickname_active", true);

        var state = String(resolveStates[index] || "unknown");
        var source = IsPanelValid(sourceLabels[index]) ? sourceLabels[index] : null;
        var hadResolvedSource = state === "resolved";
        // The layout's AlwaysPlayerName binding often resolves before the
        // scoreboard-only PlayerName source. Keep that immediately available
        // value on screen while the authoritative source catches up.
        var boundDisplayText = hadResolvedSource ? "" : ReadLabelText(display);
        if (!source && state === "resolved") state = "unknown";

        if (state === "resolved") {
            var liveText = ReadLabelText(source);
            if (liveText) resolvedTexts[index] = liveText;
            else state = "unknown";
        }
        if (state !== "resolved" && boundDisplayText) {
            resolvedTexts[index] = boundDisplayText;
            state = "bound";
        }
        if (state !== "resolved" && nowMs >= (Number(retryNextMs[index]) || 0)) {
            var result = ResolveSource(playerPanel, source);
            sourceLabels[index] = result.label || null;
            if (result.text) {
                resolvedTexts[index] = result.text;
                state = "resolved";
                retryNextMs[index] = 0;
            } else {
                resolvedTexts[index] = boundDisplayText;
                state = boundDisplayText ? "bound" : "missing";
                retryNextMs[index] = nowMs + UNRESOLVED_RETRY_MS;
            }
        }
        resolveStates[index] = state;
        var text = String(resolvedTexts[index] || "");
        Render(display, text.length > 0, text);
        return {
            sawPlayer: true,
            resolved: (state === "resolved" || state === "bound") && !!display
        };
    }

    function UpdateNicknames(root, unusedCfg, nowMs) {
        if (!root) return;
        var now = isFinite(Number(nowMs)) ? Number(nowMs) : OBSERVER_PACK.nowMs();
        var inHideout = QOL.isConnectedToHideout && QOL.isConnectedToHideout(root);
        if (inHideout) {
            if (wasInHideout && now < nextRefreshMs) return;
            wasInHideout = true;
            for (var h = 0; h < MAX_PLAYERS; h++) {
                var hideoutPlayer = FindPlayerPanel(root, h);
                if (IsPanelValid(hideoutPlayer) && hideoutPlayer.SetHasClass) {
                    try { hideoutPlayer.SetHasClass("qol_nickname_active", false); } catch (e0) {}
                    var hideoutLabels = hideoutPlayer.FindChildrenWithClassTraverse
                        ? (hideoutPlayer.FindChildrenWithClassTraverse("AlwaysPlayerName") || [])
                        : [];
                    for (var j = 0; j < hideoutLabels.length; j++) {
                        Render(hideoutLabels[j], false, "");
                    }
                }
                Render(displayLabels[h], false, "");
            }
            ResetAll(false);
            nextRefreshMs = now + REFRESH_MS;
            return;
        }
        if (wasInHideout) {
            wasInHideout = false;
            ResetAll(false);
        }
        if (now < nextRefreshMs) return;

        var sawPlayer = false;
        var allResolved = true;
        for (var i = 0; i < MAX_PLAYERS; i++) {
            var result = ProcessSlot(root, now, i);
            if (result.sawPlayer) sawPlayer = true;
            if (result.sawPlayer && !result.resolved) allResolved = false;
        }
        nextRefreshMs = now + (sawPlayer && allResolved ? STABLE_REFRESH_MS : REFRESH_MS);
    }

    QOL.register("nicknames", {
        gate: function() { return true; },
        update: UpdateNicknames
    });
})();
