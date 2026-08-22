"use strict";

const CONFIG_PATH = "/etc/cockpit/local-services.json";
const grid = document.getElementById("service-grid");
const notice = document.getElementById("notice");
const emptyState = document.getElementById("empty-state");
const search = document.getElementById("service-search");
const pageTitle = document.getElementById("page-title");
const pageSubtitle = document.getElementById("page-subtitle");

let services = [];

function miniPcHost() {
  const hostname = window.location.hostname;
  return hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;
}

function expandUrl(url) {
  return url.replaceAll("{host}", miniPcHost());
}

function isAllowedUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function createCard(service) {
  const url = expandUrl(String(service.url || ""));
  if (!isAllowedUrl(url)) {
    return null;
  }

  const link = document.createElement("a");
  link.className = "service-card";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.dataset.search = `${service.name || ""} ${service.description || ""} ${service.group || ""}`.toLowerCase();

  const icon = document.createElement("div");
  icon.className = "service-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = service.icon || "↗";

  const content = document.createElement("div");
  content.className = "service-content";

  const name = document.createElement("h2");
  name.textContent = service.name || "Unnamed service";

  const description = document.createElement("p");
  description.textContent = service.description || url;

  content.append(name, description);

  if (service.group) {
    const group = document.createElement("span");
    group.className = "service-group";
    group.textContent = service.group;
    content.append(group);
  }

  const arrow = document.createElement("span");
  arrow.className = "service-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";

  link.append(icon, content, arrow);
  return link;
}

function render(filter = "") {
  const query = filter.trim().toLowerCase();
  grid.replaceChildren();

  let visible = 0;
  for (const service of services) {
    const card = createCard(service);
    if (!card) {
      continue;
    }
    if (query && !card.dataset.search.includes(query)) {
      continue;
    }
    grid.append(card);
    visible += 1;
  }

  emptyState.hidden = visible !== 0;
}

function showNotice(message, isError = false) {
  notice.hidden = false;
  notice.classList.toggle("notice-error", isError);
  notice.textContent = message;
}

function normalizeConfig(config) {
  if (!config || typeof config !== "object" || !Array.isArray(config.services)) {
    throw new Error("Configuration must contain a services array.");
  }
  return config;
}

function loadConfig() {
  const file = cockpit.file(CONFIG_PATH, { syntax: JSON, max_read_size: 262144 });

  file.read()
    .then((config) => {
      file.close();

      if (config === null) {
        services = [];
        showNotice(`No configuration found. Create ${CONFIG_PATH} from examples/services.json.`);
        render();
        return;
      }

      const normalized = normalizeConfig(config);
      services = normalized.services;
      pageTitle.textContent = normalized.title || "Local Services";
      pageSubtitle.textContent = normalized.subtitle || "Quick links to services hosted on this machine.";
      render();
    })
    .catch((error) => {
      file.close();
      services = [];
      showNotice(`Could not load ${CONFIG_PATH}: ${cockpit.message(error)}`, true);
      render();
    });
}

search.addEventListener("input", () => render(search.value));
loadConfig();
