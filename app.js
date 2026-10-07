const STORAGE_KEY = "rifa-baby-mirella-henry-v1";
const FILTERS = ["all", "Livre", "Reservado", "Pago"];
const PIX_CONFIG = {
  key: "42526966825",
  receiverName: "MARIA EDUARDA DA SILVA",
  receiverLabel: "Maria Eduarda Da Silva Santos",
  city: "RIO DE JANEIRO",
  description: "Rifa Baby"
};

const state = {
  ticketValue: 10,
  activeFilter: "all",
  query: "",
  selectedNumber: null,
  tickets: []
};

const els = {
  grid: document.querySelector("#grid"),
  template: document.querySelector("#ticketTemplate"),
  ticketValue: document.querySelector("#ticketValue"),
  ticketValueBadge: document.querySelector("#ticketValueBadge"),
  posterFree: document.querySelector("#posterFree"),
  posterReserved: document.querySelector("#posterReserved"),
  posterPaid: document.querySelector("#posterPaid"),
  searchInput: document.querySelector("#searchInput"),
  chips: [...document.querySelectorAll(".chip")],
  paidTotal: document.querySelector("#paidTotal"),
  paidCount: document.querySelector("#paidCount"),
  freeCount: document.querySelector("#freeCount"),
  reservedCount: document.querySelector("#reservedCount"),
  paidMetric: document.querySelector("#paidMetric"),
  goalTotal: document.querySelector("#goalTotal"),
  progressLabel: document.querySelector("#progressLabel"),
  progressBar: document.querySelector("#progressBar"),
  saveState: document.querySelector("#saveState"),
  lastUpdate: document.querySelector("#lastUpdate"),
  dialog: document.querySelector("#editorDialog"),
  editorNumber: document.querySelector("#editorNumber"),
  buyerName: document.querySelector("#buyerName"),
  buyerPhone: document.querySelector("#buyerPhone"),
  ticketStatus: document.querySelector("#ticketStatus"),
  ticketNote: document.querySelector("#ticketNote"),
  pixAmount: document.querySelector("#pixAmount"),
  pixQr: document.querySelector("#pixQr"),
  pixCopyPaste: document.querySelector("#pixCopyPaste"),
  pixReceiver: document.querySelector("#pixReceiver"),
  copyPix: document.querySelector("#copyPix"),
  copyPixKey: document.querySelector("#copyPixKey"),
  saveTicket: document.querySelector("#saveTicket"),
  clearTicket: document.querySelector("#clearTicket"),
  exportJson: document.querySelector("#exportJson"),
  exportCsv: document.querySelector("#exportCsv"),
  shareSummary: document.querySelector("#shareSummary"),
  importJson: document.querySelector("#importJson"),
  resetDemo: document.querySelector("#resetDemo")
};

function createTickets() {
  return Array.from({ length: 100 }, (_, index) => ({
    number: index + 1,
    name: "",
    phone: "",
    status: "Livre",
    note: "",
    updatedAt: null
  }));
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || !Array.isArray(saved.tickets)) {
      state.tickets = createTickets();
      return;
    }

    state.ticketValue = Number(saved.ticketValue || 10);
    state.tickets = createTickets().map((fallback) => ({
      ...fallback,
      ...(saved.tickets.find((ticket) => Number(ticket.number) === fallback.number) || {})
    }));
  } catch {
    state.tickets = createTickets();
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ticketValue: state.ticketValue,
    tickets: state.tickets,
    savedAt: new Date().toISOString()
  }));
  els.saveState.textContent = "Salvo neste aparelho";
  els.lastUpdate.textContent = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function emv(id, value) {
  const stringValue = String(value);
  return `${id}${String(stringValue.length).padStart(2, "0")}${stringValue}`;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function pixPayload(number) {
  const amount = state.ticketValue.toFixed(2);
  const txid = `RIFA${String(number).padStart(3, "0")}`;
  const merchantAccount = emv("00", "br.gov.bcb.pix")
    + emv("01", PIX_CONFIG.key)
    + emv("02", `${PIX_CONFIG.description} ${number}`);
  const additionalData = emv("05", txid);
  const payload = [
    emv("00", "01"),
    emv("26", merchantAccount),
    emv("52", "0000"),
    emv("53", "986"),
    emv("54", amount),
    emv("58", "BR"),
    emv("59", PIX_CONFIG.receiverName.slice(0, 25)),
    emv("60", PIX_CONFIG.city.slice(0, 15)),
    emv("62", additionalData)
  ].join("");
  const withCrcHeader = `${payload}6304`;
  return `${withCrcHeader}${crc16(withCrcHeader)}`;
}

function numberLabel(number) {
  return String(number);
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function filteredTickets() {
  const query = normalize(state.query);
  return state.tickets.filter((ticket) => {
    const matchesFilter = state.activeFilter === "all" || ticket.status === state.activeFilter;
    const matchesQuery = !query || [
      ticket.number,
      numberLabel(ticket.number),
      ticket.name,
      ticket.phone,
      ticket.status,
      ticket.note
    ].some((item) => normalize(item).includes(query));
    return matchesFilter && matchesQuery;
  });
}

function renderMetrics() {
  const free = state.tickets.filter((ticket) => ticket.status === "Livre").length;
  const reserved = state.tickets.filter((ticket) => ticket.status === "Reservado").length;
  const paid = state.tickets.filter((ticket) => ticket.status === "Pago").length;
  const paidTotal = paid * state.ticketValue;
  const goalTotal = state.tickets.length * state.ticketValue;
  const progress = goalTotal ? Math.round((paidTotal / goalTotal) * 100) : 0;

  els.freeCount.textContent = free;
  els.reservedCount.textContent = reserved;
  els.paidMetric.textContent = paid;
  if (els.posterFree) els.posterFree.textContent = free;
  if (els.posterReserved) els.posterReserved.textContent = reserved;
  if (els.posterPaid) els.posterPaid.textContent = paid;
  els.paidTotal.textContent = money(paidTotal);
  els.paidCount.textContent = `${paid} ${paid === 1 ? "numero pago" : "numeros pagos"}`;
  els.goalTotal.textContent = money(goalTotal);
  els.progressLabel.textContent = `${progress}%`;
  els.progressBar.style.width = `${progress}%`;
  if (els.ticketValueBadge) {
    els.ticketValueBadge.textContent = money(state.ticketValue).replace(",00", "");
  }
}

function renderGrid() {
  els.grid.replaceChildren();
  const items = filteredTickets();

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "subtitle";
    empty.textContent = "Nenhum numero encontrado para esse filtro.";
    els.grid.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((ticket) => {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.dataset.status = ticket.status;
    node.querySelector(".ticket-number").textContent = numberLabel(ticket.number);
    node.querySelector(".ticket-status").textContent = ticket.status;
    node.querySelector(".ticket-person").textContent = ticket.name || "Toque para cadastrar";
    node.addEventListener("click", () => openEditor(ticket.number));
    fragment.append(node);
  });
  els.grid.append(fragment);
}

function render() {
  els.ticketValue.value = state.ticketValue;
  els.chips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.filter === state.activeFilter);
  });
  renderMetrics();
  renderGrid();
}

function openEditor(number) {
  const ticket = state.tickets.find((item) => item.number === number);
  state.selectedNumber = number;
  const payload = pixPayload(number);
  els.editorNumber.textContent = numberLabel(number);
  els.buyerName.value = ticket.name || "";
  els.buyerPhone.value = ticket.phone || "";
  els.ticketStatus.value = ticket.status || "Livre";
  els.ticketNote.value = ticket.note || "";
  if (els.pixAmount) els.pixAmount.textContent = money(state.ticketValue);
  if (els.pixCopyPaste) els.pixCopyPaste.value = payload;
  if (els.pixReceiver) els.pixReceiver.textContent = `${PIX_CONFIG.receiverLabel} | Chave Pix: ${PIX_CONFIG.key}`;
  if (els.pixQr) {
    els.pixQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(payload)}`;
  }
  els.dialog.showModal();
}

function updateSelectedTicket(nextValues) {
  const ticket = state.tickets.find((item) => item.number === state.selectedNumber);
  Object.assign(ticket, nextValues, { updatedAt: new Date().toISOString() });
  if (ticket.status === "Livre") {
    ticket.name = "";
    ticket.phone = "";
    ticket.note = "";
  }
  save();
  render();
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function exportBackup() {
  const payload = {
    app: "Rifa Baby Mirella ou Henry",
    exportedAt: new Date().toISOString(),
    ticketValue: state.ticketValue,
    tickets: state.tickets
  };
  download(`rifa-baby-backup-${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportCsv() {
  const rows = [
    ["Numero", "Nome", "Telefone", "Status", "Observacao", "Atualizado em"],
    ...state.tickets.map((ticket) => [
      numberLabel(ticket.number),
      ticket.name,
      ticket.phone,
      ticket.status,
      ticket.note,
      ticket.updatedAt || ""
    ])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
  download(`rifa-baby-exportacao-${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
}

async function shareSummary() {
  const free = state.tickets.filter((ticket) => ticket.status === "Livre").length;
  const reserved = state.tickets.filter((ticket) => ticket.status === "Reservado").length;
  const paid = state.tickets.filter((ticket) => ticket.status === "Pago").length;
  const available = state.tickets
    .filter((ticket) => ticket.status === "Livre")
    .map((ticket) => numberLabel(ticket.number))
    .join(", ");
  const text = [
    "Rifa Baby Mirella ou Henry",
    `${money(state.ticketValue).replace(",00", "")} cada numero`,
    `Pagos: ${paid} | Reservados: ${reserved} | Livres: ${free}`,
    available ? `Numeros livres: ${available}` : "Todos os numeros ja foram escolhidos."
  ].join("\n");

  if (navigator.share) {
    await navigator.share({
      title: "Rifa Baby Mirella ou Henry",
      text
    });
    return;
  }

  await navigator.clipboard.writeText(text);
  alert("Resumo copiado para compartilhar.");
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || "{}"));
      if (!Array.isArray(data.tickets)) throw new Error("Backup invalido");
      state.ticketValue = Number(data.ticketValue || state.ticketValue || 10);
      state.tickets = createTickets().map((fallback) => ({
        ...fallback,
        ...(data.tickets.find((ticket) => Number(ticket.number) === fallback.number) || {})
      }));
      save();
      render();
      alert("Backup importado com sucesso.");
    } catch {
      alert("Nao foi possivel importar esse arquivo.");
    } finally {
      els.importJson.value = "";
    }
  };
  reader.readAsText(file);
}

function wireEvents() {
  els.ticketValue.addEventListener("input", () => {
    state.ticketValue = Math.max(0, Number(els.ticketValue.value || 0));
    save();
    renderMetrics();
  });

  els.searchInput.addEventListener("input", () => {
    state.query = els.searchInput.value;
    renderGrid();
  });

  els.chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.activeFilter = FILTERS.includes(chip.dataset.filter) ? chip.dataset.filter : "all";
      render();
    });
  });

  els.saveTicket.addEventListener("click", () => {
    const nextStatus = els.ticketStatus.value === "Livre" && (els.buyerName.value.trim() || els.buyerPhone.value.trim())
      ? "Reservado"
      : els.ticketStatus.value;
    updateSelectedTicket({
      name: els.buyerName.value.trim(),
      phone: els.buyerPhone.value.trim(),
      status: nextStatus,
      note: els.ticketNote.value.trim()
    });
    els.dialog.close();
  });

  els.clearTicket.addEventListener("click", () => {
    updateSelectedTicket({ name: "", phone: "", status: "Livre", note: "" });
    els.dialog.close();
  });

  els.exportJson.addEventListener("click", exportBackup);
  els.exportCsv.addEventListener("click", exportCsv);
  if (els.shareSummary) {
    els.shareSummary.addEventListener("click", () => {
      shareSummary().catch(() => alert("Nao foi possivel compartilhar agora."));
    });
  }

  if (els.copyPix) {
    els.copyPix.addEventListener("click", async () => {
      await navigator.clipboard.writeText(els.pixCopyPaste.value);
      alert("Pix copia e cola copiado.");
    });
  }

  if (els.copyPixKey) {
    els.copyPixKey.addEventListener("click", async () => {
      await navigator.clipboard.writeText(PIX_CONFIG.key);
      alert("Chave Pix copiada.");
    });
  }

  els.importJson.addEventListener("change", () => {
    const [file] = els.importJson.files;
    if (file) importBackup(file);
  });

  els.resetDemo.addEventListener("click", () => {
    if (!confirm("Limpar todos os nomes, telefones e pagamentos deste aparelho?")) return;
    state.tickets = createTickets();
    save();
    render();
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("sw.js");
  } catch {
    // A PWA continua funcionando online mesmo se o cache nao registrar.
  }
}

load();
wireEvents();
save();
render();
registerServiceWorker();
