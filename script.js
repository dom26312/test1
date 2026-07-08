const logExamples = {
  ping: [
    ["10:18:02", "192.168.1.10 ping OK"],
    ["10:18:03", "192.168.1.11 ping OK"],
    ["10:18:04", "192.168.1.12 ping failed"],
    ["10:18:04", "status: Недоступен (Ping)"]
  ],
  telnet: [
    ["10:18:05", "connect 192.168.1.10:23"],
    ["10:18:06", "login attempt 1"],
    ["10:18:07", "authorization success"],
    ["10:18:07", "session ready"]
  ],
  shelf: [
    ["10:18:08", "command: show shelf-id"],
    ["10:18:09", "received Shelf ID A-204"],
    ["10:18:09", "expected Shelf ID A-204"],
    ["10:18:10", "comparison: match"]
  ],
  save: [
    ["10:18:11", "command: save conf"],
    ["10:18:12", "logout"],
    ["10:18:13", "Save configuration? Y"],
    ["10:18:13", "status: Конфигурация сохранена"]
  ]
};

const terminal = document.querySelector("#terminalLog");
const steps = document.querySelectorAll(".step");

function renderLog(key) {
  terminal.innerHTML = logExamples[key]
    .map(([time, message]) => `<p><span>${time}</span> ${message}</p>`)
    .join("");
}

steps.forEach((step) => {
  step.addEventListener("click", () => {
    steps.forEach((item) => item.classList.remove("active"));
    step.classList.add("active");
    renderLog(step.dataset.log);
  });
});
