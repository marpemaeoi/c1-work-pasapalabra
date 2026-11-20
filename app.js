/* Interfaz: pinta las pantallas y conecta los botones con las reglas de game.js */
(function () {
  var P = window.Pasapalabra;
  var app = document.getElementById("app");
  var TIMES = [120, 180, 240, 300];

  var setup = { mode: 2, names: ["Team Blue", "Team Gold"], soloName: "", seconds: 180 };
  var state = null;
  var timer = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ---------- Acciones ---------- */
  function dispatch(action) {
    var prevPhase = state.phase, prevActive = state.active;
    P.reduce(state, action);
    if (action.type === "tick" && state.phase === prevPhase && state.active === prevActive) {
      updateClocks();
    } else {
      render();
    }
    syncTimer();
  }

  function syncTimer() {
    var shouldRun = state && state.phase === "playing";
    if (shouldRun && !timer) timer = setInterval(function () { dispatch({ type: "tick" }); }, 1000);
    if (!shouldRun && timer) { clearInterval(timer); timer = null; }
  }

  function startGame() {
    var names = setup.mode === 1
      ? [setup.soloName.trim() || "Player"]
      : setup.names.map(function (n, i) { return n.trim() || "Team " + (i + 1); });
    state = P.createGame(names, setup.seconds);
    render();
  }

  function backToSetup() {
    state = null;
    syncTimer();
    render();
  }

  /* ---------- Pantallas ---------- */
  function render() {
    if (!state) return renderSetup();
    if (state.phase === "finished") return renderResults();
    renderGame();
  }

  function renderSetup() {
    var two = setup.mode === 2;
    var nameFields = two
      ? [0, 1].map(function (i) {
          return '<label>Team ' + (i + 1) + ' name<input class="field" data-name="' + i + '" maxlength="20" placeholder="Team ' + (i + 1) + '" value="' + esc(setup.names[i]) + '"></label>';
        }).join("")
      : '<label>Player name<input class="field" data-solo maxlength="20" placeholder="Player" value="' + esc(setup.soloName) + '"></label>';

    app.innerHTML =
      '<div class="setup pop-in">' +
        '<div class="center">' +
          '<p class="eyebrow">English C1 · Work vocabulary</p>' +
          '<h1>Pasapalabra</h1>' +
          '<p class="intro muted">26 letters, 26 work words. Answer the clue, or say <b style="color:var(--foreground)">pasapalabra</b> to skip and come back later — before the clock runs out.</p>' +
        '</div>' +
        '<div class="card">' +
          '<div><span class="label">Who\'s playing?</span>' +
            '<div class="grid-2">' +
              '<button type="button" class="choice" data-mode="1" data-selected="' + !two + '">One player</button>' +
              '<button type="button" class="choice" data-mode="2" data-selected="' + two + '">Two teams</button>' +
            '</div>' +
            (two ? '<p class="hint">Like the TV show: a wrong answer or a pasapalabra hands the turn to the other team. Each team gets different words.</p>' : '') +
          '</div>' +
          '<div class="names ' + (two ? "two" : "") + '">' + nameFields + '</div>' +
          '<div><span class="label">Time per ' + (two ? "team" : "player") + '</span>' +
            '<div class="grid-4">' +
              TIMES.map(function (t) {
                return '<button type="button" class="choice" data-time="' + t + '" data-selected="' + (setup.seconds === t) + '">' + t / 60 + ' min</button>';
              }).join("") +
            '</div>' +
          '</div>' +
          '<button type="button" class="btn btn-primary btn-xl" data-start>Start game</button>' +
        '</div>' +
      '</div>';

    app.querySelectorAll("[data-mode]").forEach(function (b) {
      b.onclick = function () { setup.mode = Number(b.dataset.mode); renderSetup(); };
    });
    app.querySelectorAll("[data-time]").forEach(function (b) {
      b.onclick = function () { setup.seconds = Number(b.dataset.time); renderSetup(); };
    });
    app.querySelectorAll("[data-name]").forEach(function (inp) {
      inp.oninput = function () { setup.names[Number(inp.dataset.name)] = inp.value; };
    });
    var solo = app.querySelector("[data-solo]");
    if (solo) solo.oninput = function () { setup.soloName = solo.value; };
    app.querySelector("[data-start]").onclick = startGame;
  }

  function scoreboardHTML(highlight) {
    var two = state.teams.length > 1;
    return '<div class="scoreboard ' + (two ? "two" : "") + '">' +
      state.teams.map(function (t, i) {
        var active = highlight && i === state.active;
        return '<div class="card score' + (active ? " active" : "") + (t.finished ? " done" : "") + '">' +
          '<div class="info">' +
            '<div class="name">' + esc(t.name) +
              (active ? '<span class="tag playing">Playing</span>' : '') +
              (t.finished ? '<span class="tag done">Done</span>' : '') +
            '</div>' +
            '<div class="stats">' +
              '<span><b class="t-success">' + P.countStatus(t, "correct") + '</b> correct</span>' +
              '<span><b class="t-danger">' + P.countStatus(t, "wrong") + '</b> wrong</span>' +
              '<span><b class="left">' + P.countStatus(t, "pending") + '</b> left</span>' +
            '</div>' +
          '</div>' +
          '<div class="clock' + (t.timeLeft <= 15 && !t.finished ? " low" : "") + '" data-clock="' + i + '">' + fmt(t.timeLeft) + '</div>' +
        '</div>';
      }).join("") +
    '</div>';
  }

  function roscoHTML(team, showActive) {
    var n = team.questions.length;
    var letters = team.questions.map(function (q, i) {
      var angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      var left = 50 + 45 * Math.cos(angle), top = 50 + 45 * Math.sin(angle);
      return '<div class="rosco-letter" data-status="' + team.statuses[i] + '" data-active="' + (showActive && i === team.current) + '" style="left:' + left + '%;top:' + top + '%">' + q.letter + '</div>';
    }).join("");
    return '<div class="rosco">' + letters +
      '<div class="rosco-center">' +
        '<p class="who">' + esc(team.name) + '</p>' +
        '<p class="big-clock' + (team.timeLeft <= 15 ? " low" : "") + '" data-big-clock>' + fmt(team.timeLeft) + '</p>' +
        '<p class="hits muted"><b>' + P.countStatus(team, "correct") + '</b> correct</p>' +
      '</div></div>';
  }

  function feedbackHTML() {
    var fb = state.feedback;
    if (!fb) return "";
    var who = esc(state.teams[fb.team].name);
    var multi = state.teams.length > 1;
    var text = {
      correct: "Correct! " + fb.letter + " ✓",
      wrong: "Wrong! The answer for " + fb.letter + " was <b>" + esc(fb.answer) + "</b>",
      pass: "Pasapalabra! " + (multi ? who + " skips " + fb.letter + "." : fb.letter + " skipped."),
      timeout: "Time's up for " + who + "!"
    }[fb.kind];
    return '<div class="feedback pop-in ' + fb.kind + '" role="status">' + text + '</div>';
  }

  function renderGame() {
    var team = state.teams[state.active];
    var q = team.questions[team.current];
    var panel;

    if (state.phase === "ready") {
      panel = '<div class="card panel centered">' +
        '<p class="eyebrow">' + (state.feedback ? "Next turn" : "Get ready") + '</p>' +
        '<h2>' + esc(team.name) + '</h2>' +
        '<p class="muted">' + P.countStatus(team, "pending") + ' letters to go · ' + fmt(team.timeLeft) + ' on the clock</p>' +
        '<button type="button" class="btn btn-primary btn-xl" data-go>▶ ' + (state.feedback ? "Continue" : "Start the clock") + '</button>' +
      '</div>';
    } else if (state.phase === "paused") {
      panel = '<div class="card panel centered">' +
        '<h2>Paused</h2><p class="muted">The clue is hidden while the game is paused.</p>' +
        '<button type="button" class="btn btn-primary btn-xl" data-pause>▶ Resume</button>' +
      '</div>';
    } else {
      panel = '<div class="card panel">' +
        '<div class="clue-head"><span class="clue-letter">' + q.letter + '</span>' +
          '<p class="clue-type">' + (q.type === "starts" ? "Starts with " : "Contains ") + q.letter + '</p></div>' +
        '<p class="clue">' + esc(q.clue) + '</p>' +
        '<form class="answer-form" data-form>' +
          '<input class="field" data-answer placeholder="Type your answer…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Your answer">' +
          '<div class="grid-2">' +
            '<button type="submit" class="btn btn-primary" data-submit disabled>Answer</button>' +
            '<button type="button" class="btn btn-pass" data-pass>Pasapalabra</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    }

    var tools = (state.phase === "playing" ? '<button type="button" class="btn btn-ghost" data-pause>❚❚ Pause</button>' : "") +
      '<button type="button" class="btn btn-ghost" data-quit>↺ New game</button>';

    app.innerHTML = '<div class="game pop-in">' + scoreboardHTML(true) +
      '<div class="board">' +
        '<div class="rosco-wrap">' + roscoHTML(team, state.phase === "playing") + '</div>' +
        '<div class="side">' + feedbackHTML() + panel + '<div class="toolbar">' + tools + '</div></div>' +
      '</div></div>';

    var go = app.querySelector("[data-go]");
    if (go) go.onclick = function () { dispatch({ type: "start" }); };
    app.querySelectorAll("[data-pause]").forEach(function (b) {
      b.onclick = function () { dispatch({ type: "togglePause" }); };
    });
    app.querySelector("[data-quit]").onclick = function () {
      if (confirm("Quit this game and go back to the start?")) backToSetup();
    };

    var form = app.querySelector("[data-form]");
    if (form) {
      var input = app.querySelector("[data-answer]");
      var submit = app.querySelector("[data-submit]");
      input.oninput = function () { submit.disabled = !input.value.trim(); };
      form.onsubmit = function (e) {
        e.preventDefault();
        if (input.value.trim()) dispatch({ type: "answer", text: input.value });
      };
      app.querySelector("[data-pass]").onclick = function () { dispatch({ type: "pass" }); };
      input.focus();
    }
  }

  function updateClocks() {
    state.teams.forEach(function (t, i) {
      var el = app.querySelector('[data-clock="' + i + '"]');
      if (el) { el.textContent = fmt(t.timeLeft); el.classList.toggle("low", t.timeLeft <= 15 && !t.finished); }
    });
    var big = app.querySelector("[data-big-clock]");
    var team = state.teams[state.active];
    if (big) { big.textContent = fmt(team.timeLeft); big.classList.toggle("low", team.timeLeft <= 15); }
  }

  function renderResults() {
    var teams = state.teams;
    var solo = teams.length === 1 ? teams[0] : null;
    var winner = P.getWinner(teams);
    var headline = solo
      ? P.countStatus(solo, "correct") + " / " + solo.questions.length
      : winner === null ? "It's a draw!" : esc(teams[winner].name) + " wins!";

    var reviews = teams.map(function (t) {
      return '<div class="card review"><h2>' + esc(t.name) + ' — review</h2><ul>' +
        t.questions.map(function (q, i) {
          var s = t.statuses[i];
          return '<li><span class="dot ' + s + '">' + q.letter + '</span><div>' +
            '<p class="word">' + esc(q.answer) + '</p>' +
            '<p class="muted">' + esc(q.clue) + '</p>' +
            (s === "wrong" && t.given[i] ? '<p class="t-danger">Answered: “' + esc(t.given[i]) + '”</p>' : '') +
            (s === "pending" ? '<p class="muted"><i>Not answered</i></p>' : '') +
          '</div></li>';
        }).join("") +
      '</ul></div>';
    }).join("");

    app.innerHTML = '<div class="results pop-in">' +
      '<div class="center">' +
        '<div class="trophy">🏆</div>' +
        '<p class="eyebrow" style="margin-top:.75rem">Final score</p>' +
        '<h1>' + headline + '</h1>' +
        (solo ? '<p class="muted" style="margin-top:.5rem">words correct, ' + esc(solo.name) + '</p>' : '') +
        '<button type="button" class="btn btn-primary btn-xl" style="margin-top:1.5rem" data-again>↺ Play again</button>' +
      '</div>' +
      scoreboardHTML(false) +
      '<div class="reviews ' + (teams.length > 1 ? "two" : "") + '">' + reviews + '</div>' +
    '</div>';
    app.querySelector("[data-again]").onclick = backToSetup;
  }

  render();
})();
