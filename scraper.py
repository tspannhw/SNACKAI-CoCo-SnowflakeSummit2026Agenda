#!/usr/bin/env python3
"""
Snowflake Summit Session Catalog Scraper

Uses Playwright (browser automation) to extract session data from the
Snowflake Summit session catalog, which is a JavaScript-rendered SPA
on the RainFocus platform.

Usage:
    pip install playwright pandas
    playwright install chromium
    python scraper.py

Output:
    summit_sessions.csv (overwrites existing file)
"""

import csv
import sys
import time
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright not installed. Install with:")
    print("  pip install playwright && playwright install chromium")
    sys.exit(1)


SUMMIT_URL = "https://www.snowflake.com/en/summit/"
CATALOG_SELECTORS = [
    "a[href*='session']",
    "a[href*='catalog']",
    "[data-testid='session-catalog']",
    ".session-card",
    ".rf-session",
]

OUTPUT_FILE = Path(__file__).parent / "summit_sessions.csv"

CSV_HEADERS = [
    "session_id", "title", "description", "speakers", "speaker_company",
    "speaker_title", "track", "format", "day", "time", "duration_min",
    "room", "level", "tags", "persona_fit",
]


def find_catalog_link(page):
    """Try to find and click the session catalog link."""
    for selector in CATALOG_SELECTORS:
        try:
            el = page.query_selector(selector)
            if el:
                href = el.get_attribute("href")
                print(f"  Found catalog link: {href}")
                return href
        except Exception:
            continue
    return None


def extract_sessions_from_catalog(page):
    """Extract session data from the rendered catalog page."""
    sessions = []

    # Wait for session cards to render
    session_selectors = [
        ".session-card", ".rf-session-card", "[class*='session']",
        "[class*='Session']", ".card", "[data-type='session']",
    ]

    for selector in session_selectors:
        cards = page.query_selector_all(selector)
        if cards:
            print(f"  Found {len(cards)} session cards with selector: {selector}")
            for card in cards:
                try:
                    session = extract_card_data(card)
                    if session.get("title"):
                        sessions.append(session)
                except Exception as e:
                    print(f"  Warning: Failed to extract card: {e}")
            break

    return sessions


def extract_card_data(card):
    """Extract data from a single session card element."""
    title_el = (
        card.query_selector("h3") or
        card.query_selector("h4") or
        card.query_selector("[class*='title']") or
        card.query_selector("[class*='Title']")
    )
    desc_el = (
        card.query_selector("p") or
        card.query_selector("[class*='desc']") or
        card.query_selector("[class*='abstract']")
    )
    speaker_el = (
        card.query_selector("[class*='speaker']") or
        card.query_selector("[class*='Speaker']")
    )
    track_el = (
        card.query_selector("[class*='track']") or
        card.query_selector("[class*='Track']") or
        card.query_selector("[class*='category']")
    )
    time_el = (
        card.query_selector("[class*='time']") or
        card.query_selector("[class*='Time']") or
        card.query_selector("[class*='schedule']")
    )

    return {
        "session_id": "",
        "title": title_el.inner_text().strip() if title_el else "",
        "description": desc_el.inner_text().strip() if desc_el else "",
        "speakers": speaker_el.inner_text().strip() if speaker_el else "",
        "speaker_company": "",
        "speaker_title": "",
        "track": track_el.inner_text().strip() if track_el else "",
        "format": "",
        "day": "",
        "time": time_el.inner_text().strip() if time_el else "",
        "duration_min": "",
        "room": "",
        "level": "",
        "tags": "",
        "persona_fit": "",
    }


def scrape_summit_sessions():
    """Main scraping function."""
    print("=" * 60)
    print("Snowflake Summit Session Catalog Scraper")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()

        # Navigate to the summit page
        print(f"\nNavigating to {SUMMIT_URL}...")
        page.goto(SUMMIT_URL, wait_until="networkidle", timeout=30000)
        time.sleep(3)

        # Look for the session catalog link
        print("\nLooking for session catalog link...")
        catalog_url = find_catalog_link(page)

        if catalog_url:
            if not catalog_url.startswith("http"):
                catalog_url = f"https://www.snowflake.com{catalog_url}"
            print(f"\nNavigating to catalog: {catalog_url}")
            page.goto(catalog_url, wait_until="networkidle", timeout=30000)
            time.sleep(5)
        else:
            print("  No catalog link found on the main page.")
            print("  The session catalog may require authentication or")
            print("  may not be published yet.")

        # Try to extract sessions
        print("\nExtracting session data...")
        sessions = extract_sessions_from_catalog(page)

        if sessions:
            print(f"\nSuccessfully extracted {len(sessions)} sessions!")
            write_csv(sessions)
        else:
            print("\nNo sessions could be extracted from the live catalog.")
            print("This likely means:")
            print("  1. The catalog requires registration/login")
            print("  2. The catalog hasn't been published yet")
            print("  3. The page structure has changed")
            print(f"\nUsing the existing seed data in {OUTPUT_FILE}")

            if not OUTPUT_FILE.exists():
                print("WARNING: No seed data file found either!")
                return False

        browser.close()

    return True


def write_csv(sessions):
    """Write extracted sessions to CSV."""
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()
        for i, session in enumerate(sessions, 1):
            session["session_id"] = session.get("session_id") or f"S{i:03d}"
            writer.writerow(session)
    print(f"Written {len(sessions)} sessions to {OUTPUT_FILE}")


if __name__ == "__main__":
    success = scrape_summit_sessions()
    sys.exit(0 if success else 1)
