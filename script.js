const fileInput = document.getElementById('fileInput');
const demoBtn = document.getElementById('demoBtn');
const downloadBtn = document.getElementById('downloadBtn');

let currentProcessed = [];
let patientChartRef = null;

fileInput.addEventListener('change', handleFile);
demoBtn.addEventListener('click', loadDemo);
downloadBtn.addEventListener('click', downloadAnalyzedCSV);

function loadDemo() {
  const demoRows = [
    { patient_id: "1001", last_a1c: 9.2, prev_a1c: 8.1, bmi: 27.0, prev_bmi: 25.0, missed_visits: 2 },
    { patient_id: "1002", last_a1c: 7.5, prev_a1c: 7.6, bmi: 24.0, prev_bmi: 24.0, missed_visits: 0 },
    { patient_id: "1003", last_a1c: 10.1, prev_a1c: 9.0, bmi: 30.0, prev_bmi: 28.0, missed_visits: 3 },
    { patient_id: "1004", last_a1c: 8.0, prev_a1c: 8.4, bmi: 26.0, prev_bmi: 25.8, missed_visits: 1 },
    { patient_id: "1005", last_a1c: 11.0, prev_a1c: 9.9, bmi: 34.0, prev_bmi: 31.5, missed_visits: 2 },
    { patient_id: "1006", last_a1c: 6.9, prev_a1c: 7.2, bmi: 22.0, prev_bmi: 22.1, missed_visits: 0 }
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

function computePatient(obj) {
  const patient_id = obj.patient_id ?? obj.Patient ?? obj.id ?? "";
  const last_a1c = toNum(obj.last_a1c);
  const prev_a1c = toNum(obj.prev_a1c);
  const bmi = toNum(obj.bmi);
  const prev_bmi = toNum(obj.prev_bmi);
  const missed_visits = toNum(obj.missed_visits);

  const a1cChange = +(last_a1c - prev_a1c).toFixed(2);
  const bmiChange = +(bmi - prev_bmi).toFixed(2);
  const riskScore = +((a1cChange * 2) + (bmiChange * 1) + (missed_visits * 1.5)).toFixed(2);

  let status = "Low";
  if (riskScore > 3) status = "High";
  else if (riskScore > 1.5) status = "Medium";

  const reasons = [];
  if (a1cChange > 0) reasons.push("A1c increasing");
  if (bmiChange > 0) reasons.push("BMI increasing");
  if (missed_visits > 0) reasons.push("Missed follow-up visits");
  if (reasons.length === 0) reasons.push("Stable recent trend");

  return {
    patient_id,
    last_a1c,
    prev_a1c,
    bmi,
    prev_bmi,
    missed_visits,
    a1cChange,
    bmiChange,
    riskScore,
    status,
    reason: reasons.join(", ")
  };
}

function processData(rawRows) {
  currentProcessed = rawRows.map(computePatient).sort((a, b) => b.riskScore - a.riskScore);
  renderSummary(currentProcessed);
  renderTable(currentProcessed);
  renderRiskChart(currentProcessed);
  renderA1cChart(currentProcessed);
  if (currentProcessed.length > 0) {
    renderPatientDetail(currentProcessed[0]);
  }
}

function renderSummary(rows) {
  const high = rows.filter(r => r.status === "High");
  const medium = rows.filter(r => r.status === "Medium");
  const low = rows.filter(r => r.status === "Low");

  const avgA1cChange = average(rows.map(r => r.a1cChange));
  const avgRisk = average(rows.map(r => r.riskScore));
  const totalMissed = rows.reduce((sum, r) => sum + r.missed_visits, 0);
  const highest = rows.length ? rows[0].patient_id : "N/A";

  document.getElementById("summary").innerHTML = `
    <div class="summary-box">
      <h4>High-Risk Patients</h4>
      <div class="big-number">${high.length}</div>
      <div>${pct(high.length, rows.length)} of active panel</div>
    </div>
    <div class="summary-box">
      <h4>Average A1c Change</h4>
      <div class="big-number">${avgA1cChange.toFixed(2)}</div>
      <div>Across uploaded panel</div>
    </div>
    <div class="summary-box">
      <h4>Total Missed Visits</h4>
      <div class="big-number">${totalMissed}</div>
      <div>Potential adherence burden</div>
    </div>
    <div class="summary-box">
      <h4>Highest Flagged Patient</h4>
      <div class="big-number">${highest}</div>
      <div>Average risk score ${avgRisk.toFixed(2)}</div>
    </div>
  `;
}

function renderTable(rows) {
  const tbody = document.querySelector("#resultsTable tbody");
  tbody.innerHTML = "";

  rows.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.patient_id)}</td>
      <td>${r.riskScore.toFixed(2)}</td>
      <td><span class="status-pill ${r.status.toLowerCase()}">${r.status}</span></td>
      <td>${signed(r.a1cChange)}</td>
      <td>${signed(r.bmiChange)}</td>
      <td>${r.missed_visits}</td>
      <td>
        ${escapeHtml(r.reason)}
        <div style="margin-top:8px;">
          <button class="row-button" data-index="${idx}">View Detail</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".row-button").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      renderPatientDetail(currentProcessed[idx]);
      document.getElementById("detailSection").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderPatientDetail(patient) {
  const section = document.getElementById("detailSection");
  section.classList.remove("hidden");
  document.getElementById("detailSubtitle").textContent = `Patient ${patient.patient_id} • ${patient.status} risk`;

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
      <div class="label">Current BMI</div>
      <div class="value">${patient.bmi.toFixed(1)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Missed Visits</div>
      <div class="value">${patient.missed_visits}</div>
    </div>
    <div class="metric-card">
      <div class="label">A1c Change</div>
      <div class="value">${signed(patient.a1cChange)}</div>
    </div>
    <div class="metric-card">
      <div class="label">BMI Change</div>
      <div class="value">${signed(patient.bmiChange)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Risk Score</div>
      <div class="value">${patient.riskScore.toFixed(2)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Flag Reason</div>
      <div class="value" style="font-size:1rem;font-weight:700;">${escapeHtml(patient.reason)}</div>
    </div>
  `;

  drawPatientTrendChart(patient);
}

function renderRiskChart(rows) {
  const canvas = document.getElementById("riskChart");
  const ctx = canvas.getContext("2d");
  clearCanvas(ctx, canvas);

  const counts = {
    High: rows.filter(r => r.status === "High").length,
    Medium: rows.filter(r => r.status === "Medium").length,
    Low: rows.filter(r => r.status === "Low").length
  };

  const labels = ["High", "Medium", "Low"];
  const values = labels.map(l => counts[l]);
  const colors = ["#AB0520", "#d99000", "#2f7d4b"];

  drawBarChart(ctx, canvas, labels, values, colors, "Patient Count");
}

function renderA1cChart(rows) {
  const canvas = document.getElementById("a1cChart");
  const ctx = canvas.getContext("2d");
  clearCanvas(ctx, canvas);

  const tiers = ["High", "Medium", "Low"];
  const vals = tiers.map(t => average(rows.filter(r => r.status === t).map(r => r.a1cChange)));
  const colors = ["#AB0520", "#d99000", "#2f7d4b"];

  drawBarChart(ctx, canvas, tiers, vals.map(v => +v.toFixed(2)), colors, "Average A1c Change");
}

function drawPatientTrendChart(patient) {
  const canvas = document.getElementById("patientChart");
  const ctx = canvas.getContext("2d");
  clearCanvas(ctx, canvas);

  const values = [patient.prev_a1c, patient.last_a1c];
  const labels = ["Previous A1c", "Current A1c"];
  drawLineChart(ctx, canvas, labels, values, "#AB0520");
}

function drawBarChart(ctx, canvas, labels, values, colors, yTitle) {
  const pad = { top: 20, right: 20, bottom: 45, left: 50 };
  const w = canvas.width;
  const h = canvas.height;
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const maxVal = Math.max(...values, 1);
  const barWidth = chartW / labels.length * 0.55;

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
    const x = pad.left + (chartW / labels.length) * i + ((chartW / labels.length) - barWidth) / 2;
    const barH = (values[i] / maxVal) * chartH;
    const y = h - pad.bottom - barH;
    ctx.fillStyle = colors[i];
    ctx.fillRect(x, y, barWidth, barH);
    ctx.fillStyle = "#13294b";
    ctx.fillText(label, x, h - 18);
    ctx.fillText(String(values[i]), x + barWidth / 4, y - 6);
  });

  ctx.save();
  ctx.translate(14, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#13294b";
  ctx.fillText(yTitle, 0, 0);
  ctx.restore();
}

function drawLineChart(ctx, canvas, labels, values, color) {
  const pad = { top: 20, right: 30, bottom: 45, left: 50 };
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
    ctx.fillText(labels[i], p.x - 30, h - 18);
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
    "patient_id","last_a1c","prev_a1c","bmi","prev_bmi","missed_visits",
    "a1c_change","bmi_change","risk_score","status","reason"
  ];
  const lines = [headers.join(",")];
  currentProcessed.forEach(r => {
    const row = [
      r.patient_id, r.last_a1c, r.prev_a1c, r.bmi, r.prev_bmi, r.missed_visits,
      r.a1cChange, r.bmiChange, r.riskScore, r.status, `"${r.reason.replaceAll('"', '""')}"`
    ];
    lines.push(row.join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "analyzed_endocrine_panel.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

loadDemo();
