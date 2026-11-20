/* Reglas del juego (sin interfaz). */
(function () {
  var LETTERS = Object.keys(window.WORD_POOL);

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Un rosco por equipo; cada equipo recibe una palabra distinta en cada letra. */
  function buildRoscos(count) {
    var sets = [];
    for (var t = 0; t < count; t++) sets.push([]);
    LETTERS.forEach(function (letter) {
      var options = shuffle(window.WORD_POOL[letter] || []);
      sets.forEach(function (set, t) {
        var pick = options[t % options.length];
        if (pick) set.push(Object.assign({ letter: letter }, pick));
      });
    });
    return sets;
  }

  function normalize(text) {
    return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  }

  function isCorrect(q, text) {
    var given = normalize(text);
    if (!given) return false;
    return [q.answer].concat(q.alternatives || []).some(function (a) { return normalize(a) === given; });
  }

  function nextPending(statuses, from) {
    var n = statuses.length;
    for (var step = 1; step <= n; step++) {
      var i = (from + step) % n;
      if (statuses[i] === "pending") return i;
    }
    return -1;
  }

  function countStatus(team, status) {
    return team.statuses.filter(function (s) { return s === status; }).length;
  }

  function createGame(names, seconds) {
    var sets = buildRoscos(names.length);
    return {
      teams: names.map(function (name, i) {
        var qs = sets[i];
        return {
          name: name,
          questions: qs,
          statuses: qs.map(function () { return "pending"; }),
          given: qs.map(function () { return null; }),
          current: 0,
          timeLeft: seconds,
          finished: false
        };
      }),
      active: 0,
      phase: "ready", // ready | playing | paused | finished
      feedback: null
    };
  }

  function handOver(state, endsTurn) {
    var me = state.teams[state.active];
    var other = -1;
    state.teams.forEach(function (t, i) { if (i !== state.active && !t.finished && other === -1) other = i; });
    if (me.finished || endsTurn) {
      if (other !== -1) { state.active = other; state.phase = "ready"; }
      else if (me.finished) state.phase = "finished";
    }
    return state;
  }

  /* Modifica el estado según la acción y lo devuelve. */
  function reduce(state, action) {
    var team = state.teams[state.active];
    var multi = state.teams.length > 1;
    var q = team.questions[team.current];

    switch (action.type) {
      case "start":
        if (state.phase === "ready") { state.phase = "playing"; state.feedback = null; }
        return state;
      case "togglePause":
        if (state.phase === "playing") state.phase = "paused";
        else if (state.phase === "paused") state.phase = "playing";
        return state;
      case "tick":
        if (state.phase !== "playing") return state;
        team.timeLeft = Math.max(0, team.timeLeft - 1);
        if (team.timeLeft > 0) return state;
        team.finished = true;
        state.feedback = { kind: "timeout", team: state.active, letter: q.letter, answer: q.answer };
        return handOver(state, true);
      case "pass":
        if (state.phase !== "playing") return state;
        var following = nextPending(team.statuses, team.current);
        if (following !== -1) team.current = following;
        state.feedback = { kind: "pass", team: state.active, letter: q.letter, answer: "" };
        return handOver(state, multi);
      case "answer":
        if (state.phase !== "playing" || !String(action.text).trim()) return state;
        var ok = isCorrect(q, action.text);
        team.statuses[team.current] = ok ? "correct" : "wrong";
        team.given[team.current] = String(action.text).trim();
        var next = nextPending(team.statuses, team.current);
        if (next === -1) team.finished = true; else team.current = next;
        state.feedback = { kind: ok ? "correct" : "wrong", team: state.active, letter: q.letter, answer: q.answer };
        return handOver(state, multi && !ok);
    }
    return state;
  }

  /* Gana quien tenga más aciertos; si empatan, menos fallos. null = empate. */
  function getWinner(teams) {
    if (teams.length < 2) return null;
    var ranked = teams.map(function (t, i) {
      return { i: i, correct: countStatus(t, "correct"), wrong: countStatus(t, "wrong") };
    }).sort(function (a, b) { return b.correct - a.correct || a.wrong - b.wrong; });
    if (ranked[0].correct === ranked[1].correct && ranked[0].wrong === ranked[1].wrong) return null;
    return ranked[0].i;
  }

  window.Pasapalabra = {
    createGame: createGame, reduce: reduce, getWinner: getWinner,
    countStatus: countStatus, isCorrect: isCorrect, nextPending: nextPending
  };
})();
