const CASES = [
  {
    id: "case-a",
    label: "Demo Eye A",
    modality: "Ultra-widefield fundus",
    profile: "image_stable",
    inputs: { pre_age: 6.2, base_al: 24.1, focus_year: 5.0 },
    evidence: ["Peripheral retinal heatmap signal", "Image-stable phenotype embedding", "Six clinical text embeddings"],
    base_image: "assets/demo_assets/case-a-base.jpg",
    hotspots: [
      { x: 58, y: 47, size: 28, intensity: 0.9 },
      { x: 35, y: 48, size: 20, intensity: 0.72 },
      { x: 22, y: 58, size: 22, intensity: 0.58 },
    ],
  },
  {
    id: "case-b",
    label: "Demo Eye B",
    modality: "Fundus image",
    profile: "systemic",
    inputs: { pre_age: 4.4, base_al: 25.3, focus_year: 5.0 },
    evidence: ["Posterior pole heatmap signal", "Systemic phenotype embeddings", "Five-year horizon"],
    base_image: "assets/demo_assets/case-b-base.jpg",
    hotspots: [
      { x: 51, y: 50, size: 26, intensity: 0.88 },
      { x: 66, y: 39, size: 18, intensity: 0.66 },
      { x: 29, y: 55, size: 20, intensity: 0.52 },
    ],
  },
  {
    id: "case-c",
    label: "Demo Eye C",
    modality: "Ultra-widefield fundus",
    profile: "balanced",
    inputs: { pre_age: 9.8, base_al: 23.4, focus_year: 3.0 },
    evidence: ["Multifocal retinal heatmap", "Balanced fusion profile", "Three-year horizon"],
    base_image: "assets/demo_assets/case-c-base.jpg",
    hotspots: [
      { x: 47, y: 52, size: 24, intensity: 0.82 },
      { x: 61, y: 42, size: 19, intensity: 0.62 },
      { x: 33, y: 64, size: 17, intensity: 0.48 },
    ],
  },
];

const PROFILES = {
  balanced: {
    label: "Balanced multimodal phenotype",
    signature: "Concordant clinical and imaging evidence",
    modifier: 0.0,
    curvature: 0.0,
    uncertainty: 0.0,
    text_weight: 0.44,
    image_weight: 0.31,
    structured_weight: 0.25,
  },
  systemic: {
    label: "Systemic high-growth phenotype",
    signature: "Systemic and genetic narrative dominant",
    modifier: 0.34,
    curvature: 0.1,
    uncertainty: 0.05,
    text_weight: 0.49,
    image_weight: 0.26,
    structured_weight: 0.25,
  },
  image_stable: {
    label: "Image-rich stable phenotype",
    signature: "Retinal image evidence dominant",
    modifier: -0.18,
    curvature: -0.04,
    uncertainty: -0.02,
    text_weight: 0.34,
    image_weight: 0.41,
    structured_weight: 0.25,
  },
  sparse: {
    label: "Sparse imaging profile",
    signature: "Structured-data fallback with narrative support",
    modifier: 0.08,
    curvature: 0.03,
    uncertainty: 0.08,
    text_weight: 0.47,
    image_weight: 0.16,
    structured_weight: 0.37,
  },
};

const HORIZONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

const COLORS = {
  fusion: "#a4453d",
  structured: "#2f6f8f",
  multimodal: "#9a6a12",
  prior: "#647178",
  grid: "#e1e6df",
  axis: "#273034",
  band: "#efd9d6",
  text: "#5b6e54",
  image: "#8a6b2d",
};

const state = {
  case: null,
  view: "image",
  debounce: null,
};

const $ = (id) => document.getElementById(id);

function format(value, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "--";
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, Number(value)));
}

function addSvg(parent, tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
  parent.appendChild(el);
  return el;
}

function clearSvg(svg, viewBox) {
  svg.innerHTML = "";
  svg.setAttribute("viewBox", viewBox);
}

function interp(points, year, key = "al") {
  const x = clamp(year, 0, 5);
  for (let i = 0; i < points.length - 1; i += 1) {
    const left = points[i];
    const right = points[i + 1];
    if (x >= left.year && x <= right.year) {
      const t = (x - left.year) / (right.year - left.year || 1);
      return Number(left[key]) + (Number(right[key]) - Number(left[key])) * t;
    }
  }
  return Number(points[points.length - 1][key]);
}

function dense(points, key = "al") {
  return Array.from({ length: 201 }, (_, i) => {
    const year = (5 * i) / 200;
    return { year, [key]: interp(points, year, key) };
  });
}

function physiologicStructured(baseAl, preAge, year) {
  if (year === 0) return baseAl;
  const pediatric = 1 / (1 + Math.exp((preAge - 13) / 4));
  const baselineRisk = clamp((baseAl - 22.5) / 7.5, 0, 1);
  const early = 1 - Math.exp(-0.72 * year);
  const linear = year / 5;
  const growth = 0.36 * early + 0.62 * linear;
  const ageTerm = 0.62 + 0.48 * pediatric;
  const baseTerm = 0.78 + 0.34 * baselineRisk;
  return baseAl + growth * ageTerm * baseTerm;
}

function predictTrajectory() {
  const preAge = clamp($("ageInput").value, 0.1, 90);
  const baseAl = clamp($("baseInput").value, 10, 45);
  const focusYear = clamp($("focusInput").value, 0, 5);
  const profileId = $("profileInput").value || "balanced";
  const profile = PROFILES[profileId] || PROFILES.balanced;

  const structuredPoints = [];
  const curvePoints = [];
  const multimodalPoints = [];
  const fusionPoints = [];
  const band = [];

  HORIZONS.forEach((year) => {
    const structuredAl = physiologicStructured(baseAl, preAge, year);
    const growth = structuredAl - baseAl;
    const t = year / 5;
    const curveAl = baseAl + 0.9 * growth - 0.025 * Math.max(preAge - 15, 0) * t;
    const phenotypeShift = profile.modifier * t + profile.curvature * Math.sin(Math.PI * t);
    const multimodalAl = structuredAl + phenotypeShift;
    const hgbWeight = 0.6 - 0.12 * t;
    const deepWeight = 1 - hgbWeight;
    const fusionAl = 0.94 * (hgbWeight * structuredAl + deepWeight * multimodalAl) + 0.06 * curveAl;
    const uncertainty = Math.max(0.18, 0.22 + 0.06 * year + profile.uncertainty);
    structuredPoints.push({ year, al: structuredAl });
    curvePoints.push({ year, al: curveAl });
    multimodalPoints.push({ year, al: multimodalAl });
    fusionPoints.push({ year, al: fusionAl });
    band.push({ year, lower: fusionAl - uncertainty, upper: fusionAl + uncertainty });
  });

  let running = baseAl;
  fusionPoints.forEach((point) => {
    running = Math.max(running, point.al);
    point.al = running;
  });

  const focusAl = interp(fusionPoints, focusYear);
  const finalAl = interp(fusionPoints, 5);
  return {
    inputs: { pre_age: preAge, base_al: baseAl, focus_year: focusYear },
    profile: { id: profileId, ...profile },
    summary: {
      focus_al: focusAl,
      al_1y: interp(fusionPoints, 1),
      al_3y: interp(fusionPoints, 3),
      al_5y: finalAl,
      total_growth_5y: finalAl - baseAl,
      annualized_growth_5y: (finalAl - baseAl) / 5,
    },
    points: fusionPoints,
    band,
    branches: {
      fusion: { points: fusionPoints, dense: dense(fusionPoints) },
      structured: { points: structuredPoints, dense: dense(structuredPoints) },
      multimodal: { points: multimodalPoints, dense: dense(multimodalPoints) },
      curve_prior: { points: curvePoints, dense: dense(curvePoints) },
    },
    attention: modalityAttention(profile),
  };
}

function modalityAttention(profile) {
  const structured = profile.structured_weight;
  const text = profile.text_weight;
  const image = profile.image_weight;
  return {
    modalities: [
      { label: "Structured", weight: structured },
      { label: "Text", weight: text },
      { label: "Image", weight: image },
    ],
    tokens: [
      { group: "Structured", label: "Baseline axial length", weight: structured * 0.44 },
      { group: "Structured", label: "Preoperative age", weight: structured * 0.34 },
      { group: "Structured", label: "Prediction horizon", weight: structured * 0.22 },
      { group: "Text", label: "Ocular biometry report", weight: text * 0.22 },
      { group: "Text", label: "Genetic profile", weight: text * 0.19 },
      { group: "Text", label: "Surgical record", weight: text * 0.17 },
      { group: "Text", label: "Cardiovascular phenotype", weight: text * 0.16 },
      { group: "Text", label: "Follow-up context", weight: text * 0.14 },
      { group: "Text", label: "Demographics", weight: text * 0.12 },
      { group: "Image", label: "Ultra-widefield fundus token", weight: image * 0.46 },
      { group: "Image", label: "B-scan image token", weight: image * 0.34 },
      { group: "Image", label: "Additional ophthalmic token", weight: image * 0.2 },
    ],
  };
}

function yDomain(values) {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }
  const pad = (max - min) * 0.08;
  return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
}

function pathFrom(points, scaleX, scaleY, key = "al") {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(p.year).toFixed(2)},${scaleY(p[key]).toFixed(2)}`)
    .join(" ");
}

function drawTrajectory(result) {
  const svg = $("trajectoryChart");
  clearSvg(svg, "0 0 980 500");
  const width = 980;
  const height = 500;
  const margin = { top: 28, right: 32, bottom: 58, left: 70 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const yValues = [
    ...result.branches.fusion.dense.map((p) => p.al),
    ...result.branches.structured.dense.map((p) => p.al),
    ...result.branches.multimodal.dense.map((p) => p.al),
    ...result.branches.curve_prior.dense.map((p) => p.al),
    ...result.band.flatMap((p) => [p.lower, p.upper]),
  ];
  const [yMin, yMax] = yDomain(yValues);
  const scaleX = (year) => margin.left + (Number(year) / 5) * plotW;
  const scaleY = (al) => margin.top + (1 - (Number(al) - yMin) / (yMax - yMin)) * plotH;

  Array.from({ length: 6 }, (_, i) => yMin + ((yMax - yMin) * i) / 5).forEach((tick) => {
    const y = scaleY(tick);
    addSvg(svg, "line", { x1: margin.left, x2: width - margin.right, y1: y, y2: y, stroke: COLORS.grid });
    addSvg(svg, "text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", class: "axis-label" }).textContent = format(tick, 1);
  });

  [0, 1, 2, 3, 4, 5].forEach((tick) => {
    const x = scaleX(tick);
    addSvg(svg, "line", { x1: x, x2: x, y1: margin.top, y2: height - margin.bottom, stroke: COLORS.grid });
    addSvg(svg, "text", { x, y: height - margin.bottom + 24, "text-anchor": "middle", class: "axis-label" }).textContent = format(tick, 0);
  });

  addSvg(svg, "line", { x1: margin.left, x2: width - margin.right, y1: height - margin.bottom, y2: height - margin.bottom, stroke: COLORS.axis, "stroke-width": 1.2 });
  addSvg(svg, "line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: height - margin.bottom, stroke: COLORS.axis, "stroke-width": 1.2 });
  addSvg(svg, "text", { x: width / 2, y: height - 12, "text-anchor": "middle", class: "axis-title" }).textContent = "Years after surgery";
  addSvg(svg, "text", { x: 18, y: height / 2, transform: `rotate(-90 18 ${height / 2})`, "text-anchor": "middle", class: "axis-title" }).textContent = "Axial length (mm)";

  const upper = result.band.map((p) => `${scaleX(p.year).toFixed(2)},${scaleY(p.upper).toFixed(2)}`).join(" ");
  const lower = [...result.band].reverse().map((p) => `${scaleX(p.year).toFixed(2)},${scaleY(p.lower).toFixed(2)}`).join(" ");
  addSvg(svg, "polygon", { points: `${upper} ${lower}`, fill: COLORS.band, opacity: 0.62 });

  [
    ["curve_prior", COLORS.prior, 1.7, "4 5"],
    ["structured", COLORS.structured, 2.2, ""],
    ["multimodal", COLORS.multimodal, 2.2, "7 4"],
    ["fusion", COLORS.fusion, 3.6, ""],
  ].forEach(([key, color, strokeWidth, dash]) => {
    addSvg(svg, "path", {
      d: pathFrom(result.branches[key].dense, scaleX, scaleY),
      fill: "none",
      stroke: color,
      "stroke-width": strokeWidth,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
      "stroke-dasharray": dash,
    });
  });

  result.points.forEach((point) => {
    addSvg(svg, "circle", {
      cx: scaleX(point.year),
      cy: scaleY(point.al),
      r: point.year === 0 ? 4.4 : 4.8,
      fill: point.year === 0 ? "#ffffff" : COLORS.fusion,
      stroke: COLORS.fusion,
      "stroke-width": 2,
    });
  });

  const focusX = scaleX(result.inputs.focus_year);
  addSvg(svg, "line", {
    x1: focusX,
    x2: focusX,
    y1: margin.top,
    y2: height - margin.bottom,
    stroke: COLORS.fusion,
    "stroke-width": 1.2,
    "stroke-dasharray": "5 5",
  });
  addSvg(svg, "circle", {
    cx: focusX,
    cy: scaleY(result.summary.focus_al),
    r: 6,
    fill: "#ffffff",
    stroke: COLORS.fusion,
    "stroke-width": 3,
  });
  addSvg(svg, "text", { x: focusX + 10, y: scaleY(result.summary.focus_al) - 10, class: "value-label" }).textContent = `${format(result.summary.focus_al, 2)} mm`;
}

function renderCaseRail() {
  const rail = $("caseRail");
  rail.innerHTML = "";
  CASES.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "case-button";
    button.dataset.caseId = item.id;
    const title = document.createElement("strong");
    title.textContent = item.label;
    const subtitle = document.createElement("span");
    subtitle.textContent = item.modality;
    button.append(title, subtitle);
    button.addEventListener("click", () => selectCase(item, true));
    rail.appendChild(button);
  });
}

function selectCase(item, applyInputs) {
  state.case = item;
  document.querySelectorAll(".case-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.caseId === item.id);
  });
  $("caseLabel").textContent = item.label;
  $("baseImage").src = item.base_image;
  renderCleanHeatmap(item);
  $("caseEvidence").innerHTML = "";
  item.evidence.forEach((label) => {
    const chip = document.createElement("span");
    chip.textContent = label;
    $("caseEvidence").appendChild(chip);
  });
  if (applyInputs) {
    $("ageInput").value = format(item.inputs.pre_age, 2);
    $("baseInput").value = format(item.inputs.base_al, 2);
    $("focusInput").value = format(item.inputs.focus_year, 2);
    $("focusRange").value = format(item.inputs.focus_year, 2);
    $("profileInput").value = item.profile;
  }
  renderImageCaption();
  updateForecast();
}

function renderCleanHeatmap(item) {
  const layer = $("cleanHeatmap");
  layer.innerHTML = "";
  item.hotspots.forEach((spot) => {
    const blob = document.createElement("span");
    blob.className = "heat-blob";
    blob.style.left = `${spot.x}%`;
    blob.style.top = `${spot.y}%`;
    blob.style.width = `${spot.size}%`;
    blob.style.height = `${spot.size}%`;
    blob.style.opacity = String(spot.intensity);
    layer.appendChild(blob);
  });
}

function setView(mode) {
  state.view = mode;
  $("imageStage").className = `image-stage ${mode}-mode`;
  document.querySelectorAll(".view-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === mode);
  });
  renderImageCaption();
}

function renderImageCaption() {
  if (!state.case) return;
  const viewLabel = { image: "Deidentified ophthalmic image", heatmap: "Attention heatmap", overlay: "Image and attention overlay" }[state.view];
  $("imageCaption").textContent = `${viewLabel} / ${state.case.modality} / ${state.case.label}`;
}

function updateCaseSummary() {
  if (!state.case) return;
  const profileLabel = $("profileInput").selectedOptions[0]?.textContent || "Multimodal phenotype";
  $("caseSummary").textContent = `${state.case.label}: age ${format($("ageInput").value, 2)} y, baseline AL ${format($("baseInput").value, 2)} mm, target ${format($("focusInput").value, 2)} y, ${profileLabel}.`;
}

function renderModalityBars(modalities) {
  const target = $("modalityBars");
  target.innerHTML = "";
  modalities.forEach((item) => {
    const row = document.createElement("div");
    row.className = `modality-row ${item.label.toLowerCase()}`;
    const label = document.createElement("span");
    label.textContent = item.label;
    const track = document.createElement("i");
    const fill = document.createElement("b");
    fill.style.width = `${Math.max(3, item.weight * 100).toFixed(1)}%`;
    track.appendChild(fill);
    const value = document.createElement("strong");
    value.textContent = format(item.weight, 2);
    row.append(label, track, value);
    target.appendChild(row);
  });
}

function renderTokenBars(tokens) {
  const target = $("tokenBars");
  target.innerHTML = "";
  const rows = [...tokens].sort((a, b) => b.weight - a.weight).slice(0, 10);
  const max = Math.max(...rows.map((item) => item.weight), 0.01);
  rows.forEach((item) => {
    const row = document.createElement("div");
    row.className = `token-row ${item.group.toLowerCase()}`;
    const top = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = item.label;
    const value = document.createElement("strong");
    value.textContent = format(item.weight, 2);
    top.append(label, value);
    const track = document.createElement("i");
    const fill = document.createElement("b");
    fill.style.width = `${(item.weight / max) * 100}%`;
    track.appendChild(fill);
    row.append(top, track);
    target.appendChild(row);
  });
}

function renderFusionSchematic() {
  const svg = $("fusionSchematic");
  clearSvg(svg, "0 0 720 230");
  const nodes = [
    { x: 42, y: 34, w: 156, h: 42, label: "Structured", color: COLORS.structured },
    { x: 42, y: 94, w: 156, h: 42, label: "Text embeddings", color: COLORS.text },
    { x: 42, y: 154, w: 156, h: 42, label: "Image embeddings", color: COLORS.image },
    { x: 318, y: 74, w: 170, h: 72, label: "Horizon heads", color: "#565d63" },
    { x: 558, y: 84, w: 128, h: 52, label: "Fused AL", color: COLORS.fusion },
  ];
  [[198, 55, 318, 96], [198, 115, 318, 110], [198, 175, 318, 126], [488, 110, 558, 110]].forEach(([x1, y1, x2, y2]) => {
    addSvg(svg, "path", {
      d: `M${x1},${y1} C${x1 + 54},${y1} ${x2 - 54},${y2} ${x2},${y2}`,
      fill: "none",
      stroke: "#b8c0b8",
      "stroke-width": 2,
    });
  });
  nodes.forEach((node) => {
    addSvg(svg, "rect", { x: node.x, y: node.y, width: node.w, height: node.h, rx: 7, fill: "#ffffff", stroke: node.color, "stroke-width": 1.5 });
    addSvg(svg, "text", { x: node.x + node.w / 2, y: node.y + node.h / 2 + 5, "text-anchor": "middle", class: "node-label" }).textContent = node.label;
  });
}

function updateForecast() {
  $("statusBadge").textContent = "Static";
  const result = predictTrajectory();
  $("focusValue").textContent = `${format(result.summary.focus_al, 2)} mm`;
  $("al5y").textContent = `${format(result.summary.al_5y, 2)} mm`;
  $("al1y").textContent = `${format(result.summary.al_1y, 2)} mm`;
  $("al3y").textContent = `${format(result.summary.al_3y, 2)} mm`;
  $("al5yStrip").textContent = `${format(result.summary.al_5y, 2)} mm`;
  const growth = result.summary.total_growth_5y;
  $("growthValue").textContent = `${growth >= 0 ? "+" : ""}${format(growth, 2)} mm`;
  $("annualGrowth").textContent = `${format(result.summary.annualized_growth_5y, 2)} mm/y`;
  $("phenotypeLabel").textContent = result.profile.signature;
  $("chartSubtitle").textContent = `Age ${format(result.inputs.pre_age, 2)} y / baseline ${format(result.inputs.base_al, 2)} mm / target ${format(result.inputs.focus_year, 2)} y`;
  updateCaseSummary();
  drawTrajectory(result);
  renderModalityBars(result.attention.modalities);
  renderTokenBars(result.attention.tokens);
}

function queueUpdate() {
  clearTimeout(state.debounce);
  state.debounce = setTimeout(updateForecast, 80);
}

function init() {
  const profileSelect = $("profileInput");
  Object.entries(PROFILES).forEach(([id, profile]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = profile.label;
    profileSelect.appendChild(option);
  });
  renderCaseRail();
  renderFusionSchematic();
  selectCase(CASES[0], true);

  $("predictButton").addEventListener("click", updateForecast);
  $("focusRange").addEventListener("input", () => {
    $("focusInput").value = $("focusRange").value;
    queueUpdate();
  });
  $("focusInput").addEventListener("input", () => {
    $("focusRange").value = $("focusInput").value;
    queueUpdate();
  });
  ["ageInput", "baseInput", "profileInput"].forEach((id) => {
    $(id).addEventListener(id === "profileInput" ? "change" : "input", queueUpdate);
  });
  document.querySelectorAll(".view-button").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
}

init();
