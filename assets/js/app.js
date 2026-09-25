(function () {
  "use strict";

  const config = window.REGION_AUTO_CONFIG || {};
  const catalog = document.querySelector("#catalog");
  const template = document.querySelector("#carCardTemplate");
  const searchInput = document.querySelector("#searchInput");
  const sortSelect = document.querySelector("#sortSelect");
  const dealerButtons = Array.from(document.querySelectorAll("[data-dealer]"));
  const sourceLabel = document.querySelector("#sourceLabel");
  const totalCars = document.querySelector("#totalCars");
  const minPrice = document.querySelector("#minPrice");
  const maxPrice = document.querySelector("#maxPrice");
  const resultCount = document.querySelector("#resultCount");

  const priceFormatter = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  });

  let cars = [];
  let selectedDealer = "all";

  const icons = {
    fuel: '<svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15"><path d="M6 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M5 21h13M8 7h7v5H8V7Zm9 1h2l2 2v7a2 2 0 0 1-4 0v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trunk: '<svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15"><path d="M5 8h14l2 4v7H3v-7l2-4Zm3 0V5h8v3M3 14h18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
  };

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && quoted && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(cell);
        if (row.some((value) => value.trim() !== "")) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    if (!rows.length) return [];

    const headers = rows[0].map((value) => value.trim());
    return rows.slice(1).map((values) => Object.fromEntries(
      headers.map((header, index) => [header, (values[index] || "").trim()])
    ));
  }

  function toNumber(value) {
    if (typeof value === "number") return value;
    const normalized = String(value || "").replace(/\s/g, "").replace(",", ".");
    return Number(normalized);
  }

  function normalizeCar(car, index) {
    const dealer = String(car.dealer || "Автосалон 2/5").trim();
    const numericId = toNumber(car.id || index + 1);
    const hasSpriteIndex = car.sprite_index !== undefined && String(car.sprite_index).trim() !== "";
    const defaultSpriteIndex = dealer.includes("1/5")
      ? Math.max(0, numericId - 14)
      : (dealer.includes("4/5") ? Math.max(0, numericId - 22) : Math.max(0, numericId - 1));
    return {
      id: String(car.id || index + 1),
      name: String(car.name || "Без названия").trim(),
      dealer,
      fuel_l: toNumber(car.fuel_l),
      fuel_unit: String(car.fuel_unit || (String(car.fuel_type).toLocaleLowerCase("ru").includes("электро") ? "кВт." : "л")).trim(),
      fuel_type: String(car.fuel_type || "Бензин").trim(),
      trunk_kg: toNumber(car.trunk_kg),
      max_speed_kmh: toNumber(car.max_speed_kmh),
      handling: toNumber(car.handling),
      acceleration_0_100_s: toNumber(car.acceleration_0_100_s),
      braking_100_0_s: toNumber(car.braking_100_0_s),
      price_rub: toNumber(car.price_rub),
      sprite_sheet: String(car.sprite_sheet || (dealer.includes("1/5") ? "dealer-1" : (dealer.includes("4/5") ? "dealer-4" : "dealer-2"))),
      sprite_index: hasSpriteIndex ? Math.max(0, toNumber(car.sprite_index)) : defaultSpriteIndex,
      active: !["0", "false", "нет", "no"].includes(String(car.active ?? "true").trim().toLowerCase())
    };
  }

  async function loadCars() {
    if (config.googleSheetCsvUrl) {
      try {
        const response = await fetch(config.googleSheetCsvUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`Google Sheet: ${response.status}`);
        const rows = parseCsv(await response.text());
        if (!rows.length) throw new Error("Google Sheet не содержит строк");
        return { data: rows, source: "Google Sheet" };
      } catch (error) {
        console.warn("Не удалось загрузить Google Sheet, используется локальная копия.", error);
      }
    }

    const response = await fetch(config.fallbackDataUrl || "data/cars.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Локальные данные: ${response.status}`);
    return { data: await response.json(), source: "локальная копия" };
  }

  function formatDecimal(value) {
    return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
  }

  function addSpec(container, label, value) {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    wrapper.append(term, description);
    container.append(wrapper);
  }

  function createCard(car, index) {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".car-card");
    card.dataset.name = car.name;
    fragment.querySelector(".car-card__number").textContent = `#${String(index + 1).padStart(2, "0")}`;
    fragment.querySelector(".dealer-pill").textContent = car.dealer;
    const visual = fragment.querySelector(".car-card__visual");
    const spriteGridSize = car.sprite_sheet === "dealer-1" ? 3 : (car.sprite_sheet === "dealer-4" ? 5 : 4);
    const spriteStep = 100 / (spriteGridSize - 1);
    const spriteColumn = car.sprite_index % spriteGridSize;
    const spriteRow = Math.floor(car.sprite_index / spriteGridSize);
    if (car.sprite_sheet === "dealer-1") visual.classList.add("car-card__visual--dealer-1");
    if (car.sprite_sheet === "dealer-4") visual.classList.add("car-card__visual--dealer-4");
    visual.style.setProperty("--sprite-x", `${spriteColumn * spriteStep}%`);
    visual.style.setProperty("--sprite-y", `${spriteRow * spriteStep}%`);
    fragment.querySelector("h2").textContent = car.name;
    fragment.querySelector(".price").textContent = priceFormatter.format(car.price_rub);
    fragment.querySelector(".car-card__facts").innerHTML = [
      `<span class="fact">${icons.fuel}${formatDecimal(car.fuel_l)} ${car.fuel_unit} · ${car.fuel_type}</span>`,
      `<span class="fact">${icons.trunk}${formatDecimal(car.trunk_kg)} кг</span>`
    ].join("");

    const specs = fragment.querySelector(".spec-grid");
    addSpec(specs, "Макс. скорость", `${formatDecimal(car.max_speed_kmh)} км/ч`);
    addSpec(specs, "Управляемость", `${formatDecimal(car.handling)} / 5`);
    addSpec(specs, "Разгон 0–100", `${formatDecimal(car.acceleration_0_100_s)} сек.`);
    addSpec(specs, "Торможение 100–0", `${formatDecimal(car.braking_100_0_s)} сек.`);
    return fragment;
  }

  function getVisibleCars() {
    const query = searchInput.value.trim().toLocaleLowerCase("ru");
    const filtered = cars.filter((car) => (
      (selectedDealer === "all" || car.dealer === selectedDealer)
      && (!query || `${car.name} ${car.dealer}`.toLocaleLowerCase("ru").includes(query))
    ));

    const [field, direction] = sortSelect.value.split("-");
    const sorters = {
      price: (a, b) => a.price_rub - b.price_rub,
      speed: (a, b) => a.max_speed_kmh - b.max_speed_kmh,
      acceleration: (a, b) => a.acceleration_0_100_s - b.acceleration_0_100_s,
      name: (a, b) => a.name.localeCompare(b.name, "ru")
    };

    return filtered.sort((a, b) => {
      const result = sorters[field](a, b);
      return direction === "desc" ? -result : result;
    });
  }

  function render() {
    const visibleCars = getVisibleCars();
    updateSummary(visibleCars);
    catalog.replaceChildren();

    if (!visibleCars.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = "<strong>Ничего не найдено</strong><span>Попробуйте изменить запрос.</span>";
      catalog.append(empty);
    } else {
      const fragment = document.createDocumentFragment();
      visibleCars.forEach((car, index) => fragment.append(createCard(car, index)));
      catalog.append(fragment);
    }

    const word = visibleCars.length === 1 ? "автомобиль" : (visibleCars.length >= 2 && visibleCars.length <= 4 ? "автомобиля" : "автомобилей");
    resultCount.textContent = `Показано: ${visibleCars.length} ${word}`;
    resultCount.hidden = false;
  }

  function updateSummary(list) {
    const prices = list.map((car) => car.price_rub).filter(Number.isFinite);
    totalCars.textContent = String(list.length);
    minPrice.textContent = prices.length ? priceFormatter.format(Math.min(...prices)) : "—";
    maxPrice.textContent = prices.length ? priceFormatter.format(Math.max(...prices)) : "—";
  }

  function showError(error) {
    console.error(error);
    sourceLabel.textContent = "данные недоступны";
    catalog.setAttribute("aria-busy", "false");
    catalog.innerHTML = '<div class="error-state"><strong>Не удалось загрузить каталог</strong><span>Проверьте источник данных и обновите страницу.</span></div>';
  }

  searchInput.addEventListener("input", render);
  sortSelect.addEventListener("change", render);
  dealerButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedDealer = button.dataset.dealer;
      dealerButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      render();
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  });

  loadCars()
    .then(({ data, source }) => {
      cars = data.map(normalizeCar).filter((car) => car.active && car.name && Number.isFinite(car.price_rub));
      sourceLabel.textContent = `данные: ${source}`;
      render();
      catalog.setAttribute("aria-busy", "false");
    })
    .catch(showError);
})();
