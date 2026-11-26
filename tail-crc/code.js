(() => {
  "use strict";
  const methods = [
    ["native", "Native base · 4K replay", "#a6b4b3"],
    ["base", "Budget-forced base", "#869b9a"],
    ["baseAnswer", "Base + answer filter", "#76908c"],
    ["rl", "Math-trained Binary RL", "#486a72"],
    ["answer", "Tail-CRC · answer", "#166b5f"],
    ["full", "Tail-CRC · full trace", "#134d46"],
  ];
  const definitions = {
    R: "Programs passing every test, as a share of all problems.",
    W: "Submitted programs failing at least one test, as a share of all problems.",
    trunc_rate: "Generations reaching their token cap, as a share of all problems. Filtering occurs after generation.",
    Net: "Correct submissions minus wrong submissions, as a share of all problems. Each passing program earns one point and each failure costs one.",
    Prec: "Share of submitted programs that passed every test.",
    usd: "Average API generation charge per assigned problem, in US dollars.",
  };
  const errors = {WA: "Wrong answer", RE: "Runtime error", TLE: "Time limit", MLE: "Memory limit", OUTPUT_LIMIT: "Output limit"};
  const capNames = {"4096": "4K", "8192": "8K"};
  const fixed = (number, digits) => number.toFixed(digits);
  const percent = number => fixed(100 * number, 2) + "%";
  const signed = number => (number < -0.00000001 ? "−" : number > 0.00000001 ? "+" : "") + fixed(Math.abs(100 * number), 2);
  const usd = number => "USD " + fixed(number, 5);

  function initialize() {
    const root = document.getElementById("code-transfer");
    const data = window.TAIL_DATA && window.TAIL_DATA.code;
    if (!root || !data || root.dataset.lcbInitialized) return;
    root.dataset.lcbInitialized = "true";
    const get = selector => root.querySelector(selector);
    const all = selector => Array.from(root.querySelectorAll(selector));
    const part = name => get("[data-lcb-" + name + "]");
    const view = {cap: "8192", slice: "main", metric: "Net", tab: "trace"};
    const allMethods = Object.values(data.slices).flatMap(slice =>
      Object.values(slice.caps).flatMap(cap => Object.values(cap.methods)));
    const maxUsd = Math.ceil(Math.max(...allMethods.map(m => m.usd)) * 1000) / 1000;
    const maxWrong = Math.ceil(Math.max(...allMethods.map(m => m.W)) * 20) / 20;
    const metricScale = {R: 1, W: maxWrong, trunc_rate: 1, Net: 1, Prec: 1, usd: maxUsd};
    const metricText = (metric, value) => metric === "usd" ? usd(value) : percent(value);

    function showTab(name, focus = false) {
      view.tab = name;
      all("[data-lcb-tab]").forEach(button => {
        const selected = name === button.dataset.lcbTab;
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
        get("#" + button.getAttribute("aria-controls")).hidden = !selected;
        if (selected && focus) button.focus();
      });
    }

    function draw() {
      const {cap, slice, metric} = view;
      const capName = capNames[cap];
      const current = data.slices[slice].caps[cap];
      const full = data.slices.main.caps[cap].methods;
      const diag = data.diagnostics[cap];
      const cases = data.slices[slice].n;
      const costScale = metricScale[metric];
      const sliceName = get("#lcb-slice").selectedOptions[0].text;
      all("[data-lcb-cap]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.lcbCap === cap)));
      part("deltas").innerHTML = [["R", "Correct · raw"], ["Net", "Net · calibrated"], ["trunc_rate", "Truncation · raw"]].map(([key, label]) => {
        const value = current.deltas[key];
        const interval = value.ci ? '<small>95% CI [' + value.ci.map(signed).join(", ") + ']</small>' : "";
        return '<div><span>' + mathSlot('\\Delta') + ' ' + label + '</span><strong>' + signed(value.estimate) + ' pp</strong>' + interval + '</div>';
      }).join("");
      const scopeNote = slice === "errata_excluded"
        ? "This sensitivity analysis omits one test problem and uses separately locked thresholds from 294 calibration problems."
        : slice === "main" ? "Thresholds were locked on 300 separate calibration problems."
        : "Contest-year slices share the original 300-problem calibration thresholds. Yearly contrasts are descriptive.";
      part("scope").textContent = "Both solvers use their own answer-span filter for the net comparison (target 6.5%). " +
        scopeNote + (current.deltas.R.ci ? " Intervals use 20,000 paired problem-level bootstrap draws." : " Paired intervals were reported only for the full and errata-excluded panels.");
      part("definition").textContent = definitions[metric] + " Bar scale: 0 to " + metricText(metric, costScale) + ".";
      part("bars").innerHTML = methods.map(([key, label, color]) => {
        const value = current.methods[key][metric];
        const fill = metric === "W" ? (key === "rl" || key === "answer" || key === "full" ? "#ac543f" : "#bd9b8d") : color;
        return '<div class="lcb-bar"><span class="lcb-bar-label">' + label +
          '</span><span class="lcb-track" aria-hidden="true"><i style="--lcb-width:' + (100 * value / costScale) +
          '%;--lcb-fill:' + fill + '"></i></span><span class="lcb-bar-value">' + metricText(metric, value) + '</span></div>';
      }).join("");
      const newProblems = data.slices.year_2025;
      const example = newProblems.caps["8192"].methods;
      const showingSpotlight = cap === "8192" && slice === "year_2025" && metric === "W";
      part("spotlight").disabled = showingSpotlight;
      part("spotlight").innerHTML = "<strong>On the " + newProblems.n + " problems from 2025,</strong> the 8K answer filter reduced wrong submissions from " +
        percent(example.rl.W) + " to " + percent(example.answer.W) + ". " + (showingSpotlight ? "" : "<span>Inspect this slice</span>");
      const timeout = diag.failures.TLE;
      part("trace-summary").textContent = "Across the full " + data.slices.main.n + "-problem test at " + capName + ", " + timeout.n +
        " math-trained model runs produced programs that timed out. Their median code-token Tail NLL was " + fixed(timeout.median, 3) +
        " nats. A model can write likely tokens and still choose a slow algorithm.";
      part("error-caption").textContent = "Code-span Tail NLL, by first failing test outcome";
      part("failures").innerHTML = Object.entries(errors).map(([key, label]) => {
        const e = diag.failures[key];
        return '<tr' + (key === "TLE" ? ' class="lcb-selected"' : '') + '><th scope="row">' + label +
          '</th><td>' + e.n + '</td><td>' + e.families + '</td><td>' + (e.median === null ? "—" : fixed(e.median, 3)) + '</td></tr>';
      }).join("");
      part("failure-note").textContent = "Each of two seeds generated one program per problem. Counts include both runs; a problem can contribute to multiple failure types.";
      const auroc = diag.auroc;
      part("spans").innerHTML = '<p>On valid programs, the Tail NLL AUROC was <strong>' + fixed(auroc.code_span, 3) +
        '</strong> for the Python code, <strong>' + fixed(auroc.answer_span, 3) + '</strong> for the whole post-thinking answer, and <strong>' +
        fixed(auroc.full_trace, 3) + '</strong> for the full sampled trace. At ' + capName + ', full-trace filtering scored ' +
        percent(full.full.Net) + ' net, compared with ' + percent(full.answer.Net) + ' for the answer and ' + percent(full.rl.Net) + ' without filtering.</p>' +
        '<p class="lcb-note">The full trace includes sampled reasoning. These comparisons show a ranking difference; they do not identify the reasoning tokens responsible for a program’s failure.</p>';
      part("stability").textContent = "Across " + diag.resplit.draws.toLocaleString("en-US") +
        " repartitions of the same 600 problems into 300 calibration and 300 test problems, the answer-span filter’s wrong-submission rate varied around its target.";
      part("resplits").innerHTML = Object.entries(data.diagnostics).map(([key, diagnostic]) => {
        const point = data.slices.main.caps[key].methods.answer.W;
        return '<tr' + (cap === key ? ' class="lcb-selected"' : '') + '><th scope="row">' + capNames[key] +
          '</th><td>' + percent(point) + '</td><td>' + percent(diagnostic.resplit.mean) + '</td><td>' +
          fixed(100 * diagnostic.resplit.sd, 2) + ' pp</td></tr>';
      }).join("");
      const p4 = diag.pilot["4B"], p8 = diag.pilot["8B"];
      part("pilot").innerHTML = "On a disjoint convenience sample of " + p4.n + " problems, the budget-forced 4B base model at " + capName + " returned " +
        p4.right + " correct and " + p4.wrong + " wrong submissions. " + p4.truncated + " of " + p4.n + " runs (" +
        fixed(100 * p4.truncated / p4.n, 0) + "%) reached the token cap. It cost " + usd(p4.usd) + " per problem versus " + usd(p8.usd) +
        " for the 8B base on these same problems (" + mathSlot(fixed(p4.usd / p8.usd, 2) + "\\times") + " the cost). Only 8B advanced to the formal test.";
      renderMath(root);
      part("state").textContent = "Showing " + sliceName + ", " + capName + ", " + get("#lcb-metric").selectedOptions[0].text + ", " + cases + " test problems.";
    }
    all("[data-lcb-cap]").forEach(button => button.addEventListener("click", () => {view.cap = button.dataset.lcbCap; draw();}));
    get("#lcb-slice").addEventListener("change", e => {view.slice = e.target.value; draw();});
    get("#lcb-metric").addEventListener("change", e => {view.metric = e.target.value; draw();});
    part("spotlight").addEventListener("click", () => {
      view.cap = "8192"; view.slice = "year_2025"; view.metric = "W";
      get("#lcb-slice").value = view.slice;
      get("#lcb-metric").value = view.metric;
      draw();
      get("#lcb-metric").focus({preventScroll: true});
    });
    all("[data-lcb-tab]").forEach(button => {
      button.addEventListener("click", () => showTab(button.dataset.lcbTab));
      button.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? "trace" : event.key === "End" ? "pilot" : view.tab === "trace" ? "pilot" : "trace";
        showTab(next, true);
      });
    });
    draw();
  }

  window.initTailCode = initialize;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, {once: true});
  else initialize();
})();
