// ========= CONFIG ===========
const SHEET_URL = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://script.google.com/macros/s/AKfycbybyg1IjkS-bA-uQPQB11C3ZuvxzZLhfBWwiCso4398jSJEFExMmatA6deH8zlEO42xeg/exec");
// ========= GLOBAL ===========
let allData = [];

// ========= LOAD & DISPLAY ===========
async function loadData() {
  const table = document.getElementById("dataTable");
  table.innerHTML = "<tr><td>Loading...</td></tr>";

  try {
    const res = await fetch(SHEET_URL);
const text = await res.text();
try {
  allData = JSON.parse(text);
} catch {
  console.error("Invalid JSON from server:", text);
  document.getElementById("dataTable").innerHTML = "<tr><td>Error loading data</td></tr>";
  return;
}


    const headers = Object.keys(allData[0]);
    let html = "<tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr>";
    allData.forEach(r => {
      html += "<tr>" + headers.map(h => `<td>${r[h] ?? ""}</td>`).join("") + "</tr>";
    });
    table.innerHTML = html;
  } catch (err) {
    console.error(err);
    table.innerHTML = "<tr><td>Error loading data</td></tr>";
  }
}

// ========= ADD RECORD ===========
async function addRecord(e) {
  e.preventDefault();
  const record = Object.fromEntries(new FormData(e.target).entries());
  try {
    await fetch(SHEET_URL, {
      method: "POST",
      body: JSON.stringify({ action: "add", record }),
      headers: { "Content-Type": "application/json" }
    });
    alert("Record added successfully!");
    e.target.reset();
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
    if (!data.length) return alert("No data to export!");

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map(r => headers.map(h => `"${r[h] || ""}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Gitajnana_Data.csv";
    a.click();
  } catch (err) {
    console.error(err);
    alert("Export failed!");
  }
}

// ========= IMPORT CSV ===========
async function importCSV() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";

  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const [headerLine, ...lines] = text.split("\n").filter(l => l.trim());
    const headers = headerLine.split(",").map(h => h.trim());

    for (const line of lines) {
      const vals = line.split(",");
      if (!vals.length) continue;
      const record = {};
      headers.forEach((h, i) => record[h] = vals[i]?.replace(/"/g, "").trim());
      await fetch(SHEET_URL, {
        method: "POST",
        body: JSON.stringify({ action: "add", record }),
        headers: { "Content-Type": "application/json" }
      });
    }

    alert("CSV imported successfully!");
    loadData();
  };

  input.click();
}

// ========= PDF REPORT ===========
document.getElementById("pdfBtn").addEventListener("click", async () => {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Invalid JSON:", text);
      alert("Could not load data for PDF!");
      return;
    }

    if (!data.length) {
      alert("No data available!");
      return;
    }

    // 🧹 Clean keys
    data = data.map(row => {
      const cleaned = {};
      for (const key in row) {
        const cleanKey = key.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
        cleaned[cleanKey] = row[key];
      }
      return cleaned;
    });

    // 🧩 Group by District
    const districts = {};
    data.forEach(row => {
      const district = row["DISTRICT"]?.trim() || "Unknown";
      if (!districts[district]) districts[district] = [];
      districts[district].push(row);
    });

    // 🧮 Sort districts alphabetically
    const sortedDistricts = Object.keys(districts).sort((a, b) =>
      a.localeCompare(b)
    );

    // Create PDF (Portrait)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // === HEADING ===
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, "bold");
    doc.text(
      "7TH ODISHA STATE LEVEL GEETA CHANTING COMPETITION 2025",
      105,
      15,
      { align: "center" }
    );

    doc.setFont(undefined, "normal");
    doc.setFontSize(10);

    // === HEADERS ===
    const headers = [
      "SL. NO.",
      "District",
      "Block",
      "Place",
      "Date",
      "A",
      "B",
      "C",
      "D",
      "Total"
    ];

    // === Totals ===
    let stateTotals = { A: 0, B: 0, C: 0, D: 0, total: 0 };
    const uniquePlaces = new Set();
    const tableBody = [];

    // === Build District Rows ===
    for (const district of sortedDistricts) {
      const rows = districts[district];
      if (district === "Unknown") continue;

      rows.sort((a, b) => (a["BLOCK"] || "").localeCompare(b["BLOCK"] || ""));

      let districtTotals = { A: 0, B: 0, C: 0, D: 0, total: 0 };

      rows.forEach((r, i) => {
        const A = Number(r["GROUP A"] || 0);
        const B = Number(r["GROUP B"] || 0);
        const C = Number(r["GROUP C"] || 0);
        const D = Number(r["GROUP D"] || 0);
        const total = Number(r["TOTAL NO OF PARTICIPANTS"] || 0);

        districtTotals.A += A;
        districtTotals.B += B;
        districtTotals.C += C;
        districtTotals.D += D;
        districtTotals.total += total;

        stateTotals.A += A;
        stateTotals.B += B;
        stateTotals.C += C;
        stateTotals.D += D;
        stateTotals.total += total;

        if (r["PLACE"]) uniquePlaces.add(r["PLACE"].trim());

        tableBody.push([
          i + 1,
          i === 0 ? district : "",
          r["BLOCK"] || "",
          r["PLACE"] || "",
          r["DATE OF COMPETITION"]
            ? new Date(r["DATE OF COMPETITION"]).toLocaleDateString("en-IN")
            : "",
          A || "",
          B || "",
          C || "",
          D || "",
          total || ""
        ]);
      });

      // District Summary Row
      tableBody.push([
        "",
        "",
        "",
        { content: "Summary", styles: { fontStyle: "bold", halign: "right" } },
        "",
        districtTotals.A.toString(),
        districtTotals.B.toString(),
        districtTotals.C.toString(),
        districtTotals.D.toString(),
        districtTotals.total.toString()
      ]);
    }

    // === State Total Row ===
    tableBody.push([
      "",
      "",
      "",
      {
        content: `STATE TOTAL (${uniquePlaces.size} Places)`,
        styles: { fontStyle: "bold", halign: "right" }
      },
      "",
      stateTotals.A.toString(),
      stateTotals.B.toString(),
      stateTotals.C.toString(),
      stateTotals.D.toString(),
      stateTotals.total.toString()
    ]);

    // === Render Table ===
    doc.autoTable({
      startY: 25,
      head: [headers],
      body: tableBody,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 1,
        halign: "center",
        valign: "middle"
      },
      headStyles: {
        fillColor: [230, 230, 230],
        textColor: [0, 0, 0],
        fontStyle: "bold"
      },
      bodyStyles: {
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      },
      margin: { top: 25, left: 8, right: 8 },
      tableWidth: "auto",
      pageBreak: "auto"
    });

    doc.save("Gitajnana_Report.pdf");
  } catch (err) {
    console.error(err);
    alert("Failed to generate PDF!");
  }
});

// ========= INIT ===========
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("importBtn").addEventListener("click", importCSV);
  document.getElementById("exportBtn").addEventListener("click", exportCSV);
  document.getElementById("pdfBtn").addEventListener("click", generatePDF);
  document.getElementById("dataForm").addEventListener("submit", addRecord);
});

window.addEventListener("load", loadData);
