"""Layout audit: pushes the UI into its widest states (long numbers, max bet, long toasts) and reports
text that overflows its box, boxes that spill out of their parent, and the multiplier/phone gap.

usage: python tools/ui_audit.py [--url http://localhost:8771/poc/index.html] [--out assets/_debug/audit]
"""
import argparse
import os
import pathlib

from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="http://localhost:8771/poc/index.html")
ap.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parent.parent / "assets" / "_debug" / "audit"))
a = ap.parse_args()
out = pathlib.Path(a.out)
out.mkdir(parents=True, exist_ok=True)

# selector -> selector of the box it must stay inside ('' = only check its own text overflow)
CHECKS = {
    ".pill": "#history-row", "#plate-text": "#plate", "#bet-main": "#bet", "#bet-sub": "#bet",
    "#amount": ".stepper", ".chip": ".left", ".tab": ".tabs", "#balance": "#stage", ".brand-t": "#top",
    "#toast-main": "#stage", "#toast-sub": "#stage", "#stamp-main": "#stage", "#stamp-mult": "#stage",
    "#saved": "#screen", "#screen-msg b": "#screen", "#history-list li": "#history-drawer",
}

MEASURE = """(checks) => {
  const st = document.querySelector('#stage').getBoundingClientRect();
  const s = st.width / 1080;
  const box = (r) => ({ l: (r.left - st.left) / s, t: (r.top - st.top) / s, r: (r.right - st.left) / s, b: (r.bottom - st.top) / s });
  const out = [];
  for (const [sel, parent] of Object.entries(checks)) {
    const p = document.querySelector(parent);
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || el.closest('[hidden]') || !el.getClientRects().length) continue;
      const shown = (n) => { for (; n; n = n.parentElement) if (+getComputedStyle(n).opacity === 0) return false; return true; };
      if (!shown(el)) continue;
      const name = sel + (el.textContent ? ` "${el.textContent.trim().slice(0, 24)}"` : '');
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible')
        out.push(`${name}: text clipped ${el.scrollWidth} > ${el.clientWidth}`);
      const range = document.createRange();
      range.selectNodeContents(el);
      const tr = box(range.getBoundingClientRect());
      const pr = box(p.getBoundingClientRect());
      const over = Math.max(pr.l - tr.l, tr.r - pr.r, pr.t - tr.t, tr.b - pr.b);
      if (over > 0.5 && tr.r > tr.l) out.push(`${name}: text spills ${over.toFixed(0)}px out of ${parent}`);
    }
  }
  const mv = document.createRange();
  mv.selectNodeContents(document.querySelector('#mult-value'));
  const m = box(mv.getBoundingClientRect());
  const plate = box(document.querySelector('#plate').getBoundingClientRect());
  const screen = box(document.querySelector('#screen').getBoundingClientRect());
  const chat = box(document.querySelector('#chat').getBoundingClientRect());
  const panel = box(document.querySelector('#panel').getBoundingClientRect());
  return { issues: out, mult: m, plate, screen, chat, panel };
}"""

# (name, js to run, js condition to wait for before measuring)
STATES = [
    ("idle", "", "game.phase === 'idle'"),
    ("auto_max", "ui.tab = 'auto'; ui.autoTarget = 1000; ui.amountIdx = AMOUNTS.length - 1; renderPanel();", ""),
    ("running_long", "ui.tab = 'bet'; renderPanel(); placeBet(performance.now()); Object.assign(game.round, { crash: 1000, fakes: [], t: Math.log(888) / GROWTH_K });",
     "game.m > 888"),
    ("cashout_big", "onBetButton();", "player.cashedAt !== null"),
    ("escape_end", "", "!!document.querySelector('#screen-msg.on')"),
    ("tier_banner", "showBanner(2); document.querySelector('#tier-banner').getAnimations().forEach((a) => { a.pause(); a.currentTime = 900; });", ""),
    ("stamp", "document.querySelector('#stamp-mult').textContent = '999.99x'; document.querySelector('#stamp-sub').textContent = '−FUN 100.0';"
              "document.querySelector('#stamp').style.opacity = 1;", ""),
    ("history", "document.querySelector('#stamp').style.opacity = 0; for (let i = 0; i < 15; i++) history.unshift({ id: 9000 + i, crash: 888.88, bet: 100, cashedAt: 777.77, payout: 77777 });"
                "renderHistory(false); document.querySelector('#history-drawer').classList.add('open');", ""),
    ("history_few", "history.splice(3); renderHistory(false);", ""),
]

with sync_playwright() as p:
    cached = sorted((pathlib.Path(os.environ["LOCALAPPDATA"]) / "ms-playwright").glob(
        "chromium_headless_shell-*/chrome-headless-shell-win64/chrome-headless-shell.exe"))
    browser = p.chromium.launch(executable_path=str(cached[-1]) if cached else None)
    page = browser.new_page(viewport={"width": 540, "height": 960}, device_scale_factor=2)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(a.url)
    page.wait_for_selector("#start:not([hidden])", timeout=60000)
    page.click("#start")
    page.wait_for_timeout(1200)
    for name, js, cond in STATES:
        if js:
            page.evaluate(f"(() => {{ {js} }})()")
        if cond:
            page.wait_for_function(cond, timeout=20000)
        page.wait_for_timeout(300)
        r = page.evaluate(MEASURE, CHECKS)
        page.screenshot(path=str(out / f"{name}.png"))
        m, sc = r["mult"], r["screen"]
        print(f"[{name}] mult text {m['t']:.0f}-{m['b']:.0f}, plate ends {r['plate']['b']:.0f}, screen starts {sc['t']:.0f};"
              f" chat ends {r['chat']['b']:.0f}, panel starts {r['panel']['t']:.0f}")
        for i in r["issues"]:
            print("   ", i)
    page.evaluate("document.querySelector('#history-drawer').classList.remove('open')")
    for w, h in ((1920, 1080), (1366, 768)):
        page.set_viewport_size({"width": w, "height": h})
        page.wait_for_timeout(400)
        page.screenshot(path=str(out / f"desktop_{w}x{h}.png"))
    print("page errors:", errors or "none")
    browser.close()
