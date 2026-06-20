(function () {
  const data = window.QW_DATA;
  const colors = {
    blue: "#2563eb",
    red: "#e11d48",
    orange: "#f59e0b",
    green: "#059669",
    purple: "#7c3aed",
    black: "#111827",
    grid: "#d6dce6",
    text: "#344054",
  };

  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  document.body.appendChild(tooltip);

  const widthSlider = document.getElementById("widthSlider");
  const widthValue = document.getElementById("widthValue");
  const modelSelect = document.getElementById("modelSelect");
  const e1Text = document.getElementById("e1Text");
  const e2Text = document.getElementById("e2Text");
  const boundText = document.getElementById("boundText");
  const insightText = document.getElementById("insightText");

  function nearestIndex(arr, value) {
    let best = 0;
    let bestDiff = Infinity;
    arr.forEach((v, i) => {
      const diff = Math.abs(v - value);
      if (diff < bestDiff) {
        best = i;
        bestDiff = diff;
      }
    });
    return best;
  }

  function fmt(value, digits = 2) {
    return Number(value).toFixed(digits);
  }

  function makeSvg(containerId, margin = { top: 24, right: 26, bottom: 46, left: 56 }) {
    const el = document.getElementById(containerId);
    el.innerHTML = "";
    const rect = el.getBoundingClientRect();
    const width = Math.max(360, rect.width);
    const height = Math.max(260, rect.height);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    el.appendChild(svg);
    return { svg, width, height, margin, plotW: width - margin.left - margin.right, plotH: height - margin.top - margin.bottom };
  }

  function scale(domain, range) {
    const [d0, d1] = domain;
    const [r0, r1] = range;
    return (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
  }

  function add(svg, tag, attrs = {}, text = "") {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    if (text) node.textContent = text;
    svg.appendChild(node);
    return node;
  }

  function pathFrom(points, xMap, yMap) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${xMap(p.x).toFixed(2)} ${yMap(p.y).toFixed(2)}`).join(" ");
  }

  function drawAxes(ctx, xDomain, yDomain, xLabel, yLabel, xTicks = 5, yTicks = 5) {
    const { svg, width, height, margin, plotW, plotH } = ctx;
    const xMap = scale(xDomain, [margin.left, margin.left + plotW]);
    const yMap = scale(yDomain, [margin.top + plotH, margin.top]);

    for (let i = 0; i <= xTicks; i++) {
      const value = xDomain[0] + (xDomain[1] - xDomain[0]) * i / xTicks;
      const x = xMap(value);
      add(svg, "line", { x1: x, y1: margin.top, x2: x, y2: margin.top + plotH, class: "grid-line" });
      add(svg, "text", { x, y: height - 16, "text-anchor": "middle", fill: colors.text, "font-size": 12 }, trimTick(value));
    }

    for (let i = 0; i <= yTicks; i++) {
      const value = yDomain[0] + (yDomain[1] - yDomain[0]) * i / yTicks;
      const y = yMap(value);
      add(svg, "line", { x1: margin.left, y1: y, x2: margin.left + plotW, y2: y, class: "grid-line" });
      add(svg, "text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", fill: colors.text, "font-size": 12 }, trimTick(value));
    }

    add(svg, "line", { x1: margin.left, y1: margin.top + plotH, x2: margin.left + plotW, y2: margin.top + plotH, stroke: "#667085", "stroke-width": 1.2 });
    add(svg, "line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotH, stroke: "#667085", "stroke-width": 1.2 });
    add(svg, "text", { x: margin.left + plotW / 2, y: height - 2, "text-anchor": "middle", fill: colors.text, "font-size": 13 }, xLabel);
    add(svg, "text", { x: 16, y: margin.top + plotH / 2, transform: `rotate(-90 16 ${margin.top + plotH / 2})`, "text-anchor": "middle", fill: colors.text, "font-size": 13 }, yLabel);
    return { xMap, yMap };
  }

  function trimTick(value) {
    const rounded = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
    return rounded.replace(/\.0$/, "");
  }

  function drawLegend(svg, items, x, y) {
    items.forEach((item, i) => {
      const gx = x + i * item.width;
      add(svg, "line", { x1: gx, y1: y, x2: gx + 26, y2: y, stroke: item.color, "stroke-width": 3, "stroke-dasharray": item.dash || "" });
      add(svg, "text", { x: gx + 34, y: y + 4, fill: colors.text, "font-size": 12 }, item.label);
    });
  }

  function attachTooltip(node, html) {
    node.addEventListener("mousemove", (event) => {
      tooltip.innerHTML = html;
      tooltip.style.display = "block";
      tooltip.style.left = `${event.clientX + 12}px`;
      tooltip.style.top = `${event.clientY + 12}px`;
    });
    node.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
  }

  function drawWellPlot() {
    const ctx = makeSvg("wellPlot", { top: 24, right: 24, bottom: 50, left: 62 });
    const { svg } = ctx;
    const x = data.main.x_nm;
    const pointsV = x.map((v, i) => ({ x: v, y: data.main.V_meV[i] }));
    const pointsP1 = x.map((v, i) => ({ x: v, y: data.main.psi1_plot_meV[i] }));
    const pointsP2 = x.map((v, i) => ({ x: v, y: data.main.psi2_plot_meV[i] }));
    const xDomain = [Math.min(...x), Math.max(...x)];
    const yDomain = [0, 330];
    const maps = drawAxes(ctx, xDomain, yDomain, "位置 x (nm)", "能量 E (meV)", 6, 5);

    add(svg, "path", { d: pathFrom(pointsV, maps.xMap, maps.yMap), fill: "none", stroke: colors.black, "stroke-width": 3 });
    data.main.E_bound_meV.slice(0, 2).forEach((E, i) => {
      const y = maps.yMap(E);
      add(svg, "line", { x1: maps.xMap(xDomain[0]), y1: y, x2: maps.xMap(xDomain[1]), y2: y, stroke: i === 0 ? colors.blue : colors.red, "stroke-width": 2, "stroke-dasharray": "7 7" });
      add(svg, "text", { x: maps.xMap(xDomain[1]) - 42, y: y - 8, fill: i === 0 ? colors.blue : colors.red, "font-size": 13 }, `E${i + 1}`);
    });
    add(svg, "path", { d: pathFrom(pointsP1, maps.xMap, maps.yMap), fill: "none", stroke: colors.blue, "stroke-width": 3 });
    add(svg, "path", { d: pathFrom(pointsP2, maps.xMap, maps.yMap), fill: "none", stroke: colors.red, "stroke-width": 3 });
    drawLegend(svg, [
      { label: "Ec(x)", color: colors.black, width: 92 },
      { label: "E1", color: colors.blue, dash: "7 7", width: 72 },
      { label: "E2", color: colors.red, dash: "7 7", width: 72 },
      { label: "psi1", color: colors.blue, width: 88 },
      { label: "psi2", color: colors.red, width: 88 },
    ], 82, 34);
  }

  function drawDosPlot() {
    const ctx = makeSvg("dosPlot");
    const e = data.dos.energy_meV;
    const xDomain = [0, 450];
    const yDomain = [0, 1.12];
    const maps = drawAxes(ctx, xDomain, yDomain, "能量 E (meV)", "归一化态密度", 5, 4);
    const p2 = e.map((v, i) => ({ x: v, y: data.dos.rho2D_norm[i] }));
    const p3 = e.map((v, i) => ({ x: v, y: data.dos.rho3D_norm[i] }));
    add(ctx.svg, "path", { d: pathFrom(p2, maps.xMap, maps.yMap), fill: "none", stroke: colors.blue, "stroke-width": 3 });
    add(ctx.svg, "path", { d: pathFrom(p3, maps.xMap, maps.yMap), fill: "none", stroke: colors.red, "stroke-width": 3, "stroke-dasharray": "9 7" });
    data.main.E_bound_meV.slice(0, 2).forEach((E, i) => {
      add(ctx.svg, "line", { x1: maps.xMap(E), y1: maps.yMap(0), x2: maps.xMap(E), y2: maps.yMap(1.06), stroke: "#111827", "stroke-dasharray": "3 4" });
      add(ctx.svg, "text", { x: maps.xMap(E) + 5, y: maps.yMap(0.12 + i * 0.12), fill: colors.text, "font-size": 12 }, `E${i + 1}`);
    });
    drawLegend(ctx.svg, [
      { label: "rho2D", color: colors.blue, width: 96 },
      { label: "rho3D", color: colors.red, dash: "9 7", width: 96 },
    ], 74, 28);
  }

  function drawPenetrationPlot() {
    const ctx = makeSvg("penetrationPlot", { top: 24, right: 24, bottom: 52, left: 52 });
    const { svg, margin, plotW, plotH } = ctx;
    const maps = drawAxes(ctx, [0, 2], [0, 1], "束缚态能级", "概率积分", 2, 4);
    const barW = plotW * 0.25;
    const regionColors = [colors.blue, "#d85719", "#eab308"];
    const regionLabels = ["左势垒区", "阱区", "右势垒区"];
    data.penetration.regions.forEach((row, i) => {
      let y0 = 0;
      const xCenter = maps.xMap(i + 0.5);
      row.forEach((value, j) => {
        const yTop = maps.yMap(y0 + value);
        const yBottom = maps.yMap(y0);
        const rect = add(svg, "rect", {
          x: xCenter - barW / 2,
          y: yTop,
          width: barW,
          height: Math.max(1, yBottom - yTop),
          fill: regionColors[j],
          stroke: "rgba(0,0,0,0.35)",
        });
        attachTooltip(rect, `${data.penetration.labels[i]}<br>${regionLabels[j]}：${fmt(value, 4)}`);
        if (value > 0.04) add(svg, "text", { x: xCenter, y: (yTop + yBottom) / 2 + 4, "text-anchor": "middle", fill: "#fff", "font-size": 12 }, fmt(value, 3));
        y0 += value;
      });
      add(svg, "text", { x: xCenter, y: margin.top + plotH + 23, "text-anchor": "middle", fill: colors.text, "font-size": 13 }, data.penetration.labels[i]);
    });
    drawLegend(svg, regionLabels.map((label, i) => ({ label, color: regionColors[i], width: 92 })), 70, ctx.height - 18);
  }

  function drawWidthPlot(selectedIndex) {
    const ctx = makeSvg("widthPlot");
    const L = data.widthScan.L_nm;
    const finite = data.widthScan.E1_finite_meV;
    const infinite = data.widthScan.E1_infinite_meV;
    const maps = drawAxes(ctx, [4, 20], [0, 390], "阱宽 Lw (nm)", "基态能级 E1 (meV)", 4, 4);
    add(ctx.svg, "path", { d: pathFrom(L.map((v, i) => ({ x: v, y: finite[i] })), maps.xMap, maps.yMap), fill: "none", stroke: colors.blue, "stroke-width": 3 });
    add(ctx.svg, "path", { d: pathFrom(L.map((v, i) => ({ x: v, y: infinite[i] })), maps.xMap, maps.yMap), fill: "none", stroke: colors.red, "stroke-width": 3, "stroke-dasharray": "9 7" });
    L.forEach((v, i) => {
      const c = add(ctx.svg, "circle", { cx: maps.xMap(v), cy: maps.yMap(finite[i]), r: i === selectedIndex ? 6 : 3.5, fill: i === selectedIndex ? colors.orange : colors.blue });
      attachTooltip(c, `Lw=${fmt(v, 2)} nm<br>有限深势阱 E1=${fmt(finite[i], 2)} meV<br>束缚态数=${data.widthScan.bound_count[i]}`);
    });
    drawLegend(ctx.svg, [
      { label: "有限深势阱", color: colors.blue, width: 118 },
      { label: "无限深势阱", color: colors.red, dash: "9 7", width: 118 },
    ], 72, 28);
  }

  function drawBoundPlot(selectedIndex) {
    const ctx = makeSvg("boundPlot");
    const L = data.widthScan.L_nm;
    const count = data.widthScan.bound_count;
    const maps = drawAxes(ctx, [4, 20], [0, 5.5], "阱宽 Lw (nm)", "束缚态数量", 4, 5);
    const stepPoints = [];
    L.forEach((v, i) => {
      if (i > 0) stepPoints.push({ x: v, y: count[i - 1] });
      stepPoints.push({ x: v, y: count[i] });
    });
    add(ctx.svg, "path", { d: pathFrom(stepPoints, maps.xMap, maps.yMap), fill: "none", stroke: colors.green, "stroke-width": 3 });
    add(ctx.svg, "circle", { cx: maps.xMap(L[selectedIndex]), cy: maps.yMap(count[selectedIndex]), r: 6, fill: colors.orange });
  }

  function drawMassPlot() {
    const ctx = makeSvg("massPlot", { top: 24, right: 20, bottom: 50, left: 56 });
    const maps = drawAxes(ctx, [0, 3], [0, 240], "能级", "能量 (meV)", 3, 4);
    const labels = ["E1", "E2"];
    const constVals = data.massComparison.const_meV;
    const varVals = data.massComparison.variable_meV;
    labels.forEach((label, i) => {
      const x0 = maps.xMap(i + 0.8);
      const x1 = maps.xMap(i + 1.2);
      add(ctx.svg, "rect", { x: x0 - 18, y: maps.yMap(constVals[i]), width: 30, height: maps.yMap(0) - maps.yMap(constVals[i]), fill: colors.blue, opacity: 0.82 });
      add(ctx.svg, "rect", { x: x1 - 18, y: maps.yMap(varVals[i]), width: 30, height: maps.yMap(0) - maps.yMap(varVals[i]), fill: colors.red, opacity: 0.82 });
      add(ctx.svg, "text", { x: maps.xMap(i + 1), y: ctx.height - 18, "text-anchor": "middle", fill: colors.text, "font-size": 13 }, label);
    });
    drawLegend(ctx.svg, [
      { label: "常质量", color: colors.blue, width: 86 },
      { label: "变质量", color: colors.red, width: 86 },
    ], 70, 28);
  }

  function drawConvPlot() {
    const ctx = makeSvg("convPlot");
    const Nx = data.convergence.Nx;
    const E1 = data.convergence.E1_meV;
    const maps = drawAxes(ctx, [80, 420], [47.3, 50.7], "网格数 Nx", "E1 (meV)", 4, 4);
    add(ctx.svg, "path", { d: pathFrom(Nx.map((v, i) => ({ x: v, y: E1[i] })), maps.xMap, maps.yMap), fill: "none", stroke: colors.purple, "stroke-width": 3 });
    Nx.forEach((v, i) => {
      const c = add(ctx.svg, "circle", { cx: maps.xMap(v), cy: maps.yMap(E1[i]), r: 5, fill: colors.purple });
      attachTooltip(c, `Nx=${v}<br>E1=${fmt(E1[i], 4)} meV<br>时间≈${fmt(data.convergence.time_s[i], 4)} s`);
    });
  }

  function updateSummary() {
    const selected = Number(widthSlider.value);
    const idx = nearestIndex(data.widthScan.L_nm, selected);
    const L = data.widthScan.L_nm[idx];
    widthSlider.value = L;
    widthValue.textContent = `${fmt(L, 1)} nm`;

    const model = modelSelect.value;
    const E = model === "variable" ? data.massComparison.variable_meV : data.massComparison.const_meV;
    e1Text.textContent = `${fmt(E[0], 3)} meV`;
    e2Text.textContent = `${fmt(E[1], 3)} meV`;
    boundText.textContent = `${data.widthScan.bound_count[idx]} 个`;

    const finite = data.widthScan.E1_finite_meV[idx];
    const infinite = data.widthScan.E1_infinite_meV[idx];
    insightText.innerHTML = `当 L<sub>w</sub>=${fmt(L, 1)} nm 时，有限深势阱基态约为 ${fmt(finite, 2)} meV，低于同宽度无限深势阱的 ${fmt(infinite, 2)} meV；当前可容纳 ${data.widthScan.bound_count[idx]} 个束缚态。`;
    drawWidthPlot(idx);
    drawBoundPlot(idx);
  }

  function drawAll() {
    drawWellPlot();
    drawDosPlot();
    drawPenetrationPlot();
    drawMassPlot();
    drawConvPlot();
    updateSummary();
  }

  widthSlider.addEventListener("input", updateSummary);
  modelSelect.addEventListener("change", updateSummary);
  window.addEventListener("resize", () => window.requestAnimationFrame(drawAll));
  drawAll();
})();
