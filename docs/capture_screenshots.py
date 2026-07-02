import asyncio
import os
from playwright.async_api import async_playwright

ROOT = "/Users/vineetdaniel/PersonalProjects/cto-dash"
OUT = os.path.join(ROOT, "docs", "screenshots")
os.makedirs(OUT, exist_ok=True)

SECTIONS = [
    ("overview", "Overview"),
    ("engineering", "Engineering"),
    ("product", "Product"),
    ("operations", "Operations"),
    ("payments", "Payments"),
    ("security", "Security"),
    ("compliance", "Compliance"),
    ("cost", "Cost"),
    ("team", "Team"),
]


async def capture():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto("http://localhost:3000/?section=overview", wait_until="networkidle")
        await asyncio.sleep(2)
        for slug, label in SECTIONS:
            url = f"http://localhost:3000/?section={slug}"
            await page.goto(url, wait_until="networkidle")
            await asyncio.sleep(2)
            path = os.path.join(OUT, f"{slug}.png")
            await page.screenshot(path=path, full_page=False)
            print(f"Saved {label} -> {path}")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(capture())
