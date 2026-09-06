from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

SOURCES = [
    ROOT / 'index.html', ROOT / 'intelligence.js', ROOT / 'platform.js',
    ROOT / 'v23.js', ROOT / 'v23-runtime.js', ROOT / 'hyperliquid-trade.js',
    ROOT / 'ramp.js', ROOT / 'checkout/cryptopilot-checkout.js',
    ROOT / 'checkout/standalone.js'
]
CSS_SOURCES = [(ROOT / 'index.html').read_text(), (ROOT / 'v23.css').read_text()]
ALL = '\n'.join(p.read_text() for p in SOURCES)
CSS = '\n'.join(CSS_SOURCES)

# Every grid span referenced by legacy HTML/JS templates must actually exist in CSS.
legacy_sources = [ROOT / 'index.html', ROOT / 'intelligence.js', ROOT / 'platform.js', ROOT / 'v23.js', ROOT / 'v23-runtime.js', ROOT / 'hyperliquid-trade.js']
legacy_all = '\n'.join(p.read_text() for p in legacy_sources)
used_spans = {int(x) for x in re.findall(r'\bspan(\d{1,2})\b', legacy_all)}
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

# Both deployment paths must publish all dynamic UI and standalone checkout assets.
for workflow in ['.github/workflows/pages.yml', '.github/workflows/refresh-news.yml']:
    text = (ROOT / workflow).read_text()
    for asset in ['v23.js', 'v23-runtime.js', 'v23.css', 'hyperliquid-trade.js', 'ramp.js']:
        assert asset in text, f'{workflow} does not publish {asset}'
    assert 'cp -R checkout _site/checkout' in text, f'{workflow} does not publish checkout/'

# Prevent duplicate visible naming confusion between circles and share/login.
runtime = (ROOT / 'v23-runtime.js').read_text()
assert "circles.textContent='Circles'" in runtime
assert "sharing.textContent='Share & Login'" in runtime

# MicroTrade must stay explicitly Base-prefilled and bounded.
v23js = (ROOT / 'v23.js').read_text()
assert 'chain=base' in v23js
assert 'maxOrder:5,maxDay:10,maxMonth:100' in v23js

# Standalone checkout must remain reusable, non-custodial and fee-transparent.
checkout = (ROOT / 'checkout/cryptopilot-checkout.js').read_text()
standalone = (ROOT / 'checkout/standalone.js').read_text()
ramp = (ROOT / 'ramp.js').read_text()
for token in [
    "attachShadow({mode:'open'})",
    "customElements.define('cryptopilot-checkout'",
    "ORDER_COMPLETED_EVENTS",
    "CryptoPilot never asks for a seed phrase or private key",
    "Platform fee capped at ₹25 by default",
    "https://stg.platform.onmeta.in/onmeta-sdk.js",
    "https://platform.onmeta.in/onmeta-sdk.js"
]:
    assert token in checkout, f'Missing checkout safeguard/integration: {token}'
assert 'ONMETA_API_SECRET' not in checkout
assert 'postMessage' in standalone and 'cryptopilot-checkout:init' in standalone
assert "import('./checkout/cryptopilot-checkout.js')" in ramp
for asset in ['checkout/index.html','checkout/README.md','checkout/embed-example.html']:
    assert (ROOT / asset).is_file(), f'Missing checkout asset: {asset}'

print(f'UI smoke OK: spans={sorted(used_spans)}, panels={len(required_ids)}, checkout=standalone')
