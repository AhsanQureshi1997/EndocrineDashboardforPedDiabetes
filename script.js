const fileInput = document.getElementById('fileInput');
const demoBtn = document.getElementById('demoBtn');
const downloadBtn = document.getElementById('downloadBtn');
const highRiskBtn = document.getElementById('highRiskBtn');
const allBtn = document.getElementById('allBtn');

let currentProcessed = [];
let currentView = "all";

fileInput.addEventListener('change', handleFile);
demoBtn.addEventListener('click', loadDemo);
downloadBtn.addEventListener('click', downloadAnalyzedCSV);
highRiskBtn.addEventListener('click', () => {
  currentView = "high";
  refreshCurrentView();
});
allBtn.addEventListener('click', () => {
  currentView = "all";
  refreshCurrentView();
});

function loadDemo() {
  const demoRows = [
    { patient_id: "1001", diabetes_type: "T1D", last_a1c: 10.8, prev_a1c: 9.3, bmi: 24.2, prev_bmi: 23.9, days_since_last_visit: 140, missed_visits: 2, cgm_use: "No", time_in_range: 0, gmi: 0, last_eye_exam_days: 500, last_kidney_screen_days: 420 },
    { patient_id: "1002", diabetes_type: "T1D", last_a1c: 7.1, prev_a1c: 7.3, bmi: 22.1, prev_bmi: 22.0, days_since_last_visit: 62, missed_visits: 0, cgm_use: "Yes", time_in_range: 72, gmi: 7.0, last_eye_exam_days: 210, last_kidney_screen_days: 200 },
    { patient_id: "1003", diabetes_type: "T2D", last_a1c: 9.4, prev_a1c: 8.6, bmi: 35.1, prev_bmi: 34.3, days_since_last_visit: 95, missed_visits: 1, cgm_use: "No", time_in_range: 0, gmi: 0, last_eye_exam_days: 420, last_kidney_screen_days: 410 },
    { patient_id: "1004", diabetes_type: "T1D", last_a1c: 8.2, prev_a1c: 8.0, bmi: 23.5, prev_bmi: 23.3, days_since_last_visit: 185, missed_visits: 2, cgm_use: "Yes", time_in_range: 51, gmi: 8.1, last_eye_exam_days: 320, last_kidney_screen_days: 380 },
    { patient_id: "1005", diabetes_type: "T2D", last_a1c: 6.9, prev_a1c: 7.0, bmi: 31.0, prev_bmi: 31.3, days_since_last_visit: 84, missed_visits: 0, cgm_use: "No", time_in_range: 0, gmi: 0, last_eye_exam_days: 700, last_kidney_screen_days: 520 },
    { patient_id: "1006", diabetes_type: "T1D", last_a1c: 11.6, prev_a1c: 10.1, bmi: 21.3, prev_bmi: 21.1, days_since_last_visit: 210, missed_visits: 3, cgm_use: "No", time_in_range: 0, gmi: 0, last_eye_exam_days: 610, last_kidney_screen_days: 630 },
    { patient_id: "1007", diabetes_type: "T1D", last_a1c: 7.8, prev_a1c: 8.2, bmi: 20.8, prev_bmi: 21.0, days_since_last_visit: 70, missed_visits: 0, cgm_use: "Yes", time_in_range: 68, gmi: 7.5, last_eye_exam_days: 150, last_kidney_screen_days: 160 }
  ];
  processData(demoRows);
}

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const rows = parseCSV(text);
    processData(rows);
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] !== undefined ? values[i].trim() : "");
    return obj;
  });
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function toNum(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : 0;
}

function yesNo(val) {
  const s = String(val || "").trim().toLowerCase();
  return s === "yes" || s === "y" || s === "true" || s === "1";
}

function computePatient(obj) {
  const patient_id = obj.patient_id ?? "";
  const diabetes_type = obj.diabetes_type ?? "";
  const last_a1c = toNum(obj.last_a1c);
  const prev_a1c = toNum(obj.prev_a1c);
  const bmi = toNum(obj.bmi);
  const prev_bmi = toNum(obj.prev_bmi);
  const days_since_last_visit = toNum(obj.days_since_last_visit);
  const missed_visits = toNum(obj.missed_visits);
  const cgm_use = yesNo(obj.cgm_use);
  const time_in_range = toNum(obj.time_in_range);
  const gmi = toNum(obj.gmi);
  const last_eye_exam_days = toNum(obj.last_eye_exam_days);
  const last_kidney_screen_days = toNum(obj.last_kidney_screen_days);

  const a1cChange = +(last_a1c - prev_a1c).toFixed(2);
  const bmiChange = +(bmi - prev_bmi).toFixed(2);

  let priorityScore = 0;
  const gaps = [];
  const rationale = [];
  let category = "Routine follow-up";
  let categoryClass = "routine";
  let action = "Continue routine follow-up.";

  // Absolute A1c severity
  if (last_a1c >= 11) {
    priorityScore += 8;
    gaps.push("Very high current A1c");
    rationale.push("Current A1c is in a very high range.");
  } else if (last_a1c >= 9) {
    priorityScore += 5;
    gaps.push("High current A1c");
    rationale.push("Current A1c is above a commonly concerning threshold.");
  } else if (last_a1c >= 7) {
    priorityScore += 2;
    rationale.push("Current A1c is above near-target range.");
  }

  // Trend
  if (a1cChange >= 1) {
    priorityScore += 3;
    gaps.push("A1c worsening");
    rationale.push("A1c has risen by at least 1 point since the prior value.");
  } else if (a1cChange > 0) {
    priorityScore += 1;
    rationale.push("A1c is trending upward.");
  }

  // Follow-up / adherence
  if (days_since_last_visit > 180) {
    priorityScore += 3;
    gaps.push("Long gap since visit");
    rationale.push("Patient has not been seen in over 180 days.");
  } else if (days_since_last_visit > 120) {
    priorityScore += 2;
    gaps.push("Visit gap");
    rationale.push("Patient has an extended interval since last visit.");
  }

  if (missed_visits >= 2) {
    priorityScore += 2;
    gaps.push("Repeated missed visits");
    rationale.push("Multiple missed visits suggest follow-up instability.");
  } else if (missed_visits === 1) {
    priorityScore += 1;
    rationale.push("One recent missed visit is present.");
  }

  // Technology gap
  const cgmGap = !cgm_use;
  if (cgmGap) {
    priorityScore += 1;
    gaps.push("CGM gap");
    rationale.push("CGM is not in use.");
  }
  if (cgm_use && time_in_range > 0 && time_in_range < 55) {
    priorityScore += 2;
    gaps.push("Low time in range");
    rationale.push("Available CGM data suggests suboptimal time in range.");
  }

  // Screening gaps
  const eyeGap = last_eye_exam_days > 365;
  const kidneyGap = last_kidney_screen_days > 365;
  if (eyeGap) {
    priorityScore += 1;
    gaps.push("Eye screening overdue");
    rationale.push("Retinal screening interval appears overdue.");
  }
  if (kidneyGap) {
    priorityScore += 1;
    gaps.push("Kidney screening overdue");
    rationale.push("Kidney screening interval appears overdue.");
  }

  // Category assignment
  if (last_a1c >= 10 || (last_a1c >= 9 && (a1cChange >= 1 || days_since_last_visit > 120 || missed_visits >= 2))) {
    category = "Urgent review";
    categoryClass = "urgent";
    action = "Prioritize near-term follow-up and review glycemic management plan.";
  } else if (last_a1c >= 9 || a1cChange >= 1 || days_since_last_visit > 120 || missed_visits >= 2 || (cgm_use && time_in_range > 0 && time_in_range < 55)) {
    category = "Closer follow-up";
    categoryClass = "close";
    action = "Arrange closer follow-up and review adherence, technology use, and trend drivers.";
  } else if (cgmGap) {
    category = "Technology gap";
    categoryClass = "tech";
    action = "Review whether CGM uptake or re-engagement could improve monitoring.";
  } else if (eyeGap || kidneyGap) {
    category = "Screening gap";
    categoryClass = "screen";
    action = "Address overdue complication screening at the next contact.";
  }

  if (gaps.length === 0) {
    gaps.push("No major gap detected");
    rationale.push("Current values suggest relatively stable follow-up and control.");
  }

  return {
    patient_id,
    diabetes_type,
    last_a1c,
    prev_a1c,
    bmi,
    prev_bmi,
    days_since_last_visit,
    missed_visits,
    cgm_use,
    time_in_range,
    gmi,
    last_eye_exam_days,
    last_kidney_screen_days,
    a1cChange,
    bmiChange,
    priorityScore,
    category,
    categoryClass,
    action,
    keyGaps: gaps,
    rationale
  };
}

function processData(rawRows) {
  currentProcessed = rawRows.map(computePatient).sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return b.last_a1c - a.last_a1c;
  });
  currentView = "all";
  renderSummary(currentProcessed);
  renderCategoryChart(currentProcessed);
  renderA1cChart(currentProcessed);
  refreshCurrentView();
  if (currentProcessed.length > 0) renderPatientDetail(currentProcessed[0]);
}

function refreshCurrentView() {
  const rows = currentView === "high"
    ? currentProcessed.filter(r => r.category === "Urgent review" || r.category === "Closer follow-up")
    : currentProcessed;

  document.getElementById("tableStatus").textContent =
    currentView === "high" ? "Showing urgent + closer follow-up patients" : "Showing all patients";

  renderTable(rows);
  if (rows.length > 0) renderPatientDetail(rows[0]);
}

function renderSummary(rows) {
  const urgent = rows.filter(r => r.category === "Urgent review").length;
  const close = rows.filter(r => r.category === "Closer follow-up").length;
  const tech = rows.filter(r => r.category === "Technology gap").length;
  const screen = rows.filter(r => r.category === "Screening gap").length;
  const routine = rows.filter(r => r.category === "Routine follow-up").length;
  const avgA1c = average(rows.map(r => r.last_a1c));
  const overdue = rows.filter(r => r.days_since_last_visit > 120).length;

  document.getElementById("summary").innerHTML = `
    <div class="summary-box">
      <h4>Urgent Review</h4>
      <div class="big-number">${urgent}</div>
      <div>${pct(urgent, rows.length)} of current panel</div>
    </div>
    <div class="summary-box">
      <h4>Closer Follow-Up</h4>
      <div class="big-number">${close}</div>
      <div>${pct(close, rows.length)} of current panel</div>
    </div>
    <div class="summary-box">
      <h4>Technology or Screening Gaps</h4>
      <div class="big-number">${tech + screen}</div>
      <div>${tech} technology, ${screen} screening</div>
    </div>
    <div class="summary-box">
      <h4>Average Current A1c</h4>
      <div class="big-number">${avgA1c.toFixed(2)}</div>
      <div>${overdue} patients >120 days since visit</div>
    </div>
  `;
}

function renderTable(rows) {
  const tbody = document.querySelector("#resultsTable tbody");
  tbody.innerHTML = "";

  rows.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(row.patient_id)}</strong><br>
        <span style="color:#5a6b85;">${escapeHtml(row.diabetes_type || "Diabetes panel")}</span>
      </td>
      <td><span class="category-pill ${row.categoryClass}">${escapeHtml(row.category)}</span></td>
      <td><span class="priority-number">${row.priorityScore}</span></td>
      <td>${row.last_a1c.toFixed(1)}</td>
      <td>${signed(row.a1cChange)}</td>
      <td>${row.days_since_last_visit}</td>
      <td>${row.cgm_use ? "Yes" : "No"}</td>
      <td>${renderGapList(row.keyGaps)}</td>
      <td>
        <div class="action-text">${escapeHtml(row.action)}</div>
        <button class="row-button" data-id="${escapeHtml(row.patient_id)}">View Detail</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".row-button").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const patient = currentProcessed.find(r => r.patient_id === id);
      if (patient) {
        renderPatientDetail(patient);
        document.getElementById("detailSection").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function renderGapList(gaps) {
  return `<ul class="key-gap-list">${gaps.map(g => `<li>${escapeHtml(g)}</li>`).join("")}</ul>`;
}

function renderPatientDetail(patient) {
  const section = document.getElementById("detailSection");
  section.classList.remove("hidden");
  document.getElementById("detailSubtitle").textContent = `${patient.patient_id} • ${patient.category}`;
  document.getElementById("detailContent").innerHTML = `
    <div class="metric-card">
      <div class="label">Current A1c</div>
      <div class="value">${patient.last_a1c.toFixed(1)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Previous A1c</div>
      <div class="value">${patient.prev_a1c.toFixed(1)}</div>
    </div>
    <div class="metric-card">
      <div class="label">A1c Change</div>
      <div class="value">${signed(patient.a1cChange)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Days Since Last Visit</div>
      <div class="value">${patient.days_since_last_visit}</div>
    </div>
    <div class="metric-card">
      <div class="label">Missed Visits</div>
      <div class="value">${patient.missed_visits}</div>
    </div>
    <div class="metric-card">
      <div class="label">CGM Use</div>
      <div class="value">${patient.cgm_use ? "Yes" : "No"}</div>
    </div>
    <div class="metric-card">
      <div class="label">Time in Range</div>
      <div class="value">${patient.time_in_range ? patient.time_in_range + "%" : "Not available"}</div>
    </div>
    <div class="metric-card">
      <div class="label">Overdue Screening</div>
      <div class="value">${screeningLabel(patient)}</div>
    </div>
  `;
  document.getElementById("detailInterpretation").textContent =
    patient.rationale.join(" ") + " Suggested action: " + patient.action;
  drawPatientTrendChart(patient);
}

function screeningLabel(patient) {
  const gaps = [];
  if (patient.last_eye_exam_days > 365) gaps.push("Eye");
  if (patient.last_kidney_screen_days > 365) gaps.push("Kidney");
  return gaps.length ? gaps.join(" + ") : "No major gap";
}

function renderCategoryChart(rows) {
  const canvas = document.getElementById("categoryChart");
  const ctx = canvas.getContext("2d");
  clearCanvas(ctx, canvas);

  const labels = ["Urgent", "Close", "Tech", "Screen", "Routine"];
  const values = [
    rows.filter(r => r.category === "Urgent review").length,
    rows.filter(r => r.category === "Closer follow-up").length,
    rows.filter(r => r.category === "Technology gap").length,
    rows.filter(r => r.category === "Screening gap").length,
    rows.filter(r => r.category === "Routine follow-up").length
  ];
  const colors = ["#AB0520", "#d99000", "#0C4A9A", "#5a34a8", "#2f7d4b"];
  drawBarChart(ctx, canvas, labels, values, colors, "Patients");
}

function renderA1cChart(rows) {
  const canvas = document.getElementById("a1cChart");
  const ctx = canvas.getContext("2d");
  clearCanvas(ctx, canvas);

  const groups = [
    { label: "Urgent", filter: "Urgent review" },
    { label: "Close", filter: "Closer follow-up" },
    { label: "Tech", filter: "Technology gap" },
    { label: "Screen", filter: "Screening gap" },
    { label: "Routine", filter: "Routine follow-up" }
  ];
  const labels = groups.map(g => g.label);
  const values = groups.map(g => +average(rows.filter(r => r.category === g.filter).map(r => r.last_a1c)).toFixed(2));
  const colors = ["#AB0520", "#d99000", "#0C4A9A", "#5a34a8", "#2f7d4b"];
  drawBarChart(ctx, canvas, labels, values, colors, "Average A1c");
}

function drawPatientTrendChart(patient) {
  const canvas = document.getElementById("patientChart");
  const ctx = canvas.getContext("2d");
  clearCanvas(ctx, canvas);

  const labels = ["Previous A1c", "Current A1c"];
  const values = [patient.prev_a1c, patient.last_a1c];
  drawLineChart(ctx, canvas, labels, values, "#AB0520");
}

function drawBarChart(ctx, canvas, labels, values, colors, yTitle) {
  const pad = { top: 20, right: 20, bottom: 45, left: 54 };
  const w = canvas.width;
  const h = canvas.height;
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const maxVal = Math.max(...values, 1);

  ctx.strokeStyle = "#cfd7e3";
  ctx.fillStyle = "#5a6b85";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH * i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    const val = (maxVal * (4 - i) / 4).toFixed(1);
    ctx.fillText(val, 8, y + 4);
  }

  labels.forEach((label, i) => {
    const slotW = chartW / labels.length;
    const barW = slotW * 0.56;
    const x = pad.left + slotW * i + (slotW - barW) / 2;
    const barH = (values[i] / maxVal) * chartH;
    const y = h - pad.bottom - barH;

    ctx.fillStyle = colors[i];
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = "#13294b";
    ctx.fillText(label, x, h - 18);
    if (Number.isFinite(values[i])) ctx.fillText(String(values[i]), x + barW / 5, y - 6);
  });

  ctx.save();
  ctx.translate(14, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#13294b";
  ctx.fillText(yTitle, 0, 0);
  ctx.restore();
}

function drawLineChart(ctx, canvas, labels, values, color) {
  const pad = { top: 20, right: 30, bottom: 45, left: 54 };
  const w = canvas.width;
  const h = canvas.height;
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = Math.max(maxVal - minVal, 1);

  ctx.strokeStyle = "#cfd7e3";
  ctx.fillStyle = "#5a6b85";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH * i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    const val = (maxVal - (range * i / 4)).toFixed(1);
    ctx.fillText(val, 8, y + 4);
  }

  const points = values.map((v, i) => {
    const x = pad.left + (chartW / (values.length - 1 || 1)) * i;
    const y = pad.top + ((maxVal - v) / range) * chartH;
    return { x, y, v };
  });

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  points.forEach((p, i) => {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#13294b";
    ctx.fillText(labels[i], p.x - 34, h - 18);
    ctx.fillText(p.v.toFixed(1), p.x - 10, p.y - 10);
  });
}

function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "14px Arial";
}

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function pct(part, whole) {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

function signed(n) {
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadAnalyzedCSV() {
  if (!currentProcessed.length) {
    alert("Load demo data or upload a CSV first.");
    return;
  }
  const headers = [
    "patient_id","diabetes_type","last_a1c","prev_a1c","bmi","prev_bmi",
    "days_since_last_visit","missed_visits","cgm_use","time_in_range","gmi",
    "last_eye_exam_days","last_kidney_screen_days","a1c_change","priority_score",
    "category","action","key_gaps"
  ];
  const lines = [headers.join(",")];
  currentProcessed.forEach(r => {
    const row = [
      r.patient_id, r.diabetes_type, r.last_a1c, r.prev_a1c, r.bmi, r.prev_bmi,
      r.days_since_last_visit, r.missed_visits, r.cgm_use ? "Yes" : "No", r.time_in_range, r.gmi,
      r.last_eye_exam_days, r.last_kidney_screen_days, r.a1cChange, r.priorityScore,
      `"${r.category.replaceAll('"', '""')}"`,
      `"${r.action.replaceAll('"', '""')}"`,
      `"${r.keyGaps.join("; ").replaceAll('"', '""')}"`
    ];
    lines.push(row.join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clinical_endocrine_panel_analyzed.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

loadDemo();
