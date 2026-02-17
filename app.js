const API_BASE = "/api/v1";
const STORAGE_BASE = "https://cademeupsi.com.br/storage/";
const WHATSAPP_NUMBER = "5551998062705";
const WA_TEMPLATE =
  "Olá {nome}, encontrei seu perfil na AcolheBem e gostaria de agendar uma conversa.";

const state = {
  page: 1,
  perPage: 12,
  city: "",
  search: "",
  approach: "",
  services: [],
  available24: false,
  lastPage: 1,
  currentData: [],
  lastFetchKey: "",
};

const el = {
  statTotal: document.getElementById("stat-total"),
  statCities: document.getElementById("stat-cities"),
  statGold: document.getElementById("stat-gold"),
  search: document.getElementById("search"),
  city: document.getElementById("city"),
  approach: document.getElementById("approach"),
  services: document.getElementById("services"),
  available24: document.getElementById("available24"),
  applyFilters: document.getElementById("applyFilters"),
  clearFilters: document.getElementById("clearFilters"),
  cards: document.getElementById("cards"),
  listMeta: document.getElementById("list-meta"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  pageInfo: document.getElementById("pageInfo"),
  listView: document.getElementById("list-view"),
  profileView: document.getElementById("profile-view"),
  profileCard: document.getElementById("profile-card"),
  backToList: document.getElementById("backToList"),
};

async function init() {
  bindEvents();
  await Promise.all([fetchStats(), fetchCities()]);
  handleHashChange();
}

function bindEvents() {
  el.applyFilters.addEventListener("click", () => {
    state.page = 1;
    syncStateFromInputs();
    fetchList(true);
  });

  el.clearFilters.addEventListener("click", () => {
    state.page = 1;
    state.city = "";
    state.search = "";
    state.approach = "";
    state.services = [];
    state.available24 = false;
    syncInputsFromState();
    fetchList(true);
  });

  el.prevPage.addEventListener("click", () => {
    if (state.page > 1) {
      state.page -= 1;
      fetchList(true);
    }
  });

  el.nextPage.addEventListener("click", () => {
    if (state.page < state.lastPage) {
      state.page += 1;
      fetchList(true);
    }
  });

  el.backToList.addEventListener("click", () => {
    window.location.hash = "#/";
  });

  window.addEventListener("hashchange", handleHashChange);
}

async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/statistics`);
    const stats = await res.json();
    el.statTotal.textContent = stats.total_users ?? "--";
    el.statGold.textContent = stats.by_highlight?.gold ?? "--";
  } catch (err) {
    el.statTotal.textContent = "--";
    el.statGold.textContent = "--";
  }
}

async function fetchCities() {
  try {
    const res = await fetch(`${API_BASE}/statistics/cities`);
    const cities = await res.json();
    el.statCities.textContent = Array.isArray(cities) ? cities.length : "--";
    if (Array.isArray(cities)) {
      cities.forEach((item) => {
        const option = document.createElement("option");
        option.value = normalizeCity(item.city);
        option.textContent = item.city.trim();
        el.city.appendChild(option);
      });
    }
  } catch (err) {
    el.statCities.textContent = "--";
  }
}

function normalizeCity(city) {
  return city.replace(/\s+/g, " ").trim();
}

function syncStateFromInputs() {
  state.search = el.search.value.trim();
  state.city = el.city.value;
  state.approach = el.approach.value.trim();
  state.services = Array.from(el.services.selectedOptions).map(
    (opt) => opt.value
  );
  state.available24 = el.available24.checked;
}

function syncInputsFromState() {
  el.search.value = state.search;
  el.city.value = state.city;
  el.approach.value = state.approach;
  Array.from(el.services.options).forEach((opt) => {
    opt.selected = state.services.includes(opt.value);
  });
  el.available24.checked = state.available24;
}

function buildListUrl() {
  const params = new URLSearchParams();
  params.set("page", state.page);
  params.set("per_page", state.perPage);
  if (state.city) {
    params.set("city", state.city);
  }
  return `${API_BASE}/users?${params.toString()}`;
}

async function fetchList(force = false) {
  const fetchKey = `${state.page}|${state.city}`;
  if (!force && fetchKey === state.lastFetchKey) {
    renderList(applyFilters(state.currentData));
    return;
  }

  el.listMeta.textContent = "Carregando profissionais...";
  el.cards.innerHTML = "";

  try {
    const url = buildListUrl();
    const res = await fetch(url);
    const payload = await res.json();
    state.lastPage = payload.last_page || 1;
    state.currentData = Array.isArray(payload.data) ? payload.data : [];
    state.lastFetchKey = fetchKey;

    updateServiceOptions(state.currentData);
    renderList(applyFilters(state.currentData), payload);
  } catch (err) {
    el.listMeta.textContent =
      "Não foi possível carregar os profissionais. Tente novamente.";
  }
}

function applyFilters(data) {
  return data
    .filter((user) => user.status === "Ativo")
    .filter((user) => {
      if (!state.search) return true;
      return user.name?.toLowerCase().includes(state.search.toLowerCase());
    })
    .filter((user) => {
      if (!state.approach) return true;
      return user.approach
        ?.toLowerCase()
        .includes(state.approach.toLowerCase());
    })
    .filter((user) => {
      if (!state.services.length) return true;
      const userServices = (user.services || []).map((s) => s.name);
      return state.services.some((service) => userServices.includes(service));
    })
    .filter((user) => {
      if (!state.available24) return true;
      return user.available_next_24h === 1;
    });
}

function updateServiceOptions(data) {
  const services = new Set();
  data.forEach((user) => {
    (user.services || []).forEach((service) => services.add(service.name));
  });

  if (services.size === 0) {
    return;
  }

  el.services.innerHTML = "";
  Array.from(services)
    .sort()
    .forEach((service) => {
      const option = document.createElement("option");
      option.value = service;
      option.textContent = service;
      option.selected = state.services.includes(service);
      el.services.appendChild(option);
    });
}

function renderList(users) {
  if (!users.length) {
    el.listMeta.textContent =
      "Nenhum profissional encontrado com esses filtros.";
    el.cards.innerHTML = "";
    el.pageInfo.textContent = `Página ${state.page} de ${state.lastPage}`;
    return;
  }

  el.listMeta.textContent = `Exibindo ${users.length} profissional(is) nesta página.`;
  el.pageInfo.textContent = `Página ${state.page} de ${state.lastPage}`;
  el.prevPage.disabled = state.page <= 1;
  el.nextPage.disabled = state.page >= state.lastPage;

  el.cards.innerHTML = "";
  users.forEach((user) => {
    el.cards.appendChild(createCard(user));
  });
}

function createCard(user) {
  const card = document.createElement("article");
  card.className = "card";

  const media = document.createElement("div");
  const isGold = user.gold_highlight === "Ativo";
  media.className = `media ${isGold ? "portrait" : "square"}`;

  const link = document.createElement("a");
  link.href = `#/perfil/${user.slug}`;
  link.setAttribute("aria-label", `Ver perfil de ${user.name}`);

  if (user.photo) {
    const img = document.createElement("img");
    img.src = `${STORAGE_BASE}${user.photo}`;
    img.alt = `Foto de ${user.name}`;
    link.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.textContent = getInitials(user.name);
    link.appendChild(placeholder);
  }

  media.appendChild(link);

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = user.name || "Profissional";

  const location = document.createElement("div");
  location.className = "card-meta";
  location.textContent = formatLocation(user);

  const approach = document.createElement("div");
  approach.className = "card-meta";
  approach.textContent = user.approach ? `Abordagem: ${user.approach}` : "";

  const services = document.createElement("div");
  services.className = "card-meta";
  services.textContent = formatServices(user.services);

  body.appendChild(title);
  if (isGold) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = "Destaque Ouro";
    body.appendChild(tag);
  }
  body.appendChild(location);
  if (approach.textContent) body.appendChild(approach);
  if (services.textContent) body.appendChild(services);

  card.appendChild(media);
  card.appendChild(body);
  return card;
}

function formatLocation(user) {
  const city = user.city ? user.city.trim() : "";
  const state = user.state ? user.state.trim() : "";
  if (city && state) return `${city} / ${state}`;
  if (city) return city;
  if (state) return state;
  return "Localização não informada";
}

function formatServices(services) {
  if (!services || !services.length) return "";
  const names = services.map((s) => s.name).filter(Boolean);
  if (!names.length) return "";
  return `Serviços: ${names.join(", ")}`;
}

function getInitials(name = "") {
  const parts = name.split(" ").filter(Boolean);
  if (!parts.length) return "AB";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

function handleHashChange() {
  const hash = window.location.hash || "#/";
  if (hash.startsWith("#/perfil/")) {
    const slug = hash.replace("#/perfil/", "");
    showProfile(slug);
  } else {
    showList();
  }
}

async function showProfile(slug) {
  el.listView.hidden = true;
  el.profileView.hidden = false;
  el.profileCard.innerHTML = "Carregando perfil...";

  try {
    const res = await fetch(`${API_BASE}/users/slug/${slug}`);
    const payload = await res.json();
    renderProfile(payload.data);
  } catch (err) {
    el.profileCard.textContent =
      "Não foi possível carregar este perfil. Tente novamente.";
  }
}

function renderProfile(user) {
  if (!user) {
    el.profileCard.textContent =
      "Perfil não encontrado ou indisponível.";
    return;
  }

  el.profileCard.innerHTML = "";

  const media = document.createElement("div");
  media.className = `media ${user.gold_highlight === "Ativo" ? "portrait" : "square"}`;

  if (user.photo) {
    const img = document.createElement("img");
    img.src = `${STORAGE_BASE}${user.photo}`;
    img.alt = `Foto de ${user.name}`;
    media.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.textContent = getInitials(user.name);
    media.appendChild(placeholder);
  }

  const content = document.createElement("div");
  content.className = "profile-content";

  const name = document.createElement("h2");
  name.textContent = user.name || "Profissional";

  const location = document.createElement("p");
  location.textContent = formatLocation(user);

  const intro = document.createElement("p");
  intro.textContent = user.introduction || "Introdução não informada.";

  const details = document.createElement("div");
  details.className = "profile-details";

  details.appendChild(makeDetail("Abordagem", user.approach || "Não informada"));
  details.appendChild(
    makeDetail("Especialidades", user.specialty || "Não informadas")
  );
  details.appendChild(
    makeDetail("Serviços", formatServices(user.services) || "Não informados")
  );
  details.appendChild(
    makeDetail(
      "Disponibilidade",
      user.available_next_24h === 1 ? "Próximas 24h" : "Não informada"
    )
  );

  const whatsapp = document.createElement("a");
  whatsapp.className = "primary-button";
  whatsapp.textContent = "Falar pelo WhatsApp";
  whatsapp.href = buildWhatsappLink(user.name || "");
  whatsapp.target = "_blank";
  whatsapp.rel = "noopener";

  content.appendChild(name);
  if (user.gold_highlight === "Ativo") {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = "Destaque Ouro";
    content.appendChild(tag);
  }
  content.appendChild(location);
  content.appendChild(intro);
  content.appendChild(details);
  content.appendChild(whatsapp);

  el.profileCard.appendChild(media);
  el.profileCard.appendChild(content);
}

function makeDetail(label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "detail";
  const title = document.createElement("span");
  title.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = value;
  wrapper.appendChild(title);
  wrapper.appendChild(strong);
  return wrapper;
}

function buildWhatsappLink(name) {
  const message = WA_TEMPLATE.replace("{nome}", name);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`;
}

function showList() {
  el.profileView.hidden = true;
  el.listView.hidden = false;
  syncInputsFromState();
  fetchList(false);
}

init();
