const DAYS = {
  segunda: "Segunda-feira",
  terca: "Terça-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira"
};

let selectedDay = "segunda";
let editingTripIndex = null;
let editingTripDay = null;
let currentProfile = null;
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
let drivers = JSON.parse(localStorage.getItem("logiflow-drivers") || "[]");
if (!Array.isArray(drivers)) drivers = [];
if (!drivers.length) {
  drivers = [
    "Francisco Isac Sousa de Jesus", "José Leonel da Silva", "Jemios Alves Pereira",
    "Jamiro Lopes de Sousa", "Fernando Antonio Alves Maia", "Carlos Fernandes Pereira",
    "Júnior Javi", "Colaborador Externo"
  ];
}
let periodSettings = JSON.parse(localStorage.getItem("logiflow-period") || '{"weekStart":""}');
let dashboardRange = JSON.parse(localStorage.getItem("logiflow-dashboard-range") || '{"start":"","end":""}');
if (!periodSettings.weekStart) {
  const today = new Date();
  const dayOffset = (today.getDay() + 6) % 7;
  today.setDate(today.getDate() - dayOffset);
  periodSettings.weekStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}
if (!dashboardRange.start || !dashboardRange.end) {
  dashboardRange.start = periodSettings.weekStart;
  const rangeEnd = new Date(`${periodSettings.weekStart}T12:00:00`);
  rangeEnd.setDate(rangeEnd.getDate() + 4);
  dashboardRange.end = `${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, "0")}-${String(rangeEnd.getDate()).padStart(2, "0")}`;
}
let trips = JSON.parse(localStorage.getItem("logiflow-trips") || "{}");
Object.keys(DAYS).forEach((day) => {
  if (!Array.isArray(trips[day])) trips[day] = [];
  trips[day].forEach((trip) => {
    if (!trip.weekStart) trip.weekStart = periodSettings.weekStart;
    if (Array.isArray(trip.collaborators)) {
      trip.collaborators = trip.collaborators.map((item) => typeof item === "string" ? { name: item, cost: Number(trip.personCost || 0), helpType: "Não informado" } : { name: item.name || "", cost: Number(item.cost || 0), helpType: item.helpType || "Não informado" });
    } else {
      trip.collaborators = [];
    }
  });
});

const tripList = document.querySelector("#tripList");
const modalBackdrop = document.querySelector("#modalBackdrop");
const summaryBackdrop = document.querySelector("#summaryBackdrop");
const tripForm = document.querySelector("#tripForm");

function money(value) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function save() {
  localStorage.setItem("logiflow-trips", JSON.stringify(trips));
  saveSharedState();
}

function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span.innerHTML;
}

function getWeekDates() {
  const start = new Date(`${periodSettings.weekStart}T12:00:00`);
  return [0, 1, 2, 3, 4].map((offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    return date;
  });
}

function formatPeriodDay(dayIndex) {
  const date = getWeekDates()[dayIndex];
  return date ? `${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}` : "Não informado";
}

function savePeriod() {
  localStorage.setItem("logiflow-period", JSON.stringify(periodSettings));
  saveSharedState();
}

function saveSharedState() {
  if (!currentProfile || currentProfile.active === false || !["admin", "editor"].includes(currentProfile.role)) return;
  localStorage.setItem("logiflow-trips", JSON.stringify(trips));
  localStorage.setItem("logiflow-period", JSON.stringify(periodSettings));
  localStorage.setItem("logiflow-dashboard-range", JSON.stringify(dashboardRange));
  localStorage.setItem("logiflow-drivers", JSON.stringify(drivers));
  window.logiFlowSync?.save({
    trips,
    periodSettings,
    dashboardRange,
    drivers
  });
}

function formatShortDate(dayIndex) {
  const date = getWeekDates()[dayIndex];
  if (!date) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatTextMoney(value) {
  return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

let autoTextDay = "all";
let travelCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let travelSelectedDate = new Date().toISOString().slice(0, 10);
let travelExpandedTripKey = null;

function getCurrentWeekTripsForText() {
  return Object.entries(DAYS).flatMap(([day, dayName], dayIndex) => {
    if (autoTextDay !== "all" && day !== autoTextDay) return [];
    return trips[day].filter((trip) => trip.weekStart === periodSettings.weekStart).map((trip) => ({ ...trip, day, dayName, dayIndex }));
  });
}

function generateFuelText() {
  const weekTrips = getCurrentWeekTripsForText();
  const headerDayIndex = autoTextDay === "all" ? (weekTrips.length ? weekTrips[0].dayIndex : 0) : Object.keys(DAYS).indexOf(autoTextDay);
  const headerDate = formatShortDate(headerDayIndex);
  const lines = [`🚗 RELATÓRIO DE VIAGENS - ${headerDate}`, ""];
  weekTrips.forEach((trip, index) => {
    lines.push(`🛣️ Viagem ${index + 1}`, "");
    lines.push(`🌍 Destino: ${(trip.municipality || "NÃO INFORMADO").toUpperCase()}`);
    lines.push(`📅 Data: ${formatShortDate(trip.dayIndex)}`);
    lines.push(`👨‍✈️ Motorista: ${trip.driver || "Não informado"}`);
    lines.push(`🚘 Veículo: ${trip.vehicle || "Não informado"}`);
    lines.push(`👥 Total de Pessoas: ${trip.collaborators.length}`);
    lines.push(`⛽ Valor Combustível: ${formatTextMoney(trip.fuelCost)}`);
    lines.push(`🏣 Custeio: ${trip.funding || "Não informado"}`);
    lines.push("──────────────────────────────────────────────────", "");
  });
  if (!weekTrips.length) lines.push(autoTextDay === "all" ? "Nenhuma viagem cadastrada nesta semana." : "Nenhuma viagem cadastrada neste dia.");
  return lines.join("\n").trim();
}

function generatePeopleText() {
  const weekTrips = getCurrentWeekTripsForText();
  const headerDayIndex = autoTextDay === "all" ? (weekTrips.length ? weekTrips[0].dayIndex : 0) : Object.keys(DAYS).indexOf(autoTextDay);
  const headerDate = formatShortDate(headerDayIndex);
  const lines = [`🚗 SOLICITAÇÕES DE VIAGEM CONSOLIDADA PARA O DIA ${headerDate}`, ""];

  if (!weekTrips.length) {
    lines.push(autoTextDay === "all" ? "Nenhuma viagem cadastrada nesta semana." : "Nenhuma viagem cadastrada nesta data.");
    return lines.join("\n").trim();
  }

  weekTrips.forEach((trip, index) => {
    const date = formatShortDate(trip.dayIndex);
    lines.push(`🛣️ Viagem ${index + 1}`, "");
    lines.push(`🌍 Destino: ${(trip.municipality || "NÃO INFORMADO").toUpperCase()}`);
    lines.push("📍 Local de Saída: Pluralmed");
    lines.push(`🕒 Data/Hora Saída: ${date} às ${trip.departureTime || "--:--"}`);
    lines.push(`🕒 Data/Hora Retorno: ${date} às ${trip.returnTime || "--:--"}`);
    lines.push(`👨‍✈️ Motorista: ${trip.driver || "Não informado"}`);
    lines.push(`🚘 Veículo: ${trip.vehicle || "Não informado"}`);
    lines.push("👥 Colaboradores:", "");
    if (trip.collaborators.length) {
      trip.collaborators.forEach((person) => lines.push(`- ${(person.name || "NÃO INFORMADO").toUpperCase()}`));
    } else {
      lines.push("- Nenhum colaborador informado");
    }
    if (index < weekTrips.length - 1) lines.push("", "---", "");
  });

  return lines.join("\n").trim();
}

function generateFinancialText() {
  const weekTrips = getCurrentWeekTripsForText();
  const headerDayIndex = autoTextDay === "all" ? (weekTrips.length ? weekTrips[0].dayIndex : 0) : Object.keys(DAYS).indexOf(autoTextDay);
  const headerDate = formatShortDate(headerDayIndex);
  const lines = [`📢 Olá, temos ${weekTrips.length} viagem(ns) que irão precisar de ajuda de custos para o dia ${headerDate}.`, "", "Por favor, adicione um saldo na conta CAJU dos motoristas.", ""];

  if (!weekTrips.length) {
    lines.push(autoTextDay === "all" ? "Nenhuma viagem cadastrada nesta semana." : "Nenhuma viagem cadastrada nesta data.");
    return lines.join("\n").trim();
  }

  weekTrips.forEach((trip, index) => {
    const totals = {};
    trip.collaborators.forEach((person) => {
      const company = person.helpType && person.helpType !== "Não informado" ? person.helpType : "Sem empresa";
      const cost = Number(person.cost || 0);
      if (cost > 0) totals[company] = (totals[company] || 0) + cost;
    });

    lines.push(`🧾 Viagem ${String(index + 1).padStart(2, "0")}:`);
    lines.push(`- 🏙️ Município: ${(trip.municipality || "Não informado")}`);
    lines.push(`- 🧍‍♂️ Solicitante: ${trip.requester || "Não informado"}`);
    lines.push(`- 👨‍✈️ Motorista: ${trip.driver || "Não definido"}`);
    lines.push(`- 👥 Total de colaboradores: ${trip.collaborators.length}`);
    lines.push("- 🏢 Valores por empresa:");

    const companyEntries = Object.entries(totals);
    if (companyEntries.length) {
      companyEntries.forEach(([company, total]) => lines.push(`   • ${company}: ${formatTextMoney(total)}`));
    } else {
      lines.push("   • Sem empresa: R$ 0,00");
    }
    lines.push("");
  });

  return lines.join("\n").trim();
}

function renderAutoText(type = "fuel") {
  const select = document.querySelector("#autoTextDay");
  const selected = select.value;
  const currentOptions = `<option value="all">Todas as datas</option>` + Object.keys(DAYS).map((day, index) => {
    const date = getWeekDates()[index];
    const label = `${date.getDate()} de ${monthNames[date.getMonth()]} - ${DAYS[day].replace("-feira", "")}`;
    return `<option value="${day}">${label}</option>`;
  }).join("");
  select.innerHTML = currentOptions;
  select.value = Object.keys(DAYS).includes(selected) || selected === "all" ? selected : "all";
  autoTextDay = select.value;
  const titles = { fuel: "Relatório de combustível", people: "Relatório de colaboradores", financial: "Solicitação financeira", complete: "Resumo completo" };
  document.querySelector("#autoTextTitle").textContent = titles[type];
  const text = type === "people" ? generatePeopleText() : type === "financial" ? generateFinancialText() : type === "complete" ? generateSummary() : generateFuelText();
  document.querySelector("#autoTextArea").value = text;
}

function render() {
  const editorMode = currentProfile?.role === "editor";
  const dayTrips = trips[selectedDay].filter((trip) => trip.weekStart === periodSettings.weekStart && (!editorMode || trip.submittedBy === (currentProfile.display_name || currentProfile.login_code || "Editor")));
  document.querySelector("#selectedDayTitle").textContent = DAYS[selectedDay];
  document.querySelector("#modalTitle").textContent = DAYS[selectedDay];
  renderWeekHeader();

  Object.keys(DAYS).forEach((day) => {
    const count = trips[day].filter((trip) => trip.weekStart === periodSettings.weekStart).length;
    document.querySelector(`#count-${day}`).textContent = count;
  });

  const allTrips = Object.values(trips).flat().filter((trip) => trip.weekStart === periodSettings.weekStart);
  const people = allTrips.reduce((total, trip) => total + trip.collaborators.length, 0);
  const cost = allTrips.reduce((total, trip) => total + Number(trip.fuelCost) + trip.collaborators.reduce((sum, person) => sum + Number(person.cost || 0), 0), 0);
  document.querySelector("#tripTotal").textContent = allTrips.length;
  document.querySelector("#peopleTotal").textContent = people;
  document.querySelector("#costTotal").textContent = money(cost);
  if (!document.querySelector("#dashboardScreen").hidden) renderDashboard();
  if (!document.querySelector("#travelPanelScreen").hidden) renderTravelPanel();

  if (!dayTrips.length) {
    tripList.innerHTML = `<div class="empty-state"><div><svg viewBox="0 0 24 24"><path d="M7 2v2H5a2 2 0 0 0-2 2v14h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7Zm12 8H5v8h14v-8Z"/></svg><strong>Nenhuma viagem cadastrada</strong><span>Adicione uma viagem para ${DAYS[selectedDay].toLowerCase()}.</span></div></div>`;
    return;
  }

  const selectedDayIndex = Object.keys(DAYS).indexOf(selectedDay);
  const selectedDate = formatPeriodDay(selectedDayIndex);
  tripList.innerHTML = dayTrips.map((trip, index) => {
    const totalHelp = trip.collaborators.reduce((sum, person) => sum + Number(person.cost || 0), 0);
    const total = Number(trip.fuelCost || 0) + totalHelp;
    const storageIndex = trips[selectedDay].indexOf(trip);
    return `<article class="trip-card trip-card-detailed ${trip.status === "pending_admin" ? "trip-pending-admin" : ""}">
      <header class="trip-card-header"><div class="trip-card-title"><span class="trip-number">VIAGEM ${String(index + 1).padStart(2,"0")}</span>${trip.status === "pending_admin" ? '<span class="editor-admin-badge" title="Solicitação enviada por editor para revisão administrativa">EDITOR ADM · AGUARDANDO COMPLEMENTO</span>' : ""}<h3>${escapeHtml(trip.municipality || "Município não informado")}</h3><p>${escapeHtml(trip.requester || "Solicitante não informado")} · ${escapeHtml(trip.vehicle || "Veículo não informado")}</p></div><div class="trip-card-date"><span>DATA</span><strong>${escapeHtml(selectedDate)}</strong></div>${currentProfile?.role === "admin" ? `<button class="edit-trip-button" type="button" data-edit-index="${storageIndex}" title="Completar ou editar dados da viagem" aria-label="Editar viagem">✎ Completar dados</button>` : ""}<button class="delete-button" type="button" data-index="${storageIndex}" title="Excluir viagem" aria-label="Excluir viagem"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg></button></header>
      <div class="trip-detail-grid">
        <section class="trip-detail-block"><div class="trip-block-heading"><span class="trip-block-symbol">◷</span><div><span>01 · CRONOGRAMA</span><h4>Horários da viagem</h4></div></div><div class="trip-time-row"><div><small>SAÍDA</small><strong>${escapeHtml(trip.departureTime || "--:--")}</strong></div><span class="trip-time-line">→</span><div><small>RETORNO</small><strong>${escapeHtml(trip.returnTime || "--:--")}</strong></div></div></section>
        <section class="trip-detail-block"><div class="trip-block-heading"><span class="trip-block-symbol">♙</span><div><span>02 · RESPONSÁVEIS</span><h4>Operação e solicitante</h4></div></div><dl class="trip-facts"><div><dt>Motorista</dt><dd>${escapeHtml(trip.driver || "Não informado")}</dd></div><div><dt>Solicitante</dt><dd>${escapeHtml(trip.requester || "Não informado")}</dd></div><div><dt>Custeio / setor</dt><dd>${escapeHtml(trip.funding || "Não informado")}</dd></div></dl></section>
        <section class="trip-detail-block"><div class="trip-block-heading"><span class="trip-block-symbol">♧</span><div><span>03 · EQUIPE</span><h4>Colaboradores <b class="trip-count-pill">${trip.collaborators.length}</b></h4></div></div>${trip.collaborators.length ? `<ul class="trip-people-list">${trip.collaborators.map(person => `<li><span>${escapeHtml(person.name)}</span><small>${person.cost ? escapeHtml(person.helpType || "Ajuda de custo") + " · " + money(person.cost) : "Sem ajuda de custo"}</small></li>`).join("")}</ul>` : '<p class="trip-no-data">Nenhum colaborador informado.</p>'}${currentProfile?.role === "editor" ? `<button class="add-trip-collaborator-button" type="button" data-add-collaborator-index="${storageIndex}">＋ Incluir colaborador</button>` : ""}</section>
        <section class="trip-detail-block trip-cost-block"><div class="trip-block-heading"><span class="trip-block-symbol">R$</span><div><span>04 · FINANCEIRO</span><h4>Resumo de custos</h4></div></div><div class="trip-cost-total"><small>CUSTO TOTAL ESTIMADO</small><strong>${money(total)}</strong></div><div class="trip-cost-lines"><div><span>Combustível</span><strong>${money(trip.fuelCost || 0)}</strong></div><div><span>Ajuda de custo</span><strong>${money(totalHelp)}</strong></div></div></section>
      </div></article>`;
  }).join("");
}

function addCollaboratorRow(name = "", cost = 0, helpType = "") {
  const row = document.createElement("div");
  row.className = "collaborator-row";
  row.innerHTML = `<input class="name-input" required placeholder="Nome do colaborador" value="${escapeHtml(name)}" />
    <button class="cost-toggle${cost ? " active" : ""}" type="button">Ajuda de custo</button>
    <div class="collaborator-help${cost ? "" : " hidden"}">
      <select class="help-type-input" aria-label="Tipo da ajuda de custo"><option value="">Tipo da ajuda</option><option>PLURALMED EDUCAÇÃO</option><option>PLURALMED SOLUÇÕES</option><option>PLURALMED GESTÃO</option><option>IGEP SAÚDE</option><option>PRIMETECH</option><option>PLURALMED TECNOLOGIA</option></select>
      <div class="money-input collaborator-cost"><span>R$</span><input class="cost-input" type="number" min="0" step="0.01" value="${cost || ""}" placeholder="0,00" /></div>
    </div>
    <button class="remove-collaborator" type="button" title="Remover colaborador" aria-label="Remover colaborador"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button>`;
  const typeSelect = row.querySelector(".help-type-input");
  if (helpType) typeSelect.value = helpType;
  document.querySelector("#collaboratorRows").appendChild(row);
}

function getTripDate(trip, dayIndex) {
  const date = new Date(`${trip.weekStart}T12:00:00`);
  date.setDate(date.getDate() + dayIndex);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getWeekTrips() {
  return Object.entries(DAYS).flatMap(([day, dayName], dayIndex) =>
    trips[day].filter((trip) => trip.weekStart).map((trip) => {
      const tripDate = getTripDate(trip, dayIndex);
      return { ...trip, day, dayName, dayIndex, tripDate };
    }).filter((trip) => trip.tripDate >= dashboardRange.start && trip.tripDate <= dashboardRange.end)
  );
}

function getTripDistance(trip) {
  const initial = Number(trip.kmInitial || 0);
  const final = Number(trip.kmFinal || 0);
  return final > initial ? final - initial : 0;
}

function renderDashboard() {
  if (!dashboardRange.end || dashboardRange.end < dashboardRange.start) dashboardRange.end = dashboardRange.start;
  const startInput = document.querySelector("#dashboardStartDate");
  const endInput = document.querySelector("#dashboardEndDate");
  if (startInput) startInput.value = dashboardRange.start;
  if (endInput) endInput.value = dashboardRange.end;
  const weekTrips = getWeekTrips();
  const people = weekTrips.reduce((total, trip) => total + trip.collaborators.length, 0);
  const fuel = weekTrips.reduce((total, trip) => total + Number(trip.fuelCost || 0), 0);
  const help = weekTrips.reduce((total, trip) => total + trip.collaborators.reduce((sum, person) => sum + Number(person.cost || 0), 0), 0);
  const km = weekTrips.reduce((total, trip) => total + getTripDistance(trip), 0);
  const municipalities = new Set(weekTrips.map((trip) => (trip.municipality || "").trim()).filter(Boolean));

  document.querySelector("#dashboardTrips").textContent = weekTrips.length;
  document.querySelector("#dashboardPeople").textContent = people;
  document.querySelector("#dashboardCost").textContent = money(fuel + help);
  document.querySelector("#dashboardKm").textContent = `${km.toLocaleString("pt-BR")} km`;
  document.querySelector("#dashboardFuel").textContent = money(fuel);
  document.querySelector("#dashboardHelp").textContent = money(help);
  document.querySelector("#dashboardMunicipalities").textContent = municipalities.size;

  const counts = Object.keys(DAYS).map((day) => weekTrips.filter((trip) => trip.day === day).length);
  const maxCount = Math.max(...counts, 1);
  document.querySelector("#dashboardDayBars").innerHTML = Object.keys(DAYS).map((day, index) => {
    const label = ["SEG", "TER", "QUA", "QUI", "SEX"][index];
    const height = `${Math.max((counts[index] / maxCount) * 100, counts[index] ? 18 : 4)}%`;
    return `<div class="day-bar"><div class="day-bar-track"><div class="day-bar-fill" style="height:${height}" title="${counts[index]} viagem(ns)"></div></div><span>${label} · ${counts[index]}</span></div>`;
  }).join("");

  const vehicleGroups = {};
  weekTrips.forEach((trip) => {
    const vehicle = trip.vehicle || "Sem placa";
    const date = formatPeriodDay(trip.dayIndex);
    const key = `${vehicle}|||${date}`;
    if (!vehicleGroups[key]) vehicleGroups[key] = { vehicle, date, drivers: new Set(), municipalities: new Set(), km: 0 };
    vehicleGroups[key].drivers.add(trip.driver || "Não informado");
    vehicleGroups[key].municipalities.add(trip.municipality || "Não informado");
    vehicleGroups[key].km += getTripDistance(trip);
  });

  const vehicleTotals = {};
  const vehicleTripCounts = {};
  Object.values(vehicleGroups).forEach((group) => {
    vehicleTotals[group.vehicle] = (vehicleTotals[group.vehicle] || 0) + group.km;
    vehicleTripCounts[group.vehicle] = (vehicleTripCounts[group.vehicle] || 0) + weekTrips.filter((trip) => trip.vehicle === group.vehicle && formatPeriodDay(trip.dayIndex) === group.date).length;
  });
  const sortedVehicles = Object.entries(vehicleTotals).sort((a, b) => b[1] - a[1]);
  const maxVehicleKm = Math.max(...sortedVehicles.map(([, km]) => km), 1);
  document.querySelector("#vehicleKmChart").innerHTML = sortedVehicles.length ? sortedVehicles.map(([vehicle, km], index) => {
    const width = `${Math.max((km / maxVehicleKm) * 100, km ? 4 : 0)}%`;
    const tripCount = vehicleTripCounts[vehicle] || 0;
    return `<div class="vehicle-bar-row"><div class="vehicle-bar-label"><strong>${escapeHtml(vehicle)}</strong><span>${tripCount} viagem(ns)</span></div><div class="vehicle-bar-track"><div class="vehicle-bar-fill" style="width:${width}"></div></div><div class="vehicle-bar-value">${km.toLocaleString("pt-BR")} km (${tripCount})</div></div>`;
  }).join("") : `<div class="vehicle-bar-row"><div class="vehicle-bar-label"><strong>Sem veículos</strong></div><div class="vehicle-bar-track"></div><div class="vehicle-bar-value">0 km</div></div>`;
  document.querySelector("#dashboardVehicleRows").innerHTML = "";
}

function getAllTripsForTravelPanel() {
  const editorMode = currentProfile?.role === "editor";
  const owner = currentProfile?.display_name || currentProfile?.login_code || "Editor";
  return Object.entries(DAYS).flatMap(([day, dayName], dayIndex) =>
    trips[day].filter(trip => trip.weekStart && (!editorMode || trip.submittedBy === owner))
      .map(trip => ({ ...trip, day, dayName, dayIndex, tripDate: getTripDate(trip, dayIndex), storageIndex: trips[day].indexOf(trip) }))
  );
}

function renderTravelPanel() {
  const monthTitle = document.querySelector("#travelMonthTitle");
  const grid = document.querySelector("#travelCalendarGrid");
  if (!monthTitle || !grid) return;
  monthTitle.textContent = `${monthNames[travelCalendarMonth.getMonth()]} de ${travelCalendarMonth.getFullYear()}`;
  const allTrips = getAllTripsForTravelPanel();
  const firstDay = new Date(travelCalendarMonth.getFullYear(), travelCalendarMonth.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(travelCalendarMonth.getFullYear(), travelCalendarMonth.getMonth() + 1, 0).getDate();
  const weekLabels = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
  const cells = weekLabels.map(label => `<div class="travel-weekday">${label}</div>`);
  for (let i = 0; i < startOffset; i++) cells.push('<div class="travel-day-cell travel-day-blank" aria-hidden="true"></div>');
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const date = `${travelCalendarMonth.getFullYear()}-${String(travelCalendarMonth.getMonth()+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
    const dayTrips = allTrips.filter(trip => trip.tripDate === date);
    const people = dayTrips.reduce((sum, trip) => sum + (trip.collaborators || []).length, 0);
    const capacity = dayTrips.length ? dayTrips.reduce((sum, trip) => sum + Number(trip.vehicleCapacity || trip.capacity || 0), 0) : 0;
    const over = dayTrips.some(trip => Number(trip.collaborators?.length || 0) > Number(trip.vehicleCapacity || trip.capacity || 999));
    const statusClass = !dayTrips.length ? "travel-day-empty" : over ? "travel-day-over" : "travel-day-has-trips";
    const destinations = dayTrips.slice(0, 3).map(trip => `<div class="travel-mini-trip"><strong>${escapeHtml(trip.municipality || "Destino não informado")}</strong><span>${escapeHtml(trip.departureTime || "--:--")} · ${(trip.collaborators || []).length} pessoa(s)</span></div>`).join("");
    const extra = dayTrips.length > 3 ? `<small class="travel-more-trips">+${dayTrips.length - 3} viagens</small>` : "";
    cells.push(`<button type="button" class="travel-day-cell ${statusClass} ${travelSelectedDate === date ? "travel-day-selected" : ""}" data-travel-date="${date}" aria-pressed="${travelSelectedDate === date}">
      <span class="travel-day-number">${dayNum}</span>
      ${dayTrips.length ? `<span class="travel-day-count">${dayTrips.length} viagem(ns)</span><div class="travel-day-mini-list">${destinations}${extra}</div><span class="travel-day-footer">${people} colaborador(es)</span>` : '<span class="travel-no-trips">Sem viagens</span>'}
    </button>`);
  }
  grid.innerHTML = cells.join("");
  grid.querySelectorAll("[data-travel-date]").forEach(button => button.addEventListener("click", () => {
    travelSelectedDate = button.dataset.travelDate;
    travelExpandedTripKey = null;
    renderTravelPanel();
  }));
  renderTravelDayDetails(allTrips);
}

function renderTravelDayDetails(allTrips = getAllTripsForTravelPanel()) {
  const date = travelSelectedDate;
  const dateObj = new Date(`${date}T12:00:00`);
  const dateTrips = allTrips.filter(trip => trip.tripDate === date);
  document.querySelector("#travelSelectedDate").textContent = dateObj.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const people = dateTrips.reduce((sum, trip) => sum + (trip.collaborators || []).length, 0);
  const cars = new Set(dateTrips.map(trip => trip.vehicle).filter(Boolean)).size;
  const cost = dateTrips.reduce((sum, trip) => sum + Number(trip.fuelCost || 0) + (trip.collaborators || []).reduce((s, person) => s + Number(person.cost || 0), 0), 0);
  document.querySelector("#travelDayMetrics").innerHTML = `<div><strong>${people}</strong><span>COLABORADORES</span></div><div><strong>${dateTrips.length}</strong><span>VIAGENS</span></div><div><strong>${cars}</strong><span>VEÍCULOS</span></div><div><strong>${money(cost)}</strong><span>CUSTO ESTIMADO</span></div>`;
  document.querySelector("#travelDayTripCount").textContent = `${dateTrips.length} ${dateTrips.length === 1 ? "viagem" : "viagens"}`;
  const container = document.querySelector("#travelDayTrips");
  if (!dateTrips.length) {
    container.innerHTML = '<div class="travel-empty-detail"><span>▦</span><strong>Nenhuma viagem neste dia</strong><p>Escolha outra data no calendário para consultar as viagens cadastradas.</p></div>';
    return;
  }
  container.innerHTML = dateTrips.map((trip, i) => {
    const key = `${trip.day}:${trip.storageIndex}`;
    const expanded = travelExpandedTripKey === key;
    const totalHelp = (trip.collaborators || []).reduce((sum, person) => sum + Number(person.cost || 0), 0);
    const total = Number(trip.fuelCost || 0) + totalHelp;
    return `<article class="travel-detail-card ${expanded ? "expanded" : ""}">
      <button type="button" class="travel-trip-summary" data-travel-trip="${key}"><span class="travel-status-dot"></span><span class="travel-trip-main"><strong>${escapeHtml(trip.municipality || "Destino não informado")}</strong><small>${escapeHtml(trip.departureTime || "--:--")}–${escapeHtml(trip.returnTime || "--:--")} · ${escapeHtml(trip.vehicle || "Veículo não informado")}</small></span><span class="travel-trip-count">${(trip.collaborators || []).length} pessoas</span><span class="travel-expand-icon">${expanded ? "−" : "+"}</span></button>
      ${expanded ? `<div class="travel-trip-expanded">
        <div class="travel-info-pair"><span>Solicitante</span><strong>${escapeHtml(trip.requester || "Não informado")}</strong></div>
        <div class="travel-info-pair"><span>Motorista</span><strong>${escapeHtml(trip.driver || "Não informado")}</strong></div>
        <div class="travel-info-pair"><span>Veículo</span><strong>${escapeHtml(trip.vehicle || "Não informado")}</strong></div>
        <div class="travel-info-pair"><span>Custeio / setor</span><strong>${escapeHtml(trip.funding || "Não informado")}</strong></div>
        <div class="travel-info-pair"><span>Horário de saída</span><strong>${escapeHtml(trip.departureTime || "Não informado")}</strong></div>
        <div class="travel-info-pair"><span>Horário de retorno</span><strong>${escapeHtml(trip.returnTime || "Não informado")}</strong></div>
        <div class="travel-collaborators"><strong>Colaboradores (${(trip.collaborators || []).length})</strong>${(trip.collaborators || []).length ? `<ul>${trip.collaborators.map(person => `<li><span>${escapeHtml(person.name || "Sem nome")}</span><small>${person.cost ? escapeHtml(person.helpType || "Ajuda de custo") + " · " + money(person.cost) : "Sem ajuda de custo"}</small></li>`).join("")}</ul>` : '<p>Nenhum colaborador informado.</p>'}</div>
        <div class="travel-cost-summary"><span>Combustível: ${money(trip.fuelCost || 0)}</span><span>Ajuda de custo: ${money(totalHelp)}</span><strong>Total: ${money(total)}</strong></div>
      </div>` : ""}
    </article>`;
  }).join("");
  container.querySelectorAll("[data-travel-trip]").forEach(button => button.addEventListener("click", () => {
    travelExpandedTripKey = travelExpandedTripKey === button.dataset.travelTrip ? null : button.dataset.travelTrip;
    renderTravelDayDetails(allTrips);
  }));
}

function renderKmTable() {
  const body = document.querySelector("#kmTableBody");
  const rows = [];

  Object.entries(DAYS).forEach(([day, dayName]) => {
    trips[day].filter((trip) => trip.weekStart === periodSettings.weekStart).forEach((trip) => {
      const index = trips[day].indexOf(trip);
      const initial = Number(trip.kmInitial || 0);
      const final = Number(trip.kmFinal || 0);
      const distance = final > initial ? final - initial : 0;
      const dayIndex = Object.keys(DAYS).indexOf(day);
      rows.push(`<tr>
        <td><strong>${dayName}</strong><span>${escapeHtml(formatPeriodDay(dayIndex))}</span></td>
        <td><strong>${escapeHtml(trip.municipality || "Não informado")}</strong><span>${escapeHtml(trip.vehicle)} · ${escapeHtml(trip.funding || "Sem custeio")}</span></td>
        <td>${escapeHtml(trip.requester)}</td>
        <td><input class="km-input" data-day="${day}" data-index="${index}" data-kind="initial" type="number" min="0" step="1" value="${trip.kmInitial ?? ""}" placeholder="0" ${currentProfile && ["admin","editor"].includes(currentProfile.role) ? "" : "disabled"} /></td>
        <td><input class="km-input" data-day="${day}" data-index="${index}" data-kind="final" type="number" min="0" step="1" value="${trip.kmFinal ?? ""}" placeholder="0" ${currentProfile && ["admin","editor"].includes(currentProfile.role) ? "" : "disabled"} /></td>
        <td class="km-distance">${distance.toLocaleString("pt-BR")} km</td>
      </tr>`);
    });
  });

  body.innerHTML = rows.length ? rows.join("") : `<tr><td class="km-empty" colspan="6">Nenhuma viagem cadastrada para registrar quilometragem.</td></tr>`;
}

function renderWeekHeader() {
  const dates = getWeekDates();
  const dayKeys = ["segunda", "terca", "quarta", "quinta", "sexta"];
  document.querySelector("#monthName").textContent = monthNames[dates[4].getMonth()].toUpperCase();
  dayKeys.forEach((day, index) => {
    document.querySelector(`#date-${day}`).textContent = dates[index].getDate();
  });
}

function openModal(tripIndex = null) {
  editingTripIndex = tripIndex;
  editingTripDay = tripIndex === null ? null : selectedDay;
  modalBackdrop.hidden = false;
  tripForm.reset();
  const isAdmin = currentProfile?.role === "admin";
  const isEditor = currentProfile?.role === "editor";
  const modal = document.querySelector(".trip-modal");
  modal?.classList.toggle("editor-request-mode", isEditor);
  ["funding", "driver", "vehicle", "fuelCost"].forEach((name) => {
    if (tripForm.elements[name]) tripForm.elements[name].required = !isEditor;
  });
  const fundingLabel = tripForm.elements.funding?.closest("label");
  const driverLabel = tripForm.elements.driver?.closest("label");
  const vehicleLabel = tripForm.elements.vehicle?.closest("label");
  const fuelLabel = tripForm.elements.fuelCost?.closest("label");
  [fundingLabel, driverLabel, vehicleLabel, fuelLabel].forEach(label => { if (label) label.hidden = isEditor; });
  const fuelSection = fuelLabel?.closest(".trip-form-section");
  if (fuelSection) fuelSection.hidden = isEditor;
  const transportSection = driverLabel?.closest(".trip-form-section");
  if (transportSection) {
    const heading = transportSection.querySelector(".trip-section-heading");
    const grids = transportSection.querySelectorAll(".trip-field-grid");
    if (isEditor) {
      if (heading) heading.hidden = true;
      grids.forEach(grid => {
        const visibleFields = Array.from(grid.querySelectorAll("label")).filter(label => !label.hidden);
        grid.hidden = visibleFields.length === 0;
      });
    } else {
      if (heading) heading.hidden = false;
      grids.forEach(grid => grid.hidden = false);
    }
  }
  const requesterLabel = tripForm.elements.requester?.closest("label");
  const requesterText = requesterLabel?.querySelector("span");
  if (requesterText) requesterText.childNodes[0].textContent = isEditor ? "Solicitador de Viagem " : "Quem solicitou a viagem ";
  const collaboratorSection = document.querySelector("#collaboratorRows")?.closest(".trip-form-section");
  if (collaboratorSection) collaboratorSection.hidden = false;
  document.querySelectorAll(".trip-form-section").forEach(section => { if (section === collaboratorSection) section.hidden = false; });
  tripForm.querySelectorAll(".trip-form-section").forEach(section => {
    if (section !== fuelSection && section !== collaboratorSection) section.hidden = false;
  });
  modalBackdrop.scrollTop = 0;
  if (modal) modal.scrollTop = 0;
  tripForm.scrollTop = 0;
  const collaboratorHeading = collaboratorSection?.querySelector(".trip-section-heading h3");
  const collaboratorDescription = collaboratorSection?.querySelector(".trip-section-heading p");
  if (collaboratorHeading) collaboratorHeading.textContent = isEditor ? "Colaboradores" : "Equipe da viagem";
  if (collaboratorDescription) collaboratorDescription.textContent = isEditor ? "Informe os nomes dos participantes. Não é necessário preencher ajuda de custo." : "Adicione quem participará do deslocamento e, se aplicável, informe ajuda de custo.";
  const costToggleButtons = document.querySelectorAll(".cost-toggle");
  costToggleButtons.forEach(button => { button.hidden = isEditor; });
  document.querySelectorAll(".collaborator-help").forEach(box => { box.hidden = isEditor; });

  const progressWrap = document.querySelector(".trip-progress-wrap");
  if (progressWrap) progressWrap.hidden = false;
  const editorNote = document.querySelector("#editorModalNote");
  if (editorNote) editorNote.hidden = !isEditor;
  const editorPageNote = document.querySelector("#editorSubmissionNote");
  if (editorPageNote) editorPageNote.hidden = currentProfile?.role !== "editor" || document.querySelector("#editorTripsNav")?.classList.contains("active") !== true;
  document.querySelector("#modalTitle").textContent = tripIndex === null ? DAYS[selectedDay] : "Completar dados da viagem";
  if (tripIndex !== null) {
    const trip = trips[selectedDay][tripIndex];
    if (trip) {
      Object.entries({requester:trip.requester, municipality:trip.municipality, funding:trip.funding, driver:trip.driver, vehicle:trip.vehicle, departureTime:trip.departureTime, returnTime:trip.returnTime, fuelCost:trip.fuelCost}).forEach(([key,value]) => { if (tripForm.elements[key]) tripForm.elements[key].value = value ?? ""; });
    }
  }
  renderDriverOptions();
  document.querySelector("#collaboratorRows").innerHTML = "";
  if (tripIndex !== null && trips[selectedDay][tripIndex]?.collaborators?.length) trips[selectedDay][tripIndex].collaborators.forEach(person => addCollaboratorRow(person.name, person.cost, person.helpType));
  else addCollaboratorRow();
  tripForm.elements.requester.focus();
}
function closeModal() { modalBackdrop.hidden = true; }
function closeSummary() { summaryBackdrop.hidden = true; }

function generateSummary() {
  const lines = ["Resumo das viagens da semana"];
  let hasTrips = false;

  Object.entries(DAYS).forEach(([day, dayName], dayIndex) => {
    if (autoTextDay !== "all" && day !== autoTextDay) return;
    const weekTrips = trips[day].filter((trip) => trip.weekStart === periodSettings.weekStart);
    if (!weekTrips.length) return;
    hasTrips = true;
    lines.push(`\n${dayName}:`);
    weekTrips.forEach((trip, index) => {
      const helpTotal = trip.collaborators.reduce((sum, person) => sum + Number(person.cost || 0), 0);
      const total = Number(trip.fuelCost) + helpTotal;
      lines.push(`${index + 1}. Solicitante: ${trip.requester}`);
      const dayIndex = Object.keys(DAYS).indexOf(day);
      const date = getWeekDates()[dayIndex];
      lines.push(`   Dia: ${formatPeriodDay(dayIndex)}`);
      lines.push(`   Município: ${trip.municipality || "Não informado"}`);
      lines.push(`   Motorista: ${trip.driver || "Não informado"}`);
      lines.push(`   Custeio: ${trip.funding || "Não informado"}`);
      lines.push(`   Veículo: ${trip.vehicle}`);
      lines.push(`   Horário de ida: ${trip.departureTime || "Não informado"}`);
      lines.push(`   Horário de volta: ${trip.returnTime || "Não informado"}`);
      lines.push(`   Colaboradores:`);
      trip.collaborators.forEach((person) => lines.push(`   - ${person.name}: ${person.helpType || "Não informado"} - ajuda de custo ${money(person.cost || 0)}`));
      lines.push(`   Custo de gasolina: ${money(trip.fuelCost)}`);
      lines.push(`   Total de ajuda de custo: ${money(helpTotal)}`);
      lines.push(`   Custo total da viagem: ${money(total)}`);
    });
  });

  if (!hasTrips) lines.push(autoTextDay === "all" ? "\nNenhuma viagem cadastrada nesta semana." : "\nNenhuma viagem cadastrada nesta data.");
  return lines.join("\n");
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const temporary = document.createElement("textarea");
    temporary.value = text;
    document.body.appendChild(temporary);
    temporary.select();
    document.execCommand("copy");
    temporary.remove();
  }
  const toast = document.querySelector("#toast");
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

document.querySelector("#previousWeek").addEventListener("click", () => {
  const start = new Date(`${periodSettings.weekStart}T12:00:00`);
  start.setDate(start.getDate() - 7);
  periodSettings.weekStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  savePeriod();
  render();
});

document.querySelector("#nextWeek").addEventListener("click", () => {
  const start = new Date(`${periodSettings.weekStart}T12:00:00`);
  start.setDate(start.getDate() + 7);
  periodSettings.weekStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  savePeriod();
  render();
});

document.querySelectorAll(".day-tab").forEach((button) => {
  button.addEventListener("click", () => {
    selectedDay = button.dataset.day;
    document.querySelectorAll(".day-tab").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    render();
  });
});

document.querySelector("#addTripButton").addEventListener("click", openModal);
document.querySelector("#addCollaboratorButton").addEventListener("click", () => addCollaboratorRow());
document.querySelector("#closeModalButton").addEventListener("click", closeModal);
document.querySelector("#cancelModalButton").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (event) => { if (event.target === modalBackdrop) closeModal(); });

document.querySelector("#closeSummaryButton").addEventListener("click", closeSummary);
document.querySelector("#closeSummaryTextButton").addEventListener("click", closeSummary);
summaryBackdrop.addEventListener("click", (event) => { if (event.target === summaryBackdrop) closeSummary(); });

document.querySelector("#generateButton").addEventListener("click", () => {
  document.querySelector("#generatedText").value = generateSummary();
  summaryBackdrop.hidden = false;
});

document.querySelector("#copySummaryButton").addEventListener("click", () => copyText(generateSummary()));
document.querySelector("#copyGeneratedButton").addEventListener("click", () => copyText(document.querySelector("#generatedText").value));

document.querySelector("#collaboratorRows").addEventListener("click", (event) => {
  const costButton = event.target.closest(".cost-toggle");
  if (costButton) {
    const helpArea = costButton.nextElementSibling;
    helpArea.classList.toggle("hidden");
    costButton.classList.toggle("active", !helpArea.classList.contains("hidden"));
    if (!helpArea.classList.contains("hidden")) helpArea.querySelector(".help-type-input").focus();
    return;
  }
  const removeButton = event.target.closest(".remove-collaborator");
  if (removeButton && document.querySelectorAll(".collaborator-row").length > 1) removeButton.closest(".collaborator-row").remove();
});

tripForm.elements.returnTime.addEventListener("input", () => tripForm.elements.returnTime.setCustomValidity(""));

tripForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentProfile || !["admin", "editor"].includes(currentProfile.role)) return;
  const data = new FormData(tripForm);
  const isEditorSubmission = currentProfile.role === "editor";
  const collaborators = Array.from(document.querySelectorAll(".collaborator-row")).map((row) => ({
    name: row.querySelector(".name-input").value.trim(),
    cost: isEditorSubmission ? 0 : Number(row.querySelector(".cost-input").value || 0),
    helpType: isEditorSubmission ? "" : (row.querySelector(".help-type-input")?.value || "Não informado")
  })).filter((person) => person.name);
  if (!collaborators.length && !isEditorSubmission) { /* equipe opcional; admin pode completar depois */ }
  if (isEditorSubmission) {
    const missingCollaborator = Array.from(document.querySelectorAll(".collaborator-row")).some(row => !row.querySelector(".name-input").value.trim());
    if (missingCollaborator) { const input = Array.from(document.querySelectorAll(".collaborator-row")).find(row => !row.querySelector(".name-input").value.trim())?.querySelector(".name-input"); input?.setCustomValidity("Informe o nome do colaborador ou remova a linha."); input?.reportValidity(); input?.addEventListener("input", () => input.setCustomValidity(""), {once:true}); return; }
  }
  if (!tripForm.reportValidity()) return;
  const departureTime = String(data.get("departureTime") || "").trim();
  const returnTime = String(data.get("returnTime") || "").trim();
  if (departureTime && returnTime && returnTime < departureTime) {
    tripForm.elements.returnTime.setCustomValidity("O horário de volta deve ser igual ou posterior ao horário de ida.");
    tripForm.elements.returnTime.reportValidity();
    return;
  }

  const tripData = {
    weekStart: periodSettings.weekStart,
    requester: String(data.get("requester") || "").trim(),
    municipality: String(data.get("municipality") || "").trim(),
    funding: String(data.get("funding") || "").trim(),
    driver: String(data.get("driver") || "").trim(),
    vehicle: String(data.get("vehicle") || "").trim().toUpperCase(),
    departureTime,
    returnTime,
    collaborators,
    fuelCost: Number(data.get("fuelCost") || 0),
    status: isEditorSubmission ? "pending_admin" : (editingTripIndex !== null ? (trips[selectedDay][editingTripIndex]?.status || "approved") : "approved"),
    submittedBy: isEditorSubmission ? (currentProfile.display_name || currentProfile.login_code || "Editor") : (editingTripIndex !== null ? (trips[selectedDay][editingTripIndex]?.submittedBy || "") : "")
  };
  if (editingTripIndex !== null && currentProfile.role === "admin") trips[selectedDay][editingTripIndex] = { ...trips[selectedDay][editingTripIndex], ...tripData, status: "approved" };
  else trips[selectedDay].push(tripData);
  editingTripIndex = null;
  editingTripDay = null;
  save();
  closeModal();
  render();
});

document.querySelector("#dashboardStartDate").addEventListener("change", (event) => {
  dashboardRange.start = event.target.value;
  if (dashboardRange.end && dashboardRange.end < dashboardRange.start) dashboardRange.end = dashboardRange.start;
  localStorage.setItem("logiflow-dashboard-range", JSON.stringify(dashboardRange));
  saveSharedState();
  renderDashboard();
});

document.querySelector("#dashboardEndDate").addEventListener("change", (event) => {
  dashboardRange.end = event.target.value;
  if (dashboardRange.start && dashboardRange.end < dashboardRange.start) dashboardRange.start = dashboardRange.end;
  localStorage.setItem("logiflow-dashboard-range", JSON.stringify(dashboardRange));
  saveSharedState();
  renderDashboard();
});

document.querySelectorAll(".nav-item[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item[data-view]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const view = button.dataset.view;
    document.querySelector("#tripsScreen").hidden = !["trips","editorTrips"].includes(view);
    const editorView = view === "editorTrips";
    document.querySelector("#addTripButton").textContent = editorView ? "Solicitar viagem" : "Adicionar viagem";
    document.querySelector("#tripsIntro").hidden = editorView;
    document.querySelector("#tripsContentHead").querySelector("h2").textContent = editorView ? "Solicitações de viagem" : "Viagens da semana";
    document.querySelector("#editorSubmissionNote").hidden = !editorView;
    if (editorView) { document.querySelector("#tripsNav").classList.remove("active"); document.querySelector("#editorTripsNav").classList.add("active"); }
    if (view === "trips") document.querySelector("#editorTripsNav")?.classList.remove("active");
    if (editorView || view === "trips") render();
    document.querySelector("#kmScreen").hidden = view !== "km";
    document.querySelector("#travelPanelScreen").hidden = view !== "travelPanel";
    if (view === "travelPanel") renderTravelPanel();
    document.querySelector("#dashboardScreen").hidden = view !== "dashboard";
    document.querySelector("#textScreen").hidden = view !== "text";
    document.querySelector("#settingsScreen").hidden = view !== "settings";
    if (view === "km") renderKmTable();
    if (view === "dashboard") renderDashboard();
    if (view === "text") renderAutoText(document.querySelector(".auto-text-button.active")?.dataset.textType || "fuel");
  });
});

document.querySelector("#autoTextDay").addEventListener("change", (event) => {
  autoTextDay = event.target.value;
  renderAutoText(document.querySelector(".auto-text-button.active")?.dataset.textType || "fuel");
});

document.querySelectorAll(".auto-text-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".auto-text-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderAutoText(button.dataset.textType);
  });
});

document.querySelector("#copyAutoTextButton").addEventListener("click", () => copyText(document.querySelector("#autoTextArea").value));

document.querySelector("#kmTableBody").addEventListener("input", (event) => {
  const input = event.target.closest(".km-input");
  if (!input || !currentProfile || !["admin", "editor"].includes(currentProfile.role)) return;
  const trip = trips[input.dataset.day][Number(input.dataset.index)];
  const field = input.dataset.kind === "initial" ? "kmInitial" : "kmFinal";
  trip[field] = input.value === "" ? null : Number(input.value);
  save();
  const row = input.closest("tr");
  const initial = Number(trip.kmInitial || 0);
  const final = Number(trip.kmFinal || 0);
  const distance = final > initial ? final - initial : 0;
  row.querySelector(".km-distance").textContent = `${distance.toLocaleString("pt-BR")} km`;
  if (!document.querySelector("#dashboardScreen").hidden) renderDashboard();
});

tripList.addEventListener("click", (event) => {
  const addCollaboratorButton = event.target.closest(".add-trip-collaborator-button");
  if (addCollaboratorButton && currentProfile?.role === "editor") {
    const tripIndex = Number(addCollaboratorButton.dataset.addCollaboratorIndex);
    const trip = trips[selectedDay]?.[tripIndex];
    if (!trip || trip.submittedBy !== (currentProfile.display_name || currentProfile.login_code || "Editor")) return;
    const name = window.prompt("Digite o nome do colaborador que deseja incluir nesta viagem:");
    if (name === null) return;
    const cleanName = name.trim();
    if (!cleanName) { window.alert("Informe o nome do colaborador."); return; }
    const duplicate = (trip.collaborators || []).some(person => String(person.name || "").trim().toLocaleLowerCase("pt-BR") === cleanName.toLocaleLowerCase("pt-BR"));
    if (duplicate) { window.alert("Esse colaborador já está incluído nesta viagem."); return; }
    if (!Array.isArray(trip.collaborators)) trip.collaborators = [];
    trip.collaborators.push({ name: cleanName, cost: 0, helpType: "Não informado" });
    save();
    render();
    return;
  }
  const editButton = event.target.closest(".edit-trip-button");
  if (editButton && currentProfile?.role === "admin") { openModal(Number(editButton.dataset.editIndex)); return; }
  const button = event.target.closest(".delete-button");
  if (!button || !currentProfile || !["admin", "editor"].includes(currentProfile.role)) return;
  trips[selectedDay].splice(Number(button.dataset.index), 1);
  save();
  render();
});

render();

let sharedSubscriptionStarted = false;
let sharedRefreshInFlight = false;
let lastSharedStateSignature = "";

function sharedStateSignature(state) {
  try { return JSON.stringify(state || null); } catch (_) { return ""; }
}

async function refreshSharedState() {
  if (!currentProfile || currentProfile.active === false || sharedRefreshInFlight || document.hidden) return;
  sharedRefreshInFlight = true;
  try {
    const remote = await window.logiFlowSync.load();
    if (remote && typeof remote === "object") {
      const signature = sharedStateSignature(remote);
      if (signature && signature !== lastSharedStateSignature) applySharedState(remote);
    }
  } catch (error) {
    console.warn("Sincronização automática temporariamente indisponível:", error.message || error);
  } finally {
    sharedRefreshInFlight = false;
  }
}
async function initializeSharedState() {
  if (!currentProfile || currentProfile.active === false) return;
  try {
    const remote = await window.logiFlowSync.load();
    if (remote && typeof remote === "object" && Object.keys(remote).length) applySharedState(remote);
    else if (["admin", "editor"].includes(currentProfile.role)) saveSharedState();
    if (!sharedSubscriptionStarted) { window.logiFlowSync.subscribe((remoteState) => applySharedState(remoteState)); sharedSubscriptionStarted = true; }
  } catch (error) { console.error("Não foi possível conectar ao armazenamento compartilhado:", error.message || error); }
}

function applySharedState(state) {
  if (!state || typeof state !== "object") return;
  lastSharedStateSignature = sharedStateSignature(state);
  if (state.trips && typeof state.trips === "object") {
    trips = state.trips;
    Object.keys(DAYS).forEach((day) => {
      if (!Array.isArray(trips[day])) trips[day] = [];
    });
    localStorage.setItem("logiflow-trips", JSON.stringify(trips));
  }
  if (state.periodSettings && typeof state.periodSettings === "object") {
    periodSettings = state.periodSettings;
    localStorage.setItem("logiflow-period", JSON.stringify(periodSettings));
  }
  if (state.dashboardRange && typeof state.dashboardRange === "object") {
    dashboardRange = state.dashboardRange;
    localStorage.setItem("logiflow-dashboard-range", JSON.stringify(dashboardRange));
  }
  if (Array.isArray(state.drivers)) {
    drivers = state.drivers.filter((name) => typeof name === "string" && name.trim());
    localStorage.setItem("logiflow-drivers", JSON.stringify(drivers));
    renderDriverOptions();
    renderDrivers();
  }
  render();
}

initializeSharedState();

// Revalida o estado compartilhado periodicamente como proteção caso um dispositivo
// perca uma notificação Realtime ou retorne de uma conexão instável.
setInterval(refreshSharedState, 15000);
window.addEventListener("focus", refreshSharedState);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshSharedState();
});

const roleLabels = { admin: "Administrador", editor: "Editor", visualizador: "Visualizador" };

async function showLoginOrApp() {
  const statusResult = await window.logiFlowSync.getBootstrapStatus();
  const needsBootstrap = !statusResult.error && statusResult.data?.needsBootstrap === true;
  document.querySelector("#bootstrapFields").hidden = !needsBootstrap;
  document.querySelector("#loginFields").hidden = needsBootstrap;
  document.querySelector("#loginCode").required = !needsBootstrap;
  document.querySelector("#loginPassword").required = !needsBootstrap;
  ["#bootstrapToken", "#bootstrapName", "#bootstrapCode", "#bootstrapPassword", "#bootstrapPasswordConfirmation"].forEach((selector) => { document.querySelector(selector).required = needsBootstrap; });
  document.querySelector("#loginSubmit").textContent = needsBootstrap ? "Criar administrador" : "Entrar";
  document.querySelector("#loginError").hidden = true;
  currentProfile = await window.logiFlowSync.getCurrentProfile();
  if (currentProfile && currentProfile.active !== false) {
    document.querySelector("#loginOverlay").hidden = true;
    applyCurrentProfile();
    await initializeSharedState();
  } else { document.querySelector("#loginOverlay").hidden = false; }
}

function applyCurrentProfile() {
  if (!currentProfile) return;
  document.querySelector(".sidebar-footer strong").textContent = currentProfile.display_name || currentProfile.login_code || "Usuário";
  document.querySelector(".sidebar-footer span").textContent = roleLabels[currentProfile.role] || "Consulta";
  document.querySelector(".avatar").textContent = (currentProfile.display_name || currentProfile.login_code || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const canManage = currentProfile.role === "admin";
  // Texto Automático é exclusivo para administradores.
  const textNav = document.querySelector("#textNav");
  if (textNav) textNav.hidden = !canManage;
  const kmNav = document.querySelector('.nav-item[data-view="km"]');
  if (kmNav) kmNav.hidden = !canManage;
  const canEdit = canManage || currentProfile.role === "editor";
  const editorTripsNav = document.querySelector("#editorTripsNav");
  const tripsNav = document.querySelector("#tripsNav");
  if (editorTripsNav) editorTripsNav.hidden = !canEdit || canManage;
  if (tripsNav) { tripsNav.hidden = !canManage; tripsNav.querySelector("span").textContent = "Viagens · ADMIN"; }
  if (currentProfile.role === "editor") {
    document.querySelector("#tripsScreen").hidden = false;
    document.querySelector("#editorTripsNav")?.classList.add("active");
    document.querySelector("#tripsNav")?.classList.remove("active");
    document.querySelector("#tripsIntro").hidden = true;
    document.querySelector("#tripsContentHead").querySelector("h2").textContent = "Minhas solicitações de viagem";
    document.querySelector("#addTripButton").textContent = "Solicitar viagem";
    document.querySelector("#editorSubmissionNote").hidden = false;
  }
  if (editorTripsNav && currentProfile.role === "editor") editorTripsNav.querySelector("span").textContent = "Minhas viagens";
  // Editores acessam somente Minhas viagens; configurações são reservadas à administração.
  document.querySelector("#settingsNav").hidden = currentProfile.role !== "admin";
  document.querySelector("#newAccountPanel").hidden = !canManage;
  document.querySelector("#accountsPanel").hidden = !canManage;
  document.querySelector("#driversPanel").hidden = !canManage;
  document.querySelector("#driverForm").hidden = !canManage;
  document.querySelector("#addTripButton").hidden = !canEdit;
  document.querySelectorAll(".delete-button").forEach((button) => { button.hidden = !canEdit; });
  document.querySelectorAll(".km-input").forEach((input) => { input.disabled = !canEdit; });
}

let cooldownTimer = null;
function formatCooldown(seconds) { const minutes=Math.floor(seconds/60), remainder=seconds%60; return `${String(minutes).padStart(2,"0")}:${String(remainder).padStart(2,"0")}`; }
function startAuthCooldown(seconds=300) {
 const errorElement=document.querySelector("#loginError"),submitButton=document.querySelector("#loginSubmit"),endAt=Date.now()+seconds*1000;
 localStorage.setItem("logiflow-auth-cooldown",String(endAt));clearInterval(cooldownTimer);submitButton.disabled=true;errorElement.className="login-error";errorElement.hidden=false;
 const updateCooldown=()=>{const remaining=Math.max(0,Math.ceil((endAt-Date.now())/1000));if(remaining>0){errorElement.textContent=`Limite temporário. Nova tentativa em ${formatCooldown(remaining)}.`;submitButton.disabled=true;return;}clearInterval(cooldownTimer);localStorage.removeItem("logiflow-auth-cooldown");errorElement.hidden=true;submitButton.disabled=false;};
 updateCooldown();cooldownTimer=setInterval(updateCooldown,1000);
}
const savedCooldown=Number(localStorage.getItem("logiflow-auth-cooldown")||0);
if(savedCooldown>Date.now())startAuthCooldown(Math.ceil((savedCooldown-Date.now())/1000));
document.querySelector("#loginForm").addEventListener("submit",async(event)=>{
 event.preventDefault();const errorElement=document.querySelector("#loginError"),submitButton=document.querySelector("#loginSubmit");errorElement.hidden=true;submitButton.disabled=true;
 try{
  if(!document.querySelector("#bootstrapFields").hidden){
   const token=document.querySelector("#bootstrapToken").value.trim(),displayName=document.querySelector("#bootstrapName").value.trim(),loginCode=document.querySelector("#bootstrapCode").value.trim(),password=document.querySelector("#bootstrapPassword").value,confirmation=document.querySelector("#bootstrapPasswordConfirmation").value;
   if(!token||!displayName||!loginCode)throw new Error("Preencha o código de configuração, nome e login.");
   if(password.length<12)throw new Error("Use uma senha com pelo menos 12 caracteres.");
   if(password!==confirmation)throw new Error("As senhas não coincidem.");
   const created=await window.logiFlowSync.bootstrapAdmin(token,displayName,loginCode,password);if(created.error)throw created.error;
   const loginResult=await window.logiFlowSync.login(loginCode,password);if(loginResult.error||!loginResult.data?.session)throw new Error("Administrador criado. Entre com o login e a senha definidos.");
   currentProfile=await window.logiFlowSync.getCurrentProfile();if(!currentProfile||currentProfile.role!=="admin")throw new Error("Não foi possível confirmar o perfil administrador.");
   document.querySelector("#loginOverlay").hidden=true;applyCurrentProfile();await initializeSharedState();return;
  }
  const loginCode=document.querySelector("#loginCode").value.trim(),password=document.querySelector("#loginPassword").value;
  const {data,error}=await window.logiFlowSync.login(loginCode,password);if(error||!data?.session)throw new Error("Código ou senha inválidos.");
  currentProfile=await window.logiFlowSync.getCurrentProfile();if(!currentProfile||currentProfile.active===false){await window.logiFlowSync.logout();throw new Error("Esta conta está inativa.");}
  document.querySelector("#loginOverlay").hidden=true;applyCurrentProfile();await initializeSharedState();
 }catch(error){const message=String(error?.message||"");if(message.toLowerCase().includes("rate limit"))startAuthCooldown();else{errorElement.textContent=message||"Não foi possível concluir a operação.";errorElement.className="login-error";errorElement.hidden=false;}}
 finally{if(Number(localStorage.getItem("logiflow-auth-cooldown")||0)<=Date.now())submitButton.disabled=false;}
});
async function logoutCurrentProfile() {
  try {
    await window.logiFlowSync.logout();
    currentProfile = null;
    document.querySelector("#loginOverlay").hidden = false;
    document.querySelector("#loginPassword").value = "";
  } catch (error) {
    console.error("Não foi possível sair da conta:", error);
  }
}
document.querySelector("#logoutButton")?.addEventListener("click", logoutCurrentProfile);
document.querySelectorAll("[data-logout-button]").forEach((button) => {
  button.addEventListener("click", logoutCurrentProfile);
});

document.querySelector("#passwordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const password = String(data.get("password"));
  const confirmation = String(data.get("passwordConfirmation"));
  const message = document.querySelector("#passwordMessage");
  message.hidden = false;
  if (password !== confirmation) {
    message.textContent = "As senhas não coincidem.";
    message.className = "settings-message error";
    return;
  }
  try {
    const { error } = await window.logiFlowSync.changePassword(password);
    if (error) throw error;
    form.reset();
    message.textContent = "Senha alterada com sucesso.";
    message.className = "settings-message success";
  } catch (error) {
    message.textContent = error.message || "Não foi possível alterar a senha.";
    message.className = "settings-message error";
  }
});

function renderDriverOptions() {
  const select = document.querySelector("#tripDriver");
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = `<option value="">Selecione o motorista</option>${drivers.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  if (drivers.includes(currentValue)) select.value = currentValue;
}

function renderDrivers() {
  const list = document.querySelector("#driversList");
  if (!list) return;
  list.innerHTML = drivers.map((name, index) => `
    <div class="driver-row" data-driver-index="${index}">
      <strong>${escapeHtml(name)}</strong>
      <button class="driver-remove" type="button" aria-label="Remover ${escapeHtml(name)}">Remover</button>
    </div>
  `).join("") || "<p>Nenhum motorista cadastrado.</p>";
  renderDriverOptions();
}

document.querySelector("#driverForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = String(data.get("driverName")).trim();
  if (!name) return;
  if (drivers.some((driver) => driver.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
    alert("Este motorista já está cadastrado.");
    return;
  }
  drivers.push(name);
  drivers.sort((a, b) => a.localeCompare(b, "pt-BR"));
  form.reset();
  renderDrivers();
  saveSharedState();
});

document.querySelector("#driversList").addEventListener("click", (event) => {
  const button = event.target.closest(".driver-remove");
  if (!button) return;
  const row = button.closest(".driver-row");
  drivers.splice(Number(row.dataset.driverIndex), 1);
  renderDrivers();
  saveSharedState();
});

async function renderAccounts() {
  const list = document.querySelector("#accountsList");
  try {
    const accounts = await window.logiFlowSync.getAccounts();
    list.innerHTML = accounts.map((account) => `
      <div class="account-row" data-account-id="${escapeHtml(account.id)}">
        <div><strong>${escapeHtml(account.display_name)}</strong><span>${escapeHtml(account.login_code)}</span></div>
        <select class="role-select" aria-label="Cargo de ${escapeHtml(account.display_name)}">
          ${Object.entries(roleLabels).map(([value, label]) => `<option value="${value}" ${account.role === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <button class="account-status ${account.active ? "active" : "inactive"}" type="button">${account.active ? "Ativa" : "Inativa"}</button>
      </div>
    `).join("") || "<p>Nenhuma conta cadastrada.</p>";
  } catch (error) {
    list.innerHTML = `<p>Não foi possível carregar as contas. ${escapeHtml(error.message || "")}</p>`;
  }
}

document.querySelector("#accountForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    if (currentProfile?.role !== "admin") throw new Error("Apenas administradores podem criar contas.");
    const result = await window.logiFlowSync.createAccount(
      String(data.get("displayName")).trim(),
      String(data.get("loginCode")).trim(),
      String(data.get("password")),
      String(data.get("role"))
    );
    if (result.error) throw result.error;
    form.reset();
    await renderAccounts();
    const toast = document.querySelector("#toast");
    toast.textContent = "Conta criada com sucesso";
    toast.classList.add("show");
    setTimeout(() => { toast.textContent = "Texto copiado"; toast.classList.remove("show"); }, 2200);
  } catch (error) {
    alert(error.message || "Não foi possível criar a conta.");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#accountsList").addEventListener("change", async (event) => {
  if (!event.target.classList.contains("role-select")) return;
  const row = event.target.closest(".account-row");
  try {
    await window.logiFlowSync.updateAccount(row.dataset.accountId, { role: event.target.value, updated_at: new Date().toISOString() });
  } catch (error) {
    alert(error.message || "Não foi possível alterar o cargo.");
    await renderAccounts();
  }
});

document.querySelector("#accountsList").addEventListener("click", async (event) => {
  const button = event.target.closest(".account-status");
  if (!button) return;
  const row = button.closest(".account-row");
  const active = button.classList.contains("inactive");
  try {
    await window.logiFlowSync.updateAccount(row.dataset.accountId, { active, updated_at: new Date().toISOString() });
    await renderAccounts();
  } catch (error) {
    alert(error.message || "Não foi possível alterar o status.");
  }
});

document.querySelector("#settingsNav").addEventListener("click", () => {
  renderDriverOptions();
  if (currentProfile?.role === "admin") {
    renderDrivers();
    renderAccounts();
  }
});


// Indicador dinâmico de preenchimento no formulário de nova viagem.
(() => {
  const form = document.querySelector("#tripForm");
  if (!form) return;
  const bar = document.querySelector("#tripProgressBar");
  const text = document.querySelector("#tripProgressText");
  const hint = document.querySelector("#tripProgressHint");
  const fields = () => [...form.querySelectorAll("input[required], select[required], textarea[required]")];
  const updateProgress = () => {
    const all = fields();
    const complete = all.filter((field) => field.value.trim() !== "").length;
    const percent = all.length ? Math.round(complete / all.length * 100) : 0;
    if (bar) bar.style.width = percent + "%";
    if (text) text.textContent = percent + "% concluído";
    if (hint) hint.textContent = percent === 100 ? "Tudo preenchido! Confira os dados e salve a viagem." : percent >= 65 ? "Quase lá — revise os dados e complete os campos restantes." : percent >= 30 ? "Bom progresso! Continue preenchendo os dados da rota." : "Comece informando quem solicitou a viagem.";
  };
  form.addEventListener("input", updateProgress);
  form.addEventListener("change", updateProgress);
  document.querySelector("#addCollaboratorButton")?.addEventListener("click", () => setTimeout(updateProgress, 0));
  document.querySelector("#modalBackdrop")?.addEventListener("click", (event) => { if (event.target.id === "modalBackdrop") return; });
  updateProgress();
})();

renderDriverOptions();
showLoginOrApp();

document.querySelector("#travelPrevMonth")?.addEventListener("click", () => {
  travelCalendarMonth = new Date(travelCalendarMonth.getFullYear(), travelCalendarMonth.getMonth() - 1, 1);
  renderTravelPanel();
});
document.querySelector("#travelNextMonth")?.addEventListener("click", () => {
  travelCalendarMonth = new Date(travelCalendarMonth.getFullYear(), travelCalendarMonth.getMonth() + 1, 1);
  renderTravelPanel();
});
document.querySelector("#travelToday")?.addEventListener("click", () => {
  const now = new Date();
  travelCalendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  travelSelectedDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  travelExpandedTripKey = null;
  renderTravelPanel();
});
