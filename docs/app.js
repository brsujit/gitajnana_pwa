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

    // 🧩 Group by district and sort alphabetically
    const districts = {};
    data.forEach(row => {
      const d = row["DISTRICT"]?.trim() || "Unknown";
      if (!districts[d]) districts[d] = [];
      districts[d].push(row);
    });
    const sortedDistricts = Object.keys(districts).sort((a, b) => a.localeCompare(b));

    // 🧮 Create PDF (A4 landscape)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    // 🏷️ Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("STATE LEVEL GITA CHANTING COMPETITION REPORT", 14, 15);
    doc.setFontSize(10);
    doc.text("District-wise Participant Summary", 14, 22);

    // 🧾 Define headers
    const headers = [
      "District",
      "Block",
      "Place",
      "Date of Competition",
      "GROUP A",
      "GROUP B",
      "GROUP C",
      "GROUP D",
      "TOTAL NO OF PARTICIPANTS"
    ];

    const tableBody = [];

    // 🧮 Grand Totals
    let totalA = 0, totalB = 0, totalC = 0, totalD = 0, totalParticipants = 0;

    for (const district of sortedDistricts) {
      const rows = districts[district];
      if (district === "Unknown") continue;

      rows.sort((a, b) => (a["BLOCK"] || "").localeCompare(b["BLOCK"] || ""));

      rows.forEach((r, i) => {
        const a = Number(r["GROUP A"] || 0);
        const b = Number(r["GROUP B"] || 0);
        const c = Number(r["GROUP C"] || 0);
        const d = Number(r["GROUP D"] || 0);
        const total = Number(r["TOTAL NO OF PARTICIPANTS"] || 0);

        totalA += a;
        totalB += b;
        totalC += c;
        totalD += d;
        totalParticipants += total;

        tableBody.push([
          i === 0 ? district : "", // show district name only once
          r["BLOCK"] || "",
          r["PLACE"] || "",
          r["DATE OF COMPETITION"]
            ? new Date(r["DATE OF COMPETITION"]).toLocaleDateString()
            : "",
          a || "",
          b || "",
          c || "",
          d || "",
          total || ""
        ]);
      });
    }

    // 🟩 Add total row
    tableBody.push([
      "STATE TOTAL",
      "",
      "",
      "",
      totalA.toString(),
      totalB.toString(),
      totalC.toString(),
      totalD.toString(),
      totalParticipants.toString()
    ]);

    // 🧾 Render table (auto-fit to A4 width)
    doc.autoTable({
      startY: 28,
      head: [headers],
      body: tableBody,
      theme: "grid",
      styles: {
        fontSize: 8,
        halign: "center",
        valign: "middle",
        cellPadding: 1.5
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: "bold"
      },
      bodyStyles: {
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      },
      tableWidth: "auto",
      margin: { top: 25, left: 10, right: 10, bottom: 15 },
      didParseCell: function (data) {
        if (data.row.index === tableBody.length - 1) {
          // Highlight total row
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [245, 245, 245];
        }
      }
    });

    // 📄 Footer (page number)
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${pageCount}`, 270, 200, { align: "right" });
    }

    // 💾 Save file
    doc.save("Gitajnana_State_Report.pdf");
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
