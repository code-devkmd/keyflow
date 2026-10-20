from playwright.sync_api import sync_playwright
res=[]
def check(n,ok,d=''): res.append(ok); print('PASS' if ok else 'FAIL', n, d)
with sync_playwright() as pw:
    b=pw.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); pg=b.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:4173'); pg.get_by_text('Music practice').click()
    fi='input[aria-label="Import a MIDI file"]'
    # rejects
    pg.set_input_files(fi,'/tmp/song.mp3'); check('mp3 rejected', 'MIDI file' in pg.locator('[role=alert]').inner_text())
    pg.set_input_files(fi,'/tmp/fake.mid'); pg.wait_for_function("document.querySelector('[role=alert]').innerText.includes('valid MIDI')"); check('fake .mid rejected', True, pg.locator('[role=alert]').inner_text())
    # load
    pg.set_input_files(fi,'/tmp/test.mid'); pg.wait_for_selector('.midi-ok')
    check('loaded message', '6 notes' in pg.locator('.midi-ok').inner_text() or '7 notes' in pg.locator('.midi-ok').inner_text(), pg.locator('.midi-ok').inner_text())
    check('Your MIDI lesson button appears + selected', pg.locator('.practice-switch button.selected').inner_text()=='Your MIDI')
    check('tempo set from file (60)', '60 BPM' in pg.locator('.tempo-control').inner_text())
    label=lambda: pg.locator('.practice-next strong').inner_text()
    check('all tracks: first target is bass C2 + melody C4', label()=='C2 + C4', label())
    # choose Melody track only
    pg.select_option('.midi-import-options select >> nth=0', label='Melody (6)')
    check('track filter -> first target C4', label()=='C4', label())
    hits=lambda: int(pg.locator('.practice-score strong').nth(0).inner_text())
    tries=lambda: int(pg.locator('.practice-score strong').nth(1).inner_text())
    pg.get_by_text('Play lesson').click()
    pg.keyboard.press('a'); pg.wait_for_timeout(100); check('C4 hit', hits()==1, f'{hits()}/{tries()}')
    pg.wait_for_function("document.querySelector('.practice-next strong').innerText==='E4'"); pg.keyboard.press('d')
    pg.wait_for_function("document.querySelector('.practice-next strong').innerText==='G4'"); pg.keyboard.press('h')  # wrong (A4)
    pg.wait_for_timeout(80); check('wrong note counts as a try, not a hit', hits()==2 and tries()==1, f'{hits()}/{tries()}')
    check('feedback names target', 'Target: G4' in pg.locator('.practice-feedback').inner_text(), pg.locator('.practice-feedback').inner_text())
    pg.keyboard.press('g'); pg.wait_for_timeout(80); check('G4 hit after retry', hits()==3)
    pg.wait_for_function("document.querySelector('.practice-next strong').innerText==='C4 + E4 + G4'")
    for k in 'adg': pg.keyboard.press(k)
    pg.wait_for_timeout(100); check('chord needs all 3 notes, 3 hits', hits()==6 and tries()==1, f'{hits()}/{tries()}')
    t0=tries(); pg.keyboard.press('k'); pg.wait_for_timeout(80); check('out-of-window press counts as a try', tries()==t0+1 and hits()==6, f'{hits()}/{tries()}')
    # octave shift
    pg.get_by_text('Restart').click()
    pg.select_option('.midi-import-options select >> nth=1', label='-1'); check('octave -1 -> C3', label()=='C3', label())
    pg.screenshot(path='/tmp/midi.png'); check('no page errors', not errs, str(errs)); b.close()
print(sum(res),'/',len(res))
