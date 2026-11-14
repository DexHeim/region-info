(function () {
  "use strict";

  const main = document.querySelector("#main");
  const mediaBase = "https://cdn.region.game/main/images";
  const sourceOrigin = "https://wiki.region.game";
  const collator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });
  const numbers = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
  const dates = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow" });
  const rubles = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
  const sectionCache = new Map();
  const documentCache = new Map();
  const comparison = new Map();
  const tuning = window.REGION_TUNING;
  const icons = {
    home: "⌂", vehicles: "▰", items: "▧", clothes: "♧", estate: "⌂",
    business: "▤", appearance: "◇", map: "⌖", cases: "▣", animations: "▷",
    season: "✦", achievements: "☆", levels: "↗", factions: "♜", rentals: "▱",
    articles: "≡", updates: "◷", tuning: "⚙"
  };
  const labels = {
    Car: "Автомобиль", Bike: "Мотоцикл", Bicycle: "Велосипед", Boat: "Лодка", Trailer: "Прицеп",
    Compact: "Компакт", Sedan: "Седаны", SUV: "Внедорожники", Coupe: "Купе", Muscle: "Маслкары",
    SportClassic: "Спорт-классика", Sport: "Спорт", Super: "Суперкары", OffRoad: "Внедорожники",
    Industrial: "Промышленные", Utility: "Служебные", Van: "Фургоны", VAN: "Фургоны", Motorcycle: "Мотоциклы",
    Commercial: "Коммерческий", Emergency: "Спецслужбы", Helicopter: "Вертолёты", Military: "Военный",
    Offroad: "Внедорожники", Service: "Служебные", service: "Служебный",
    Gas: "Бензин", Diesel: "Дизель", Electric: "Электро", Petrol: "Бензин", GasAvia: "Авиабензин", None: "Без топлива", Heli: "Вертолёт",
    FWD: "Передний", RWD: "Задний", AWD: "Полный",
    dealer: "Автосалон", donate: "Донат", faction: "Фракция", job: "Работа", rental: "Прокат",
    Male: "Мужское", Female: "Женское", Shared: "Унисекс", Unisex: "Унисекс",
    weapon: "Оружие", food: "Еда", tools: "Инструменты", fishing: "Рыбалка", treasure: "Клад",
    medicine: "Медицина", med: "Медицина", documents: "Документы", materials: "Материалы", other: "Прочее",
    clothes: "Одежда", products: "Продукты", quest: "Задания", resources: "Ресурсы", tech: "Техника", weapon_components: "Обвесы оружия",
    top: "Верх", legs: "Низ", feet: "Обувь", accessory: "Аксессуар", hat: "Головной убор",
    glasses: "Очки", ear: "Серьги", watches: "Часы", bracelets: "Браслеты", mask: "Маска",
    bag: "Сумка", bodyArmor: "Бронежилет", undershirt: "Нижняя одежда",
    yours: "Своё", lamoba: "ЛаМоба", selection: "Эгоист", tsum: "ПУМ"
  };
  let manifest;
  let imageOverrides = {};
  let routeVersion = 0;
  let cleanupView = () => {};
  let toastTimer;

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("\ue000", "RC").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function normalize(value) {
    return String(value ?? "").toLocaleLowerCase("ru").replaceAll("ё", "е");
  }

  function label(value) {
    return labels[value] || value || "—";
  }

  function money(value, currency = "rub") {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
    return currency === "rc" ? `${numbers.format(value)} RC` : rubles.format(value);
  }

  function imageUrl(url) {
    return imageOverrides[url]?.src || url;
  }

  function documentMarkup(markup) {
    for (const [original, replacement] of Object.entries(imageOverrides)) {
      markup = markup.replaceAll(original, escapeHtml(replacement.src));
    }
    const unavailableVideos = Object.values(imageOverrides).map((replacement) => replacement.unavailableVideo).filter(Boolean);
    return markup.replace(/<video\b[\s\S]*?<\/video>/g, (video) => unavailableVideos.some((url) => video.includes(url))
      ? '<p class="media-note">Видеопревью этой анимации пока недоступно.</p>' : video);
  }

  async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Не удалось загрузить ${url} (${response.status})`);
    return response.json();
  }

  function loadSection(section) {
    if (!sectionCache.has(section)) {
      const request = getJson(`data/wiki/${section}.json`).catch((error) => {
        sectionCache.delete(section);
        throw error;
      });
      sectionCache.set(section, request);
    }
    return sectionCache.get(section);
  }

  function sectionTitle(section) {
    return manifest.sections.find((item) => item.id === section)?.title || "Справочник";
  }

  function loadDocument(path) {
    const entry = manifest.pages.find((page) => page.path === path);
    if (!entry) return Promise.resolve(null);
    if (!documentCache.has(entry.chunk)) {
      const request = getJson(`data/wiki/details/${entry.chunk}`).catch((error) => {
        documentCache.delete(entry.chunk);
        throw error;
      });
      documentCache.set(entry.chunk, request);
    }
    return documentCache.get(entry.chunk).then((chunk) => chunk[path]);
  }

  function localHref(path) {
    const url = new URL(path, sourceOrigin);
    if (url.origin !== sourceOrigin) return url.href;
    let query = url.search;
    if (url.hash) {
      const params = new URLSearchParams(query);
      const anchor = decodeURIComponent(url.hash.slice(1));
      params.set(url.pathname === "/articles/" && manifest.categories[anchor] ? "category" : "anchor", anchor);
      query = `?${params}`;
    }
    return `#${url.pathname}${query}`;
  }

  function pageHeading(title, description = "", section = "") {
    return `<div class="breadcrumbs"><a href="#/">Главная</a>${section ? `<span>›</span><a href="#/${section}">${escapeHtml(sectionTitle(section))}</a>` : ""}</div>
      <header class="page-head"><h1>${escapeHtml(title)}</h1>${description ? `<p class="intro">${escapeHtml(description)}</p>` : ""}</header>`;
  }

  function sourceNote(path) {
    return `<p class="source-note">Данные из Region Wiki. <a href="${sourceOrigin}${escapeHtml(path)}" target="_blank" rel="noreferrer">Открыть страницу источника ↗</a></p>`;
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
  }

  function renderNavigation(section) {
    const groups = [
      ["", ["home", "articles", "updates"]],
      ["Каталоги", ["vehicles", "items", "clothes", "appearance", "estate", "business", "map"]],
      ["Прогресс и занятия", ["cases", "animations", "season", "achievements", "levels", "factions", "rentals"]],
      ["Наши дополнения", ["tuning"]]
    ];
    document.querySelector("#navigation").innerHTML = groups.map(([title, items]) => (
      `${title ? `<p class="nav-label">${title}</p>` : ""}${items.map((id) => {
        const text = id === "home" ? "Главная" : id === "tuning" ? "Расчёт тюнинга" : sectionTitle(id);
        return `<a class="nav-link" href="#/${id === "home" ? "" : id}" ${id === section ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${icons[id]}</span>${text}</a>`;
      }).join("")}`
    )).join("");
  }

  function renderHome() {
    const counts = { vehicles: "321 модель · характеристики и тюнинг", items: "440 предметов · вес и свойства", clothes: "2 302 вещи · 19 278 расцветок", estate: "1 032 объекта · цены и гаражи", business: "57 бизнесов · налоги и склады", appearance: "1 065 вариантов внешности", map: "498 мест · 193 зоны", articles: "74 статьи о механиках" };
    const featured = ["vehicles", "items", "clothes", "estate", "business", "appearance", "map", "articles"];
    const quick = [
      ["/articles/start/first-day/", "Первый день в игре"],
      ["/articles/jobs/overview/", "Работы и заработок"],
      ["/articles/systems/pets/", "Как завести питомца"],
      ["/articles/crime/house-burglary/", "Кражи со взломом"],
      ["/articles/vehicles/car-market/", "Продажа машины на авторынке"]
    ];
    main.innerHTML = `<section class="hero"><p class="eyebrow">Мир Region</p><h1>Всё для жизни<br>в регионе</h1><p>Игровые механики, транспорт, предметы и места. Цены улучшений и калькулятор тюнинга — рядом с автомобилями.</p><div class="hero-links"><a class="primary-button" href="#/articles">Изучить механики ↗</a><a class="quiet-button" href="#/vehicles">Выбрать автомобиль</a></div></section>
      <div class="section-heading"><h2>Справочник</h2><a href="#/search">Поиск по всем разделам ↗</a></div>
      <div class="section-grid">${featured.map((id) => `<a class="section-card" href="#/${id}"><span class="section-icon" aria-hidden="true">${icons[id]}</span><span class="arrow" aria-hidden="true">↗</span><h3>${sectionTitle(id)}</h3><p>${counts[id]}</p></a>`).join("")}</div>
      <div class="home-columns"><section><div class="section-heading"><h2>Обновления игры</h2><a href="#/updates">Все обновления ↗</a></div><a class="update-card" href="#/updates/2026-11-14-pets-heists-car-market/"><img src="${sourceOrigin}/img/updates/2026-11-14-pets-heists-car-market/cover-thumb.webp" alt="Обновление Region" loading="lazy"><div><time datetime="2026-11-14">14 ноября 2026</time><h3>Питомцы, кражи со взломом и авторынок</h3><p>Уход за животными, налёты на жильё и продажа машин.</p></div></a></section>
      <section><div class="section-heading"><h2>С чего начать</h2></div><div class="quick-links">${quick.map(([path, title]) => `<a href="${localHref(path)}">${title}<span>↗</span></a>`).join("")}</div></section></div>
      <div class="section-heading"><h2>Больше в игре</h2></div><div class="section-grid">${["cases", "animations", "season", "achievements", "levels", "factions", "rentals", "tuning"].map((id) => `<a class="section-card" href="#/${id}"><span class="section-icon" aria-hidden="true">${icons[id]}</span><span class="arrow" aria-hidden="true">↗</span><h3>${id === "tuning" ? "Расчёт тюнинга" : sectionTitle(id)}</h3></a>`).join("")}</div>`;
  }

  function normalizeRows(section, payload) {
    const data = payload.data.find((island) => island.data.rows || island.data.items || island.data.vehicles)?.data || {};
    if (section === "vehicles") {
      return data.vehicles.map((vehicle) => ({
        id: vehicle.model, href: `/vehicles/${vehicle.model}/`, title: `${vehicle.brand} ${vehicle.name}`,
        image: `${mediaBase}/vehicles/${vehicle.model}.png`, price: vehicle.price_dealer ?? vehicle.price_donate,
        priceLabel: vehicle.price_dealer == null ? "Оценочная стоимость" : "Цена в салоне",
        sub: `${label(vehicle.class)} · ${label(vehicle.access)}`, kind: vehicle.class, kindLabel: label(vehicle.class),
        level: vehicle.access, levelLabel: label(vehicle.access), city: vehicle.brand,
        stats: [`${numbers.format(vehicle.max_speed_kmh)} км/ч`, vehicle.t100_s == null ? "" : `${numbers.format(vehicle.t100_s)} с до 100`, `${vehicle.seats} мест`, `${vehicle.trunk_kg} кг`],
        sortBy: { price: vehicle.price_dealer ?? vehicle.price_donate, speed: vehicle.max_speed_kmh, acceleration: vehicle.t100_s, trunk: vehicle.trunk_kg }, vehicle
      }));
    }
    if (section === "items") {
      return data.items.map((item) => ({
        id: item.id, href: `/items/${item.id}/`, title: item.name, sub: item.description,
        image: `${mediaBase}/inventory/items/${item.id}.avif`, kind: item.category, kindLabel: label(item.category),
        level: String(item.rarity), levelLabel: ["", "Обычный", "Редкий", "Дорогой", "Великолепный", "Люкс", "VIP"][item.rarity] || String(item.rarity),
        stats: [`${numbers.format(item.weight_kg)} кг`, `${item.size_w}×${item.size_h}`, `${item.max_stack} шт.`],
        sortBy: { weight: item.weight_kg, stack: item.max_stack, rarity: item.rarity }
      }));
    }
    if (section === "clothes") {
      const slots = { hat: "hats", ear: "ears", bodyArmor: "bodyarmor" };
      return data.rows.map((row) => ({
        id: row[0], href: `/clothes/${row[0]}/`, title: row[2], kind: row[4], kindLabel: label(row[4]),
        level: row[3], levelLabel: label(row[3]), city: (row[8] || "").split(",").filter(Boolean).map(label),
        image: `${mediaBase}/clothes/${slots[row[4]] || row[4].toLowerCase()}/${row[3] === "Shared" ? "male" : row[3].toLowerCase()}/${row[5]}/${row[10]}_small.avif`,
        sub: `${label(row[3])} · ${row[9]} расцветок`, price: row[7],
        stats: [(row[8] || "").split(",").map(label).join(" · "), row[12] ? "Из кейса" : "", row[14] ? "Сезонный пропуск" : ""],
        sortBy: { price: row[7], colors: row[9], rarity: row[6] }
      }));
    }
    if (data.rows) return data.rows;
    return manifest.pages.filter((document) => document.section === section).map((document) => ({
      id: document.path, href: document.path, title: document.title, sub: document.summary,
      image: document.image, stats: [],
      kindLabel: section === "updates" ? dates.format(new Date(document.path.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "1970-01-01")) : "",
      sortBy: { date: Date.parse(document.path.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "1970-01-01") }
    }));
  }

  function catalogSettings(section, payload) {
    if (section === "updates") return {
      sorts: [{ key: "date", dir: "desc", label: "Сначала новые" }, { key: "date", dir: "asc", label: "Сначала ранние" }, { key: "name", dir: "asc", label: "По названию" }]
    };
    const text = payload.data.find((island) => island.data.text)?.data.text;
    if (text) return text;
    if (section === "vehicles") return {
      kindTitle: "Класс", levelTitle: "Доступ", cityTitle: "Марка",
      sorts: [{ key: "name", dir: "asc", label: "По названию" }, { key: "price", dir: "asc", label: "Сначала дешевле" }, { key: "price", dir: "desc", label: "Сначала дороже" }, { key: "speed", dir: "desc", label: "По скорости" }, { key: "acceleration", dir: "asc", label: "По разгону" }, { key: "trunk", dir: "desc", label: "По багажнику" }]
    };
    if (section === "items") return {
      kindTitle: "Категория", levelTitle: "Редкость",
      sorts: [{ key: "name", dir: "asc", label: "По названию" }, { key: "weight", dir: "asc", label: "Легче" }, { key: "weight", dir: "desc", label: "Тяжелее" }, { key: "rarity", dir: "desc", label: "По редкости" }]
    };
    if (section === "clothes") return {
      kindTitle: "Тип одежды", levelTitle: "Для кого", cityTitle: "Магазины",
      sorts: [{ key: "name", dir: "asc", label: "По названию" }, { key: "price", dir: "asc", label: "Сначала дешевле" }, { key: "price", dir: "desc", label: "Сначала дороже" }, { key: "colors", dir: "desc", label: "Больше расцветок" }]
    };
    return { sorts: [{ key: "name", dir: "asc", label: "По названию" }] };
  }

  function filterSelect(rows, field, title, selected) {
    const values = new Map(rows.flatMap((row) => {
      const items = Array.isArray(row[field]) ? row[field] : [row[field]];
      return items.filter((value) => value != null && value !== "").map((value) => [String(value), row[`${field}Label`] || value]);
    }));
    if (values.size < 2) return "";
    const combined = selected.includes(",") ? `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected.split(",").map((value) => values.get(value) || value).join(", "))}</option>` : "";
    return `<label class="filter-label">${escapeHtml(title)}<select data-filter="${field}"><option value="">Все</option>${combined}${[...values].sort((a, b) => collator.compare(a[1], b[1])).map(([value, text]) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></label>`;
  }

  function cardHtml(row, section, settings) {
    const currencyReward = row.level === "money" || row.level === "rc";
    const symbol = row.level === "money" ? "₽" : row.level === "rc" ? "RC" : section === "levels" ? String(row.id) : icons[section] || "◇";
    const iconUrl = row.blip ? new URL(row.blip, sourceOrigin).href : "";
    let media = `<span class="media-placeholder ${currencyReward ? "media-placeholder--currency" : ""}" aria-hidden="true">${escapeHtml(symbol)}</span>`;
    if (row.image) {
      const presentation = imageOverrides[row.image];
      const cover = !presentation && row.fit !== "contain" && ["estate", "business", "factions", "updates"].includes(section);
      const className = presentation?.fit === "icon" ? "media-icon" : cover ? "cover" : "";
      media = `<img src="${escapeHtml(imageUrl(row.image))}" alt="" loading="lazy" decoding="async" class="${className}">`;
    } else if (iconUrl && !currencyReward && section !== "levels") {
      media = `<img class="media-icon" src="${escapeHtml(iconUrl)}" alt="" loading="lazy">`;
    }
    const category = [row.kindLabel, row.levelLabel, ["vehicles", "clothes"].includes(section) ? "" : Array.isArray(row.city) ? row.city.join(", ") : row.city].filter(Boolean).join(" · ");
    const description = row.vehicle ? "" : row.sub || (row.cat && !category.includes(row.cat) ? row.cat : "");
    const statLabels = row.vehicle ? ["Скорость", "0–100 км/ч", "Места", "Багажник"]
      : section === "items" ? ["Вес", "Размер", "В стопке"]
      : section === "clothes" ? ["Магазины", "Источник", "Источник"] : settings.columns || [];
    const stats = (row.stats || []).map((value, index) => {
      if (value === null || value === undefined || value === "" || value === "—") return "";
      if (section === "season" && index === 0 && row.badge) return "";
      return `<div>${statLabels[index] ? `<dt>${escapeHtml(statLabels[index])}</dt>` : ""}<dd>${escapeHtml(value)}</dd></div>`;
    }).join("");
    const foot = row.foot && !["season", "levels"].includes(section) ? `<p class="card-foot">${escapeHtml(row.foot)}</p>` : "";
    return `<article class="catalog-card"><a class="card-media" href="${localHref(row.href)}" aria-label="${escapeHtml(row.title)}" data-icon="${escapeHtml(iconUrl)}" data-symbol="${escapeHtml(symbol)}">${section === "season" && row.badge ? `<span class="card-badge">${escapeHtml(row.badge)}</span>` : ""}${media}</a><div class="card-body"><p class="card-category">${escapeHtml(category)}</p><h2><a href="${localHref(row.href)}">${escapeHtml(row.title)}</a></h2>${row.price != null ? `<p class="card-price">${row.priceLabel ? `<small>${escapeHtml(row.priceLabel)}</small>` : ""}${money(row.price, row.currency)}</p>` : ""}${description ? `<p class="card-description">${escapeHtml(description)}</p>` : ""}${stats ? `<dl class="card-stats">${stats}</dl>` : ""}${foot}</div>${row.vehicle ? `<label class="compare-select"><input type="checkbox" data-compare="${escapeHtml(row.id)}" ${comparison.has(row.id) ? "checked" : ""}>Добавить к сравнению</label>` : ""}</article>`;
  }

  function paginationHtml(page, pages) {
    if (pages < 2) return "";
    const choices = new Set([1, pages, page - 1, page, page + 1]);
    return `<nav class="pagination" aria-label="Страницы каталога"><button data-page="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="Предыдущая страница">←</button>${[...choices].filter((value) => value > 0 && value <= pages).sort((a, b) => a - b).map((value) => `<button data-page="${value}" ${page === value ? 'aria-current="page"' : ""}>${value}</button>`).join("")}<button data-page="${page + 1}" ${page === pages ? "disabled" : ""} aria-label="Следующая страница">→</button></nav>`;
  }

  function tableHtml(rows, settings) {
    return `<div class="catalog-table-wrap"><table class="catalog-table"><thead><tr><th scope="col">Название</th>${(settings.columns || []).map((title) => `<th scope="col">${escapeHtml(title)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr><th scope="row"><a href="${localHref(row.href)}">${escapeHtml(row.title)}</a></th>${(settings.columns || []).map((title, index) => `<td>${escapeHtml(row.stats?.[index] ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function renderCatalog(section, payload, params) {
    const rows = normalizeRows(section, payload);
    const settings = catalogSettings(section, payload);
    const sorts = settings.sorts;
    const initialSort = `${sorts[0].key}:${sorts[0].dir}`;
    const incoming = new URLSearchParams(params);
    const aliases = { class: "kind", cat: "kind", slot: "kind", g: "level", access: "level", shop: "city" };
    for (const [from, to] of Object.entries(aliases)) {
      if (incoming.has(from) && !incoming.has(to)) incoming.set(to, from === "shop" ? incoming.get(from).split(",").map(label).join(",") : incoming.get(from));
    }
    if (section === "vehicles" && incoming.has("brand")) {
      const brand = payload.data[0].data.vehicles.find((vehicle) => vehicle.brand_slug === incoming.get("brand"))?.brand;
      if (brand) incoming.set("city", brand);
    }
    if (incoming.has("sort") && !incoming.get("sort").includes(":")) {
      const sortAliases = { max_speed_kmh: "speed", t100_s: "acceleration", price_dealer: "price", trunk_kg: "trunk" };
      incoming.set("sort", `${sortAliases[incoming.get("sort")] || incoming.get("sort")}:${incoming.get("dir") || "asc"}`);
    }
    const state = {
      query: incoming.get("q") || "", kind: incoming.get("kind") || "", level: incoming.get("level") || "",
      city: incoming.get("city") || "", sort: incoming.get("sort") || initialSort,
      min: incoming.get("min") || "", max: incoming.get("max") || "", page: Math.max(1, Number(incoming.get("page")) || 1), size: 24,
      view: incoming.get("view") || settings.defaultView || "cards"
    };
    const introductions = {
      vehicles: "Полный каталог транспорта. В карточках автомобилей — наши расчёты стоимости улучшений и внешнего тюнинга.",
      estate: "Квартиры открываются внутри карточек жилых комплексов. Дома и отели представлены отдельными карточками.",
      season: payload.description || ""
    };
    const guide = section === "season" ? '<p class="catalog-guide"><a href="#/articles/systems/season-pass/">Задания, опыт и покупка премиума ↗</a></p>' : "";
    main.innerHTML = pageHeading(payload.title, introductions[section] || "", section) + guide +
      `<div class="toolbar"><input type="search" id="catalogQuery" aria-label="Поиск в разделе" placeholder="${escapeHtml(settings.search || "Найти в разделе")}" value="${escapeHtml(state.query)}">${filterSelect(rows, "kind", settings.kindTitle || "Тип", state.kind)}${filterSelect(rows, "level", settings.levelTitle || "Категория", state.level)}${filterSelect(rows, "city", settings.cityTitle || "Город", state.city)}<label class="filter-label">Сортировка<select id="catalogSort">${sorts.map((sort) => `<option value="${sort.key}:${sort.dir}" ${state.sort === `${sort.key}:${sort.dir}` ? "selected" : ""}>${escapeHtml(sort.label)}</option>`).join("")}</select></label>${rows.some((row) => row.price != null) ? `<label class="filter-label">Цена от<input id="minPrice" type="number" min="0" aria-label="Минимальная цена" value="${escapeHtml(state.min)}"></label><label class="filter-label">Цена до<input id="maxPrice" type="number" min="0" aria-label="Максимальная цена" value="${escapeHtml(state.max)}"></label>` : ""}<button class="quiet-button" id="resetFilters" type="button">Сбросить</button></div><div id="catalogResults" aria-live="polite"></div>${section === "vehicles" ? '<p class="source-note"><a href="cars.html">Наш каталог с замерами управляемости и торможения ↗</a></p>' : ""}${sourceNote(`/${section}/`)}`;
    const results = main.querySelector("#catalogResults");
    const filterToggle = document.createElement("button");
    filterToggle.className = "quiet-button filter-toggle";
    filterToggle.type = "button";
    filterToggle.setAttribute("aria-expanded", "false");
    filterToggle.textContent = "Фильтры";
    const toolbar = main.querySelector(".toolbar");
    main.querySelector("#catalogQuery").after(filterToggle);
    filterToggle.addEventListener("click", () => {
      filterToggle.setAttribute("aria-expanded", String(toolbar.classList.toggle("filters-open")));
    });

    function matchesFacet(value, selected) {
      if (!selected) return true;
      const available = Array.isArray(value) ? value.map(String) : [String(value)];
      return selected.split(",").some((choice) => available.includes(choice));
    }

    function draw() {
      const filterCount = [state.kind, state.level, state.city, state.min, state.max].filter((value) => value !== "").length;
      filterToggle.textContent = filterCount ? `Фильтры (${filterCount})` : "Фильтры";
      const terms = normalize(state.query).split(/\s+/).filter(Boolean);
      const filtered = rows.filter((row) => {
        const haystack = normalize([row.title, row.sub, row.kindLabel, row.levelLabel, row.city, row.id, ...(row.stats || [])].join(" "));
        return terms.every((term) => haystack.includes(term))
          && matchesFacet(row.kind, state.kind)
          && matchesFacet(row.level, state.level)
          && matchesFacet(row.city, state.city)
          && (state.min === "" || (row.price != null && row.price >= Number(state.min)))
          && (state.max === "" || (row.price != null && row.price <= Number(state.max)));
      });
      const [key, direction] = state.sort.split(":");
      filtered.sort((a, b) => {
        if (key === "name") return collator.compare(a.title, b.title) * (direction === "desc" ? -1 : 1);
        const first = a.sortBy?.[key];
        const second = b.sortBy?.[key];
        if (first == null && second == null) return collator.compare(a.title, b.title);
        if (first == null) return 1;
        if (second == null) return -1;
        return (first - second) * (direction === "desc" ? -1 : 1);
      });
      const pages = Math.max(1, Math.ceil(filtered.length / state.size));
      state.page = Math.min(state.page, pages);
      const pageRows = filtered.slice((state.page - 1) * state.size, state.page * state.size);
      const tableAvailable = settings.columns?.length > 0;
      const content = state.view === "table" && tableAvailable ? tableHtml(pageRows, settings) : `<div class="catalog-grid">${pageRows.map((row) => cardHtml(row, section, settings)).join("")}</div>`;
      results.innerHTML = `<div class="result-line"><span>Найдено ${numbers.format(filtered.length)} из ${numbers.format(rows.length)}</span>${tableAvailable ? `<label>Вид <select id="catalogView" aria-label="Вид каталога"><option value="cards" ${state.view === "cards" ? "selected" : ""}>Карточки</option><option value="table" ${state.view === "table" ? "selected" : ""}>Таблица</option></select></label>` : ""}<label>На странице <select id="pageSize" aria-label="Количество на странице">${[24, 48, 96].map((size) => `<option ${state.size === size ? "selected" : ""}>${size}</option>`).join("")}</select></label></div>${pageRows.length ? content : '<div class="empty">По выбранным условиям ничего не найдено.</div>'}${paginationHtml(state.page, pages)}`;
      results.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
        state.page = Number(button.dataset.page);
        draw();
        main.querySelector(".toolbar").scrollIntoView({ block: "start" });
      }));
      results.querySelector("#pageSize").addEventListener("change", (event) => { state.size = Number(event.target.value); state.page = 1; draw(); });
      results.querySelector("#catalogView")?.addEventListener("change", (event) => { state.view = event.target.value; draw(); });
      results.querySelectorAll("[data-compare]").forEach((input) => input.addEventListener("change", () => {
        toggleComparison(rows.find((row) => row.id === input.dataset.compare).vehicle);
        input.checked = comparison.has(input.dataset.compare);
      }));
      const query = new URLSearchParams();
      for (const field of ["kind", "level", "city", "min", "max", "sort"]) {
        if (state[field]) query.set(field, state[field]);
      }
      if (state.query) query.set("q", state.query);
      if (state.view !== "cards") query.set("view", state.view);
      if (state.page > 1) query.set("page", state.page);
      history.replaceState(null, "", `#/${section}${query.size ? `?${query}` : ""}`);
    }

    main.querySelector("#catalogQuery").addEventListener("input", (event) => { state.query = event.target.value; state.page = 1; draw(); });
    main.querySelectorAll("[data-filter]").forEach((select) => select.addEventListener("change", () => { state[select.dataset.filter] = select.value; state.page = 1; draw(); }));
    main.querySelector("#catalogSort").addEventListener("change", (event) => { state.sort = event.target.value; state.page = 1; draw(); });
    for (const [id, field] of [["minPrice", "min"], ["maxPrice", "max"]]) {
      main.querySelector(`#${id}`)?.addEventListener("input", (event) => { state[field] = event.target.value; state.page = 1; draw(); });
    }
    main.querySelector("#resetFilters").addEventListener("click", () => { history.replaceState(null, "", `#/${section}`); route(); });
    draw();
  }

  function renderArticles(params) {
    const category = params.get("category") || "";
    const pages = manifest.pages.filter((page) => page.section === "articles");
    main.innerHTML = pageHeading("Игровые механики", "74 статьи о работах, хобби, семьях, криминале и повседневной жизни в Region.") +
      `<div class="article-categories"><a class="category-link ${!category ? "active" : ""}" href="#/articles">Все статьи</a>${Object.entries(manifest.categories).map(([id, title]) => `<a class="category-link ${category === id ? "active" : ""}" href="#/articles?category=${id}">${escapeHtml(title)}</a>`).join("")}</div>` +
      Object.entries(manifest.categories).filter(([id]) => !category || category === id).map(([id, title]) => `<section class="article-group"><h2>${escapeHtml(title)}</h2><div class="article-links">${pages.filter((page) => page.path.split("/")[2] === id).map((page) => `<a class="article-link" href="${localHref(page.path)}"><h3>${escapeHtml(page.title)} ↗</h3><p>${escapeHtml(page.summary)}</p></a>`).join("")}</div></section>`).join("");
  }

  function fact(labelText, value) {
    return `<div class="detail-fact"><span>${escapeHtml(labelText)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function tuningHtml(price) {
    const groups = (title, collection, kind, open) => `<details ${open ? "open" : ""}><summary>${title}</summary><div class="tuning-groups">${collection.map((group) => `<section class="tuning-group"><h3>${escapeHtml(group.title)}</h3><ul>${group.options.map(([name, referencePrice]) => `<li><span>${escapeHtml(name)}</span><strong>${money(tuning.calculatePrice(referencePrice, price, kind))}</strong></li>`).join("")}</ul></section>`).join("")}</div></details>`;
    const fixed = [{ title: "Фиксированные цены ателье из Wiki", options: [["Бронированный кузов", 30000], ["Смена типа краски", 15000]] }];
    return `<div class="tuning-summary"><div><span>Цена автомобиля для расчёта</span><strong>${money(price)}</strong></div><div><span>Выкуп 70% для салонной машины</span><strong>${money(Math.round(price * .7))}</strong></div><div><span>Все уровни улучшений по порядку</span><strong>${money(tuning.calculatePerformanceTotal(price))}</strong></div></div>${groups("Улучшения", tuning.performance, "mechanical", true)}${groups("Покраска, тонировка, колёса и фары", tuning.appearance, "visual", false)}${groups("Клаксон", [tuning.horns], "fixed", false)}${groups("Другие услуги ателье", fixed, "fixed", false)}<p class="tuning-note"><a href="#/articles/vehicles/fuel-repair-tuning/">Механики нитро, GPS-маячка, ливрей, дыма шин, шлема и ремонта ↗</a></p>`;
  }

  function tuningNote() {
    return '<p class="tuning-note">Приблизительный расчёт Region Info по фактическим ценам BMW M5 (E39) за 1 700 000 ₽. Цены масштабируются по стоимости машины с округлением до 100 ₽, минимум улучшения — 10 000 ₽. Клаксоны имеют фиксированную цену. Итог включает покупку каждого уровня последовательно.</p>';
  }

  function renderTuning(params) {
    const initialPrice = Math.max(1, Number(params.get("price")) || 1700000);
    main.innerHTML = pageHeading("Калькулятор тюнинга", "Наши дополнительные расчёты цен двигателя, трансмиссии, тормозов, подвески, турбо и внешнего вида.") +
      `<form class="calculator-form" id="calculatorForm"><label>Исходная стоимость<select id="priceType"><option value="sale">Цена автомобиля</option><option value="state">Гос. стоимость салонной машины (70%)</option></select></label><label>Сумма, ₽<input id="tuningPrice" type="number" min="1" step="100" value="${initialPrice}" inputmode="numeric" required></label></form><section class="tuning-panel">${tuningNote()}<div id="tuningResults" aria-live="polite"></div></section><p class="source-note"><a href="cars.html">Открыть прежний каталог с замерами автомобилей ↗</a></p>`;
    const priceInput = main.querySelector("#tuningPrice");
    const priceType = main.querySelector("#priceType");
    function draw() {
      const price = Number(priceInput.value) / (priceType.value === "state" ? .7 : 1);
      main.querySelector("#tuningResults").innerHTML = Number.isFinite(price) && price > 0 ? tuningHtml(price) : '<p role="status">Укажите стоимость автомобиля больше нуля.</p>';
    }
    main.querySelector("#calculatorForm").addEventListener("submit", (event) => event.preventDefault());
    priceInput.addEventListener("input", draw);
    priceType.addEventListener("change", draw);
    draw();
  }

  function localizeDocument(container, path) {
    const iconSources = new Set(Object.values(imageOverrides).filter((replacement) => replacement.fit === "icon").map((replacement) => replacement.src));
    container.querySelectorAll("img").forEach((image) => {
      if (iconSources.has(image.src)) image.dataset.mediaKind = "icon";
    });
    container.querySelectorAll("a[href]").forEach((link) => {
      const raw = link.getAttribute("href");
      if (raw.startsWith("#")) {
        link.href = `${localHref(path)}?anchor=${encodeURIComponent(raw.slice(1))}`;
        return;
      }
      const url = new URL(raw, sourceOrigin);
      if (url.origin === sourceOrigin && (manifest.pages.some((page) => page.path === url.pathname) || manifest.sections.some((section) => url.pathname === `/${section.id}/`))) {
        link.href = localHref(url.href);
      } else {
        link.target = "_blank";
        link.rel = "noreferrer";
      }
    });
    container.querySelectorAll("video").forEach((video) => { video.muted = true; });
    container.querySelectorAll(".gallery img[data-full]").forEach((image, index, images) => {
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", image.alt || "Посмотреть расцветку");
      function showImage() {
        const preview = container.querySelector("img:not([data-full])");
        if (preview) { preview.src = image.dataset.full; preview.alt = image.alt; }
        const variantName = container.querySelector(".imported-info > p > span");
        if (variantName) variantName.textContent = image.alt;
        const counter = [...container.querySelectorAll(".imported-stage > span")].find((span) => /\d+\s*\/\s*\d+/.test(span.textContent));
        if (counter) counter.textContent = `${index + 1} / ${images.length}`;
      }
      image.addEventListener("click", showImage);
      image.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); showImage(); } });
    });
  }

  async function renderDocument(section, payload, path, params, version) {
    const documentData = await loadDocument(path);
    if (version !== routeVersion) return;
    if (!documentData) throw new Error("Эта страница отсутствует в локальной базе.");
    const vehicle = section === "vehicles" ? payload.data[0].data.vehicles.find((item) => item.model === path.split("/")[2]) : null;
    const toc = documentData.headings.filter((heading) => heading.id).map((heading) => `<a href="${localHref(path)}?anchor=${encodeURIComponent(heading.id)}">${escapeHtml(heading.title)}</a>`).join("") + (vehicle ? `<a href="${localHref(path)}?anchor=region-tuning">Расчёт тюнинга</a>` : "");
    document.title = `${documentData.title} — Region Info`;
    main.innerHTML = pageHeading(documentData.title, documentData.summary, section) +
      (vehicle ? `<div class="detail-hero"><img class="detail-image" src="${escapeHtml(imageUrl(`${mediaBase}/vehicles/${vehicle.model}.png`))}" alt="${escapeHtml(documentData.title)}"><div class="detail-facts">${fact(vehicle.price_dealer == null ? "Оценочная стоимость" : "Базовая цена в салоне", money(vehicle.price_dealer ?? vehicle.price_donate))}${fact("Максимальная скорость", `${numbers.format(vehicle.max_speed_kmh)} км/ч`)}${fact("Разгон 0–100", vehicle.t100_s == null ? "—" : `${numbers.format(vehicle.t100_s)} с`)}${fact("Багажник", `${vehicle.trunk_kg} кг`)}</div></div><button type="button" class="quiet-button" id="detailCompare">${comparison.has(vehicle.model) ? "Убрать из сравнения" : "Добавить к сравнению"}</button><section id="vehicleTuning" class="tuning-panel"><h2>Стоимость улучшений и тюнинга</h2>${tuningNote()}${vehicle.price_dealer > 0 ? tuningHtml(vehicle.price_dealer) : '<p class="tuning-note">Для этой модели отсутствует салонная цена. Укажите стоимость в калькуляторе для расчёта.</p><a class="quiet-button" href="#/tuning">Открыть калькулятор</a>'}</section><div id="legacySpecs"></div>` : "") +
      `<div class="article-layout"><article class="prose ${vehicle ? "prose--vehicle" : ""}">${documentMarkup(documentData.html)}</article>${toc ? `<aside class="article-toc" aria-label="На этой странице"><details id="pageToc"><summary>На этой странице</summary>${toc}</details></aside>` : ""}</div>${documentData.widgets.filter((widget) => widget.component.includes("MiniMap")).map((widget) => `<p><a class="quiet-button" href="#/map?x=${widget.data.x}&y=${widget.data.y}">На карте · ${escapeHtml(widget.data.label || "Расположение")} ↗</a></p>`).join("")}${sourceNote(path)}`;
    const tocDetails = main.querySelector("#pageToc");
    if (tocDetails) tocDetails.open = !matchMedia("(max-width: 1200px)").matches;
    if (vehicle) {
      const tuningPanel = main.querySelector("#vehicleTuning");
      tuningPanel.dataset.anchor = "region-tuning";
      const specs = main.querySelector('.prose [data-anchor="specs"]')?.closest("section");
      if (specs) {
        specs.after(tuningPanel);
        tuningPanel.after(main.querySelector("#legacySpecs"));
      }
    }
    localizeDocument(main.querySelector(".prose"), path);
    main.querySelector("#detailCompare")?.addEventListener("click", (event) => {
      toggleComparison(vehicle);
      event.target.textContent = comparison.has(vehicle.model) ? "Убрать из сравнения" : "Добавить к сравнению";
    });
    if (vehicle) {
      const legacy = await getJson("data/cars.json").catch(() => []);
      if (version !== routeVersion) return;
      const modelName = normalize(`${vehicle.brand} ${vehicle.name}`).replace(/[^\p{L}\p{N}]/gu, "");
      const oldCar = legacy.find((car) => car.wiki_model ? car.wiki_model === vehicle.model : normalize(car.name).replace(/[^\p{L}\p{N}]/gu, "") === modelName);
      if (oldCar) {
        main.querySelector("#legacySpecs").innerHTML = `<section class="tuning-panel"><h2>Дополнительные замеры Region Info</h2><p class="tuning-note">Замеры из нашего прежнего каталога.</p><div class="detail-facts">${fact("Управляемость", `${oldCar.handling} / 5`)}${fact("Торможение 100–0", `${numbers.format(oldCar.braking_100_0_s)} с`)}</div></section>`;
      }
    }
    const anchor = params.get("anchor");
    if (anchor) main.querySelector(`[data-anchor="${CSS.escape(anchor)}"]`)?.scrollIntoView({ block: "start" });
  }

  function toggleComparison(vehicle) {
    if (comparison.has(vehicle.model)) comparison.delete(vehicle.model);
    else if (comparison.size < 4) comparison.set(vehicle.model, vehicle);
    else showToast("В сравнении может быть до четырёх моделей.");
    document.querySelector("#compareTray").hidden = comparison.size === 0;
    document.querySelector("#compareCount").textContent = `В сравнении ${comparison.size} из 4`;
    document.querySelector("#compareOpen").disabled = comparison.size < 2;
  }

  function renderComparison() {
    const list = [...comparison.values()].map((vehicle) => ({ ...vehicle, assessment: vehicle.price_donate ?? vehicle.price_dealer }));
    const metrics = [
      ["Цена в салоне", "price_dealer", "min", (value) => money(value)],
      ["Оценочная стоимость", "assessment", "min", (value) => money(value)],
      ["Максимальная скорость", "max_speed_kmh", "max", (value) => `${numbers.format(value)} км/ч`],
      ["Разгон 0–100", "t100_s", "min", (value) => value == null ? "—" : `${numbers.format(value)} с`],
      ["Багажник", "trunk_kg", "max", (value) => `${numbers.format(value)} кг`],
      ["Мест", "seats", "max", String], ["Масса", "mass_kg", "", (value) => `${numbers.format(value)} кг`],
      ["Топливо", "fuel_type", "", label], ["Бак", "fuel_capacity_l", "max", (value) => numbers.format(value)],
      ["Расход под нагрузкой", "fuel_load_l100", "min", (value) => numbers.format(value)],
      ["Привод", "drivetrain", "", label]
    ];
    document.querySelector("#compareContent").innerHTML = `<table class="compare-table"><thead><tr><th scope="col">Характеристика</th>${list.map((vehicle) => `<th scope="col"><img src="${escapeHtml(imageUrl(`${mediaBase}/vehicles/${vehicle.model}.png`))}" alt="">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.name)}</th>`).join("")}</tr></thead><tbody>${metrics.map(([title, field, direction, format]) => {
      const values = list.map((vehicle) => vehicle[field]).filter((value) => typeof value === "number");
      const best = direction === "min" ? Math.min(...values) : Math.max(...values);
      return `<tr><th scope="row">${title}</th>${list.map((vehicle) => `<td ${direction && vehicle[field] != null && vehicle[field] === best ? 'class="best"' : ""}>${escapeHtml(format(vehicle[field]))}</td>`).join("")}</tr>`;
    }).join("")}</tbody></table>`;
    document.querySelector("#compareDialog").showModal();
  }

  function renderSearch(params) {
    const query = params.get("q") || "";
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const selectedSection = params.get("section") || "";
    const results = manifest.pages.filter((page) => (!selectedSection || page.section === selectedSection) && terms.every((term) => normalize(`${page.title} ${page.summary}`).includes(term)));
    results.sort((a, b) => Number(normalize(b.title).includes(normalize(query))) - Number(normalize(a.title).includes(normalize(query))) || collator.compare(a.title, b.title));
    const page = Math.min(Math.max(1, Number(params.get("page")) || 1), Math.max(1, Math.ceil(results.length / 40)));
    main.innerHTML = pageHeading("Поиск по справочнику", "Поиск по названиям и описаниям всех загруженных карточек и статей.") + `<form class="toolbar" id="pageSearch"><input type="search" id="pageQuery" value="${escapeHtml(query)}" placeholder="Например, питомцы или BMW M5" aria-label="Поисковый запрос"><select id="searchSection" aria-label="Раздел поиска"><option value="">Все разделы</option>${manifest.sections.map((section) => `<option value="${section.id}" ${section.id === selectedSection ? "selected" : ""}>${escapeHtml(section.title)}</option>`).join("")}</select><button class="primary-button" type="submit">Найти</button></form><p class="muted">Найдено ${numbers.format(results.length)}</p><div class="search-results">${results.slice((page - 1) * 40, page * 40).map((result) => `<a class="search-result" href="${localHref(result.path)}"><span>${escapeHtml(sectionTitle(result.section))}</span><h2>${escapeHtml(result.title)}</h2><p>${escapeHtml(result.summary)}</p></a>`).join("") || '<div class="empty">Совпадений нет. Попробуйте другое название.</div>'}</div>${paginationHtml(page, Math.ceil(results.length / 40))}`;
    const submit = () => {
      const next = new URLSearchParams({ q: main.querySelector("#pageQuery").value, section: main.querySelector("#searchSection").value });
      location.hash = `/search?${next}`;
    };
    main.querySelector("#pageSearch").addEventListener("submit", (event) => { event.preventDefault(); submit(); });
    main.querySelector("#searchSection").addEventListener("change", submit);
    main.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
      const next = new URLSearchParams(params);
      next.set("page", button.dataset.page);
      location.hash = `/search?${next}`;
    }));
  }

  function renderMap(payload, params) {
    const data = payload.data[0].data;
    const selectedCategories = new Set(data.categories.map((category) => category.id));
    const selectedZones = new Set();
    const initialPlace = data.places.find((place) => place.id === params.get("p"));
    let zoom = initialPlace ? 5 : 3;
    let center = initialPlace ? { x: initialPlace.x, y: initialPlace.y } : { x: params.has("x") ? Number(params.get("x")) : -600, y: params.has("y") ? Number(params.get("y")) : 6000 };
    let query = "";
    main.innerHTML = pageHeading("Карта региона", "Работы, магазины, недвижимость, прокат и игровые зоны. Перетаскивайте карту и меняйте масштаб.") + `<div class="map-layout"><div class="map-filters"><input type="search" id="mapQuery" aria-label="Найти место на карте" placeholder="Найти место"><button class="quiet-button" id="mapAll" type="button">Снять все</button><h3>Места</h3>${data.categories.map((category) => `<label><input type="checkbox" data-category="${escapeHtml(category.id)}" checked>${escapeHtml(category.label)}</label>`).join("")}<h3>Зоны</h3>${data.zoneKinds.map((kind) => `<label><input type="checkbox" data-zone="${escapeHtml(kind.id)}">${escapeHtml(kind.label)}</label>`).join("")}</div><div class="map-surface" id="mapSurface" tabindex="0" aria-label="Карта. Стрелки перемещают карту, плюс и минус меняют масштаб."><div class="map-plane" id="mapPlane"></div><div class="map-controls"><button class="icon-button" id="zoomIn" aria-label="Приблизить">+</button><button class="icon-button" id="zoomOut" aria-label="Отдалить">−</button><button class="icon-button" id="mapCity" aria-label="К Петербургу">⌂</button></div><div class="map-popup" id="mapPopup" hidden></div></div></div><div id="mapLocations" class="map-location-list"></div>${sourceNote("/map/")}`;
    const surface = main.querySelector("#mapSurface");
    const plane = main.querySelector("#mapPlane");
    const popup = main.querySelector("#mapPopup");

    function project(x, y) {
      const size = 256 * 2 ** zoom;
      return { x: (x + 8192) / 16384 * size, y: (8192 - y) / 16384 * size };
    }

    function showPlace(place) {
      const actions = [...(place.actions || []), ...(place.articles || [])];
      popup.innerHTML = `<button class="icon-button" aria-label="Закрыть место">×</button><h3>${escapeHtml(place.name)}</h3><p>${escapeHtml(place.kindLabel || place.note || "")}</p>${place.description ? `<p>${escapeHtml(place.description)}</p>` : ""}${(place.facts || []).map((value) => `<p>${escapeHtml(Array.isArray(value) ? value.join(" · ") : typeof value === "object" ? `${value.label} · ${value.value}` : value)}</p>`).join("")}<p>Координаты ${numbers.format(place.x)}, ${numbers.format(place.y)}</p>${actions.map((action) => `<a href="${localHref(action.href || action.url || "/map/")}">${escapeHtml(action.label || action.title || "Подробнее")} ↗</a>`).join(" ")}`;
      popup.hidden = false;
      popup.querySelector("button").addEventListener("click", () => { popup.hidden = true; });
    }

    function draw() {
      const size = 256 * 2 ** zoom;
      const origin = project(center.x, center.y);
      const offsetX = surface.clientWidth / 2 - origin.x;
      const offsetY = surface.clientHeight / 2 - origin.y;
      plane.style.width = `${size}px`;
      plane.style.height = `${size}px`;
      plane.style.transform = `translate(${offsetX}px,${offsetY}px)`;
      const minX = Math.max(0, Math.floor(-offsetX / 256));
      const maxX = Math.min(2 ** zoom - 1, Math.floor((surface.clientWidth - offsetX) / 256));
      const minY = Math.max(0, Math.floor(-offsetY / 256));
      const maxY = Math.min(2 ** zoom - 1, Math.floor((surface.clientHeight - offsetY) / 256));
      const tiles = [];
      for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) tiles.push(`<img class="map-tile" src="https://cdn.region.game/map/dark/${zoom}/${x}/${y}.png" alt="" draggable="false" style="left:${x * 256}px;top:${y * 256}px">`);
      }
      const visible = data.places.filter((place) => selectedCategories.has(place.cat) && normalize(`${place.name} ${place.kindLabel} ${place.note}`).includes(query));
      const markers = visible.map((place) => {
        const point = project(place.x, place.y);
        if (point.x + offsetX < -30 || point.x + offsetX > surface.clientWidth + 30 || point.y + offsetY < -30 || point.y + offsetY > surface.clientHeight + 30) return "";
        return `<button class="map-marker" data-place="${escapeHtml(place.id)}" aria-label="${escapeHtml(place.name)}" title="${escapeHtml(place.name)}" style="left:${point.x}px;top:${point.y}px"><img src="${sourceOrigin}${escapeHtml(place.icon)}" alt=""></button>`;
      }).join("");
      const zones = data.zones.filter((zone) => selectedZones.has(zone.kind)).map((zone) => {
        const color = data.zoneKinds.find((kind) => kind.id === zone.kind)?.color || "#4f9f79";
        if (zone.shape === "circle") {
          const point = project(zone.cx, zone.cy);
          return `<circle cx="${point.x}" cy="${point.y}" r="${zone.radius / 16384 * size}" fill="${escapeHtml(color)}22" stroke="${escapeHtml(color)}" stroke-width="1"/>`;
        }
        const points = (zone.points || []).map((point) => {
          const projected = project(point.x ?? point[0], point.y ?? point[1]);
          return `${projected.x},${projected.y}`;
        }).join(" ");
        return `<polygon points="${points}" fill="${escapeHtml(color)}22" stroke="${escapeHtml(color)}" stroke-width="1"/>`;
      }).join("");
      plane.innerHTML = tiles.join("") + `<svg class="map-zones" width="${size}" height="${size}" aria-hidden="true">${zones}</svg>` + markers;
      plane.querySelectorAll("[data-place]").forEach((button) => button.addEventListener("click", () => showPlace(data.places.find((place) => place.id === button.dataset.place))));
      main.querySelector("#mapLocations").innerHTML = `<span class="muted">Найдено ${visible.length} мест</span>` + (query ? visible.slice(0, 30).map((place) => `<button data-location="${escapeHtml(place.id)}">${escapeHtml(place.name)} · ${escapeHtml(place.note || place.kindLabel)}</button>`).join("") : "");
      main.querySelectorAll("[data-location]").forEach((button) => button.addEventListener("click", () => {
        const place = data.places.find((item) => item.id === button.dataset.location);
        center = { x: place.x, y: place.y };
        zoom = 5;
        draw();
        showPlace(place);
      }));
    }

    function changeZoom(delta) { zoom = Math.max(1, Math.min(6, zoom + delta)); draw(); }
    main.querySelector("#zoomIn").addEventListener("click", () => changeZoom(1));
    main.querySelector("#zoomOut").addEventListener("click", () => changeZoom(-1));
    main.querySelector("#mapCity").addEventListener("click", () => { center = { x: -600, y: 6000 }; zoom = 3; draw(); });
    main.querySelector("#mapQuery").addEventListener("input", (event) => { query = normalize(event.target.value); draw(); });
    main.querySelectorAll("[data-category]").forEach((input) => input.addEventListener("change", () => { if (input.checked) selectedCategories.add(input.dataset.category); else selectedCategories.delete(input.dataset.category); draw(); }));
    main.querySelectorAll("[data-zone]").forEach((input) => input.addEventListener("change", () => { if (input.checked) selectedZones.add(input.dataset.zone); else selectedZones.delete(input.dataset.zone); draw(); }));
    main.querySelector("#mapAll").addEventListener("click", (event) => {
      const select = selectedCategories.size === 0;
      selectedCategories.clear();
      main.querySelectorAll("[data-category]").forEach((input) => { input.checked = select; if (select) selectedCategories.add(input.dataset.category); });
      event.target.textContent = select ? "Снять все" : "Выбрать все";
      draw();
    });
    let drag;
    surface.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button, a, input, .map-popup")) return;
      drag = { x: event.clientX, y: event.clientY, center: { ...center } };
      surface.setPointerCapture(event.pointerId);
    });
    surface.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const scale = 16384 / (256 * 2 ** zoom);
      center = { x: Math.max(-8192, Math.min(8192, drag.center.x - (event.clientX - drag.x) * scale)), y: Math.max(-8192, Math.min(8192, drag.center.y + (event.clientY - drag.y) * scale)) };
      draw();
    });
    surface.addEventListener("pointerup", () => { drag = null; });
    surface.addEventListener("pointercancel", () => { drag = null; });
    surface.addEventListener("wheel", (event) => { event.preventDefault(); changeZoom(event.deltaY < 0 ? 1 : -1); }, { passive: false });
    surface.addEventListener("keydown", (event) => {
      const step = 16384 / (256 * 2 ** zoom) * 80;
      const shifts = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (shifts[event.key]) { event.preventDefault(); center.x += shifts[event.key][0]; center.y += shifts[event.key][1]; draw(); }
      if (["+", "="].includes(event.key)) changeZoom(1);
      if (event.key === "-") changeZoom(-1);
    });
    const observer = new ResizeObserver(draw);
    observer.observe(surface);
    cleanupView = () => observer.disconnect();
    draw();
    if (initialPlace) showPlace(initialPlace);
  }

  async function route() {
    if (!manifest) return;
    const version = ++routeVersion;
    cleanupView();
    cleanupView = () => {};
    document.body.classList.remove("menu-open");
    document.querySelector("#menuButton").setAttribute("aria-expanded", "false");
    const raw = location.hash.slice(1) || "/";
    const url = new URL(raw.startsWith("/") ? raw : `/${raw}`, sourceOrigin);
    const parts = url.pathname.split("/").filter(Boolean);
    const section = parts[0] || "home";
    const path = `/${parts.join("/")}/`;
    renderNavigation(section);
    main.innerHTML = '<div class="loading" role="status">Загружаем раздел…</div>';
    document.title = `${section === "home" ? "Справочник игрока" : section === "tuning" ? "Калькулятор тюнинга" : section === "search" ? "Поиск" : sectionTitle(section)} — Region Info`;
    try {
      if (section === "home") renderHome();
      else if (section === "search") renderSearch(url.searchParams);
      else if (section === "tuning") renderTuning(url.searchParams);
      else if (section === "articles" && parts.length === 1) renderArticles(url.searchParams);
      else {
        if (!manifest.sections.some((item) => item.id === section)) throw new Error("Раздел не найден.");
        const payload = await loadSection(section);
        if (version !== routeVersion) return;
        if (section === "vehicles" && parts[1] === "compare") { renderCatalog(section, payload, url.searchParams); }
        else if (parts.length > 1) await renderDocument(section, payload, path, url.searchParams, version);
        else if (section === "map") renderMap(payload, url.searchParams);
        else renderCatalog(section, payload, url.searchParams);
      }
      if (version !== routeVersion) return;
      if (!url.searchParams.get("anchor")) window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
    } catch (error) {
      if (version !== routeVersion) return;
      console.error(error);
      main.innerHTML = `${pageHeading("Не удалось открыть страницу")}<div class="error"><p>${escapeHtml(error.message)}</p><button class="quiet-button" id="retryPage">Повторить загрузку</button> <a class="quiet-button" href="#/">На главную</a></div>`;
      main.querySelector("#retryPage").addEventListener("click", route);
    }
  }

  document.querySelector("#globalSearch").addEventListener("submit", (event) => {
    event.preventDefault();
    location.hash = `/search?q=${encodeURIComponent(document.querySelector("#globalQuery").value)}`;
  });
  document.querySelector(".skip").addEventListener("click", (event) => {
    event.preventDefault();
    main.focus();
    main.scrollIntoView({ block: "start" });
  });
  document.querySelector("#menuButton").addEventListener("click", (event) => {
    const expanded = document.body.classList.toggle("menu-open");
    event.currentTarget.setAttribute("aria-expanded", String(expanded));
  });
  main.addEventListener("click", () => {
    document.body.classList.remove("menu-open");
    document.querySelector("#menuButton").setAttribute("aria-expanded", "false");
  });
  document.querySelector("#compareClear").addEventListener("click", () => {
    comparison.clear();
    document.querySelector("#compareTray").hidden = true;
    main.querySelectorAll("[data-compare]").forEach((input) => { input.checked = false; });
    const detailButton = main.querySelector("#detailCompare");
    if (detailButton) detailButton.textContent = "Добавить к сравнению";
  });
  document.querySelector("#compareOpen").addEventListener("click", renderComparison);
  document.querySelector("#compareClose").addEventListener("click", () => document.querySelector("#compareDialog").close());
  document.querySelector("#compareDialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) && !document.querySelector("dialog[open]")) { event.preventDefault(); document.querySelector("#globalQuery").focus(); }
    if (event.key === "Escape") { document.body.classList.remove("menu-open"); document.querySelector("#menuButton").setAttribute("aria-expanded", "false"); }
  });
  document.addEventListener("error", (event) => {
    if (event.target.tagName === "VIDEO") {
      const message = document.createElement("p");
      message.className = "media-note";
      message.textContent = "Видеопревью пока недоступно.";
      event.target.replaceWith(message);
      return;
    }
    if (event.target.tagName !== "IMG") return;
    const image = event.target;
    if (!image.dataset.fullTried && image.src.endsWith("_small.avif")) {
      image.dataset.fullTried = "true";
      image.src = image.src.replace("_small.avif", ".avif");
    } else if (!image.dataset.formatTried && /\.(avif|png)$/.test(image.src)) {
      image.dataset.formatTried = "true";
      image.src = image.src.endsWith(".avif") ? image.src.replace(/\.avif$/, ".png") : image.src.replace(/\.png$/, ".avif");
    } else {
      const media = image.closest(".card-media");
      if (media?.dataset.icon && !image.dataset.iconTried) {
        image.dataset.iconTried = "true";
        image.src = media.dataset.icon;
        image.className = "media-icon";
      } else if (media) {
        const placeholder = document.createElement("span");
        placeholder.className = "media-placeholder";
        placeholder.setAttribute("aria-hidden", "true");
        placeholder.textContent = media.dataset.symbol;
        image.replaceWith(placeholder);
      } else {
        image.alt = image.alt || "Изображение недоступно";
        image.classList.add("media-unavailable");
      }
    }
  }, true);
  window.addEventListener("hashchange", route);

  Promise.all([getJson("data/wiki/index.json"), getJson("data/wiki/image-overrides.json").catch(() => ({}))]).then(([index, overrides]) => {
    manifest = index;
    imageOverrides = overrides;
    document.querySelector("#importDate").textContent = `База от ${dates.format(new Date(index.importedAt))}`;
    route();
  }).catch((error) => {
    console.error(error);
    main.innerHTML = '<div class="error">Не удалось загрузить базу справочника. Обновите страницу. <a href="cars.html">Открыть каталог автомобилей</a></div>';
  });
})();
