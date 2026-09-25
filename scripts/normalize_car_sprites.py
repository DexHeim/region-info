"""Normalize vehicle placement inside the catalog sprite sheets.

The catalog enlarges a sprite tile inside its viewport. Every opaque vehicle
therefore needs a consistent transparent safety margin so roofs, wheels and
bumpers are never clipped. This script trims each tile to its visible pixels,
scales it without changing its aspect ratio, and places it back in the centre
of the original grid cell.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "assets" / "img"


@dataclass(frozen=True)
class SpriteSheet:
    source: str
    target: str
    grid_size: int


SHEETS = (
    SpriteSheet("car-sprite-v2.png", "car-sprite-v3.png", 4),
    SpriteSheet("car-sprite-dealer-1-v2.png", "car-sprite-dealer-1-v3.png", 3),
    SpriteSheet("car-sprite-dealer-3a.png", "car-sprite-dealer-3a-v3.png", 4),
    SpriteSheet("car-sprite-dealer-3b.png", "car-sprite-dealer-3b-v3.png", 4),
    SpriteSheet("car-sprite-dealer-4-v2.png", "car-sprite-dealer-4-v3.png", 5),
    SpriteSheet("car-sprite-dealer-5a.png", "car-sprite-dealer-5a-v3.png", 4),
    SpriteSheet("car-sprite-dealer-5b.png", "car-sprite-dealer-5b-v3.png", 4),
    SpriteSheet("car-sprite-dealer-5c.png", "car-sprite-dealer-5c-v3.png", 4),
    SpriteSheet("car-sprite-dealer-5d.png", "car-sprite-dealer-5d-v3.png", 4),
)

ALPHA_THRESHOLD = 8
MAX_CONTENT_WIDTH = 0.90
MAX_CONTENT_HEIGHT = 0.76
SOURCE_PADDING = 3


def cell_edges(length: int, grid_size: int) -> list[int]:
    """Match the percentage-based CSS grid as closely as integer pixels allow."""

    return [round(index * length / grid_size) for index in range(grid_size + 1)]


def visible_bounds(image: Image.Image) -> tuple[int, int, int, int] | None:
    """Return the bounds of the main connected opaque shape in a grid cell.

    A few source vehicles extend a pixel or two into a neighbouring cell. The
    largest connected component is the actual vehicle; using it prevents those
    foreign edge fragments from influencing the crop and appearing in cards.
    """

    width, height = image.size
    alpha = image.getchannel("A").tobytes()
    visible = bytearray(value > ALPHA_THRESHOLD for value in alpha)
    visited = bytearray(width * height)
    largest_size = 0
    largest_bounds: tuple[int, int, int, int] | None = None

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

        if size > largest_size:
            largest_size = size
            largest_bounds = (min_x, min_y, max_x + 1, max_y + 1)

    return largest_bounds


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

    for row in range(spec.grid_size):
        for column in range(spec.grid_size):
            left, right = x_edges[column], x_edges[column + 1]
            top, bottom = y_edges[row], y_edges[row + 1]
            cell = source.crop((left, top, right, bottom))
            bounds = visible_bounds(cell)
            if bounds is None:
                continue

            vehicle = padded_crop(cell, bounds)
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
    print(f"Created {target_path.relative_to(ROOT)}")


def main() -> None:
    for sheet in SHEETS:
        normalize_sheet(sheet)


if __name__ == "__main__":
    main()
