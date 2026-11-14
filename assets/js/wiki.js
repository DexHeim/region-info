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
    home: "house", vehicles: "car", items: "package", clothes: "shirt", estate: "building-2",
    business: "store", appearance: "scan-face", map: "map", cases: "box", animations: "play",
    season: "calendar-days", achievements: "trophy", levels: "layers", factions: "shield", rentals: "square-parking",
    articles: "book-open", updates: "history", tuning: "wrench"
  };
  const labels = {
    Car: "Автомобиль", Bike: "Мотоцикл", Bicycle: "Велосипед", Boat: "Лодка", Trailer: "Прицеп",
    Compact: "Компакт", Sedan: "Седаны", SUV: "Внедорожники", Coupe: "Купе", Muscle: "Маслкары",
    SportClassic: "Спорт-классика", Sport: "Спорт", Super: "Суперкары", OffRoad: "Внедорожники",
    Industrial: "Грузовые", Utility: "Хозяйственные", Van: "Фургоны", VAN: "Фургоны", Motorcycle: "Мотоциклы",
    Commercial: "Коммерческие", Emergency: "Спецтранспорт", Helicopter: "Вертолёты", Military: "Военные",
    Offroad: "Бездорожье", Service: "Служебные", service: "Служебный",
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
  let vehiclePriceOverrides = {};
  let routeVersion = 0;
  let cleanupView = () => {};
  let toastTimer;
  let searchIndexPromise;

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("\ue000", "RC").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function icon(name) {
    return `<svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg?v=20261114-11#${escapeHtml(name)}"></use></svg>`;
  }

  function normalize(value) {
    return String(value ?? "").toLocaleLowerCase("ru").replaceAll("ё", "е");
  }

  function searchText(value) {
    const lookalikes = { а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x" };
    return normalize(String(value ?? "").normalize("NFKC"))
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/(^|\s)([a-zа-я])\s+(?=\d)/gu, "$1$2")
      .trim().split(/\s+/).map((word) => /^[a-zавекмнорстух]{1,3}\d+[a-zавекмнорстух]{0,2}$/.test(word)
        ? word.replace(/[авекмнорстух]/g, (letter) => lookalikes[letter]) : word).join(" ");
  }

  function searchHref(query = "", section = "", page = 1) {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (section) params.set("section", section);
    if (page > 1) params.set("page", page);
    return `#/search${params.size ? `?${params}` : ""}`;
  }

  function loadSearchIndex() {
    if (!searchIndexPromise) {
      searchIndexPromise = getJson("data/wiki/search.json?v=20261114-10").then((extra) =>
        [...manifest.pages, ...extra.places, { path: "/tuning", title: "Калькулятор тюнинга", summary: "Приблизительный расчёт стоимости полного тюнинга, двигателя, трансмиссии, тормозов, подвески, турбо и внешних улучшений.", section: "vehicles", searchIcon: "calculator" }].map((page) => {
          page = { ...page, previewFacts: extra.facts?.[page.path] || [] };
          const title = searchText(page.title);
          const summary = searchText(page.summary);
          const code = page.section === "vehicles" ? searchText(page.path.split("/")[2]) : "";
          const content = extra.texts[page.path] || page.keywords || "";
          const variants = (extra.variants?.[page.path] || []).map((name) => ({ name, text: searchText(name) }));
          return { page, title, summary, code, content, variants, compactTitle: title.replaceAll(" ", ""), text: `${title} ${summary} ${code} ${searchText(sectionTitle(page.section))} ${searchText(content)}` };
        })
      ).catch((error) => { searchIndexPromise = null; throw error; });
    }
    return searchIndexPromise;
  }

  function searchMatches(query, index) {
    const needle = searchText(query);
    const terms = needle.split(/\s+/).filter(Boolean);
    const compact = needle.replaceAll(" ", "");
    const matchers = terms.map((term) => new RegExp(/^\d+$/.test(term) ? `(?:^|\\s)${term}(?=\\s|$)` : term));
    const containsTerms = (text) => matchers.every((matcher) => matcher.test(text));
    const matchCompact = terms.length === 1 && /\p{L}/u.test(compact);
    return index.filter((entry) => containsTerms(entry.text) || (matchCompact && entry.compactTitle.includes(compact))).map((entry) => {
      let score = 0;
      if (needle && entry.title === needle) score = 120;
      else if (compact && (entry.code === compact || entry.compactTitle === compact)) score = 110;
      else if (needle && entry.title.startsWith(needle)) score = 100;
      else if (needle && entry.title.includes(needle)) score = 90;
      else if (compact && entry.compactTitle.includes(compact)) score = 80;
      else if (terms.length && containsTerms(entry.title)) score = 70;
      else if (terms.length && containsTerms(entry.summary)) score = 30;
      let page = entry.page;
      if (score < 30 && terms.length && ["articles", "updates"].includes(page.section)) {
        const start = Math.max(0, normalize(entry.content).indexOf(terms[0]) - 60);
        const offset = start ? entry.content.indexOf(" ", start) + 1 : 0;
        const snippet = entry.content.slice(offset, offset + 220).trim();
        page = { ...page, snippet: `${offset ? "…" : ""}${snippet}${offset + 220 < entry.content.length ? "…" : ""}` };
      }
      const variant = terms.length && entry.variants.find((variant) => containsTerms(variant.text));
      if (variant && variant.text !== entry.title) page = { ...page, snippet: `В расцветках · ${variant.name}` };
      return { page, score };
    }).sort((a, b) => b.score - a.score || collator.compare(a.page.title, b.page.title)).map((entry) => entry.page);
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

  function attachAnimationSound(video, soundUrl, container) {
    const audio = document.createElement("audio");
    audio.src = soundUrl;
    audio.preload = "none";
    audio.loop = video.loop;
    audio.hidden = true;
    const controls = document.createElement("div");
    controls.className = "animation-audio";
    controls.innerHTML = `<button class="animation-sound" type="button"></button><input class="animation-volume" type="range" min="0" max="1" step="0.05" value="0.5" aria-label="Громкость анимации">`;
    const button = controls.querySelector("button");
    const volume = controls.querySelector("input");
    let disposed = false;
    video.classList.add("animation-video--audio");
    video.volume = 0.5;
    container.append(audio, controls);

    function updateControls() {
      if (audio.error) return;
      const enabled = !video.muted && video.volume > 0;
      button.innerHTML = `${icon(enabled ? "volume-2" : "volume-x")}<span>Звук</span>`;
      button.setAttribute("aria-label", enabled ? "Выключить звук анимации" : "Включить звук анимации");
      button.setAttribute("aria-pressed", String(enabled));
      button.title = enabled ? "Выключить звук" : "Включить звук";
      volume.value = video.volume;
      volume.setAttribute("aria-valuetext", `${Math.round(video.volume * 100)}%`);
      audio.volume = video.volume;
      audio.muted = video.muted;
    }

    function playSound() {
      if (disposed || video.paused || video.seeking || video.muted || video.volume === 0 || video.error || audio.error) return;
      audio.play().catch((error) => {
        if (disposed || error.name === "AbortError") return;
        video.muted = true;
        updateControls();
        if (error.name === "NotAllowedError") showToast("Нажмите кнопку звука для воспроизведения аудиодорожки.");
      });
    }

    function seekSound() {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      audio.currentTime = video.currentTime % audio.duration;
    }

    button.addEventListener("click", () => {
      video.muted = !video.muted;
      if (!video.muted && video.volume === 0) video.volume = 0.5;
      updateControls();
      if (video.muted) audio.pause();
      else if (video.paused) video.play().catch(() => showToast("Не удалось запустить видеопревью."));
      else playSound();
    });
    volume.addEventListener("input", () => {
      video.volume = Number(volume.value);
      video.muted = video.volume === 0;
    });
    video.addEventListener("play", playSound);
    video.addEventListener("playing", playSound);
    video.addEventListener("pause", () => audio.pause());
    video.addEventListener("waiting", () => audio.pause());
    video.addEventListener("error", () => audio.pause());
    video.addEventListener("ended", () => audio.pause());
    video.addEventListener("seeking", () => { audio.pause(); seekSound(); });
    video.addEventListener("seeked", () => { seekSound(); playSound(); });
    video.addEventListener("ratechange", () => { audio.playbackRate = video.playbackRate; });
    audio.addEventListener("loadedmetadata", seekSound);
    video.addEventListener("volumechange", () => {
      updateControls();
      if (video.muted || video.volume === 0) audio.pause();
      else playSound();
    });
    audio.addEventListener("error", () => {
      if (disposed) return;
      audio.pause();
      button.disabled = true;
      button.innerHTML = `${icon("volume-x")}<span>Звук недоступен</span>`;
      button.setAttribute("aria-label", "Аудиодорожка недоступна");
      button.setAttribute("aria-pressed", "false");
      button.title = "Аудиодорожка недоступна";
      volume.disabled = true;
      showToast("Не удалось загрузить звук анимации.");
    });
    updateControls();
    return () => {
      disposed = true;
      video.pause();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.remove();
      controls.remove();
    };
  }

  async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Не удалось загрузить ${url} (${response.status})`);
    return response.json();
  }

  function loadSection(section) {
    if (!sectionCache.has(section)) {
      const request = getJson(`data/wiki/${section}.json?v=20261114-5`).catch((error) => {
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
      const request = getJson(`data/wiki/details/${entry.chunk}?v=20261114-5`).catch((error) => {
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
      ["Транспорт", ["vehicles", "rentals", "tuning"]],
      ["Мир и имущество", ["estate", "business", "map", "factions"]],
      ["Персонаж", ["items", "clothes", "appearance", "animations"]],
      ["Прогресс и награды", ["season", "cases", "achievements", "levels"]]
    ];
    document.querySelector("#navigation").innerHTML = groups.map(([title, items]) => (
      `${title ? `<p class="nav-label">${title}</p>` : ""}${items.map((id) => {
        const text = id === "home" ? "Главная" : id === "tuning" ? "Расчёт тюнинга" : sectionTitle(id);
        return `<a class="nav-link" href="#/${id === "home" ? "" : id}" ${id === section ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${icon(icons[id])}</span>${text}</a>`;
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
    main.innerHTML = `<section class="hero"><img class="hero-image" src="https://wiki.region.game/img/hero/city-1600.webp" alt="" fetchpriority="high"><p class="eyebrow">Мир Region</p><h1>Всё для жизни<br>в регионе</h1><p>Игровые механики, транспорт, предметы и места. Цены улучшений и калькулятор тюнинга — рядом с автомобилями.</p><div class="hero-links"><a class="primary-button" href="#/articles">Изучить механики ↗</a><a class="quiet-button" href="#/vehicles">Выбрать автомобиль</a></div></section>
      <div class="section-heading"><h2>Справочник</h2><a href="#/search">Поиск по всем разделам ↗</a></div>
      <div class="section-grid">${featured.map((id) => `<a class="section-card" href="#/${id}"><span class="section-icon" aria-hidden="true">${icon(icons[id])}</span><span class="arrow" aria-hidden="true">↗</span><h3>${sectionTitle(id)}</h3><p>${counts[id]}</p></a>`).join("")}</div>
      <div class="home-columns"><section><div class="section-heading"><h2>Обновления игры</h2><a href="#/updates">Все обновления ↗</a></div><a class="update-card" href="#/updates/2026-11-14-pets-heists-car-market/"><img src="${sourceOrigin}/img/updates/2026-11-14-pets-heists-car-market/cover-thumb.webp" alt="Обновление Region" loading="lazy"><div><time datetime="2026-11-14">14 ноября 2026</time><h3>Питомцы, кражи со взломом и авторынок</h3><p>Уход за животными, налёты на жильё и продажа машин.</p></div></a></section>
      <section><div class="section-heading"><h2>С чего начать</h2></div><div class="quick-links">${quick.map(([path, title]) => `<a href="${localHref(path)}">${title}<span>↗</span></a>`).join("")}</div></section></div>
      <div class="section-heading"><h2>Больше в игре</h2></div><div class="section-grid">${["cases", "animations", "season", "achievements", "levels", "factions", "rentals", "tuning"].map((id) => `<a class="section-card" href="#/${id}"><span class="section-icon" aria-hidden="true">${icon(icons[id])}</span><span class="arrow" aria-hidden="true">↗</span><h3>${id === "tuning" ? "Расчёт тюнинга" : sectionTitle(id)}</h3></a>`).join("")}</div>`;
  }

  function normalizeRows(section, payload) {
    const data = payload.data.find((island) => island.data.rows || island.data.items || island.data.vehicles)?.data || {};
    if (section === "vehicles") {
      return data.vehicles.map((vehicle) => {
        const costs = vehicleCosts(vehicle);
        return {
          id: vehicle.model, href: `/vehicles/${vehicle.model}/`, title: `${vehicle.brand} ${vehicle.name}`,
          image: `${mediaBase}/vehicles/${vehicle.model}.png`, price: costs.vehiclePrice,
          priceLabel: vehicle.price_dealer == null || vehiclePriceOverrides[vehicle.model]?.vehicle_price != null ? "Цена машины" : "Цена в салоне",
          sub: `${label(vehicle.class)} · ${label(vehicle.access)}`, kind: vehicle.class, kindLabel: label(vehicle.class),
          level: vehicle.access, levelLabel: label(vehicle.access), city: vehicle.brand,
          stats: [`${numbers.format(vehicle.max_speed_kmh)} км/ч`, vehicle.t100_s == null ? "" : `${numbers.format(vehicle.t100_s)} с`, String(vehicle.seats), `${vehicle.trunk_kg} кг`],
          sortBy: { price: costs.vehiclePrice, speed: vehicle.max_speed_kmh, acceleration: vehicle.t100_s, trunk: vehicle.trunk_kg }, vehicle
        };
      });
    }
    if (section === "items") {
      return data.items.map((item) => ({
        id: item.id, href: `/items/${item.id}/`, title: item.name, sub: item.description,
        image: `${mediaBase}/inventory/items/${item.id}.avif`, kind: item.category, kindLabel: label(item.category),
        level: String(item.rarity), levelLabel: ["", "Обычный", "Редкий", "Дорогой", "Великолепный", "Люкс", "VIP"][item.rarity] || String(item.rarity),
        badge: ["", "Обычный", "Редкий", "Дорогой", "Великолепный", "Люкс", "VIP"][item.rarity],
        tone: ["", "#707070", "#65df2c", "#527fff", "#a477ff", "#ffad45", "#ff6464"][item.rarity],
        stats: [item.weight_kg < 1 ? `${numbers.format(item.weight_kg * 1000)} г` : `${numbers.format(item.weight_kg)} кг`, `${item.size_w}×${item.size_h}`, `${numbers.format(Math.max(1, item.max_stack || 1))} шт.`],
        usable: Boolean(item.is_usable), tradable: Boolean(item.is_tradable),
        sortBy: { weight: item.weight_kg, stack: Math.max(1, item.max_stack || 1), rarity: item.rarity }
      }));
    }
    if (section === "clothes") {
      const slots = { hat: "hats", ear: "ears", bodyArmor: "bodyarmor" };
      return data.rows.map((row) => ({
        id: row[0], href: `/clothes/${row[0]}/`, title: row[2], kind: row[4], kindLabel: label(row[4]),
        level: row[3], levelLabel: label(row[3]), city: (row[8] || "").split(",").filter(Boolean).map(label),
        image: `${mediaBase}/clothes/${slots[row[4]] || row[4].toLowerCase()}/${row[3] === "Shared" ? "male" : row[3].toLowerCase()}/${row[5]}/${row[10]}_small.avif`,
        sub: `${row[9]} расцветок`, price: row[7], badge: ["", "Обычный", "Редкий", "Дорогой", "Великолепный", "Люкс", "VIP"][row[6]],
        tone: ["", "#707070", "#65df2c", "#527fff", "#a477ff", "#ffad45", "#ff6464"][row[6]],
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
      kindTitle: "Категория", levelTitle: "Редкость", columns: ["Вес", "Размер", "В ячейке"],
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

  function catalogFacet(rows, field, title, selected) {
    const choices = new Map();
    for (const row of rows) {
      const values = Array.isArray(row[field]) ? row[field] : [row[field]];
      for (const value of values.filter((item) => item != null && item !== "")) {
        const key = String(value);
        const choice = choices.get(key) || { title: row[`${field}Label`] || key, count: 0 };
        choice.count += 1;
        choices.set(key, choice);
      }
    }
    if (choices.size < 2) return "";
    const contents = choices.size > 28 ? filterSelect(rows, field, title, selected)
      : `<div class="facet-options">${[...choices].sort((a, b) => collator.compare(a[1].title, b[1].title)).map(([value, choice]) => `<button type="button" data-facet="${field}" data-value="${escapeHtml(value)}" aria-pressed="${selected.split(",").includes(value)}"><span>${escapeHtml(choice.title)}</span><small>${choice.count}</small></button>`).join("")}</div>`;
    return `<details class="catalog-facet" open><summary>${escapeHtml(title)}${icon("chevron-down")}</summary>${contents}</details>`;
  }

  function catalogStat(value, section) {
    const text = section === "business" ? String(value ?? "—").replace(/^(налог|склад)\s+/i, "") : String(value ?? "—");
    return /^\d+$/.test(text) ? numbers.format(Number(text)) : text;
  }

  function cardHtml(row, section, settings) {
    const currencyReward = row.level === "money" || row.level === "rc";
    const symbol = row.level === "money" ? "₽" : row.level === "rc" ? "RC" : section === "levels" ? String(row.id) : "";
    const iconUrl = row.blip ? new URL(row.blip, sourceOrigin).href : "";
    const tone = /^#[0-9a-f]{3,8}$/i.test(row.tone || "") ? row.tone : "#f0373f";
    let media = `<span class="media-placeholder ${currencyReward ? "media-placeholder--currency" : ""}" aria-hidden="true">${symbol ? escapeHtml(symbol) : icon(icons[section] || "package")}</span>`;
    if (row.image) {
      const presentation = imageOverrides[row.image];
      const cover = !presentation && row.fit !== "contain" && ["estate", "business", "factions", "updates"].includes(section);
      const className = presentation?.fit === "icon" ? "media-icon" : cover ? "cover" : "";
      media = `<img src="${escapeHtml(imageUrl(row.image))}" alt="" loading="lazy" decoding="async" class="${className}">`;
    } else if (iconUrl && !currencyReward && section !== "levels") {
      media = `<img class="media-icon" src="${escapeHtml(iconUrl)}" alt="" loading="lazy">`;
    }
    const categoryParts = [row.kindLabel, row.levelLabel, ["clothes", "appearance"].includes(section) ? "" : Array.isArray(row.city) ? row.city.join(", ") : row.city];
    if (["business", "estate", "factions"].includes(section)) categoryParts.splice(1, 1);
    const category = [...new Set(categoryParts.filter((value) => value && value !== row.title))].join(" · ");
    const statLabels = section === "items" ? ["Вес", "Размер", "В ячейке"] : section === "clothes" ? ["Магазины", "Источник", "Источник"] : settings.columns || [];
    const stats = (row.stats || []).map((value, index) => {
      if (value === null || value === undefined || value === "" || value === "—") return "";
      if (section === "season" && index === 0 && row.badge) return "";
      if (section === "appearance") return "";
      const text = catalogStat(value, section);
      return `<div>${statLabels[index] ? `<dt>${escapeHtml(statLabels[index])}</dt>` : ""}<dd>${escapeHtml(text)}</dd></div>`;
    }).join("");
    const description = row.sub || (row.cat && !category.includes(row.cat) ? row.cat : "");
    const foot = row.foot && !["season", "levels"].includes(section) && !(row.stats || []).includes(row.foot) ? `<p class="card-foot">${escapeHtml(row.foot)}</p>` : "";
    const priceLabel = row.priceLabel || (section === "estate" ? { Complex: "Квартиры от", Hotel: "За сутки от" }[row.kind] : section === "rentals" && row.kind === "rental" ? "В час от" : "");
    const preview = row.video && !imageOverrides[row.image]?.unavailableVideo ? `<button class="card-preview" type="button" data-preview="${escapeHtml(row.href)}" aria-label="Посмотреть анимацию ${escapeHtml(row.title)}" aria-pressed="false">${icon("play")}</button>` : "";
    return `<article class="catalog-card catalog-card--${section}" style="--tone:${tone}"><div class="card-visual"><a class="card-media ${row.light ? "card-media--light" : ""}" href="${localHref(row.href)}" aria-label="${escapeHtml(row.title)}" data-icon="${escapeHtml(iconUrl)}" data-symbol="${escapeHtml(symbol)}" data-section="${escapeHtml(section)}">${row.badge ? `<span class="card-badge">${escapeHtml(row.badge)}</span>` : ""}${media}</a>${preview}</div><div class="card-body"><p class="card-category">${iconUrl && ["business", "estate", "factions", "rentals"].includes(section) ? `<img class="category-icon" src="${escapeHtml(iconUrl)}" alt="">` : ""}${escapeHtml(category)}</p><h2><a href="${localHref(row.href)}">${escapeHtml(row.title)}</a></h2>${description ? `<p class="card-description">${escapeHtml(description)}</p>` : ""}${row.price != null && !settings.noPrice ? `<p class="card-price">${priceLabel ? `<small>${escapeHtml(priceLabel)}</small>` : ""}${money(row.price, row.currency)}</p>` : ""}${stats ? `<dl class="card-stats">${stats}</dl>` : ""}${foot}</div></article>`;
  }

  function paginationHtml(page, pages) {
    if (pages < 2) return "";
    const choices = new Set([1, pages, page - 1, page, page + 1]);
    return `<nav class="pagination" aria-label="Страницы каталога"><button data-page="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="Предыдущая страница">←</button>${[...choices].filter((value) => value > 0 && value <= pages).sort((a, b) => a - b).map((value) => `<button data-page="${value}" ${page === value ? 'aria-current="page"' : ""}>${value}</button>`).join("")}<button data-page="${page + 1}" ${page === pages ? "disabled" : ""} aria-label="Следующая страница">→</button></nav>`;
  }

  function tableHtml(rows, settings, section) {
    const hasPrice = !settings.noPrice && section !== "rentals" && rows.some((row) => row.price != null);
    const cover = ["business", "estate", "factions", "updates"].includes(section);
    return `<div class="catalog-table-wrap"><table class="catalog-table"><thead><tr><th scope="col">Название</th>${hasPrice ? '<th scope="col">Цена</th>' : ""}${(settings.columns || []).map((title) => `<th scope="col">${escapeHtml(title)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr><th scope="row"><a class="table-title" href="${localHref(row.href)}">${row.image ? `<img class="${cover ? "cover" : ""}" src="${escapeHtml(imageUrl(row.image))}" alt="" loading="lazy">` : ""}<span>${escapeHtml(row.title)}${row.kindLabel ? `<small>${escapeHtml(row.kindLabel)}</small>` : ""}</span></a></th>${hasPrice ? `<td class="table-price">${money(row.price, row.currency)}${section === "estate" && row.kind === "Hotel" ? " / сутки" : ""}</td>` : ""}${(settings.columns || []).map((title, index) => `<td>${escapeHtml(catalogStat(row.stats?.[index], section))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function vehicleCosts(vehicle) {
    const verified = vehiclePriceOverrides[vehicle.model] || {};
    const price = verified.tuning_base ?? vehicle.price_dealer ?? vehicle.price_donate;
    const tuningBase = Number.isFinite(price) && price > 0 ? price : null;
    const statePrice = verified.state_buyback ?? (vehicle.price_dealer == null ? null : Math.floor(vehicle.price_dealer * .7));
    return {
      vehiclePrice: verified.vehicle_price ?? vehicle.price_dealer,
      statePrice,
      buybackConfirmed: verified.state_buyback != null,
      tuningBase,
      tuningPrice: tuningBase == null ? null : tuning.calculatePerformanceTotal(tuningBase)
    };
  }

  function vehicleBuybackText(costs) {
    if (costs.statePrice == null) return "—";
    return `${costs.buybackConfirmed ? "" : "≈ "}${money(costs.statePrice)}`;
  }

  function vehicleCardHtml(row, presentation) {
    const vehicle = row.vehicle;
    const costs = vehicleCosts(vehicle);
    const rarity = ["", "Обычный", "Редкий", "Дорогой", "Великолепный", "Люкс", "VIP"][vehicle.rarity];
    const stats = [
      ["gauge", "Максимальная скорость", `${numbers.format(vehicle.max_speed_kmh)} км/ч`],
      ["timer", "Разгон до 100 км/ч", vehicle.t100_s == null ? "—" : `${numbers.format(vehicle.t100_s)} с`],
      ["fuel", "Топливо", label(vehicle.fuel_type)],
      ["users", "Количество мест", String(vehicle.seats)]
    ];
    return `<article class="vehicle-card rarity-${vehicle.rarity}">
      <a class="vehicle-media card-media" href="${localHref(row.href)}" aria-label="${escapeHtml(row.title)}" data-section="vehicles">
        ${presentation?.logo ? `<img class="brand-watermark" src="${escapeHtml(imageUrl(presentation.logo))}" alt="" loading="lazy">` : ""}
        <img class="vehicle-image" src="${escapeHtml(imageUrl(row.image))}" alt="" loading="lazy" decoding="async">
        <div class="vehicle-badges"><span>${escapeHtml(row.kindLabel)}</span>${vehicle.rarity > 1 ? `<span class="rarity-badge">${rarity}</span>` : ""}</div>
      </a>
      <label class="vehicle-compare" title="Добавить к сравнению"><input type="checkbox" data-compare="${escapeHtml(row.id)}" ${comparison.has(row.id) ? "checked" : ""}><span>${icon("scale")}<span class="sr-only">Сравнить ${escapeHtml(row.title)}</span></span></label>
      <div class="vehicle-body"><div class="vehicle-heading"><div><p class="vehicle-brand">${escapeHtml(vehicle.brand)}${presentation?.flag ? `<img class="country-flag" src="${escapeHtml(presentation.flag)}" alt="${escapeHtml(presentation.country)}" width="16" height="12" loading="lazy">` : ""}</p><h2><a href="${localHref(row.href)}">${escapeHtml(vehicle.name)}</a></h2></div><div class="vehicle-price">${row.price != null ? `<small>${escapeHtml(row.priceLabel)}</small><strong>${money(row.price)}</strong>` : `<span>${vehicle.access === "service" ? "Служебный" : "Цена уточняется"}</span>`}</div></div>
      <dl class="vehicle-costs"><div title="${costs.buybackConfirmed ? "Сумма подтверждена в игровом окне автоскупа" : costs.statePrice == null ? "Требуется подтверждение в игре" : "Расчёт 70% от базовой цены в салоне"}"><dt>Госвыкуп</dt><dd>${vehicleBuybackText(costs)}</dd></div><div title="Приблизительная сумма покупки всех уровней двигателя, трансмиссии, тормозов, подвески и турбо по порядку"><dt>Полный тюнинг</dt><dd>${costs.tuningPrice == null ? "—" : `≈ ${money(costs.tuningPrice)}`}</dd></div></dl>
      <dl class="vehicle-stats">${stats.map(([name, title, value]) => `<div title="${title}"><dt class="sr-only">${title}</dt>${icon(name)}<dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></div>
    </article>`;
  }

  function renderVehicles(payload, params) {
    const rows = normalizeRows("vehicles", payload);
    const brands = payload.brands || {};
    rows.forEach((row) => { row.country = brands[row.vehicle.brand_slug]?.country || ""; });
    const sorts = catalogSettings("vehicles", payload).sorts;
    const incoming = new URLSearchParams(params);
    for (const [alias, field] of Object.entries({ class: "kind", access: "level" })) {
      if (incoming.has(alias) && !incoming.has(field)) incoming.set(field, incoming.get(alias));
    }
    if (incoming.has("brand") && !incoming.has("city")) {
      const brand = rows.find((row) => row.vehicle.brand_slug === incoming.get("brand"))?.vehicle.brand;
      if (brand) incoming.set("city", brand);
    }
    const sortAliases = { max_speed_kmh: "speed", t100_s: "acceleration", price_dealer: "price", trunk_kg: "trunk" };
    const requestedSort = incoming.get("sort") || "name:asc";
    const sort = requestedSort.includes(":") ? requestedSort : `${sortAliases[requestedSort] || requestedSort}:${incoming.get("dir") || "asc"}`;
    const ranges = [
      { title: "Цена, ₽", low: "min", high: "max", key: "price", step: 1000 },
      { title: "Макс. скорость, км/ч", low: "speedMin", high: "speedMax", key: "speed", step: 1 },
      { title: "Разгон 0–100 км/ч, с", low: "accelerationMin", high: "accelerationMax", key: "acceleration", step: .1 },
      { title: "Багажник, кг", low: "trunkMin", high: "trunkMax", key: "trunk", step: 1 }
    ];
    const state = {
      query: incoming.get("q") || "", kind: incoming.get("kind") || "", level: incoming.get("level") || "",
      city: incoming.get("city") || "", country: incoming.get("country") || "",
      sort: sorts.some((item) => `${item.key}:${item.dir}` === sort) ? sort : "name:asc",
      view: ["list", "table"].includes(incoming.get("view")) ? "list" : "cards",
      page: Math.max(1, Math.floor(Number(incoming.get("page")) || 1)),
      size: [24, 48, 96].includes(Number(incoming.get("size"))) ? Number(incoming.get("size")) : 24
    };
    for (const range of ranges) {
      state[range.low] = incoming.get(range.low) || "";
      state[range.high] = incoming.get(range.high) || "";
    }
    const classes = [...new Set(rows.map((row) => row.kind))];
    const access = [["", "Все", "layout-grid"], ["dealer", "Салон", "store"], ["donate", "Кейсы", "gift"], ["service", "Служебные", "siren"]];
    const rangeFields = ranges.flatMap((range) => [range.low, range.high]);
    main.innerHTML = pageHeading("Транспорт", "Характеристики, цены и расчёт улучшений для каждой модели.", "vehicles") +
      `<div class="vehicle-page-links"><a href="#/tuning">${icon("wrench")}Калькулятор тюнинга</a><a href="cars.html">Дополнительные замеры ${icon("arrow-up-right")}</a></div>
      <div class="vehicle-catalog"><button class="quiet-button vehicle-filter-toggle" id="vehicleFilterToggle" aria-expanded="false" aria-controls="vehicleFilters">${icon("sliders-horizontal")}<span>Фильтры</span></button>
      <aside class="vehicle-filters" id="vehicleFilters" aria-label="Фильтры транспорта"><div class="filter-heading"><h2>Фильтры</h2><button id="resetVehicleFilters" type="button">Сбросить</button></div>
        <section class="filter-section"><h3>Как получить</h3><div class="access-grid">${access.map(([value, title, name]) => `<button type="button" data-access="${value}" aria-pressed="${state.level === value}">${icon(name)}<span class="access-count">${value ? rows.filter((row) => row.level === value).length : rows.length}</span><span>${title}</span></button>`).join("")}</div></section>
        <section class="filter-section"><h3>Марка и страна</h3>${filterSelect(rows, "city", "Марка", state.city)}${filterSelect(rows, "country", "Страна", state.country)}</section>
        <section class="filter-section"><h3>Класс</h3><div class="class-chips">${classes.map((value) => `<button type="button" data-class="${escapeHtml(value)}" aria-pressed="${state.kind.split(",").includes(value)}">${escapeHtml(label(value))}<span>${rows.filter((row) => row.kind === value).length}</span></button>`).join("")}</div></section>
        ${ranges.map((range) => `<section class="filter-section"><h3>${range.title}</h3><div class="range-inputs"><label><span>От</span><input type="number" data-range="${range.low}" min="0" step="${range.step}" aria-label="${range.title} от" placeholder="0" value="${escapeHtml(state[range.low])}"></label><label><span>До</span><input type="number" data-range="${range.high}" min="0" step="${range.step}" aria-label="${range.title} до" placeholder="Любая" value="${escapeHtml(state[range.high])}"></label></div></section>`).join("")}
      </aside><section class="vehicle-results" aria-label="Каталог транспорта"><div class="vehicle-toolbar"><label class="vehicle-search">${icon("search")}<input id="vehicleQuery" type="search" aria-label="Поиск транспорта" placeholder="Марка, модель или код" value="${escapeHtml(state.query)}"></label><select id="vehicleSort" aria-label="Сортировка транспорта">${sorts.map((item) => `<option value="${item.key}:${item.dir}" ${state.sort === `${item.key}:${item.dir}` ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select><div class="view-switch" role="group" aria-label="Вид каталога"><button type="button" data-view="cards" aria-label="Карточки" aria-pressed="${state.view === "cards"}">${icon("layout-grid")}</button><button type="button" data-view="list" aria-label="Список" aria-pressed="${state.view === "list"}">${icon("list")}</button></div></div><div id="vehicleResults" aria-live="polite"></div></section></div>${sourceNote("/vehicles/")}`;
    const results = main.querySelector("#vehicleResults");
    const filterToggle = main.querySelector("#vehicleFilterToggle");
    const filterPanel = main.querySelector("#vehicleFilters");

    function draw() {
      const terms = searchText(state.query).split(/\s+/).filter(Boolean);
      const filtered = rows.filter((row) => {
        const haystack = searchText([row.title, row.id, row.country, row.kindLabel].join(" "));
        return terms.every((term) => haystack.includes(term))
          && (!state.kind || state.kind.split(",").includes(row.kind))
          && (!state.level || state.level.split(",").includes(row.level))
          && (!state.city || state.city.split(",").includes(row.city))
          && (!state.country || state.country === row.country)
          && ranges.every((range) => {
            const value = row.sortBy[range.key];
            return (state[range.low] === "" || (value != null && value >= Number(state[range.low])))
              && (state[range.high] === "" || (value != null && value <= Number(state[range.high])));
          });
      });
      const [key, direction] = state.sort.split(":");
      filtered.sort((first, second) => {
        if (key === "name") return collator.compare(first.title, second.title) * (direction === "desc" ? -1 : 1);
        const a = first.sortBy[key];
        const b = second.sortBy[key];
        if (a == null && b == null) return collator.compare(first.title, second.title);
        if (a == null) return 1;
        if (b == null) return -1;
        return (a - b) * (direction === "desc" ? -1 : 1) || collator.compare(first.title, second.title);
      });
      const pages = Math.max(1, Math.ceil(filtered.length / state.size));
      state.page = Math.min(state.page, pages);
      const pageRows = filtered.slice((state.page - 1) * state.size, state.page * state.size);
      results.innerHTML = `<div class="result-line"><span><strong>${numbers.format(filtered.length)}</strong> из ${rows.length} моделей</span><label>На странице<select id="vehiclePageSize" aria-label="Количество на странице">${[24, 48, 96].map((size) => `<option ${state.size === size ? "selected" : ""}>${size}</option>`).join("")}</select></label></div>${pageRows.length ? `<div class="vehicle-grid ${state.view === "list" ? "vehicle-grid--list" : ""}">${pageRows.map((row) => vehicleCardHtml(row, brands[row.vehicle.brand_slug])).join("")}</div>` : '<div class="empty">По выбранным условиям ничего не найдено.</div>'}${paginationHtml(state.page, pages)}`;
      results.querySelectorAll("[data-compare]").forEach((input) => input.addEventListener("change", () => {
        toggleComparison(rows.find((row) => row.id === input.dataset.compare).vehicle);
        input.checked = comparison.has(input.dataset.compare);
      }));
      results.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
        state.page = Number(button.dataset.page);
        draw();
        main.querySelector(".vehicle-toolbar").scrollIntoView({ block: "start" });
      }));
      results.querySelector("#vehiclePageSize").addEventListener("change", (event) => { state.size = Number(event.target.value); state.page = 1; draw(); });
      main.querySelectorAll("[data-access]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.access === state.level)));
      main.querySelectorAll("[data-class]").forEach((button) => button.setAttribute("aria-pressed", String(state.kind.split(",").includes(button.dataset.class))));
      main.querySelectorAll("[data-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === state.view)));
      const filterCount = [state.kind, state.level, state.city, state.country, ...rangeFields.map((field) => state[field])].filter(Boolean).length;
      filterToggle.querySelector("span").textContent = filterCount ? `Фильтры (${filterCount})` : "Фильтры";
      const query = new URLSearchParams();
      for (const field of ["kind", "level", "city", "country", ...rangeFields]) {
        if (state[field]) query.set(field, state[field]);
      }
      if (state.query) query.set("q", state.query);
      if (state.sort !== "name:asc") query.set("sort", state.sort);
      if (state.view !== "cards") query.set("view", state.view);
      if (state.page > 1) query.set("page", state.page);
      if (state.size !== 24) query.set("size", state.size);
      history.replaceState(null, "", `#/vehicles${query.size ? `?${query}` : ""}`);
    }

    filterToggle.addEventListener("click", () => {
      const open = filterPanel.classList.toggle("is-open");
      filterToggle.setAttribute("aria-expanded", String(open));
    });
    main.querySelector("#vehicleQuery").addEventListener("input", (event) => { state.query = event.target.value; state.page = 1; draw(); });
    main.querySelector("#vehicleSort").addEventListener("change", (event) => { state.sort = event.target.value; state.page = 1; draw(); });
    main.querySelectorAll("[data-filter]").forEach((select) => select.addEventListener("change", () => { state[select.dataset.filter] = select.value; state.page = 1; draw(); }));
    main.querySelectorAll("[data-range]").forEach((input) => input.addEventListener("input", () => { state[input.dataset.range] = input.value; state.page = 1; draw(); }));
    main.querySelectorAll("[data-access]").forEach((button) => button.addEventListener("click", () => { state.level = button.dataset.access; state.page = 1; draw(); }));
    main.querySelectorAll("[data-class]").forEach((button) => button.addEventListener("click", () => {
      const selected = new Set(state.kind.split(",").filter(Boolean));
      if (selected.has(button.dataset.class)) selected.delete(button.dataset.class);
      else selected.add(button.dataset.class);
      state.kind = [...selected].join(","); state.page = 1; draw();
    }));
    main.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { state.view = button.dataset.view; draw(); }));
    main.querySelector("#resetVehicleFilters").addEventListener("click", () => { history.replaceState(null, "", "#/vehicles"); route(); });
    draw();
  }

  function renderCatalog(section, payload, params) {
    if (section === "vehicles") return renderVehicles(payload, params);
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
      min: incoming.get("min") || "", max: incoming.get("max") || "", page: Math.max(1, Number(incoming.get("page")) || 1), size: [24, 48, 96].includes(Number(incoming.get("size"))) ? Number(incoming.get("size")) : 24,
      view: incoming.get("view") || settings.defaultView || "cards",
      weightMin: incoming.get("weightMin") || "", weightMax: incoming.get("weightMax") || "",
      usable: incoming.get("usable") === "1", tradable: incoming.get("tradable") === "1"
    };
    const introductions = {
      vehicles: "Полный каталог транспорта. В карточках автомобилей — наши расчёты стоимости улучшений и внешнего тюнинга.",
      estate: "Квартиры открываются внутри карточек жилых комплексов. Дома и отели представлены отдельными карточками.",
      season: payload.headerHtml ? "" : payload.description || ""
    };
    const guide = section === "season" ? `<div class="prose catalog-season-summary">${documentMarkup(payload.headerHtml || "")}</div><p class="catalog-guide"><a href="#/articles/systems/season-pass/">Задания, опыт и покупка премиума ↗</a></p>` : "";
    const itemFilters = section === "items" ? `<details class="catalog-facet" open><summary>Вес, кг${icon("chevron-down")}</summary><div class="range-inputs"><label><span>От</span><input type="number" min="0" step="0.001" data-item-range="weightMin" aria-label="Вес от" value="${escapeHtml(state.weightMin)}" placeholder="0"></label><label><span>До</span><input type="number" min="0" step="0.001" data-item-range="weightMax" aria-label="Вес до" value="${escapeHtml(state.weightMax)}" placeholder="Любой"></label></div></details><div class="item-capabilities"><label><input type="checkbox" data-capability="usable" ${state.usable ? "checked" : ""}>Можно использовать</label><label><input type="checkbox" data-capability="tradable" ${state.tradable ? "checked" : ""}>Можно передавать</label></div>` : "";
    const facets = catalogFacet(rows, "kind", settings.kindTitle || "Тип", state.kind) + catalogFacet(rows, "level", settings.levelTitle || "Категория", state.level) + catalogFacet(rows, "city", settings.cityTitle || "Город", state.city);
    const hasPrice = !settings.noPrice && rows.some((row) => row.price != null);
    const hasFilters = Boolean(facets || hasPrice);
    const tableAvailable = settings.columns?.length > 0;
    main.innerHTML = pageHeading(payload.title, introductions[section] || "", section) + guide +
      `<div class="catalog-layout ${!hasFilters ? "catalog-layout--simple" : ""}">${hasFilters ? `<aside class="catalog-filters" id="catalogFilters" aria-label="Фильтры каталога"><div class="filter-heading"><h2>Фильтры</h2><button id="resetFilters" type="button">Сбросить</button></div>${facets}${itemFilters}${hasPrice ? `<details class="catalog-facet" open><summary>Цена, ${rows.some((row) => row.currency === "rc") ? "RC / ₽" : "₽"}${icon("chevron-down")}</summary><div class="range-inputs"><label><span>От</span><input id="minPrice" type="number" min="0" aria-label="Минимальная цена" value="${escapeHtml(state.min)}" placeholder="0"></label><label><span>До</span><input id="maxPrice" type="number" min="0" aria-label="Максимальная цена" value="${escapeHtml(state.max)}" placeholder="Любая"></label></div></details>` : ""}</aside>` : ""}<section class="catalog-content" aria-label="${escapeHtml(payload.title)}"><div class="catalog-controls"><label class="catalog-search">${icon("search")}<input type="search" id="catalogQuery" aria-label="Поиск в разделе" placeholder="${escapeHtml(settings.search || "Найти в разделе")}" value="${escapeHtml(state.query)}"></label><select id="catalogSort" aria-label="Сортировка">${sorts.map((sort) => `<option value="${sort.key}:${sort.dir}" ${state.sort === `${sort.key}:${sort.dir}` ? "selected" : ""}>${escapeHtml(sort.label)}</option>`).join("")}</select>${tableAvailable ? `<div class="view-switch" role="group" aria-label="Вид каталога"><button data-catalog-view="cards" type="button" aria-label="Карточки" aria-pressed="${state.view === "cards"}">${icon("layout-grid")}</button><button data-catalog-view="table" type="button" aria-label="Таблица" aria-pressed="${state.view === "table"}">${icon("list")}</button></div>` : ""}${hasFilters ? `<button class="quiet-button catalog-filter-toggle" id="catalogFilterToggle" type="button" aria-expanded="false" aria-controls="catalogFilters">${icon("sliders-horizontal")}<span>Фильтры</span></button>` : ""}</div><div id="catalogResults" aria-live="polite"></div></section></div>${sourceNote(`/${section}/`)}`;
    if (section === "season") {
      const summary = main.querySelector(".catalog-season-summary");
      const title = document.createElement("h2"); title.className = "catalog-season-title"; title.textContent = payload.seasonTitle || "";
      summary.querySelector(".detail-metrics")?.before(title);
      const metrics = summary.querySelector('.detail-metrics');
      if (metrics) {
        const overview = document.createElement('details');
        overview.className = 'season-overview';
        overview.open = !matchMedia('(max-width: 760px)').matches;
        overview.innerHTML = '<summary>Сроки, опыт и премиум</summary>';
        metrics.before(overview);
        overview.append(metrics);
      }
      summary.querySelector('.detail-category')?.remove();
      localizeDocument(summary, "/season/");
    }
    const results = main.querySelector("#catalogResults");
    let cleanupPreview = () => {};
    cleanupView = () => cleanupPreview();
    const filterToggle = main.querySelector("#catalogFilterToggle");
    filterToggle?.addEventListener("click", () => {
      filterToggle.setAttribute("aria-expanded", String(main.querySelector("#catalogFilters").classList.toggle("is-open")));
    });

    function matchesFacet(value, selected) {
      if (!selected) return true;
      const available = Array.isArray(value) ? value.map(String) : [String(value)];
      return selected.split(",").some((choice) => available.includes(choice));
    }

    function draw() {
      cleanupPreview();
      const filterCount = [state.kind, state.level, state.city, state.min, state.max, state.weightMin, state.weightMax, state.usable, state.tradable].filter(Boolean).length;
      if (filterToggle) filterToggle.querySelector("span").textContent = filterCount ? `Фильтры (${filterCount})` : "Фильтры";
      const terms = searchText(state.query).split(/\s+/).filter(Boolean);
      const filtered = rows.filter((row) => {
        const haystack = searchText([row.title, row.sub, row.kindLabel, row.levelLabel, row.city, row.id, ...(row.stats || [])].join(" "));
        return terms.every((term) => haystack.includes(term))
          && matchesFacet(row.kind, state.kind)
          && matchesFacet(row.level, state.level)
          && matchesFacet(row.city, state.city)
          && (state.min === "" || (row.price != null && row.price >= Number(state.min)))
          && (state.max === "" || (row.price != null && row.price <= Number(state.max)))
          && (!state.usable || row.usable) && (!state.tradable || row.tradable)
          && (state.weightMin === "" || row.sortBy?.weight >= Number(state.weightMin))
          && (state.weightMax === "" || row.sortBy?.weight <= Number(state.weightMax));
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
      const content = state.view === "table" && tableAvailable ? tableHtml(pageRows, settings, section) : `<div class="catalog-grid catalog-grid--${section}">${pageRows.map((row) => cardHtml(row, section, settings)).join("")}</div>`;
      results.innerHTML = `<div class="result-line"><span><strong>${numbers.format(filtered.length)}</strong> из ${numbers.format(rows.length)}</span><label>На странице <select id="pageSize" aria-label="Количество на странице">${[24, 48, 96].map((size) => `<option ${state.size === size ? "selected" : ""}>${size}</option>`).join("")}</select></label></div>${pageRows.length ? content : '<div class="empty">По выбранным условиям ничего не найдено.</div>'}${paginationHtml(state.page, pages)}`;
      main.querySelectorAll("[data-facet]").forEach((button) => button.setAttribute("aria-pressed", String(state[button.dataset.facet].split(",").includes(button.dataset.value))));
      main.querySelectorAll("[data-catalog-view]").forEach((button) => button.setAttribute("aria-pressed", String(state.view === button.dataset.catalogView)));
      results.querySelectorAll("[data-preview]").forEach((button) => button.addEventListener("click", () => {
        const media = button.closest(".catalog-card").querySelector(".card-media");
        const existing = media.querySelector("video");
        cleanupPreview();
        if (existing) return;
        const row = pageRows.find((item) => item.href === button.dataset.preview);
        const video = document.createElement("video");
        video.src = row.video;
        video.loop = true;
        video.playsInline = true;
        media.append(video);
        const cleanupSound = row.sound ? attachAnimationSound(video, row.sound, media.parentElement) : () => {};
        cleanupPreview = () => {
          cleanupSound();
          video.pause();
          video.remove();
          button.setAttribute("aria-pressed", "false");
          button.innerHTML = icon("play");
          cleanupPreview = () => {};
        };
        button.setAttribute("aria-pressed", "true"); button.innerHTML = icon("x");
        video.play().catch(() => {
          if (!video.isConnected) return;
          cleanupPreview();
          showToast("Видеопревью недоступно.");
        });
      }));
      results.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
        state.page = Number(button.dataset.page);
        draw();
        main.querySelector(".catalog-controls").scrollIntoView({ block: "start" });
      }));
      results.querySelector("#pageSize").addEventListener("change", (event) => { state.size = Number(event.target.value); state.page = 1; draw(); });
      results.querySelector("#catalogView")?.addEventListener("change", (event) => { state.view = event.target.value; draw(); });
      results.querySelectorAll("[data-compare]").forEach((input) => input.addEventListener("change", () => {
        toggleComparison(rows.find((row) => row.id === input.dataset.compare).vehicle);
        input.checked = comparison.has(input.dataset.compare);
      }));
      const query = new URLSearchParams();
      for (const field of ["kind", "level", "city", "min", "max", "sort", "weightMin", "weightMax"]) {
        if (state[field]) query.set(field, state[field]);
      }
      if (state.usable) query.set("usable", "1");
      if (state.tradable) query.set("tradable", "1");
      if (state.query) query.set("q", state.query);
      if (state.view !== "cards") query.set("view", state.view);
      if (state.page > 1) query.set("page", state.page);
      if (state.size !== 24) query.set("size", state.size);
      history.replaceState(null, "", `#/${section}${query.size ? `?${query}` : ""}`);
    }

    main.querySelector("#catalogQuery").addEventListener("input", (event) => { state.query = event.target.value; state.page = 1; draw(); });
    main.querySelectorAll("[data-filter]").forEach((select) => select.addEventListener("change", () => { state[select.dataset.filter] = select.value; state.page = 1; draw(); }));
    main.querySelector("#catalogSort").addEventListener("change", (event) => { state.sort = event.target.value; state.page = 1; draw(); });
    for (const [id, field] of [["minPrice", "min"], ["maxPrice", "max"]]) {
      main.querySelector(`#${id}`)?.addEventListener("input", (event) => { state[field] = event.target.value; state.page = 1; draw(); });
    }
    main.querySelectorAll("[data-item-range]").forEach((input) => input.addEventListener("input", () => { state[input.dataset.itemRange] = input.value; state.page = 1; draw(); }));
    main.querySelectorAll("[data-capability]").forEach((input) => input.addEventListener("change", () => { state[input.dataset.capability] = input.checked; state.page = 1; draw(); }));
    main.querySelectorAll("[data-facet]").forEach((button) => button.addEventListener("click", () => {
      const field = button.dataset.facet;
      const selected = new Set(state[field].split(",").filter(Boolean));
      if (selected.has(button.dataset.value)) selected.delete(button.dataset.value);
      else selected.add(button.dataset.value);
      state[field] = [...selected].join(","); state.page = 1; draw();
    }));
    main.querySelectorAll("[data-catalog-view]").forEach((button) => button.addEventListener("click", () => { state.view = button.dataset.catalogView; draw(); }));
    main.querySelector("#resetFilters")?.addEventListener("click", () => { history.replaceState(null, "", `#/${section}`); route(); });
    draw();
  }

  function renderArticles(params) {
    const category = params.get("category") || "";
    const pages = manifest.pages.filter((page) => page.section === "articles");
    main.innerHTML = pageHeading("Игровые механики", "74 статьи о работах, хобби, семьях, криминале и повседневной жизни в Region.") +
      `<div class="article-categories"><a class="category-link ${!category ? "active" : ""}" href="#/articles">Все статьи</a>${Object.entries(manifest.categories).map(([id, title]) => `<a class="category-link ${category === id ? "active" : ""}" href="#/articles?category=${id}">${escapeHtml(title)}</a>`).join("")}</div>` +
      Object.entries(manifest.categories).filter(([id]) => !category || category === id).map(([id, title]) => `<section class="article-group"><h2>${escapeHtml(title)}</h2><div class="article-links">${pages.filter((page) => page.path.split("/")[2] === id).map((page) => `<a class="article-link" href="${localHref(page.path)}"><h3>${escapeHtml(page.title)} ↗</h3><p>${escapeHtml(page.summary)}</p></a>`).join("")}</div></section>`).join("");
  }

  function fact(labelText, value, description = "") {
    return `<div class="detail-fact"${description ? ` title="${escapeHtml(description)}"` : ""}><span>${escapeHtml(labelText)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function tuningHtml(price, vehicle = null) {
    const costs = vehicle ? vehicleCosts(vehicle) : null;
    const statePrice = costs ? vehicleBuybackText(costs) : money(Math.floor(price * .7));
    const priceLabel = "База расчёта улучшений";
    const stateLabel = vehicle ? "Госвыкуп" : "Выкуп 70% для салонной машины";
    const groups = (title, collection, kind, open) => `<details ${open ? "open" : ""}><summary>${title}</summary><div class="tuning-groups">${collection.map((group) => `<section class="tuning-group"><h3>${escapeHtml(group.title)}</h3><ul>${group.options.map(([name, referencePrice]) => `<li><span>${escapeHtml(name)}</span><strong>${money(tuning.calculatePrice(referencePrice, price, kind))}</strong></li>`).join("")}</ul></section>`).join("")}</div></details>`;
    const fixed = [{ title: "Фиксированные цены ателье из Wiki", options: [["Бронированный кузов", 30000], ["Смена типа краски", 15000]] }];
    return `<div class="tuning-summary"><div><span>${priceLabel}</span><strong>${money(price)}</strong></div><div><span>${stateLabel}</span><strong>${statePrice}</strong></div><div><span>Все уровни улучшений по порядку</span><strong>${money(tuning.calculatePerformanceTotal(price))}</strong></div></div>${groups("Улучшения", tuning.performance, "mechanical", true)}${groups("Покраска, тонировка, колёса и фары", tuning.appearance, "visual", false)}${groups("Клаксон", [tuning.horns], "fixed", false)}${groups("Другие услуги ателье", fixed, "fixed", false)}<p class="tuning-note"><a href="#/articles/vehicles/fuel-repair-tuning/">Механики нитро, GPS-маячка, ливрей, дыма шин, шлема и ремонта ↗</a></p>`;
  }

  function tuningNote() {
    return '<p class="tuning-note">Приблизительный расчёт Region Info по фактическим ценам BMW M5 (E39) за 1 700 000 ₽. Цены масштабируются по базе расчёта улучшений с округлением до 100 ₽, минимум улучшения — 10 000 ₽. Клаксоны имеют фиксированную цену. Итог включает покупку каждого уровня последовательно.</p>';
  }

  function renderTuning(params) {
    const initialPrice = Math.max(1, Number(params.get("price")) || 1700000);
    main.innerHTML = pageHeading("Калькулятор тюнинга", "Наши дополнительные расчёты цен двигателя, трансмиссии, тормозов, подвески, турбо и внешнего вида.") +
      `<form class="calculator-form" id="calculatorForm"><label>Исходная стоимость<select id="priceType"><option value="sale">База расчёта улучшений</option><option value="state">Выкуп салонной машины (70%)</option></select></label><label>Сумма, ₽<input id="tuningPrice" type="number" min="1" step="100" value="${initialPrice}" inputmode="numeric" required></label></form><section class="tuning-panel">${tuningNote()}<div id="tuningResults" aria-live="polite"></div></section><p class="source-note"><a href="cars.html">Открыть прежний каталог с замерами автомобилей ↗</a></p>`;
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

  function localizeDocument(container, path, vehicles = []) {
    const iconSources = new Set(Object.values(imageOverrides).filter((replacement) => replacement.fit === "icon").map((replacement) => replacement.src));
    container.querySelectorAll("img").forEach((image) => {
      if (iconSources.has(image.src)) image.dataset.mediaKind = "icon";
    });
    container.querySelectorAll("a[href]").forEach((link) => {
      const raw = link.getAttribute("href");
      if (raw.startsWith('#/')) return;
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
    container.querySelectorAll(".related-card--vehicle").forEach((card) => {
      const model = card.getAttribute("href")?.match(/\/vehicles\/([^/?#]+)/)?.[1];
      const vehicle = vehicles.find((entry) => entry.model === model);
      const price = card.querySelector(".related-price");
      if (!vehicle || !price) return;
      const costs = vehicleCosts(vehicle);
      price.textContent = costs.vehiclePrice == null ? "Цена уточняется" : money(costs.vehiclePrice);
    });
    container.querySelectorAll("video").forEach((video) => {
      video.removeAttribute("muted");
      video.muted = false;
      video.playsInline = true;
    });
    container.querySelectorAll(".gallery img[data-full]").forEach((image, index, images) => {
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", image.alt || "Посмотреть расцветку");
      image.setAttribute("aria-pressed", String(index === 0));
      function showImage() {
        const hero = image.closest(".imported-hero") || container;
        const preview = hero.querySelector(".imported-stage > img");
        if (preview) { preview.src = image.dataset.full; preview.alt = image.alt; }
        const variantName = hero.querySelector(".imported-info > p > span");
        if (variantName) variantName.textContent = image.alt;
        const counter = [...hero.querySelectorAll(".imported-stage > span")].find((span) => /\d+\s*\/\s*\d+/.test(span.textContent));
        if (counter) counter.textContent = `${index + 1} / ${images.length}`;
        images.forEach((thumbnail) => thumbnail.setAttribute("aria-pressed", String(thumbnail === image)));
      }
      image.addEventListener("click", showImage);
      image.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); showImage(); } });
    });
    container.querySelectorAll(".article-photo img, .screenshot-frame img").forEach((image) => {
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `Увеличить изображение${image.alt ? ` · ${image.alt}` : ""}`);
      function openImage() {
        const expanded = document.querySelector("#expandedImage");
        expanded.src = image.dataset.full || image.src;
        expanded.alt = image.alt;
        document.querySelector("#expandedImageCaption").textContent = image.closest("figure")?.querySelector("figcaption")?.textContent || image.alt;
        document.querySelector("#imageDialog").showModal();
      }
      image.addEventListener("click", openImage);
      image.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openImage(); } });
    });
    container.querySelectorAll(".article-screenshot").forEach((figure) => {
      const frame = figure.querySelector(".screenshot-frame");
      if (!frame) return;
      figure.querySelectorAll(".screen-annotation[data-x]").forEach((annotation, index) => {
        const point = document.createElement("button");
        point.className = "screenshot-point";
        point.type = "button";
        point.textContent = String(index + 1);
        point.title = annotation.textContent;
        point.setAttribute("aria-label", `${index + 1} · ${annotation.textContent}`);
        point.style.left = `${annotation.dataset.x}%`;
        point.style.top = `${annotation.dataset.y}%`;
        point.addEventListener("click", () => {
          figure.querySelectorAll(".screen-annotation").forEach((item) => item.classList.toggle("is-selected", item === annotation));
          annotation.scrollIntoView({ block: "nearest" });
        });
        frame.append(point);
      });
    });
  }

  function enhanceVehicle(overview, vehicle) {
    const info = overview.querySelector('.imported-info');
    const costs = vehicleCosts(vehicle);
    const brand = info.firstElementChild;
    info.querySelector('h1').textContent = vehicle.name;
    brand.classList.add('vehicle-brand-line');
    info.querySelector(':scope > ul').classList.add('vehicle-tags');
    const originalPrices = info.querySelector(':scope > div:has(> div > span)');
    if (vehicle.access === 'service') {
      const availability = document.createElement('p');
      availability.className = 'detail-note';
      availability.textContent = originalPrices.textContent.trim();
      originalPrices.before(availability);
    }
    const similarLink = info.querySelector('a[href*="/vehicles/compare/"]');
    const similarModels = similarLink ? new URL(similarLink.href, sourceOrigin).searchParams.get('ids') : '';
    const originalActions = info.lastElementChild;
    const rows = [
      ['store', 'Цена в салоне', money(vehicle.price_dealer), vehicle.price_dealer == null ? 'В салонах нет' : 'Базовая цена. Владелец салона может изменить её в пределах игры.'],
      ['gift', 'Цена машины', money(costs.vehiclePrice), vehiclePriceOverrides[vehicle.model]?.source || 'Цена кейсового транспорта требует игрового подтверждения'],
      ['building-2', 'Госвыкуп', vehicleBuybackText(costs), costs.buybackConfirmed ? 'Подтверждено в игровом окне «ИП Автоскуп»' : costs.statePrice == null ? 'Сумма требует игрового подтверждения' : 'Расчёт от базовой цены в салоне · 70%'],
      ['wrench', 'Полный тюнинг', costs.tuningPrice == null ? '—' : `≈ ${money(costs.tuningPrice)}`, 'Все уровни улучшений по порядку']
    ];
    originalPrices.className = 'vehicle-finances';
    originalPrices.innerHTML = rows.map(([name, title, value, note], index) => {
      if ((vehicle.access === 'service' && index < 2) || (index === 1 && vehicle.price_dealer != null && !vehiclePriceOverrides[vehicle.model]?.vehicle_price)) return '';
      return `<div class="vehicle-finance ${index > 1 ? 'vehicle-finance--accent' : ''}">${icon(name)}<div><span>${title}</span><strong>${index === 3 && costs.tuningBase != null ? `<a href="${localHref(`/vehicles/${vehicle.model}/`)}?anchor=region-tuning">${value} ${icon('arrow-up-right')}</a>` : value}</strong></div>${vehicle.access === 'service' ? '' : `<p>${note}</p>`}</div>`;
    }).join('');
    if (vehicle.dealership_business_id != null) {
      const salonLink = document.createElement('a');
      salonLink.className = 'vehicle-dealership';
      salonLink.href = localHref(`/business/${vehicle.dealership_business_id}/`);
      salonLink.textContent = `Салон «${vehicle.dealership}» ↗`;
      originalPrices.firstElementChild.querySelector('p').append(document.createElement('br'), salonLink);
    }
    originalActions.className = 'detail-actions';
    originalActions.innerHTML = `${similarModels ? `<button type="button" class="primary-button" id="similarCompare" data-models="${escapeHtml(similarModels)}">${icon('scale')}Сравнить с похожей</button>` : ''}<button type="button" class="quiet-button" id="detailCompare" data-model="${escapeHtml(vehicle.model)}">${comparison.has(vehicle.model) ? 'Убрать из сравнения' : 'Добавить к сравнению'}</button><a class="quiet-button" href="#/vehicles?kind=${encodeURIComponent(vehicle.class)}">Весь класс ${icon('arrow-up-right')}</a>`;
    overview.querySelector('.imported-stage > span:nth-child(2)')?.classList.add('vehicle-rarity');
    const highlights = main.querySelector('.imported-kpis');
    if (highlights) {
      highlights.querySelectorAll('.imported-kpi').forEach((metric) => {
        const ranking = metric.lastElementChild.textContent.match(/(\d+) место из (\d+)/);
        if (!ranking) return;
        const meter = document.createElement('span');
        meter.className = 'kpi-meter';
        meter.setAttribute('aria-hidden', 'true');
        meter.innerHTML = `<span style="width:${(Number(ranking[2]) - Number(ranking[1]) + 1) / Number(ranking[2]) * 100}%"></span>`;
        metric.lastElementChild.before(meter);
      });
      const strip = document.createElement('section');
      strip.className = 'prose vehicle-highlights';
      strip.append(highlights);
      overview.after(strip);
    }
  }

  function enhanceDocument(section, documentData, params, vehicle) {
    const layout = main.querySelector(".article-layout");
    const prose = layout.querySelector(".prose");
    prose.classList.add(`prose--${section}`);
    const structured = !["articles", "updates"].includes(section);
    if (structured) {
      layout.classList.add('article-layout--structured');
      const hero = prose.querySelector(".imported-hero, .detail-heading");
      if (hero) {
        const info = hero.querySelector(".imported-info") || hero;
        const heading = main.querySelector(".page-head");
        heading.querySelector(".intro")?.remove();
        const estateSeparator = documentData.title.includes(' · ') ? ' · ' : ', ';
        if (section === 'estate' && documentData.title.includes(estateSeparator)) {
          const [title, ...address] = documentData.title.split(estateSeparator);
          heading.querySelector('h1').textContent = title;
          const context = document.createElement('p');
          context.className = 'detail-address';
          context.textContent = address.join(estateSeparator);
          heading.append(context);
        }
        const category = vehicle ? info.firstElementChild : info.querySelector(":scope > a, :scope > .detail-category");
        if (category) category.after(heading);
        else info.prepend(heading);
        const overview = document.createElement("section");
        overview.className = `prose detail-overview detail-overview--${section}`;
        overview.append(hero);
        overview.querySelectorAll('img').forEach((image) => { image.loading = 'eager'; });
        layout.before(overview);
        if (vehicle) enhanceVehicle(overview, vehicle);
        if (hero.classList.contains("imported-hero")) {
          [...hero.children].slice(2).forEach((extra) => { extra.classList.add("detail-extra"); info.append(extra); });
        }
      }
      main.querySelectorAll(".imported-info > div, .detail-heading > div").forEach((group) => {
        if (group.querySelector(":scope > div > b")) group.classList.add("detail-metrics");
      });
      prose.querySelectorAll(".related-card--vehicle, .related-card--clothes, .related-card--property").forEach((card) => card.classList.add("related-card"));
      prose.querySelectorAll('dl').forEach((list) => list.classList.add('detail-rows'));
      prose.querySelectorAll('h2').forEach((heading) => {
        const parent = heading.parentElement;
        if (parent.tagName === 'DIV' && parent.firstElementChild === heading) parent.classList.add('detail-section-header');
      });
      prose.querySelectorAll(".related-grid + .related-grid").forEach((grid) => {
        grid.previousElementSibling.append(...grid.children);
        grid.remove();
      });
    }
    const details = main.querySelector("#pageToc");
    const headings = [...prose.querySelectorAll("h2")];
    details.innerHTML = '<summary>На этой странице</summary>' + headings.map((heading, index) => {
      const anchor = heading.dataset.anchor || heading.closest("section[data-anchor]")?.dataset.anchor || `section-${index + 1}`;
      heading.dataset.anchor = anchor;
      return `<a href="${localHref(documentData.path)}?anchor=${encodeURIComponent(anchor)}">${escapeHtml(heading.textContent)}</a>`;
    }).join("");
    details.closest(".article-toc").hidden = headings.length === 0;

    const floorBar = prose.querySelector(".floor-tabs");
    const floors = [...prose.querySelectorAll(".flat-list")];
    floors.forEach((floor) => floor.querySelectorAll('li').forEach((row) => {
      row.querySelectorAll('.flat-meta').forEach((meta, index) => {
        const label = document.createElement('span');
        label.className = 'flat-meta-label';
        label.textContent = index === 0 ? 'Жильцов' : 'Мест в гараже';
        meta.prepend(label);
      });
    }));
    if (floorBar && floors.length) {
      floorBar.setAttribute("role", "tablist");
      floorBar.setAttribute("aria-label", "Этаж");
      floorBar.innerHTML = floors.map((floor, index) => `<button type="button" role="tab" id="floor-tab-${index}" aria-controls="flat-floor-${index}" data-floor-index="${index}" aria-selected="${!floor.hidden}" tabindex="${floor.hidden ? -1 : 0}">${escapeHtml(floor.dataset.anchor?.replace("floor-", "") || index + 1)} этаж</button>`).join("");
      floors.forEach((floor, index) => {
        floor.id = `flat-floor-${index}`; floor.setAttribute("role", "tabpanel"); floor.setAttribute("aria-labelledby", `floor-tab-${index}`);
      });
      function selectFloor(index) {
        floors.forEach((floor, position) => { floor.hidden = index !== position; });
        floorBar.querySelectorAll("button").forEach((button, position) => { button.setAttribute("aria-selected", String(index === position)); button.tabIndex = index === position ? 0 : -1; });
      }
      const requestedFloor = floors.findIndex((floor) => floor.dataset.anchor === params.get("anchor"));
      if (requestedFloor >= 0) selectFloor(requestedFloor);
      floorBar.addEventListener("click", (event) => { const button = event.target.closest("button"); if (button) selectFloor(Number(button.dataset.floorIndex)); });
      floorBar.addEventListener("keydown", (event) => {
        const current = Number(event.target.dataset.floorIndex);
        const targets = { ArrowLeft: (current + floors.length - 1) % floors.length, ArrowRight: (current + 1) % floors.length, Home: 0, End: floors.length - 1 };
        if (!(event.key in targets)) return;
        event.preventDefault(); selectFloor(targets[event.key]); floorBar.querySelectorAll("button")[targets[event.key]].focus();
      });
    }

    const observers = [];
    const maps = documentData.widgets.filter((widget) => widget.component.includes("MiniMap"));
    const figures = [...prose.querySelectorAll('figure[data-anchor^="map"]')];
    maps.forEach((widget, index) => {
      const data = widget.data;
      const figure = figures[index];
      if (!figure || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
      const preview = document.createElement("a");
      preview.className = "map-preview";
      preview.href = localHref(data.href || `/map/?x=${data.x}&y=${data.y}`);
      preview.setAttribute("aria-label", `${data.label || "Расположение"} на карте`);
      figure.prepend(preview);
      function draw() {
        const zoom = Math.max(2, Math.min(6, Math.round(data.zoom || 5)));
        const size = 256 * 2 ** zoom;
        const centerX = (data.x + 8192) / 16384 * size;
        const centerY = (8192 - data.y) / 16384 * size;
        const offsetX = preview.clientWidth / 2 - centerX;
        const offsetY = preview.clientHeight / 2 - centerY;
        const tiles = [];
        for (let x = Math.max(0, Math.floor(-offsetX / 256)); x <= Math.min(2 ** zoom - 1, Math.floor((preview.clientWidth - offsetX) / 256)); x += 1) {
          for (let y = Math.max(0, Math.floor(-offsetY / 256)); y <= Math.min(2 ** zoom - 1, Math.floor((preview.clientHeight - offsetY) / 256)); y += 1) {
            tiles.push(`<img src="https://cdn.region.game/map/dark/${zoom}/${x}/${y}.png" alt="" loading="lazy" style="left:${x * 256 + offsetX}px;top:${y * 256 + offsetY}px">`);
          }
        }
        preview.innerHTML = tiles.join("") + `<span class="map-preview-marker">${data.icon ? `<img src="${escapeHtml(new URL(data.icon, sourceOrigin).href)}" alt="">` : icon("map")}</span><span class="map-preview-action">Открыть карту ${icon("arrow-up-right")}</span>`;
      }
      const observer = new ResizeObserver(draw);
      observer.observe(preview);
      observers.push(observer);
    });
    cleanupView = () => observers.forEach((observer) => observer.disconnect());
  }

  async function renderDocument(section, payload, path, params, version) {
    const documentData = await loadDocument(path);
    if (version !== routeVersion) return;
    if (!documentData) throw new Error("Эта страница отсутствует в локальной базе.");
    let vehicleCatalog = [];
    if (section === "vehicles" || documentData.html.includes("related-card--vehicle")) {
      const vehiclePayload = section === "vehicles" ? payload : await loadSection("vehicles");
      vehicleCatalog = vehiclePayload.data[0].data.vehicles;
    }
    if (version !== routeVersion) return;
    const vehicle = section === "vehicles" ? vehicleCatalog.find((item) => item.model === path.split("/")[2]) : null;
    const costs = vehicle ? vehicleCosts(vehicle) : null;
    const toc = documentData.headings.filter((heading) => heading.id).map((heading) => `<a href="${localHref(path)}?anchor=${encodeURIComponent(heading.id)}">${escapeHtml(heading.title)}</a>`).join("") + (vehicle ? `<a href="${localHref(path)}?anchor=region-tuning">Расчёт тюнинга</a>` : "");
    document.title = `${documentData.title} — Region Info`;
    main.innerHTML = pageHeading(documentData.title, documentData.summary, section) +
      (vehicle ? `<section id="vehicleTuning" class="tuning-panel"><h2>Стоимость улучшений и тюнинга</h2>${tuningNote()}${costs.tuningBase != null ? tuningHtml(costs.tuningBase, vehicle) : '<p class="tuning-note">Для этой модели в Wiki отсутствует стоимость. Укажите цену в калькуляторе для расчёта.</p><a class="quiet-button" href="#/tuning">Открыть калькулятор</a>'}</section><div id="legacySpecs"></div>` : "") +
      `<div class="article-layout"><article class="prose ${vehicle ? "prose--vehicle" : ""}">${documentMarkup(documentData.html)}</article><aside class="article-toc" aria-label="На этой странице"><details id="pageToc"><summary>На этой странице</summary>${toc}</details></aside></div>${sourceNote(path)}`;
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
    localizeDocument(main.querySelector(".prose"), path, vehicleCatalog);
    enhanceDocument(section, documentData, params, vehicle);
    const animation = section === "animations" ? normalizeRows(section, payload).find((row) => row.href === path) : null;
    const soundCleanups = [];
    main.querySelectorAll("video").forEach((video) => {
      const sound = video.closest("[data-animation-sound]")?.dataset.animationSound || animation?.sound;
      if (sound) soundCleanups.push(attachAnimationSound(video, sound, video.parentElement));
    });
    const cleanupDocument = cleanupView;
    cleanupView = () => {
      soundCleanups.forEach((cleanup) => cleanup());
      cleanupDocument();
    };
    main.querySelector('#similarCompare')?.addEventListener('click', (event) => {
      const models = event.currentTarget.dataset.models.split(',');
      comparison.clear();
      models.map((model) => payload.data[0].data.vehicles.find((item) => item.model === model)).filter(Boolean).slice(0, 4).forEach(toggleComparison);
      main.querySelector('#detailCompare').textContent = comparison.has(vehicle.model) ? 'Убрать из сравнения' : 'Добавить к сравнению';
      renderComparison();
    });
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
    updateComparison();
  }

  function updateComparison() {
    document.querySelector("#compareTray").hidden = comparison.size === 0;
    document.querySelector("#compareCount").textContent = `В сравнении ${comparison.size} из 4`;
    document.querySelector("#compareOpen").disabled = comparison.size < 2;
    document.querySelector("#compareSelection").innerHTML = [...comparison.values()].map((vehicle) => `<div class="compare-vehicle"><span>${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.name)}</span><button type="button" data-remove-comparison="${escapeHtml(vehicle.model)}" aria-label="Убрать ${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.name)} из сравнения">${icon("x")}</button></div>`).join("");
    main.querySelectorAll("[data-compare]").forEach((input) => { input.checked = comparison.has(input.dataset.compare); });
    const detailButton = main.querySelector("#detailCompare");
    if (detailButton) detailButton.textContent = comparison.has(detailButton.dataset.model) ? "Убрать из сравнения" : "Добавить к сравнению";
  }

  function removeFromComparison(model) {
    const index = [...comparison.keys()].indexOf(model);
    if (index < 0) return;
    const dialog = document.querySelector("#compareDialog");
    const wasOpen = dialog.open;
    comparison.delete(model);
    updateComparison();
    if (wasOpen && comparison.size) renderComparison();
    if (wasOpen && !comparison.size) dialog.close();
    const controls = document.querySelectorAll(`${wasOpen && comparison.size ? "#compareContent" : "#compareSelection"} [data-remove-comparison]`);
    if (controls.length) controls[Math.min(index, controls.length - 1)].focus({ preventScroll: true });
    else main.focus({ preventScroll: true });
  }

  function renderComparison() {
    const list = [...comparison.values()].map((vehicle) => ({ ...vehicle, ...vehicleCosts(vehicle) }));
    const metrics = [
      ["Цена машины", "vehiclePrice", "min", (value) => money(value)],
      ["Госвыкуп", "statePrice", "max", (value, vehicle) => vehicleBuybackText(vehicle)],
      ["База расчёта улучшений", "tuningBase", "", (value) => money(value)],
      ["Полный тюнинг · расчёт", "tuningPrice", "min", (value) => value == null ? "—" : `≈ ${money(value)}`],
      ["Максимальная скорость", "max_speed_kmh", "max", (value) => `${numbers.format(value)} км/ч`],
      ["Разгон 0–100", "t100_s", "min", (value) => value == null ? "—" : `${numbers.format(value)} с`],
      ["Багажник", "trunk_kg", "max", (value) => `${numbers.format(value)} кг`],
      ["Мест", "seats", "max", String], ["Масса", "mass_kg", "", (value) => value == null ? "—" : `${numbers.format(value)} кг`],
      ["Топливо", "fuel_type", "", label], ["Бак / батарея", "fuel_capacity_l", "max", (value, vehicle) => `${numbers.format(value)} ${vehicle.fuel_type === 'Electric' ? 'ед.' : 'л'}`],
      ["Расход под нагрузкой", "fuel_load_l100", "min", (value, vehicle) => `${numbers.format(value)} ${vehicle.fuel_type === 'Electric' ? 'ед.' : 'л'}/100 км`],
      ["Привод", "drivetrain", "", label]
    ];
    document.querySelector("#compareContent").innerHTML = `<p class="compare-help">Таблицу можно прокручивать по горизонтали.</p><table class="compare-table"><thead><tr><th scope="col">Характеристика</th>${list.map((vehicle) => `<th scope="col" class="compare-vehicle-column"><button class="compare-remove icon-button" type="button" data-remove-comparison="${escapeHtml(vehicle.model)}" aria-label="Убрать ${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.name)} из сравнения">${icon("x")}</button><img src="${escapeHtml(imageUrl(`${mediaBase}/vehicles/${vehicle.model}.png`))}" alt="">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.name)}</th>`).join("")}</tr></thead><tbody>${metrics.map(([title, field, direction, format]) => {
      const values = list.map((vehicle) => vehicle[field]).filter((value) => typeof value === "number");
      const best = direction === "min" ? Math.min(...values) : Math.max(...values);
      return `<tr><th scope="row">${title}</th>${list.map((vehicle) => `<td ${direction && vehicle[field] != null && vehicle[field] === best ? 'class="best"' : ""}>${escapeHtml(vehicle[field] == null ? '—' : format(vehicle[field], vehicle))}</td>`).join("")}</tr>`;
    }).join("")}</tbody></table>`;
    const dialog = document.querySelector("#compareDialog");
    if (!dialog.open) dialog.showModal();
  }

  function searchMediaHtml(page, row = {}) {
    const original = page.image || row.image;
    const source = original ? imageUrl(original) : page.icon;
    const cover = original && row.fit !== "contain" && imageOverrides[original]?.fit !== "icon" && ["estate", "business", "factions", "updates", "map"].includes(page.section);
    return `<span class="card-media search-media ${cover ? "search-media--cover" : ""}" data-section="${escapeHtml(page.section)}" data-icon="${escapeHtml(page.icon || "")}">${source ? `<img src="${escapeHtml(source)}" alt="" loading="lazy" decoding="async" class="${!original || imageOverrides[original]?.fit === "icon" ? "media-icon" : ""}">` : icon(page.searchIcon || icons[page.section])}</span>`;
  }

  function searchResultHtml(page, metadata) {
    const row = metadata?.row;
    const settings = metadata?.settings;
    let description = page.snippet || (["season", "levels"].includes(page.section) ? page.summary : row?.sub || page.summary);
    let facts = [];
    if (row?.vehicle) {
      const costs = vehicleCosts(row.vehicle);
      description = `${row.stats[0]}${row.stats[1] ? ` · 0–100 за ${row.stats[1]}` : ""} · багажник ${row.stats[3]}`;
      facts = [[row.priceLabel, money(row.price)], ["Госвыкуп", vehicleBuybackText(costs)], ["Полный тюнинг", costs.tuningPrice == null ? "—" : `≈ ${money(costs.tuningPrice)}`]];
    } else if (page.section === "map") {
      facts = (page.facts || []).slice(0, 3).map((fact) => [fact.label, fact.value]);
    } else if (page.section === "rentals" && page.previewFacts?.length) {
      facts = page.previewFacts.slice(0, 3);
    } else if (row && page.section !== "season") {
      const priceLabel = row.priceLabel || settings.priceTitle || (page.section === "estate" ? { Complex: "Квартиры от", Hotel: "За сутки от" }[row.kind] : page.section === "rentals" && row.kind === "rental" ? "Аренда в час от" : "") || "Цена";
      if (row.price != null && !settings.noPrice) facts.push([priceLabel, money(row.price, row.currency)]);
      const columns = page.section === "items" ? ["Вес", "Размер", "В ячейке"] : page.section === "clothes" ? ["Магазины"] : settings.columns || [];
      facts.push(...columns.slice(0, 3).flatMap((title, index) => row.stats?.[index] != null && row.stats[index] !== "" && row.stats[index] !== "—" ? [[title, catalogStat(row.stats[index], page.section)]] : []));
    }
    if (!row && page.section !== "map") facts = (page.previewFacts || []).slice(0, 3);
    if (description.startsWith(page.title)) description = description.slice(page.title.length).replace(/^[\s:—·-]+/u, "");
    const kind = page.section === "season" ? "" : row?.kindLabel || page.kindLabel;
    const category = [sectionTitle(page.section), kind].filter(Boolean).join(" · ");
    return `<a class="search-result" href="${localHref(page.path)}">${searchMediaHtml(page, row)}<div class="search-result-main"><p class="search-result-type">${escapeHtml(category)}</p><h2>${escapeHtml(page.title)}</h2>${description ? `<p class="search-result-summary">${escapeHtml(description)}</p>` : ""}</div>${icon("arrow-up-right")}${facts.length ? `<dl class="search-facts">${facts.map(([title, value]) => `<div><dt>${escapeHtml(title)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>` : ""}</a>`;
  }

  async function renderSearch(params, version) {
    const state = {
      query: params.get("q") || "",
      section: manifest.sections.some((section) => section.id === params.get("section")) ? params.get("section") : "",
      page: Math.max(1, Math.floor(Number(params.get("page")) || 1))
    };
    let timer;
    let revision = 0;
    let draft = false;
    main.innerHTML = `<div class="search-page">${pageHeading("Поиск по справочнику", "Вещи, транспорт, места и игровые механики.")}<form class="search-form" id="pageSearch" role="search"><div class="search-input">${icon("search")}<label class="sr-only" for="pageQuery">Поисковый запрос</label><input type="search" id="pageQuery" value="${escapeHtml(state.query)}" placeholder="Название, адрес или игровая механика" autocomplete="off"><button class="icon-button search-clear" id="searchClear" type="button" aria-label="Очистить запрос" ${!state.query ? "hidden" : ""}>${icon("x")}</button></div><button class="primary-button" type="submit">Найти</button></form><nav class="search-scopes" id="searchScopes" aria-label="Разделы результатов поиска"></nav><p class="search-count" id="searchCount" role="status"></p><section class="search-results" id="searchResults" aria-label="Результаты поиска" aria-busy="true"></section></div>`;
    const input = main.querySelector("#pageQuery");
    const clear = main.querySelector("#searchClear");
    const results = main.querySelector("#searchResults");
    const scopes = main.querySelector("#searchScopes");
    const count = main.querySelector("#searchCount");

    async function draw() {
      const ticket = ++revision;
      results.setAttribute("aria-busy", "true");
      results.inert = true;
      count.textContent = "Ищем…";
      try {
        const index = await loadSearchIndex();
        if (ticket !== revision || version !== routeVersion) return;
        const matches = searchMatches(state.query, index);
        const counts = new Map(manifest.sections.map((section) => [section.id, 0]));
        matches.forEach((page) => counts.set(page.section, counts.get(page.section) + 1));
        if (!searchText(state.query) && !state.section) {
          scopes.innerHTML = "";
          count.textContent = "";
          results.innerHTML = `<div class="search-start"><h2>Примеры запросов</h2><div class="search-examples">${["Ремкомплект", "Питомцы", "BMW E30", "Работы", "Сезонный пропуск"].map((query) => `<a href="${searchHref(query)}">${icon("search")}${query}</a>`).join("")}</div><h2>Поиск по разделам</h2><div class="search-directory">${manifest.sections.map((section) => `<a href="${searchHref("", section.id)}">${icon(icons[section.id])}<span>${escapeHtml(section.title)}</span><small>${numbers.format(counts.get(section.id))}</small></a>`).join("")}</div></div>`;
          results.setAttribute("aria-busy", "false");
          results.inert = false;
          history.replaceState(null, "", searchHref());
          return;
        }
        const filtered = matches.filter((page) => !state.section || page.section === state.section);
        const pages = Math.max(1, Math.ceil(filtered.length / 20));
        state.page = Math.min(state.page, pages);
        const visible = filtered.slice((state.page - 1) * 20, state.page * 20);
        const sections = [...new Set(visible.map((page) => page.section))].filter((section) => !["articles", "updates", "map"].includes(section));
        const payloads = await Promise.allSettled(sections.map(loadSection));
        if (ticket !== revision || version !== routeVersion) return;
        const metadata = new Map();
        payloads.forEach((result, index) => {
          if (result.status !== "fulfilled") return;
          const section = sections[index];
          const settings = catalogSettings(section, result.value);
          normalizeRows(section, result.value).forEach((row) => {
            if (!metadata.has(row.href)) metadata.set(row.href, { row, settings });
          });
        });
        scopes.innerHTML = `<a data-search-section="" href="${searchHref(state.query)}" ${!state.section ? 'aria-current="page"' : ""}>Все разделы <span>${numbers.format(matches.length)}</span></a>` + manifest.sections.filter((section) => counts.get(section.id) || section.id === state.section).map((section) => `<a data-search-section="${section.id}" href="${searchHref(state.query, section.id)}" ${state.section === section.id ? 'aria-current="page"' : ""}>${escapeHtml(section.title)} <span>${numbers.format(counts.get(section.id))}</span></a>`).join("");
        count.textContent = `Найдено ${numbers.format(filtered.length)}${pages > 1 ? ` · страница ${state.page} из ${pages}` : ""}`;
        results.innerHTML = visible.length ? `<div class="search-result-list">${visible.map((page) => searchResultHtml(page, metadata.get(page.path))).join("")}</div>${paginationHtml(state.page, pages)}` : `<div class="search-empty"><h2>Совпадений не найдено</h2><p>Попробуйте другое название или сократите запрос.</p>${state.section ? `<a class="quiet-button" href="${searchHref(state.query)}">Искать во всех разделах</a>` : ""}</div>`;
        results.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { location.hash = searchHref(state.query, state.section, Number(button.dataset.page)); }));
        history.replaceState(null, "", searchHref(state.query, state.section, state.page));
      } catch (error) {
        if (ticket !== revision || version !== routeVersion) return;
        count.textContent = "Не удалось загрузить поиск";
        results.innerHTML = '<div class="search-empty"><button class="quiet-button" type="button" id="retrySearch">Повторить</button></div>';
        results.querySelector("#retrySearch").addEventListener("click", draw);
      }
      results.setAttribute("aria-busy", "false");
      results.inert = false;
    }

    input.addEventListener("input", () => {
      state.query = input.value;
      state.page = 1;
      if (!draft) { history.pushState(null, "", searchHref(state.query, state.section)); draft = true; }
      revision += 1;
      clear.hidden = !state.query;
      document.querySelector("#globalQuery").value = state.query;
      results.setAttribute("aria-busy", "true");
      results.inert = true;
      count.textContent = "Ищем…";
      scopes.querySelectorAll("[data-search-section]").forEach((link) => { link.href = searchHref(state.query, link.dataset.searchSection); });
      clearTimeout(timer);
      timer = setTimeout(draw, 180);
    });
    clear.addEventListener("click", () => {
      input.value = "";
      state.query = "";
      state.page = 1;
      if (!draft) { history.pushState(null, "", searchHref("", state.section)); draft = true; }
      clear.hidden = true;
      document.querySelector("#globalQuery").value = "";
      input.focus();
      clearTimeout(timer);
      draw();
    });
    main.querySelector("#pageSearch").addEventListener("submit", (event) => {
      event.preventDefault();
      clearTimeout(timer);
      state.query = input.value;
      state.page = 1;
      draft = false;
      document.querySelector("#globalQuery").value = state.query;
      draw();
    });
    document.querySelector("#globalQuery").value = state.query;
    cleanupView = () => { clearTimeout(timer); revision += 1; };
    await draw();
  }

  function renderMap(payload, params) {
    const data = payload.data[0].data;
    const selectedCategories = new Set(data.categories.map((category) => category.id));
    const selectedZones = new Set();
    const initialPlace = data.places.find((place) => place.id === params.get("p"));
    let zoom = initialPlace ? 5 : 3;
    let center = initialPlace ? { x: initialPlace.x, y: initialPlace.y } : { x: params.has("x") ? Number(params.get("x")) : -600, y: params.has("y") ? Number(params.get("y")) : 6000 };
    let query = "";
    main.innerHTML = pageHeading("Карта региона", "Работы, магазины, недвижимость, прокат и игровые зоны. Перетаскивайте карту и меняйте масштаб.") + `<div class="map-layout"><div class="map-filters"><input type="search" id="mapQuery" aria-label="Найти место на карте" placeholder="Найти место"><button class="quiet-button" id="mapAll" type="button">Снять все</button><h3>Места</h3>${data.categories.map((category) => `<label><input type="checkbox" data-category="${escapeHtml(category.id)}" checked>${escapeHtml(category.label)}</label>`).join("")}<h3>Зоны</h3>${data.zoneKinds.map((kind) => `<label><input type="checkbox" data-zone="${escapeHtml(kind.id)}">${escapeHtml(kind.label)}</label>`).join("")}</div><div class="map-surface" id="mapSurface" tabindex="0" aria-label="Карта. Стрелки перемещают карту, плюс и минус меняют масштаб."><div class="map-plane" id="mapPlane"></div><div class="map-controls"><button class="icon-button" id="zoomIn" aria-label="Приблизить">${icon("plus")}</button><button class="icon-button" id="zoomOut" aria-label="Отдалить">${icon("minus")}</button><button class="icon-button" id="mapCity" aria-label="К Петербургу">${icon("house")}</button></div><div class="map-popup" id="mapPopup" hidden></div></div></div><div id="mapLocations" class="map-location-list"></div>${sourceNote("/map/")}`;
    const surface = main.querySelector("#mapSurface");
    const plane = main.querySelector("#mapPlane");
    const popup = main.querySelector("#mapPopup");

    function project(x, y) {
      const size = 256 * 2 ** zoom;
      return { x: (x + 8192) / 16384 * size, y: (8192 - y) / 16384 * size };
    }

    function showPlace(place) {
      const actions = [...(place.actions || []), ...(place.articles || [])];
      popup.innerHTML = `<button class="icon-button" aria-label="Закрыть место">${icon("x")}</button><h3>${escapeHtml(place.name)}</h3><p>${escapeHtml(place.kindLabel || place.note || "")}</p>${place.description ? `<p>${escapeHtml(place.description)}</p>` : ""}${(place.facts || []).map((value) => `<p>${escapeHtml(Array.isArray(value) ? value.join(" · ") : typeof value === "object" ? `${value.label} · ${value.value}` : value)}</p>`).join("")}<p>Координаты ${numbers.format(place.x)}, ${numbers.format(place.y)}</p>${actions.map((action) => `<a href="${localHref(action.href || action.url || "/map/")}">${escapeHtml(action.label || action.title || "Подробнее")} ↗</a>`).join(" ")}`;
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
      const visible = data.places.filter((place) => selectedCategories.has(place.cat) && query.split(/\s+/).filter(Boolean).every((term) => searchText(`${place.name} ${place.kindLabel} ${place.note} ${place.description || ""}`).includes(term)));
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
    main.querySelector("#mapQuery").addEventListener("input", (event) => { query = searchText(event.target.value); draw(); });
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
    closeGlobalSearch();
    document.querySelector("#imageDialog").close();
    document.querySelector("#compareDialog").close();
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
    main.dataset.section = section;
    renderNavigation(section);
    main.innerHTML = '<div class="loading" role="status">Загружаем раздел…</div>';
    document.title = `${section === "home" ? "Справочник игрока" : section === "tuning" ? "Калькулятор тюнинга" : section === "search" ? "Поиск" : sectionTitle(section)} — Region Info`;
    try {
      if (section === "home") renderHome();
      else if (section === "search") await renderSearch(url.searchParams, version);
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
      if (!main.contains(document.activeElement) && !document.activeElement.matches("input, textarea, select")) main.focus({ preventScroll: true });
    } catch (error) {
      if (version !== routeVersion) return;
      console.error(error);
      main.innerHTML = `${pageHeading("Не удалось открыть страницу")}<div class="error"><p>${escapeHtml(error.message)}</p><button class="quiet-button" id="retryPage">Повторить загрузку</button> <a class="quiet-button" href="#/">На главную</a></div>`;
      main.querySelector("#retryPage").addEventListener("click", route);
    }
  }

  const globalForm = document.querySelector("#globalSearch");
  const globalInput = document.querySelector("#globalQuery");
  const globalSuggestions = document.querySelector("#globalSuggestions");
  const searchDialog = document.querySelector("#searchDialog");
  const searchTrigger = document.querySelector("#openSearch");
  const searchClear = document.querySelector("#globalSearchClear");
  const searchStatus = document.querySelector("#globalSearchStatus");
  const allSearchResults = document.querySelector("#showAllSearch");
  let suggestionOptions = [];
  let suggestionIndex = -1;
  let suggestionRevision = 0;
  let searchBackdropDown = false;

  function positionGlobalSearch() {
    if (!searchDialog.open) return;
    const anchor = searchTrigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const margin = window.matchMedia("(max-width: 600px)").matches ? 10 : 16;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportWidth = Math.min(viewport?.width || innerWidth, document.documentElement.clientWidth);
    const viewportBottom = viewportTop + (viewport?.height || innerHeight);
    const width = Math.min(880, viewportWidth - margin * 2);
    const right = viewportLeft + viewportWidth - margin;
    const preferredLeft = anchor.left + width <= right ? anchor.left : anchor.right - width;
    const left = Math.max(viewportLeft + margin, Math.min(preferredLeft, right - width));
    const top = Math.max(viewportTop + margin, anchor.bottom + 12);
    searchDialog.style.setProperty("--search-top", `${top}px`);
    searchDialog.style.setProperty("--search-left", `${left}px`);
    searchDialog.style.setProperty("--search-width", `${width}px`);
    searchDialog.style.setProperty("--search-height", `${Math.max(0, viewportBottom - top - margin)}px`);
  }

  function closeGlobalSearch() {
    suggestionRevision += 1;
    if (searchDialog.open) searchDialog.close();
    searchTrigger.setAttribute("aria-expanded", "false");
    globalInput.setAttribute("aria-expanded", "false");
    globalInput.removeAttribute("aria-activedescendant");
    suggestionIndex = -1;
  }

  function openGlobalSearch() {
    if (!manifest) return;
    document.body.classList.remove("menu-open");
    document.querySelector("#menuButton").setAttribute("aria-expanded", "false");
    if (!searchDialog.open) searchDialog.showModal();
    positionGlobalSearch();
    searchTrigger.setAttribute("aria-expanded", "true");
    globalInput.focus({ preventScroll: true });
    globalInput.select();
    showGlobalSuggestions();
  }

  function openSearchOption(option) {
    closeGlobalSearch();
    const next = localHref(option.path);
    if (location.hash === next) main.focus({ preventScroll: true });
    else location.hash = next;
  }

  async function showGlobalSuggestions() {
    if (!searchDialog.open) return;
    const ticket = ++suggestionRevision;
    const query = globalInput.value;
    suggestionOptions = [];
    suggestionIndex = -1;
    globalInput.removeAttribute("aria-activedescendant");
    globalInput.setAttribute("aria-expanded", "false");
    searchClear.hidden = !query;
    globalSuggestions.inert = true;
    globalSuggestions.setAttribute("aria-busy", "true");
    allSearchResults.disabled = true;
    globalSuggestions.innerHTML = '<div id="globalSearchOptions" role="listbox" aria-label="Результаты поиска"></div><p class="search-suggestion-empty">Загружаем поиск…</p>';
    try {
      if (!manifest) return;
      if (!searchText(query)) {
        suggestionOptions = manifest.sections.map((section) => ({ title: section.title, path: `/${section.id}/` }));
        globalSuggestions.innerHTML = `<p class="search-suggestion-label" id="searchOptionsTitle">Разделы</p><div class="search-section-options" id="globalSearchOptions" role="listbox" aria-labelledby="searchOptionsTitle">${suggestionOptions.map((section, index) => `<button class="search-section-option" type="button" role="option" tabindex="-1" id="search-option-${index}" aria-selected="false" data-suggestion="${index}">${escapeHtml(section.title)}</button>`).join("")}</div>`;
        allSearchResults.innerHTML = `Открыть страницу поиска ${icon("arrow-right")}`;
        searchStatus.textContent = `Доступно ${suggestionOptions.length} разделов`;
      } else {
        const index = await loadSearchIndex();
        if (ticket !== suggestionRevision || !searchDialog.open || globalInput.value !== query) return;
        const matches = searchMatches(query, index);
        suggestionOptions = matches.slice(0, 8);
        globalSuggestions.innerHTML = `<p class="search-suggestion-label" id="searchOptionsTitle">Найдено ${numbers.format(matches.length)}</p><div id="globalSearchOptions" role="listbox" aria-labelledby="searchOptionsTitle">${suggestionOptions.map((page, index) => `<button class="search-option" type="button" role="option" tabindex="-1" id="search-option-${index}" aria-selected="false" data-suggestion="${index}">${searchMediaHtml(page)}<span class="search-option-text"><b>${escapeHtml(page.title)}</b><small>${escapeHtml(sectionTitle(page.section))}${page.section === "clothes" && page.snippet ? ` · ${escapeHtml(page.snippet)}` : ""}</small></span>${icon("arrow-up-right")}</button>`).join("")}</div>${matches.length ? "" : '<p class="search-suggestion-empty">Совпадений нет. Попробуйте другое название или сократите запрос.</p>'}`;
        allSearchResults.innerHTML = `Все результаты · ${numbers.format(matches.length)} ${icon("arrow-right")}`;
        searchStatus.textContent = `Найдено ${numbers.format(matches.length)}. Показано ${suggestionOptions.length}`;
      }
      globalSuggestions.inert = false;
      globalSuggestions.setAttribute("aria-busy", "false");
      globalInput.setAttribute("aria-expanded", "true");
      allSearchResults.disabled = false;
    } catch (error) {
      if (ticket !== suggestionRevision || !searchDialog.open) return;
      globalSuggestions.innerHTML = '<div id="globalSearchOptions" role="listbox" aria-label="Результаты поиска"></div><p class="search-suggestion-empty">Не удалось загрузить поиск.</p><button class="quiet-button" type="button" id="retryGlobalSearch">Повторить</button>';
      globalSuggestions.querySelector("#retryGlobalSearch").addEventListener("click", showGlobalSuggestions);
      globalSuggestions.inert = false;
      globalSuggestions.setAttribute("aria-busy", "false");
      searchStatus.textContent = "Не удалось загрузить поиск";
    }
  }

  searchTrigger.addEventListener("click", openGlobalSearch);
  window.addEventListener("resize", positionGlobalSearch);
  window.addEventListener("scroll", positionGlobalSearch, { passive: true });
  window.visualViewport?.addEventListener("resize", positionGlobalSearch);
  window.visualViewport?.addEventListener("scroll", positionGlobalSearch, { passive: true });
  document.querySelector("#closeSearch").addEventListener("click", closeGlobalSearch);
  searchDialog.addEventListener("close", () => { if (!searchDialog.open) closeGlobalSearch(); });
  searchDialog.addEventListener("pointerdown", (event) => { searchBackdropDown = event.target === searchDialog; });
  searchDialog.addEventListener("click", (event) => {
    if (!searchBackdropDown || event.target !== searchDialog) return;
    const bounds = searchDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeGlobalSearch();
  });
  searchClear.addEventListener("click", () => {
    globalInput.value = "";
    globalInput.focus();
    showGlobalSuggestions();
  });
  globalSuggestions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggestion]");
    const selected = button && suggestionOptions[Number(button.dataset.suggestion)];
    if (selected && !globalSuggestions.inert) openSearchOption(selected);
  });
  globalInput.addEventListener("input", showGlobalSuggestions);
  globalInput.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeGlobalSearch();
      return;
    }
    if (suggestionOptions.length && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (suggestionIndex < 0 && direction < 0) suggestionIndex = 0;
      suggestionIndex = (suggestionIndex + direction + suggestionOptions.length) % suggestionOptions.length;
      globalSuggestions.querySelectorAll("[data-suggestion]").forEach((button, index) => button.setAttribute("aria-selected", String(index === suggestionIndex)));
      globalInput.setAttribute("aria-activedescendant", `search-option-${suggestionIndex}`);
      globalSuggestions.querySelector(`#search-option-${suggestionIndex}`).scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && suggestionIndex >= 0) {
      event.preventDefault();
      openSearchOption(suggestionOptions[suggestionIndex]);
    }
  });
  globalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    closeGlobalSearch();
    globalInput.blur();
    const next = searchHref(globalInput.value);
    if (location.hash === next) route();
    else location.hash = next;
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
  for (const id of ['menuClose', 'menuBackdrop']) {
    document.querySelector(`#${id}`).addEventListener('click', () => {
      document.body.classList.remove('menu-open');
      document.querySelector('#menuButton').setAttribute('aria-expanded', 'false');
      document.querySelector('#menuButton').focus();
    });
  }
  main.addEventListener("click", () => {
    document.body.classList.remove("menu-open");
    document.querySelector("#menuButton").setAttribute("aria-expanded", "false");
  });
  document.querySelector("#compareClear").addEventListener("click", () => {
    comparison.clear();
    updateComparison();
  });
  for (const selector of ["#compareSelection", "#compareContent"]) {
    document.querySelector(selector).addEventListener("click", (event) => {
      const control = event.target.closest("[data-remove-comparison]");
      if (control) removeFromComparison(control.dataset.removeComparison);
    });
  }
  document.querySelector("#compareOpen").addEventListener("click", renderComparison);
  document.querySelector("#compareClose").addEventListener("click", () => document.querySelector("#compareDialog").close());
  document.querySelector("#compareDialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  document.addEventListener("keydown", (event) => {
    const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.isContentEditable;
    const searchShortcut = event.key === "/" && !editing && !event.ctrlKey && !event.metaKey && !event.altKey;
    const commandShortcut = event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey);
    const activeDialog = document.querySelector("dialog[open]");
    if ((searchShortcut || commandShortcut) && (!activeDialog || activeDialog === searchDialog)) {
      event.preventDefault();
      openGlobalSearch();
    }
    if (event.key === "Escape") { document.body.classList.remove("menu-open"); document.querySelector("#menuButton").setAttribute("aria-expanded", "false"); }
  });
  document.addEventListener("error", (event) => {
    if (event.target.tagName === "VIDEO") {
      const card = event.target.closest(".catalog-card");
      if (card) {
        const button = card.querySelector("[data-preview]");
        if (button) { button.setAttribute("aria-pressed", "false"); button.innerHTML = icon("play"); }
        event.target.remove();
        showToast("Видеопревью недоступно.");
        return;
      }
      const message = document.createElement("p");
      message.className = "media-note";
      message.textContent = "Видеопревью пока недоступно.";
      event.target.replaceWith(message);
      return;
    }
    if (event.target.tagName !== "IMG") return;
    const image = event.target;
    if (image.matches(".brand-watermark, .country-flag")) { image.hidden = true; return; }
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
        placeholder.innerHTML = media.dataset.symbol ? escapeHtml(media.dataset.symbol) : icon(icons[media.dataset.section] || "car");
        image.replaceWith(placeholder);
      } else {
        image.alt = image.alt || "Изображение недоступно";
        image.classList.add("media-unavailable");
      }
    }
  }, true);
  document.querySelector("#imageDialogClose").addEventListener("click", () => document.querySelector("#imageDialog").close());
  document.querySelector("#imageDialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  window.addEventListener("hashchange", route);

  Promise.all([getJson("data/wiki/index.json"), getJson("data/wiki/image-overrides.json").catch(() => ({})), getJson("data/wiki/vehicle-price-overrides.json?v=20261114-14").catch(() => ({}))]).then(([index, overrides, prices]) => {
    manifest = index;
    imageOverrides = overrides;
    vehiclePriceOverrides = prices;
    searchTrigger.disabled = false;
    document.querySelector("#importDate").textContent = `База от ${dates.format(new Date(index.importedAt))}`;
    route();
  }).catch((error) => {
    console.error(error);
    main.innerHTML = '<div class="error">Не удалось загрузить базу справочника. Обновите страницу. <a href="cars.html">Открыть каталог автомобилей</a></div>';
  });
})();
