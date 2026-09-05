from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

SOURCES = [
    ROOT / 'index.html', ROOT / 'intelligence.js', ROOT / 'platform.js',
    ROOT / 'v23.js', ROOT / 'v23-runtime.js', ROOT / 'hyperliquid-trade.js',
    ROOT / 'ramp.js'
]
CSS_SOURCES = [(ROOT / 'index.html').read_text(), (ROOT / 'v23.css').read_text()]
ALL = '\n'.join(p.read_text() for p in SOURCES)
CSS = '\n'.join(CSS_SOURCES)

# Every grid span referenced by HTML/JS templates must actually exist in CSS.
used_spans = {int(x) for x in re.findall(r'\bspan(\d{1,2})\b', ALL)}
missing_spans = [n for n in sorted(used_spans) if not re.search(rf'\.span{n}\s*\{{', CSS)]
assert not missing_spans, f'Undefined grid span classes: {missing_spans}'

# Product tabs/panels that previously regressed must remain present.
required_ids = [
    'microtrade', 'socialconnect', 'investor-eoi', 'agentdev',
    'hyperliquid-trade', 'newsroom', 'grants', 'institutional',
    'pilot', 'infrastructure', 'developer', 'ramp'
]
for panel_id in required_ids:
    assert panel_id in ALL, f'Missing dynamic panel: {panel_id}'

# Critical visual and responsive guarantees.
v23 = (ROOT / 'v23.css').read_text()
for token in [
    '.span12{grid-column:1/-1}',
    'body[data-cp-theme="liquid-neon"]',
    'body[data-cp-theme="akatsuki-storm"]',
    '@media(max-width:900px)',
    '@media(prefers-reduced-motion:reduce)',
    '#themeBtn{display:none}'
]:
    assert token in v23, f'Missing visual safeguard: {token}'

# Both deployment paths must publish all dynamic UI assets.
for workflow in ['.github/workflows/pages.yml', '.github/workflows/refresh-news.yml']:
    text = (ROOT / workflow).read_text()
    for asset in ['v23.js', 'v23-runtime.js', 'v23.css', 'hyperliquid-trade.js', 'ramp.js']:
        assert asset in text, f'{workflow} does not publish {asset}'

# Prevent duplicate visible naming confusion between circles and share/login.
runtime = (ROOT / 'v23-runtime.js').read_text()
assert "circles.textContent='Circles'" in runtime
assert "sharing.textContent='Share & Login'" in runtime

# MicroTrade must stay explicitly Base-prefilled and bounded.
v23js = (ROOT / 'v23.js').read_text()
assert 'chain=base' in v23js
assert 'maxOrder:5,maxDay:10,maxMonth:100' in v23js

# Regulated ramp must remain non-custodial and fee-transparent.
ramp = (ROOT / 'ramp.js').read_text()
assert 'CryptoPilot does not custody your INR, crypto or private keys.' in ramp
assert '0.25%' in ramp
assert 'provider partner-fee support' in ramp
assert 'ONMETA_API_SECRET' not in ramp

print(f'UI smoke OK: spans={sorted(used_spans)}, panels={len(required_ids)}')
