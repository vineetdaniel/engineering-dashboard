import asyncio
import os
from playwright.async_api import async_playwright

ROOT = "/Users/vineetdaniel/PersonalProjects/cto-dash"
OUT = os.path.join(ROOT, "docs", "screenshots")
os.makedirs(OUT, exist_ok=True)

SECTIONS = [
    ("overview", "Overview", "Executive summary with uptime, payments, security, cost, and engineering flow scores."),
    ("engineering", "Engineering", "Pull requests, commit velocity, DORA metrics, deployment frequency, and lead time."),
    ("product", "Product", "Jira sprint progress, story points, backlog health, and delivery predictability."),
    ("operations", "Operations", "Active incidents, on-call rotation, P0/P1 tracking, and incident lifecycle."),
    ("payments", "Payments", "Payment success rate, fraud/chargeback rates, transaction volume, and settlement health."),
    ("security", "Security", "CVE severity distribution, critical SLA tracking, and secrets scanning findings."),
    ("compliance", "Compliance", "Control pass/fail grid, audit log, and PCI/SOC mappings."),
    ("cost", "Cost", "MTD cloud spend, budget burn forecast, cost anomalies, and top spend drivers."),
    ("team", "Team", "Squad scorecards, developer productivity personas, and resource allocation."),
]


async def blur_developer_names(page):
    """Blur elements that likely contain developer/resource names."""
    await page.evaluate("""
        () => {
            // Blur common name-bearing elements (headings, links, table cells) inside planning/persona widgets
            const selectors = [
                '[class*="persona"]', '[class*="developer"]', '[class*="resource"]', '[class*="author"]',
                'td', 'th', 'h3', 'h4', 'a'
            ];
            selectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    const text = el.textContent || '';
                    // Heuristic: contains two or more capitalized words, or looks like an email/login
                    if (/^\s*[A-Z][a-z]+(\s+[A-Z][a-z]+)+\s*$/.test(text) || text.includes('@')) {
                        el.style.filter = 'blur(8px)';
                    }
                });
            });
        }
    """)


async def capture():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        for slug, label, _ in SECTIONS:
            url = f"http://localhost:3000/?section={slug}"
            await page.goto(url, wait_until="networkidle")
            await asyncio.sleep(2)
            await blur_developer_names(page)
            await asyncio.sleep(0.5)
            path = os.path.join(OUT, f"{slug}.png")
            await page.screenshot(path=path, full_page=False)
            print(f"Saved {label} -> {path}")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(capture())
