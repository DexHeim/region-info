"""Normalize vehicle placement inside the catalog sprite sheets.

Some source vehicles extend beyond their nominal grid cells, so slicing the
sheet into cells first can cut a vehicle in half. Detect complete connected
vehicle shapes across the whole sheet, then scale and centre each shape in its
destination cell with a consistent transparent safety margin.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "assets" / "img"


@dataclass(frozen=True)
class SpriteSheet:
    key: str
    source: str
    target: str
    grid_size: int


@dataclass(frozen=True)
class Component:
    pixel_count: int
    bounds: tuple[int, int, int, int]

    @property
    def centre_x(self) -> float:
        left, _, right, _ = self.bounds
        return (left + right) / 2

    @property
    def centre_y(self) -> float:
        _, top, _, bottom = self.bounds
        return (top + bottom) / 2


SHEETS = (
    SpriteSheet("dealer-2", "car-sprite-v2.png", "car-sprite-v3.png", 4),
    SpriteSheet("dealer-1", "car-sprite-dealer-1-v2.png", "car-sprite-dealer-1-v3.png", 3),
    SpriteSheet("dealer-3a", "car-sprite-dealer-3a.png", "car-sprite-dealer-3a-v3.png", 4),
    SpriteSheet("dealer-3b", "car-sprite-dealer-3b.png", "car-sprite-dealer-3b-v3.png", 4),
    SpriteSheet("dealer-4", "car-sprite-dealer-4-v2.png", "car-sprite-dealer-4-v3.png", 5),
    SpriteSheet("dealer-5a", "car-sprite-dealer-5a.png", "car-sprite-dealer-5a-v3.png", 4),
    SpriteSheet("dealer-5b", "car-sprite-dealer-5b.png", "car-sprite-dealer-5b-v3.png", 4),
    SpriteSheet("dealer-5c", "car-sprite-dealer-5c.png", "car-sprite-dealer-5c-v3.png", 4),
    SpriteSheet("dealer-5d", "car-sprite-dealer-5d.png", "car-sprite-dealer-5d-v3.png", 4),
)

ALPHA_THRESHOLDS = (16, 24, 32, 48, 64, 96, 128)
MIN_COMPONENT_PIXELS = 500
MAX_CONTENT_WIDTH = 0.90
MAX_CONTENT_HEIGHT = 0.76
SOURCE_PADDING = 3


def used_tile_indexes() -> dict[str, set[int]]:
    with (ROOT / "data" / "cars.json").open(encoding="utf-8") as source:
        cars = json.load(source)

    indexes: dict[str, set[int]] = {}
    for car in cars:
        key = car.get("sprite_sheet", "dealer-2")
        index = int(car.get("sprite_index", int(car["id"]) - 1))
        indexes.setdefault(key, set()).add(index)
    return indexes


def cell_edges(length: int, grid_size: int) -> list[int]:
    """Match the percentage-based CSS grid as closely as integer pixels allow."""

    return [round(index * length / grid_size) for index in range(grid_size + 1)]


def visible_components(image: Image.Image, threshold: int) -> list[Component]:
    """Return substantial connected opaque shapes across an entire sheet."""

    width, height = image.size
    alpha = image.getchannel("A").tobytes()
    visible = bytearray(value > threshold for value in alpha)
    visited = bytearray(width * height)
    components: list[Component] = []

    for start, is_visible in enumerate(visible):
        if not is_visible or visited[start]:
            continue

        stack = [start]
        visited[start] = 1
        size = 0
        min_x = max_x = start % width
        min_y = max_y = start // width

        while stack:
            pixel = stack.pop()
            y, x = divmod(pixel, width)
            size += 1
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)

            for neighbour_y in range(max(0, y - 1), min(height, y + 2)):
                row_start = neighbour_y * width
                for neighbour_x in range(max(0, x - 1), min(width, x + 2)):
                    neighbour = row_start + neighbour_x
                    if visible[neighbour] and not visited[neighbour]:
                        visited[neighbour] = 1
                        stack.append(neighbour)

        if size > MIN_COMPONENT_PIXELS:
            components.append(
                Component(size, (min_x, min_y, max_x + 1, max_y + 1))
            )

    return components


def extract_vehicles(
    source: Image.Image, expected_count: int
) -> tuple[list[Component], int]:
    """Find a threshold that separates every complete vehicle in the sheet."""

    counts: list[str] = []
    for threshold in ALPHA_THRESHOLDS:
        components = visible_components(source, threshold)
        counts.append(f"{threshold}: {len(components)}")
        if len(components) == expected_count:
            return components, threshold

    raise ValueError(
        f"Expected {expected_count} vehicles, found {', '.join(counts)}"
    )


def assign_components(
    components: list[Component], used_indexes: set[int], grid_size: int
) -> dict[int, Component]:
    """Assign visually ordered components to their destination sprite indexes."""

    indexes_by_row: dict[int, list[int]] = {}
    for index in sorted(used_indexes):
        indexes_by_row.setdefault(index // grid_size, []).append(index)

    by_vertical_position = sorted(components, key=lambda item: item.centre_y)
    assignments: dict[int, Component] = {}
    offset = 0
    for indexes in indexes_by_row.values():
        row_components = by_vertical_position[offset : offset + len(indexes)]
        row_components.sort(key=lambda item: item.centre_x)
        assignments.update(zip(indexes, row_components))
        offset += len(indexes)

    return assignments


def padded_crop(image: Image.Image, bounds: tuple[int, int, int, int]) -> Image.Image:
    visible = image.crop(bounds)
    padded = Image.new(
        "RGBA",
        (visible.width + SOURCE_PADDING * 2, visible.height + SOURCE_PADDING * 2),
        (0, 0, 0, 0),
    )
    padded.alpha_composite(visible, (SOURCE_PADDING, SOURCE_PADDING))
    return padded


def normalize_sheet(spec: SpriteSheet) -> None:
    source_path = IMAGE_DIR / spec.source
    target_path = IMAGE_DIR / spec.target
    source = Image.open(source_path).convert("RGBA")
    normalized = Image.new("RGBA", source.size, (0, 0, 0, 0))
    x_edges = cell_edges(source.width, spec.grid_size)
    y_edges = cell_edges(source.height, spec.grid_size)
    used_indexes = used_tile_indexes().get(spec.key, set())
    components, threshold = extract_vehicles(source, len(used_indexes))
    assignments = assign_components(components, used_indexes, spec.grid_size)

    for row in range(spec.grid_size):
        for column in range(spec.grid_size):
            sprite_index = row * spec.grid_size + column
            if sprite_index not in used_indexes:
                continue

            left, right = x_edges[column], x_edges[column + 1]
            top, bottom = y_edges[row], y_edges[row + 1]
            vehicle = padded_crop(source, assignments[sprite_index].bounds)
            max_width = round((right - left) * MAX_CONTENT_WIDTH)
            max_height = round((bottom - top) * MAX_CONTENT_HEIGHT)
            scale = min(max_width / vehicle.width, max_height / vehicle.height)
            output_size = (
                max(1, round(vehicle.width * scale)),
                max(1, round(vehicle.height * scale)),
            )
            vehicle = vehicle.resize(output_size, Image.Resampling.LANCZOS)

            x = left + ((right - left) - vehicle.width) // 2
            y = top + ((bottom - top) - vehicle.height) // 2
            normalized.alpha_composite(vehicle, (x, y))

    normalized.save(target_path, optimize=True)
    print(
        f"Created {target_path.relative_to(ROOT)} "
        f"({len(components)} vehicles, alpha > {threshold})"
    )


def main() -> None:
    for sheet in SHEETS:
        normalize_sheet(sheet)


if __name__ == "__main__":
    main()
