document.getElementById('fileInput').addEventListener('change', handleFile);

function handleFile(event) {
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    const text = e.target.result;
    const rows = text.split("\n").map(r => r.split(","));

    const headers = rows[0];
    const data = rows.slice(1);

    processData(headers, data);
  };

  reader.readAsText(file);
}

function processData(headers, data) {
  const tbody = document.querySelector("#resultsTable tbody");
  tbody.innerHTML = "";

  data.forEach(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h.trim()] = row[i]);

    let a1cChange = obj.last_a1c - obj.prev_a1c;
    let bmiChange = obj.bmi - obj.prev_bmi;
    let missed = parseInt(obj.missed_visits || 0);

    let score = (a1cChange * 2) + (bmiChange * 1) + (missed * 1.5);

    let status = "Low";
    if (score > 3) status = "High";
    else if (score > 1.5) status = "Medium";

    let reason = [];
    if (a1cChange > 0) reason.push("A1c ↑");
    if (bmiChange > 0) reason.push("BMI ↑");
    if (missed > 0) reason.push("Missed visits");

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${obj.patient_id}</td>
      <td>${score.toFixed(2)}</td>
      <td class="${status.toLowerCase()}">${status}</td>
      <td>${reason.join(", ")}</td>
    `;

    tbody.appendChild(tr);
  });
}
