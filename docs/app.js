// ========= CONFIG ===========
const SHEET_URL = "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent("https://script.google.com/macros/s/AKfycbybyg1IjkS-bA-uQPQB11C3ZuvxzZLhfBWwiCso4398jSJEFExMmatA6deH8zlEO42xeg/exec");

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

    // Clean up headers
    data = data.map(row => {
      const cleaned = {};
      for (const key in row) {
        const cleanKey = key.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
        cleaned[cleanKey] = row[key];
      }
      return cleaned;
    });

    // Group by District
    const districts = {};
    data.forEach(row => {
      const district = row["DISTRICT"]?.trim() || "Unknown";
      if (!districts[district]) districts[district] = [];
      districts[district].push(row);
    });

    // Sort alphabetically
    const sortedDistricts = Object.keys(districts).sort((a, b) =>
      a.localeCompare(b)
    );

    // PDF setup
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text("7TH ODISHA STATE LEVEL GEETA CHANTING COMPETITION 2025", pageWidth / 2, 15, { align: "center" });

    let y = 25;
    let totalA = 0, totalB = 0, totalC = 0, totalD = 0, totalParticipants = 0, totalPlaces = 0;

    for (const district of sortedDistricts) {
      const rows = districts[district];
      if (district === "Unknown") continue;

      rows.sort((a, b) => (a["PLACE"] || "").localeCompare(b["PLACE"] || ""));

      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      doc.text(`District: ${district}`, 14, y);
      y += 5;

      const headers = [
        "SL. NO.", "Place", "Date", "A", "B", "C", "D", "Total", "Summary"
      ];

      const tableBody = rows.map((r, i) => {
        totalA += Number(r["GROUP A"] || 0);
        totalB += Number(r["GROUP B"] || 0);
        totalC += Number(r["GROUP C"] || 0);
        totalD += Number(r["GROUP D"] || 0);
        totalParticipants += Number(r["TOTAL NO OF PARTICIPANTS"] || 0);
        totalPlaces++;

        return [
          i + 1,
          r["PLACE"] || "",
          r["DATE OF COMPETITION"]
            ? new Date(r["DATE OF COMPETITION"]).toLocaleDateString()
            : "",
          r["GROUP A"] || "",
          r["GROUP B"] || "",
          r["GROUP C"] || "",
          r["GROUP D"] || "",
          r["TOTAL NO OF PARTICIPANTS"] || "",
          ""
        ];
      });

      // District summary
      const totalDistrictA = rows.reduce((sum, r) => sum + Number(r["GROUP A"] || 0), 0);
      const totalDistrictB = rows.reduce((sum, r) => sum + Number(r["GROUP B"] || 0), 0);
      const totalDistrictC = rows.reduce((sum, r) => sum + Number(r["GROUP C"] || 0), 0);
      const totalDistrictD = rows.reduce((sum, r) => sum + Number(r["GROUP D"] || 0), 0);
      const totalDistrict = rows.reduce((sum, r) => sum + Number(r["TOTAL NO OF PARTICIPANTS"] || 0), 0);

      tableBody.push([
        "", "Summary", "", totalDistrictA, totalDistrictB, totalDistrictC, totalDistrictD, totalDistrict, ""
      ]);

      doc.autoTable({
        startY: y,
        head: [headers],
        body: tableBody,
        theme: "grid",
        margin: { left: 10, right: 10 },
        styles: { fontSize: 8, halign: "center", valign: "middle" },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: "bold"
        },
        bodyStyles: { lineColor: [200, 200, 200], lineWidth: 0.1 },
        tableWidth: "auto",
        columnStyles: {
          0: { cellWidth: 10 },  // SL. NO.
          1: { cellWidth: 30 },  // Place
          2: { cellWidth: 22 },  // Date
          3: { cellWidth: 12 },
          4: { cellWidth: 12 },
          5: { cellWidth: 12 },
          6: { cellWidth: 12 },
          7: { cellWidth: 18 },
          8: { cellWidth: 20 }
        },
        pageBreak: "auto"
      });

      y = doc.lastAutoTable.finalY + 6;
      if (y > 270) {
        doc.addPage();
        y = 25;
      }
    }

    // 🟩 State Summary
    doc.addPage();
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text("STATE SUMMARY", pageWidth / 2, 20, { align: "center" });

    const summaryData = [
      ["Total Districts", sortedDistricts.length - (districts["Unknown"] ? 1 : 0)],
      ["Total Places", totalPlaces],
      ["Total Participants", totalParticipants],
      ["Group A Total", totalA],
      ["Group B Total", totalB],
      ["Group C Total", totalC],
      ["Group D Total", totalD]
    ];

    doc.autoTable({
      startY: 30,
      head: [["Description", "Total"]],
      body: summaryData,
      theme: "grid",
      styles: { fontSize: 10, halign: "center" },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: "bold"
      },
      bodyStyles: { fontStyle: "bold" }
    });

    doc.save("Gitajnana_District_Report.pdf");
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
