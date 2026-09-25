(function (global) {
  "use strict";

  const REFERENCE_CAR_PRICE = 1700000;
  const MECHANICAL_MINIMUM = 10000;

  const performance = [
    {
      title: "Двигатель",
      options: [
        ["Ур. 1", 30000],
        ["Ур. 2", 50000],
        ["Ур. 3", 70000],
        ["Максимальный", 100000]
      ]
    },
    {
      title: "Трансмиссия",
      options: [
        ["Ур. 1", 20000],
        ["Ур. 2", 40000],
        ["Максимальный", 50000]
      ]
    },
    {
      title: "Тормоза",
      options: [
        ["Ур. 1", 10000],
        ["Ур. 2", 20000],
        ["Максимальный", 30000]
      ]
    },
    {
      title: "Подвеска",
      options: [
        ["Ур. 1", 10000],
        ["Ур. 2", 20000],
        ["Ур. 3", 30000],
        ["Максимальный", 40000]
      ]
    },
    {
      title: "Турбо",
      options: [["Турбина", 90000]]
    }
  ];

  const appearance = [
    {
      title: "Основной цвет",
      options: [
        ["Обычный", 17000],
        ["Металлик", 17900],
        ["Перламутр", 18700],
        ["Матовый", 23000],
        ["Металл", 42500],
        ["Хром", 68000]
      ]
    },
    {
      title: "Дополнительный цвет",
      options: [
        ["Обычный", 8500],
        ["Металлик", 8900],
        ["Перламутр", 9400],
        ["Матовый", 11500],
        ["Металл", 21300],
        ["Хром", 34000]
      ]
    },
    {
      title: "Тонировка",
      options: [
        ["Нет", 25500],
        ["Стоковая", 25500],
        ["Светлый дым", 42500],
        ["Лимузин", 51000],
        ["Зелёная", 51000],
        ["Тёмный дым", 59500],
        ["Чёрная", 76500]
      ]
    },
    {
      title: "Колёса",
      options: [
        ["Sport", 11900],
        ["Muscle", 5100],
        ["Lowrider", 5100],
        ["SUV", 8500],
        ["Offroad", 6800],
        ["Tuner", 10200],
        ["High End", 15300]
      ]
    },
    {
      title: "Цвет фар",
      options: [
        ["Синий", 14000],
        ["Электрик", 14000],
        ["Мятно-зелёный", 14000],
        ["Лаймовый", 14000],
        ["Жёлтый", 14000],
        ["Золотой", 14000],
        ["Оранжевый", 14000],
        ["Красный", 14000],
        ["Розовый", 14000],
        ["Ярко-розовый", 14000],
        ["Фиолетовый", 14000],
        ["Ультрафиолет", 14000]
      ]
    }
  ];

  const horns = {
    title: "Клаксон",
    options: [
      ["Стандартный", 5000],
      ["Нота До", 30000],
      ["Нота Ре", 30000],
      ["Нота Ми", 30000],
      ["Нота Фа", 30000],
      ["Нота Соль", 30000],
      ["Нота Ля", 30000],
      ["Нота Си", 30000],
      ["Нота До (высокая)", 30000],
      ["Клоунский", 100000],
      ["Америка 1", 110000],
      ["Америка 2", 110000],
      ["Америка 3", 130000],
      ["Америка 4", 130000],
      ["Джаз 1", 140000],
      ["Музыкальный 1", 150000],
      ["Музыкальный 2", 150000],
      ["Джаз 2", 150000],
      ["Джаз 3", 150000],
      ["Музыкальный 3", 160000],
      ["Музыкальный 4", 160000],
      ["Музыкальный 5", 170000],
      ["Классика 1", 170000],
      ["Джаз 4 (повтор)", 170000],
      ["Классика 2", 180000],
      ["Классика 3", 180000],
      ["Классика 4", 180000],
      ["Классика 9 (повтор)", 180000],
      ["Классика 5", 190000],
      ["Классика 6", 190000],
      ["Грузовик", 200000],
      ["Печальная труба", 200000],
      ["Классика 7", 200000],
      ["Классика 8 (повтор)", 200000],
      ["Полицейский", 340000]
    ]
  };

  function roundPrice(value, increment) {
    return Math.round(value / increment) * increment;
  }

  function calculatePrice(referencePrice, carPrice, kind) {
    const scaledPrice = referencePrice * carPrice / REFERENCE_CAR_PRICE;
    if (kind === "mechanical") {
      return Math.max(MECHANICAL_MINIMUM, roundPrice(scaledPrice, 100));
    }
    return roundPrice(scaledPrice, 100);
  }

  function calculatePerformanceTotal(carPrice) {
    return performance.reduce((total, group) => {
      const groupTotal = group.options.reduce((subtotal, option) => (
        subtotal + calculatePrice(option[1], carPrice, "mechanical")
      ), 0);
      return total + groupTotal;
    }, 0);
  }

  global.REGION_TUNING = {
    referenceCarPrice: REFERENCE_CAR_PRICE,
    mechanicalMinimum: MECHANICAL_MINIMUM,
    performance,
    appearance,
    horns,
    calculatePrice,
    calculatePerformanceTotal
  };
}(typeof window === "undefined" ? globalThis : window));
