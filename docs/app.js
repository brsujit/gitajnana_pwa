// ========= CONFIG ===========
const SHEET_URL = "https://script.google.com/macros/s/YOUR_DEPLOYED_SCRIPT_ID/exec";

// ========= GLOBAL ===========
let allData = [];

// ========= AUTO NUMBERS ===========
function getNextSerialNumber() {
  if (!allData || allData.length === 0) return 1;
  const nums = allData.map(r => Number(r["SL NO"] || 0)).filter(n => !isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}
function getCurrentYear() {
  return new Date().getFullYear();
}

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

    // update auto fields
    document.getElementById("slno").value = getNextSerialNumber();
    document.getElementById("year").value = getCurrentYear();
  } catch (err) {
    console.error(err);
    table.innerHTML = "<tr><td>Error loading data</td></tr>";
  }
}

// ========= ADD RECORD ===========
document.getElementById("dataForm").addEventListener("submit", async e => {
  e.preventDefault();
  const record = Object.fromEntries(new FormData(e.target).entries());
  record["SL NO"] = getNextSerialNumber();
  record["YEAR OF COMPETITION"] = getCurrentYear();

  try {
    await fetch(SHEET_URL, {
      method: "POST",
      body: JSON.stringify({ action: "add", record }),
      headers: { "Content-Type": "application/json" }
    });
    alert(`Record #${record["SL NO"]} added successfully!`);
    e.target.reset();
    loadData();
  } catch (err) {
    console.error(err);
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
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      alert("Could not load data for PDF!");
      return;
    }

    if (!data.length) {
      alert("No data available!");
      return;
    }

    data = data.map(row => {
      const cleaned = {};
      for (const key in row) {
        const cleanKey = key.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
        cleaned[cleanKey] = row[key];
      }
      return cleaned;
    });

    const districts = {};
    data.forEach(row => {
      const district = row["DISTRICT"]?.trim() || "Unknown";
      if (!districts[district]) districts[district] = [];
      districts[district].push(row);
    });

    const sortedDistricts = Object.keys(districts).sort((a, b) => a.localeCompare(b));
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Gitajnana Examination – District-wise Participants Report", 14, 15);
    doc.setFontSize(10);

    let y = 25;
    let totalA = 0, totalB = 0, totalC = 0, totalD = 0, totalParticipants = 0;

    for (const district of sortedDistricts) {
      const rows = districts[district];
      rows.sort((a, b) => (a["BLOCK"] || "").localeCompare(b["BLOCK"] || ""));
      doc.setFont(undefined, "bold");
      doc.text(`District: ${district}`, 14, y);
      doc.setFont(undefined, "normal");
      y += 5;

      const headers = ["District","Block","Place","Date of Competition","GROUP A","GROUP B","GROUP C","GROUP D","TOTAL NO OF PARTICIPANTS","District Total"];
      const tableBody = rows.map((r, i) => {
        totalA += Number(r["GROUP A"] || 0);
        totalB += Number(r["GROUP B"] || 0);
        totalC += Number(r["GROUP C"] || 0);
        totalD += Number(r["GROUP D"] || 0);
        totalParticipants += Number(r["TOTAL NO OF PARTICIPANTS"] || 0);
        return [
          i === 0 ? (r["DISTRICT"] || "") : "",
          r["BLOCK"] || "",
          r["PLACE"] || "",
          r["DATE OF COMPETITION"] ? new Date(r["DATE OF COMPETITION"]).toLocaleDateString() : "",
          r["GROUP A"] || "",
          r["GROUP B"] || "",
          r["GROUP C"] || "",
          r["GROUP D"] || "",
          r["TOTAL NO OF PARTICIPANTS"] || "",
          ""
        ];
      });

      const total = rows.reduce((sum, r) => sum + Number(r["TOTAL NO OF PARTICIPANTS"] || 0), 0);
      tableBody.push(["", "", "", "", "", "", "", "", "District Total", total.toString()]);
      doc.autoTable({
        startY: y,
        head: [headers],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 8, halign: "center" },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
        pageBreak: "avoid"
      });
      y = doc.lastAutoTable.finalY + 10;
      if (y > 180) {
        doc.addPage();
        y = 25;
      }
    }

    doc.addPage();
    doc.setFontSize(14);
    doc.text("STATE SUMMARY", 130, 20);
    doc.autoTable({
      startY: 30,
      head: [["Description", "Total"]],
      body: [
        ["Total Districts", sortedDistricts.length],
        ["Group A Total", totalA],
        ["Group B Total", totalB],
        ["Group C Total", totalC],
        ["Group D Total", totalD],
        ["Total Participants", totalParticipants]
      ],
      theme: "grid",
      styles: { fontSize: 10, halign: "center" },
      headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold" }
    });

    doc.save("Gitajnana_District_Report.pdf");
  } catch (err) {
    console.error(err);
    alert("Failed to generate PDF!");
  }
});

// ========= INIT ===========
window.addEventListener("load", loadData);
