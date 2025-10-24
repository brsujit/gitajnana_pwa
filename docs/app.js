const SHEET_URL = "PASTE_YOUR_WEBAPP_URL_HERE"; // ← replace this!

async function loadData() {
  const res = await fetch(SHEET_URL);
  const data = await res.json();
  displayData(data);
}

function displayData(rows) {
  const table = document.getElementById("dataTable");
  table.innerHTML = "";
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  let html = "<tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr>";
  rows.forEach(r => {
    html += "<tr>" + headers.map(h => `<td>${r[h] ?? ""}</td>`).join("") + "</tr>";
  });
  table.innerHTML = html;
}

document.getElementById("dataForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const record = Object.fromEntries(new FormData(form).entries());
  await fetch(SHEET_URL, {
    method: "POST",
    body: JSON.stringify(record),
    headers: { "Content-Type": "application/json" },
  });
  alert("Record added!");
  form.reset();
  loadData();
});

document.getElementById("searchDistrict").addEventListener("input", async e => {
  const res = await fetch(SHEET_URL);
  const data = await res.json();
  const filtered = data.filter(r =>
    (r.DISTRICT || "").toLowerCase().includes(e.target.value.toLowerCase())
  );
  displayData(filtered);
});

window.addEventListener("load", loadData);
