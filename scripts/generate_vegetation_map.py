from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
BASE_MAP = ROOT / "public" / "assets" / "land_ocean_ice_2048.jpg"
LAND_WATER_MASK = ROOT / "public" / "assets" / "land_water_2048.jpg"
OUTPUT = ROOT / "public" / "assets" / "land_ocean_ice_vegetation_max_2048.jpg"


def clamp(value: float, low: int = 0, high: int = 255) -> int:
    return max(low, min(high, int(round(value))))


def main() -> None:
    base = Image.open(BASE_MAP).convert("RGB")
    land_water = Image.open(LAND_WATER_MASK).convert("L").resize(base.size)

    # In the existing mask, dark pixels are land and light pixels are water/ice.
    land_mask = land_water.point(lambda p: clamp((255 - p) * 1.35))
    land_mask = land_mask.filter(ImageFilter.GaussianBlur(radius=0.8))

    base_pixels = base.load()
    mask_pixels = land_mask.load()

    vegetation = Image.new("RGB", base.size)
    vegetation_pixels = vegetation.load()

    for y in range(base.height):
        for x in range(base.width):
            r, g, b = base_pixels[x, y]
            land = mask_pixels[x, y] / 255

            if land <= 0.02:
                vegetation_pixels[x, y] = (r, g, b)
                continue

            brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            warmth = max(0, r - b) / 255

            # Dense-vegetation target: keep tonal relief, but make deserts/arid land greener.
            target_r = 18 + 42 * brightness + 10 * warmth
            target_g = 64 + 128 * brightness + 20 * warmth
            target_b = 24 + 48 * brightness

            blend = 0.82 * land
            vegetation_pixels[x, y] = (
                clamp(r * (1 - blend) + target_r * blend),
                clamp(g * (1 - blend) + target_g * blend),
                clamp(b * (1 - blend) + target_b * blend),
            )

    vegetation = ImageEnhance.Color(vegetation).enhance(1.12)
    vegetation = ImageEnhance.Contrast(vegetation).enhance(1.04)
    vegetation.save(OUTPUT, quality=92, optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
