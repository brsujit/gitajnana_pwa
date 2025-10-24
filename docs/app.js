// ========= CONFIG ===========
const SHEET_URL = "https://script.google.com/macros/s/AKfycbxyz12345/exec";  // Replace this

// ========= FETCH & DISPLAY ===========
async function loadData() {
  const tableBody = document.getElementById("dataBody");
  tableBody.innerHTML = "<tr><td colspan='17'>Loading...</td></tr>";

  try {
    const response = await fetch(https://script.google.com/macros/s/AKfycbxkQ-vrh9OwG3Q825tev19dWr0wBklm31unoWZ6npxxzOu0R1JIITsra68o7VO8pIK0/exec);
    const data = await response.json();

    tableBody.innerHTML = "";
    data.forEach((row) => {
      const tr = document.createElement("tr");
      Object.values(row).forEach((val) => {
        const td = document.createElement("td");
        td.textContent = val;
        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tableBody.innerHTML = "<tr><td colspan='17'>Error loading data</td></tr>";
  }
}

// ========= ADD RECORD ===========
async function addRecord(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const jsonData = {};

  formData.forEach((value, key) => {
    jsonData[key] = value;
  });

  try {
    const res = await fetch(SHEET_URL, {
      method: "POST",
      body: JSON.stringify(jsonData),
    });
    alert("Record added!");
    form.reset();
    loadData();
  } catch (err) {
    console.error(err);
    alert("Error adding record");
  }
}

// ========= EXPORT CSV ===========
async function exportCSV() {
  try {
    const res = await fetch(SHEET_URL);
    const data = await res.json();

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(",")];

    for (const row of data) {
      csvRows.push(headers.map((h) => `"${row[h] || ""}"`).join(","));
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Gitajnana_Data.csv";
    a.click();
  } catch (err) {
    alert("Error exporting CSV");
  }
}

// ========= IMPORT CSV ===========
function importCSV() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".csv";
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    const text = await file.text();
    const rows = text.split("\n").map((r) => r.split(","));
    const headers = rows[0];
    const dataRows = rows.slice(1);

    for (const r of dataRows) {
      if (r.length < 3) continue; // skip empty rows
      const record = {};
      headers.forEach((h, i) => (record[h.trim()] = r[i]?.trim() || ""));
      await fetch(SHEET_URL, {
        method: "POST",
        body: JSON.stringify(record),
      });
    }
    alert("CSV data imported successfully!");
    loadData();
  };
  fileInput.click();
}

// ========= INIT ===========
document.getElementById("dataForm").addEventListener("submit", addRecord);
document.getElementById("exportBtn").addEventListener("click", exportCSV);
document.getElementById("importBtn").addEventListener("click", importCSV);

window.onload = loadData;
