import time
from playwright.sync_api import sync_playwright

SPEC = {'a':'C4','s':'D4','d':'E4','f':'F4','g':'G4','h':'A4','j':'B4','k':'C5',
        'w':'C#4','e':'D#4','t':'F#4','y':'G#4','u':'A#4'}
results = []
def check(name, ok, detail=''):
    results.append((name, ok)); print(('PASS' if ok else 'FAIL'), name, detail)

INIT = """
window.__starts = 0; window.__stops = 0;
const s = OscillatorNode.prototype.start, p = OscillatorNode.prototype.stop;
OscillatorNode.prototype.start = function(...a){ window.__starts++; return s.apply(this,a); };
OscillatorNode.prototype.stop  = function(...a){ window.__stops++;  return p.apply(this,a); };
"""
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    page = b.new_page(); errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script(INIT)
    page.goto('http://localhost:4173'); page.wait_for_selector('button[aria-label="C4"]')
    pressed = lambda: sorted(page.eval_on_selector_all('button[aria-pressed="true"]','els=>els.map(e=>e.getAttribute("aria-label"))'))
    starts = lambda: page.evaluate('window.__starts')
    stops = lambda: page.evaluate('window.__stops')
    page.keyboard.press('a'); page.wait_for_timeout(600)   # warm up audio init (first press may race init)
    page.wait_for_timeout(1500)

    # labels on piano keys
    lab = {n: page.locator(f'button[aria-label="{n}"]').inner_text().split('\n')[0].strip() for n in SPEC.values()}
    check('labels on piano keys match mapping', all(lab[n]==k.upper() for k,n in SPEC.items()), str(lab))

    # every mapped key: correct key lights, exactly one note-on, releases
    for k, note in SPEC.items():
        s0 = starts(); page.keyboard.down(k); page.wait_for_timeout(120)
        ok1 = pressed()==[note]; ok2 = starts()-s0==1
        page.keyboard.up(k); page.wait_for_timeout(120)
        ok3 = pressed()==[]
        check(f'key {k.upper()} -> {note} (highlight, 1 note-on, release)', ok1 and ok2 and ok3, f'{pressed()} starts+{starts()-s0}')

    # chord, release in different order
    for k in 'adg': page.keyboard.down(k)
    page.wait_for_timeout(120)
    check('chord A+D+G highlights C4,E4,G4', pressed()==['C4','E4','G4'], str(pressed()))
    page.keyboard.up('d'); check('release middle key leaves others', pressed()==['C4','G4'], str(pressed()))
    page.keyboard.up('g'); page.keyboard.up('a'); page.wait_for_timeout(100)
    check('all released after out-of-order release', pressed()==[])

    # held key: auto-repeat
    s0 = starts()
    for _ in range(15): page.keyboard.down('h'); page.wait_for_timeout(15)
    check('holding A4 with 15 auto-repeat keydowns = 1 note-on', starts()-s0==1, f'+{starts()-s0}')
    page.keyboard.up('h'); page.wait_for_timeout(100)
    check('released after hold', pressed()==[])

    # blur
    page.keyboard.down('a'); page.keyboard.down('d'); page.wait_for_timeout(100)
    page.evaluate("window.dispatchEvent(new Event('blur'))"); page.wait_for_timeout(100)
    check('window blur releases held notes (simulated blur event)', pressed()==[], str(pressed()))
    s0 = starts(); page.keyboard.up('a'); page.keyboard.up('d')
    page.keyboard.down('a'); page.wait_for_timeout(120)
    check('key works again after blur (not stuck)', pressed()==['C4'] and starts()-s0==1)
    page.keyboard.up('a')

    # tab hidden
    page.keyboard.down('s'); page.wait_for_timeout(100)
    page.evaluate("Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(100)
    check('tab hidden releases held notes (simulated visibilitychange)', pressed()==[])
    page.evaluate("Object.defineProperty(document,'hidden',{value:false,configurable:true})")
    page.keyboard.up('s')

    # Escape
    page.keyboard.down('a'); page.keyboard.down('k'); page.wait_for_timeout(100)
    page.keyboard.press('Escape'); page.wait_for_timeout(100)
    check('Escape releases all notes', pressed()==[], str(pressed()))
    page.keyboard.up('a'); page.keyboard.up('k')

    # typing in an input
    page.evaluate("const i=document.createElement('input');i.id='t';document.body.appendChild(i)")
    page.focus('#t'); s0 = starts(); page.keyboard.type('awsk')
    check('typing in <input> is untouched', page.input_value('#t')=='awsk' and starts()==s0 and pressed()==[], page.input_value('#t'))
    page.evaluate("document.activeElement.blur()")

    # unmapped key not prevented
    prevented = page.evaluate("(()=>{const e=new KeyboardEvent('keydown',{code:'KeyZ',key:'z',cancelable:true,bubbles:true});window.dispatchEvent(e);return e.defaultPrevented})()")
    mapped = page.evaluate("(()=>{const e=new KeyboardEvent('keydown',{code:'KeyA',key:'a',cancelable:true,bubbles:true});window.dispatchEvent(e);window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyA',bubbles:true}));return e.defaultPrevented})()")
    check('preventDefault only for mapped keys', prevented is False and mapped is True)

    # octave shift moves notes and labels
    page.keyboard.press('ArrowRight'); page.wait_for_timeout(100)
    check('ArrowRight: label A moves to C5', page.locator('button[aria-label="C5"]').inner_text().split('\n')[0].strip()=='A')
    page.keyboard.down('a'); page.wait_for_timeout(100)
    check('A plays C5 after shift', pressed()==['C5'], str(pressed()))
    page.keyboard.press('ArrowLeft')  # shift back while held
    page.keyboard.up('a'); page.wait_for_timeout(100)
    check('release after octave change mid-hold is not stuck', pressed()==[])

    # mouse still works alongside keyboard
    page.keyboard.down('a'); box = page.locator('button[aria-label="E4"]').bounding_box()
    page.mouse.move(box['x']+box['width']/2, box['y']+box['height']-10); page.mouse.down(); page.wait_for_timeout(100)
    check('keyboard + mouse highlight together', pressed()==['C4','E4'], str(pressed()))
    page.mouse.up(); page.keyboard.up('a'); page.wait_for_timeout(100)
    check('both released', pressed()==[])
    check('no page errors', not errors, str(errors))
    page.screenshot(path='/tmp/shot.png'); b.close()
print(f"\n{sum(ok for _,ok in results)}/{len(results)} passed")
