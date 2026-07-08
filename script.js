const sampleDevices = [
  { ip: "192.168.1.10", expected: "A-204" },
  { ip: "192.168.1.11", expected: "B-110" },
  { ip: "192.168.1.12", expected: "C-018" },
  { ip: "192.168.1.13", expected: "D-410" },
  { ip: "192.168.1.14", expected: "E-022" }
];

const state = {
  devices: [],
  log: [],
  running: false,
  processed: 0
};

const els = {
  file: document.querySelector("#excelFile"),
  fileName: document.querySelector("#fileName"),
  startBtn: document.querySelector("#startBtn"),
  reportBtn: document.querySelector("#reportBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  sampleBtn: document.querySelector("#sampleBtn"),
  rows: document.querySelector("#deviceRows"),
  log: document.querySelector("#logOutput"),
  downloadLogBtn: document.querySelector("#downloadLogBtn"),
  progressLabel: document.querySelector("#progressLabel"),
  progressCount: document.querySelector("#progressCount"),
  progressBar: document.querySelector("#progressBar"),
  totalCount: document.querySelector("#totalCount"),
  savedCount: document.querySelector("#savedCount"),
  mismatchCount: document.querySelector("#mismatchCount"),
  failedCount: document.querySelector("#failedCount")
};

function normalizeDevice(row) {
  const ip = row["IP Address"] || row.IP || row.ip || row["IP"] || "";
  const expected = row["Shelf ID"] || row.ShelfID || row.shelf_id || row["ShelfID"] || "";
  return {
    ip: String(ip).trim(),
    expected: String(expected).trim(),
    received: "",
    status: "Ожидает",
    statusKind: "pending",
    comment: "Готов к обработке"
  };
}

function loadDevices(devices, sourceName) {
  state.devices = devices
    .map((device) => ({
      ip: device.ip,
      expected: device.expected,
      received: device.received || "",
      status: device.status || "Ожидает",
      statusKind: device.statusKind || "pending",
      comment: device.comment || "Готов к обработке"
    }))
    .filter((device) => device.ip && device.expected);

  state.log = [];
  state.processed = 0;
  els.fileName.textContent = sourceName || "Excel загружен";
  addLog(`Файл загружен. Найдено устройств: ${state.devices.length}`);
  updateUi();
}

async function parseWorkbook(file) {
  if (!window.XLSX) {
    throw new Error("Библиотека XLSX не загрузилась. Проверьте интернет и обновите страницу.");
  }

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet).map(normalizeDevice);
}

function renderRows() {
  if (!state.devices.length) {
    els.rows.innerHTML = '<tr class="empty-row"><td colspan="5">Загрузите Excel или откройте пример данных.</td></tr>';
    return;
  }

  els.rows.innerHTML = state.devices
    .map((device) => `
      <tr>
        <td>${escapeHtml(device.ip)}</td>
        <td>${escapeHtml(device.expected)}</td>
        <td>${escapeHtml(device.received || "-")}</td>
        <td><span class="status ${device.statusKind}">${escapeHtml(device.status)}</span></td>
        <td>${escapeHtml(device.comment)}</td>
      </tr>
    `)
    .join("");
}

function updateUi() {
  const total = state.devices.length;
  const saved = state.devices.filter((device) => device.status === "Конфигурация сохранена").length;
  const mismatch = state.devices.filter((device) => device.status === "Shelf ID не соответствует").length;
  const failed = state.devices.filter((device) =>
    ["Нет доступа (Telnet)", "Недоступен (Ping)", "Ошибка выполнения"].includes(device.status)
  ).length;

  els.totalCount.textContent = total;
  els.savedCount.textContent = saved;
  els.mismatchCount.textContent = mismatch;
  els.failedCount.textContent = failed;
  els.startBtn.disabled = !total || state.running;
  els.reportBtn.disabled = !state.devices.some((device) => device.status !== "Ожидает");
  els.downloadLogBtn.disabled = !state.log.length;
  els.progressCount.textContent = `${state.processed} / ${total}`;
  els.progressLabel.textContent = state.running ? "Обработка..." : total ? "Готово к запуску" : "Ожидание файла";
  els.progressBar.style.width = total ? `${Math.round((state.processed / total) * 100)}%` : "0%";
  els.log.textContent = state.log.length ? state.log.join("\n") : "Ожидание запуска...";
  renderRows();
}

function addLog(message) {
  const time = new Date().toLocaleTimeString("ru-RU", { hour12: false });
  state.log.push(`${time} ${message}`);
  els.log.textContent = state.log.join("\n");
  els.log.scrollTop = els.log.scrollHeight;
}

function simulateDevice(device, index) {
  const lastNumber = Number(device.ip.split(".").pop()) || index;
  addLog(`[${device.ip}] ping`);

  if (lastNumber % 7 === 0) {
    return {
      received: "",
      status: "Недоступен (Ping)",
      statusKind: "error",
      comment: "Устройство не отвечает на ping"
    };
  }

  addLog(`[${device.ip}] telnet connect :23`);

  if (lastNumber % 5 === 0) {
    return {
      received: "",
      status: "Нет доступа (Telnet)",
      statusKind: "error",
      comment: "Авторизация не выполнена после 3 попыток"
    };
  }

  const shouldMatch = lastNumber % 3 !== 0;
  const received = shouldMatch ? device.expected : `${device.expected}-X`;
  addLog(`[${device.ip}] show shelf-id -> ${received}`);

  if (received === device.expected) {
    addLog(`[${device.ip}] save conf`);
    addLog(`[${device.ip}] logout -> Y`);
    return {
      received,
      status: "Конфигурация сохранена",
      statusKind: "success",
      comment: "Shelf ID совпадает"
    };
  }

  addLog(`[${device.ip}] save conf skipped`);
  addLog(`[${device.ip}] logout -> N`);
  return {
    received,
    status: "Shelf ID не соответствует",
    statusKind: "warning",
    comment: "Конфигурация НЕ сохранена"
  };
}

async function runProcessing() {
  if (!state.devices.length || state.running) return;

  state.running = true;
  state.processed = 0;
  state.log = [];
  state.devices = state.devices.map((device) => ({
    ...device,
    received: "",
    status: "Ожидает",
    statusKind: "pending",
    comment: "В очереди"
  }));
  updateUi();

  for (let index = 0; index < state.devices.length; index += 1) {
    const device = state.devices[index];
    addLog(`[${device.ip}] start`);
    await wait(420);
    const result = simulateDevice(device, index + 1);
    Object.assign(device, result);
    state.processed = index + 1;
    updateUi();
  }

  state.running = false;
  addLog("Обработка завершена. report.xlsx готов к скачиванию.");
  updateUi();
}

function downloadReport() {
  const rows = state.devices.map((device) => ({
    IP: device.ip,
    "Shelf ID (ожидаемый)": device.expected,
    "Shelf ID (полученный)": device.received,
    "Статус": device.status,
    "Комментарий": device.comment
  }));

  if (window.XLSX) {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "report");
    XLSX.writeFile(workbook, "report.xlsx");
    return;
  }

  const csv = toCsv(rows);
  downloadBlob(csv, "report.csv", "text/csv;charset=utf-8");
}

function downloadLog() {
  downloadBlob(state.log.join("\n"), "save_conf.log", "text/plain;charset=utf-8");
}

function resetAll() {
  state.devices = [];
  state.log = [];
  state.running = false;
  state.processed = 0;
  els.file.value = "";
  els.fileName.textContent = "Выберите Excel-файл";
  updateUi();
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] || {});
  const lines = rows.map((row) => headers.map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`).join(","));
  return [headers.join(","), ...lines].join("\n");
}

function downloadBlob(content, name, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

els.file.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    els.fileName.textContent = "Чтение файла...";
    const devices = await parseWorkbook(file);
    loadDevices(devices, file.name);
  } catch (error) {
    addLog(`Ошибка чтения файла: ${error.message}`);
    els.fileName.textContent = "Файл не прочитан";
    updateUi();
  }
});

els.sampleBtn.addEventListener("click", () => loadDevices(sampleDevices, "Пример данных"));
els.startBtn.addEventListener("click", runProcessing);
els.reportBtn.addEventListener("click", downloadReport);
els.downloadLogBtn.addEventListener("click", downloadLog);
els.resetBtn.addEventListener("click", resetAll);

updateUi();
