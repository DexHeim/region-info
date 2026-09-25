# Region Auto

Мини-справочник транспорта игры Region. Каталог содержит ассортимент автосалонов 1/5, 2/5 и 4/5, изображения, поиск, фильтрацию и сортировку.

## Локальный запуск

```powershell
python -m http.server 8080
```

После запуска сайт доступен по адресу `http://localhost:8080`.

## Данные из Google Sheets

Сайт умеет загружать опубликованную Google-таблицу и автоматически переключается на локальный файл `data/cars.json`, если таблица недоступна.

Готовый файл `outputs/region-auto/region-auto-cars.xlsx` содержит все 46 позиций. Его можно импортировать в Google Sheets через `Файл → Импорт → Загрузить`, чтобы не переносить строки вручную.

Создайте лист `Автомобили` и добавьте первую строку с точными именами колонок:

```text
id | name | dealer | fuel_l | fuel_unit | fuel_type | trunk_kg | max_speed_kmh | handling | acceleration_0_100_s | braking_100_0_s | price_rub | sprite_sheet | sprite_index | active
```

Правила заполнения:

- числа указываются без единиц измерения и знака валюты;
- `active` — `TRUE` для показа машины и `FALSE` для скрытия;
- `id`, `sprite_sheet` и `sprite_index` связывают строку с изображением транспорта, поэтому их лучше не менять;
- `dealer` — название автосалона, например `Автосалон 2/5`;
- заголовки колонок менять нельзя, порядок колонок не важен.

Откройте доступ к таблице по ссылке, возьмите её ID и сформируйте CSV-адрес:

```text
https://docs.google.com/spreadsheets/d/ID_ТАБЛИЦЫ/gviz/tq?tqx=out:csv&sheet=Автомобили
```

Вставьте адрес в `googleSheetCsvUrl` файла `assets/js/config.js`. После этого изменения в Google Sheets будут появляться на сайте при обновлении страницы.

## Публикация на GitHub Pages

Сайт публикуется из корня ветки `main`. В настройках репозитория используется источник `Deploy from a branch`:

1. Откройте `Settings → Pages`.
2. В `Build and deployment` выберите источник `Deploy from a branch`.
3. Выберите ветку `main` и папку `/ (root)`.

После каждого обновления ветки `main` GitHub Pages автоматически пересоберёт сайт.

## Структура

```text
├── index.html
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── app.js
│       └── config.js
└── data/cars.json
```
