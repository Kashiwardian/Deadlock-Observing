(function () {

    var lastIds = null;

    function getPlayerIds() {
        var streetBrawl = null;
        var panel = $.GetContextPanel();
        if (!panel) return null;

        var teams_container = panel.GetParent();
        var hud_root = ((teams_container.GetParent()).GetParent()).GetParent();

        if (!hud_root.BHasClass("TeamSpectator")) return null;
        if (hud_root.BHasClass("gamemode_streetbrawl")) {
            streetBrawl = true;
        }
        
        var teams = teams_container.FindChildrenWithClassTraverse("AllPlayers");
        if (!teams || teams.length < 2) return null;

        if (streetBrawl) {
            var team1_players = teams[0].Children().reverse();
        } else {
            var team1_players = teams[0].Children();
        }
        var team2_players = teams[1].Children();
        var players = team1_players.concat(team2_players);

        var ids = [];
        for (let i = 0; i < players.length; i++) {
            ids.push(players[i].id);
        }
        return ids;
    }

    function idsMatch(a, b) {
        if (!a || !b || a.length != b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] != b[i]) return false;
        }
        return true;
    }

    function applyBindings(ids) {
        var keybinds = ['1','2','3','4','5','6','7','8','9','0','-','='];
        for (let i = 0; i < ids.length; i++) {
            var player_num = ids[i].replace("TopBarPlayer", "");
            var spectate_num = Number(player_num) + 1;
            var command = "bind " + keybinds[i] + " spec_target " + spectate_num.toString();
            $.DispatchEvent("CitadelConCommand", command);
        }
    }

    function updateLoop() {
        var ids = getPlayerIds();
        if (ids && !idsMatch(ids, lastIds)) {
            applyBindings(ids);
            lastIds = ids;
        }
        $.Schedule(1, updateLoop);
    }

    updateLoop();
})();