// ========= CONFIG ===========
const SHEET_URL = "https://script.google.com/macros/s/AKfycbxHbrU0nPhyEcOBqQNXLCHs15m3TZrYWE9eCei0GTgUDLVzu2iD1U0MVfQvpS2L5yAF5w/exec"; 

window.addEventListener("DOMContentLoaded", () => {
  // All your button event listeners go here
  document.getElementById("importBtn").addEventListener("click", importCSV);
  document.getElementById("exportBtn").addEventListener("click", exportCSV);
  document.getElementById("pdfBtn").addEventListener("click", generatePDF);
  document.getElementById("dataForm").addEventListener("submit", addRecord);
});

// ========= GLOBAL ===========
let allData = [];

// ========= LOAD & DISPLAY ===========
async function loadData() {
  const table = document.getElementById("dataTable");
  table.innerHTML = "<tr><td>Loading...</td></tr>";

  try {
    const res = await fetch(SHEET_URL);
    allData = await res.json();

    if (!allData.length) {
      table.innerHTML = "<tr><td>No data found</td></tr>";
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
document.getElementById("dataForm").addEventListener("submit", async e => {
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
    alert("Error adding record");
  }
});

// ========= EXPORT CSV ===========
document.getElementById("exportBtn").addEventListener("click", async () => {
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
  } catch {
    alert("Export failed!");
  }
});

// ========= IMPORT CSV ===========
document.getElementById("importBtn").addEventListener("click", () => {
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
});

// ========= PDF REPORT ===========
document.getElementById("pdfBtn").addEventListener("click", async () => {
  try {
    const res = await fetch(SHEET_URL);
    const data = await res.json();
    if (!data.length) return alert("No data available!");

    // Group by District
    const districts = {};
    data.forEach(r => {
      const d = r["District"] || "Unknown";
      if (!districts[d]) districts[d] = [];
      districts[d].push(r);
    });

    // Create PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Gitajnana Examination – District-wise Participants Report", 14, 15);
    doc.setFontSize(11);

    let y = 25;
    for (const [district, rows] of Object.entries(districts)) {
      doc.setFont(undefined, "bold");
      doc.text(`District: ${district}`, 14, y);
      doc.setFont(undefined, "normal");
      y += 5;

      // Column order for PDF
      const headers = [
        "District",
        "Place",
        "Date of Competition",
        "GROUP A",
        "GROUP B",
        "GROUP C",
        "GROUP D",
        "TOTAL NO OF PARTICIPANTS",
        "District Total"
      ];

      // Prepare rows with District Total blank first
      const tableBody = rows.map(r => {
        return [
          r["District"] || "",
          r["Place"] || "",
          r["Date of Competition"] || "",
          r["GROUP A"] || "",
          r["GROUP B"] || "",
          r["GROUP C"] || "",
          r["GROUP D"] || "",
          r["TOTAL NO OF PARTICIPANTS"] || "",
          ""
        ];
      });

      // Compute total participants per district
      const total = rows.reduce(
        (sum, r) => sum + Number(r["TOTAL NO OF PARTICIPANTS"] || 0),
        0
      );

      // Add total row
      tableBody.push([
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "District Total",
        total.toString()
      ]);

      doc.autoTable({
        startY: y,
        head: [headers],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 8, halign: "center" },
        headStyles: { fillColor: [220, 220, 220] },
        didDrawPage: data => {
          y = data.cursor.y + 15;
        }
      });

      if (y > 180) {
        doc.addPage();
        y = 25;
      } else {
        y += 10;
      }
    }

    doc.save("Gitajnana_District_Report.pdf");
  } catch (err) {
    console.error(err);
    alert("Failed to generate PDF!");
  }
});

// ========= INIT ===========
window.addEventListener("load", loadData);
