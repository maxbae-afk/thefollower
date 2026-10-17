"""Headless walkthrough of the POC: screenshots of betting, filming, a fake-out, the crash cinematic,
an escape (the cash-out ends the round) and the tier changes, plus any console errors.

usage: python tools/capture.py [out_dir] [--url http://localhost:8771/poc/index.html] [--only crash,escape,tiers]
"""
import argparse
import os
import pathlib
import sys
import time

from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("out", nargs="?", default=str(pathlib.Path(__file__).resolve().parent.parent / "assets" / "_debug" / "cap"))
ap.add_argument("--url", default="http://localhost:8771/poc/index.html")
ap.add_argument("--only", default="")
a = ap.parse_args()
out = pathlib.Path(a.out)
out.mkdir(parents=True, exist_ok=True)
errors = []


def log(*args, **kw):
    print(*args, **kw, flush=True)


def shot(page, name):
    page.screenshot(path=str(out / f"{name}.png"))
    log("  ", name, page.evaluate("`${game.phase} m=${game.m.toFixed(2)} crashing=${game.crashing}`"))


def until(page, expr, timeout=25, what=None):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if page.evaluate(expr):
            return
        time.sleep(0.03)
    log("console:", *errors[-20:], sep="\n  ")
    raise TimeoutError(what or expr)


def wait_phase(page, phase):
    until(page, f"game.phase === '{phase}' && !game.crashing", what=phase)


with sync_playwright() as p:
    cached = sorted((pathlib.Path(os.environ["LOCALAPPDATA"]) / "ms-playwright").glob(
        "chromium_headless_shell-*/chrome-headless-shell-win64/chrome-headless-shell.exe"))
    browser = p.chromium.launch(executable_path=str(cached[-1]) if cached else None,
                                args=["--autoplay-policy=no-user-gesture-required"])
    if "film" in a.only:
        ctx = browser.new_context(viewport={"width": 540, "height": 960}, record_video_dir=str(out / "video"),
                                  record_video_size={"width": 540, "height": 960})
        page = ctx.new_page()
    else:
        page = browser.new_page(viewport={"width": 540, "height": 960}, device_scale_factor=2)
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: (errors.append(f"pageerror: {e}"), log("  !! pageerror:", e.stack or e)))
    page.goto(a.url)
    page.wait_for_selector("#start:not([hidden])", timeout=60000)
    shot(page, "00_loader")
    page.click("#start")
    page.evaluate("""(() => {
        window.voLog = [];
        const said = sound.voice.bind(sound);
        sound.voice = (key, delay = 0) => {
            const line = said(key, delay);
            voLog.push({ t: performance.now() / 1000 + delay, key, dur: line.dur, phase: game.phase,
                         crashing: game.crashing, m: game.m });
            return line;
        };
    })()""")

    try:
        time.sleep(1.5)
        log("   audio buffers:", page.evaluate("Object.keys(sound.buffers).length"),
            "voice:", page.evaluate("Object.keys(sound.buffers).filter((k) => k.startsWith('vo:')).length"),
            "ctx:", page.evaluate("sound.ctx && sound.ctx.state"))
        fps = page.evaluate("""new Promise((r) => { let n = 0; const t0 = performance.now();
            const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); };
            requestAnimationFrame(f); })""")
        log("   fps (betting):", fps)

        if "film" in a.only:
            wait_phase(page, "idle")
            page.evaluate("cheat.at.v = 1.8")
            page.click("#bet")
            t0 = page.evaluate("performance.now()")
            until(page, "!!game.crashing")
            log("   crash after", round(page.evaluate("performance.now()") - t0), "ms of filming")
            wait_phase(page, "idle")
            time.sleep(1.0)
            ctx.close()

        if "voice" in a.only:
            # three long rounds: watched to the end, escaped at x2.5, watched to the end
            page.evaluate("Object.assign(cheat.at, { v: 6, keep: true })")
            for escape in (False, True, False):
                wait_phase(page, "idle")
                time.sleep(4.0)
                page.click("#bet")
                if escape:
                    until(page, "game.m >= 2.5", what="x2.5")
                    page.click("#bet")
                until(page, "!!game.crashing", timeout=40)
            wait_phase(page, "idle")
            page.evaluate("Object.assign(cheat.at, { v: null, keep: false })")

        if "auto" in a.only:
            wait_phase(page, "idle")
            page.click(".tab[data-tab=auto]")
            time.sleep(0.3)
            shot(page, "10_auto_tab")
            page.evaluate("cheat.at.v = 3.0")
            page.click("#bet")
            time.sleep(0.3)
            shot(page, "11_auto_running")
            until(page, "player.cashedAt !== null || !!game.crashing")
            time.sleep(0.2)
            shot(page, "12_auto_cashed")
            fps = page.evaluate("""new Promise((r) => { let n = 0; const t0 = performance.now();
                const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); };
                requestAnimationFrame(f); })""")
            log("   fps (running):", fps)
            wait_phase(page, "idle")
            time.sleep(0.4)
            shot(page, "13_auto_next")
            until(page, "game.phase === 'running'", what="autoplay starts the next round")
            log("   autoplay started round", page.evaluate("game.round.id"), "by itself")
            page.evaluate("player.autoOn = false; renderPanel()")
            until(page, "!!game.crashing", timeout=60)
            wait_phase(page, "idle")
            page.click(".tab[data-tab=bet]")

        if not a.only or "crash" in a.only:
            wait_phase(page, "idle")
            time.sleep(3.0)
            shot(page, "01_ready")
            if page.evaluate("game.phase") != "idle":
                raise TimeoutError("a round started without a bet")
            page.evaluate("cheat.at.v = 3.2")
            page.click("#bet")
            time.sleep(2.2)
            shot(page, "02_filming_early")
            page.evaluate("doFake('creature')")
            for i in range(4):
                time.sleep(0.45)
                shot(page, f"03_fakeout_{i}")
            until(page, "game.m >= 2.6 || !!game.crashing")
            shot(page, "04_filming_late")
            until(page, "!!game.crashing")
            for i, dt in enumerate([0.35, 0.9, 0.6, 0.55, 0.6, 0.45, 0.5, 0.9]):
                time.sleep(dt)
                shot(page, f"05_crash_{i}")

        if not a.only or "escape" in a.only:
            # single player: cashing out ends the round on the spot
            wait_phase(page, "idle")
            time.sleep(0.6)
            page.evaluate("cheat.at.v = 5.0")
            page.click("#bet")
            until(page, "game.m >= 1.6")
            # watch from inside the page: screenshots are too slow to time this from out here
            page.evaluate("""(() => {
                const t0 = performance.now();
                onBetButton();
                const m0 = game.m;
                window.escWatch = { moved: false, idleAt: null };
                const id = setInterval(() => {
                    if (game.phase === 'running' && game.m !== m0) escWatch.moved = true;
                    if (game.phase === 'idle') { escWatch.idleAt = performance.now() - t0; clearInterval(id); }
                }, 30);
            })()""")
            time.sleep(0.25)
            shot(page, "06_cashout")
            time.sleep(0.5)
            shot(page, "07_escape_0")
            until(page, "!!document.querySelector('#screen-msg.on') || game.phase === 'idle'", what="stream cut")
            shot(page, "07_escape_1")
            until(page, "escWatch.idleAt !== null", what="standby after the cash out")
            w = page.evaluate("escWatch")
            if w["moved"]:
                raise TimeoutError("the round kept running after the cash out")
            log(f"   cash out ended the round; standby {w['idleAt'] / 1000:.1f}s later")
            time.sleep(0.5)
            page.click("#history-tab")
            time.sleep(0.4)
            shot(page, "08_history")
            page.click("#history-drawer")

        if "tiers" in a.only:
            # raise the bet into LV2 and LV3: the place and the creature change, then film and crash in each
            page.evaluate("Promise.all([loadTier(1), loadTier(2)]).then(() => true)")
            for lv in (2, 3):
                wait_phase(page, "idle")
                page.click(f".chip[data-i='{lv}']")
                for i, dt in enumerate([0.2, 0.3, 0.3, 0.6]):
                    time.sleep(dt)
                    shot(page, f"20_lv{lv}_switch_{i}")
                until(page, "!tier.busy", what="tier switch")
                time.sleep(1.2)
                shot(page, f"21_lv{lv}_ready")
                page.evaluate("cheat.at.v = 2.6")
                page.click("#bet")
                time.sleep(2.2)
                shot(page, f"22_lv{lv}_filming")
                page.evaluate("doFake('creature')")
                time.sleep(0.8)
                shot(page, f"23_lv{lv}_fake")
                until(page, "!!game.crashing", timeout=30)
                for i, dt in enumerate([0.9, 1.1, 0.5, 0.45, 0.6]):
                    time.sleep(dt)
                    shot(page, f"24_lv{lv}_crash_{i}")
            wait_phase(page, "idle")
            page.click(".chip[data-i='0']")
            time.sleep(0.5)
            shot(page, "25_lv1_back")
            until(page, "!tier.busy", what="tier switch back")
    except TimeoutError as e:
        log("TIMEOUT:", e)
        shot(page, "99_timeout")
        browser.close()
        sys.exit(1)

    lines = page.evaluate("voLog")
    if lines:
        log("   voice lines:")
        t0, prev_end = lines[0]["t"], None
        for v in lines:
            gap = "" if prev_end is None else f"  gap {v['t'] - prev_end:+5.1f}s"
            state = v["phase"] + (f"/{v['crashing']}" if v["crashing"] else "")
            log(f"     {v['t'] - t0:6.1f}s  {state:16} x{v['m']:<5.2f} {v['key']:14} {v['dur']:4.1f}s{gap}")
            prev_end = v["t"] + v["dur"]
    browser.close()
    log("console:", *errors[:40], sep="\n  ") if errors else log("console: clean")
