#!/usr/bin/env python3
"""Compile design-canvas screens (designs/*.dc.html) into React client components (screens/*.jsx).

Why: the canvas is the source of truth for layout and copy. Compiling it keeps the app pixel-identical to the
reviewed designs and turns "update the design" into "recompile", instead of hand-porting 390 KB of markup.

What it handles (everything the Munim designs use):
  {{a.b}} holes in text and attributes · <sc-if value> · <sc-for list as> · onClick/onChange="{{fn}}"
  inline style strings → style objects · SVG attribute names → React names · links to other boards → app routes
  the DCLogic class → a hook (useDC) · sample-data literals → this.props.data.NAME (the server's view model)

Usage: python3 tools/dc2react.py            (compiles every screen in SCREENS)
"""
import html.parser, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESIGNS, OUT = os.path.join(ROOT, 'designs'), os.path.join(ROOT, 'screens')

# screen file -> (component name, data vars the server supplies instead of the design's sample literals)
SCREENS = {
    'Main': ('Today', []),
    'Spends': ('Spends', []),
    'Category': ('Category', ['DATA']),
    'Transactions': ('Transactions', ['TX']),
    'Invest': ('Invest', ['ESSM', 'BANK', 'PF', 'INCOME_M', 'TERM_COVER', 'ENDOW', 'SAVED_WITH_MUNIM']),
    'Xray': ('Xray', ['PF']),
    'Voice': ('Ask', []),
    'SundayCall': ('SundayCall', []),
    'Recaps': ('Recaps', []),
    'MonthClose': ('MonthClose', []),
    'Rules': ('Rules', []),
}

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
ATTR = {'class': 'className', 'for': 'htmlFor', 'tabindex': 'tabIndex', 'maxlength': 'maxLength', 'inputmode': 'inputMode',
        'readonly': 'readOnly', 'autocomplete': 'autoComplete', 'spellcheck': 'spellCheck', 'colspan': 'colSpan', 'rowspan': 'rowSpan',
        'viewbox': 'viewBox', 'preserveaspectratio': 'preserveAspectRatio', 'gradientunits': 'gradientUnits',
        'gradienttransform': 'gradientTransform', 'patternunits': 'patternUnits', 'textlength': 'textLength',
        'markerwidth': 'markerWidth', 'markerheight': 'markerHeight', 'refx': 'refX', 'refy': 'refY', 'stddeviation': 'stdDeviation',
        'xlink:href': 'xlinkHref', 'onclick': 'onClick', 'onchange': 'onChange', 'oninput': 'onInput', 'onkeydown': 'onKeyDown',
        'onsubmit': 'onSubmit', 'onfocus': 'onFocus', 'onblur': 'onBlur', 'autofocus': 'autoFocus', 'enterkeyhint': 'enterKeyHint',
        'crossorigin': 'crossOrigin', 'onpointermove': 'onPointerMove', 'onpointerdown': 'onPointerDown', 'onpointerup': 'onPointerUp', 'onpointerleave': 'onPointerLeave', 'onpointerenter': 'onPointerEnter', 'onmouseenter': 'onMouseEnter', 'onmouseleave': 'onMouseLeave', 'onkeyup': 'onKeyUp', 'ontouchstart': 'onTouchStart', 'onscroll': 'onScroll', 'srcset': 'srcSet', 'datetime': 'dateTime', 'accesskey': 'accessKey', 'contenteditable': 'contentEditable'}
BOOL = {'disabled', 'checked', 'open', 'hidden', 'required', 'readonly', 'selected', 'multiple', 'autofocus'}
HOLE = re.compile(r'\{\{\s*([^}]*?)\s*\}\}')


def camel(s):
    if s.startswith('--'): return s
    if s.startswith('-'): s = s[1:]; parts = s.split('-'); return parts[0].capitalize() + ''.join(p.capitalize() for p in parts[1:])
    parts = s.split('-'); return parts[0] + ''.join(p.capitalize() for p in parts[1:])


class Node:
    def __init__(self, tag, attrs=None): self.tag, self.attrs, self.kids = tag, attrs or [], []


class P(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.root = Node('#root'); self.stack = [self.root]; self.css = []; self.in_style = False; self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag == 'style': self.in_style = True; return
        if tag in ('helmet', 'x-dc', 'html', 'head', 'body', 'meta', 'title', 'link', 'script'):
            if tag in ('title', 'script'): self.skip += 1
            return
        n = Node(tag, attrs); self.stack[-1].kids.append(n)
        if tag not in VOID: self.stack.append(n)
    def handle_startendtag(self, tag, attrs):
        if tag in ('meta', 'link'): return
        self.stack[-1].kids.append(Node(tag, attrs))
    def handle_endtag(self, tag):
        if tag == 'style': self.in_style = False; return
        if tag in ('title', 'script'): self.skip -= 1; return
        if tag in ('helmet', 'x-dc', 'html', 'head', 'body') or tag in VOID: return
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag: del self.stack[i:]; return
    def handle_data(self, d):
        if self.in_style: self.css.append(d); return
        if self.skip: return
        self.stack[-1].kids.append(d)
    def handle_entityref(self, name): self.handle_data(f'&{name};')
    def handle_charref(self, name): self.handle_data(f'&#{name};')


class Emit:
    def __init__(self): self.scope = []; self.n = 0
    def expr(self, h):
        h = h.strip()
        if h in ('true', 'false', 'null'): return h
        parts = h.split('.')
        base = parts[0] if parts[0] in self.scope else 'V.' + parts[0]
        return base + ''.join('?.' + p for p in parts[1:])
    def value(self, s):
        """Attribute value with holes -> JSX expression text (without braces) or None for a plain string."""
        holes = HOLE.findall(s)
        if not holes: return None
        if HOLE.fullmatch(s.strip()): return self.expr(HOLE.fullmatch(s.strip()).group(1))
        out = HOLE.sub(lambda m: '${' + self.expr(m.group(1)) + ' ?? ""}', s.replace('`', '\\`'))
        return '`' + out + '`'
    def style(self, s):
        items, depth, cur = [], 0, ''
        for ch in s:
            if ch == '(': depth += 1
            if ch == ')': depth -= 1
            if ch == ';' and depth == 0: items.append(cur); cur = ''
            else: cur += ch
        items.append(cur)
        props = []
        for it in items:
            if ':' not in it: continue
            k, v = it.split(':', 1); k, v = k.strip(), v.strip()
            if not k: continue
            ev = self.value(v)
            props.append(f'{json.dumps(camel(k))}: {ev if ev else json.dumps(html_unescape(v))}')
        return '{{' + ', '.join(props) + '}}'
    def attrs(self, tag, attrs):
        out = []
        for k, v in attrs:
            if k.startswith('hint-') or k in ('xmlns',) and False: continue
            if k.startswith('hint-'): continue
            name = ATTR.get(k, k if (k.startswith('aria-') or k.startswith('data-')) else camel(k) if '-' in k else k)
            if v is None:
                out.append(name if k in BOOL or True else name); continue
            if k == 'style': out.append(f'style={self.style(v)}'); continue
            ev = self.value(v)
            if k == 'href':
                if ev: out.append(f'href={{route({ev})}}'); continue
                if v.endswith('.dc.html'): out.append(f'href={{route({json.dumps(v)})}}'); continue
            if k == 'value' and tag in ('input', 'textarea') and ev: out.append(f'value={{{ev} ?? ""}}'); continue
            if ev: out.append(f'{name}={{{ev}}}'); continue
            if k in BOOL: out.append(f'{name}={{true}}' if v in ('', k, 'true') else f'{name}={json.dumps(v)}'); continue
            out.append(f'{name}={{{json.dumps(html_unescape(v))}}}' if ('"' in v or '{' in v or '}' in v) else f'{name}="{v}"')
        return (' ' + ' '.join(out)) if out else ''
    def text(self, t):
        if not t.strip():
            return '' if '\n' in t else "{' '}"
        lead = "{' '}" if t[0].isspace() else ''; trail = "{' '}" if t[-1].isspace() else ''
        body = re.sub(r'\s+', ' ', t.strip())
        out, pos = [], 0
        for m in HOLE.finditer(body):
            out.append(esc(body[pos:m.start()])); out.append('{' + self.expr(m.group(1)) + '}'); pos = m.end()
        out.append(esc(body[pos:]))
        return lead + ''.join(out) + trail
    def node(self, n, ind):
        if isinstance(n, str): return self.text(n)
        pad = '  ' * ind
        if n.tag == 'sc-if':
            cond = dict(n.attrs).get('value', '')
            m = HOLE.fullmatch(cond.strip()); c = self.expr(m.group(1)) if m else json.dumps(cond)
            inner = self.kids(n, ind + 1)
            return f'{{!!({c}) && (<>\n{inner}\n{pad}</>)}}'
        if n.tag == 'sc-for':
            a = dict(n.attrs); m = HOLE.fullmatch(a.get('list', '').strip()); lst = self.expr(m.group(1)) if m else '[]'
            var = a.get('as', 'item'); self.n += 1; idx = f'i{self.n}'
            self.scope.append(var); inner = self.kids(n, ind + 1); self.scope.pop()
            return f'{{({lst} || []).map(({var}, {idx}) => (<Fragment key={{{idx}}}>\n{inner}\n{pad}</Fragment>))}}'
        at = self.attrs(n.tag, n.attrs)
        if n.tag in VOID or (not n.kids and n.tag in ('path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'stop', 'use')):
            return f'<{n.tag}{at} />'
        if n.tag == 'textarea':
            return f'<textarea{at} />'
        return f'<{n.tag}{at}>' + self.kids(n, ind + 1, inline=True) + f'</{n.tag}>'
    def kids(self, n, ind, inline=False):
        parts = [self.node(k, ind) for k in n.kids]
        parts = [p for p in parts if p != '']
        return ''.join(parts) if inline else '\n'.join('  ' * ind + p for p in parts)


def html_unescape(s):
    import html as h
    return h.unescape(s)


def esc(s):
    return s.replace('{', "{'{'}").replace('}', "{'}'}").replace('<', '&lt;').replace('>', '&gt;')


def replace_data(code, names):
    """var NAME = <literal> (up to the depth-0 ',' or ';') -> var NAME = this.props.data.NAME"""
    for name in names:
        m = re.search(r'(?:\bvar\s+|,\s*)' + name + r'\s*=\s*', code)
        if not m: sys.exit(f'data var {name} not found')
        i, depth, q = m.end(), 0, None
        while i < len(code):
            ch = code[i]
            if q:
                if ch == '\\': i += 2; continue
                if ch == q: q = None
            elif ch in '\'"`': q = ch
            elif ch in '([{': depth += 1
            elif ch in ')]}': depth -= 1
            elif ch in ',;' and depth == 0: break
            i += 1
        code = code[:m.end()] + 'this.props.data.' + name + code[i:]
    return code


def compile_screen(fname, comp, data_vars, tokens):
    src = open(os.path.join(DESIGNS, fname + '.dc.html')).read()
    p = P(); body = src.split('<x-dc>', 1)[1].split('</x-dc>', 1)[0]; p.feed(body); p.close()
    css = ''.join(p.css).replace(tokens, '').strip()
    css = '\n'.join(l for l in css.splitlines() if not l.startswith('body{margin:0}') and l.strip() != '/*TOKENS*/')
    m = re.search(r"<script type=\"text/x-dc\"[^>]*data-props='([^']*)'>(.*?)</script>", src, re.S)
    props, logic = json.loads(m.group(1)), m.group(2).strip()
    logic = replace_data(logic, data_vars)
    defaults = {k: v.get('default') for k, v in props.items() if not k.startswith('$')}
    e = Emit()
    root = [k for k in p.root.kids if not isinstance(k, str) or k.strip()]
    assert len(root) == 1, f'{fname}: expected one root element, got {len(root)}'
    r = root[0]
    # The design frame is a fixed 390x844 phone; the app fills the viewport (max 480 wide) instead.
    r.attrs = [(k, re.sub(r'width: 390px; height: 844px;', 'width: 100%; max-width: 480px; height: 100dvh; margin: 0 auto;', v) if k == 'style' else v) for k, v in r.attrs]
    jsx = e.node(r, 2)
    out = f"""'use client';
/* GENERATED by tools/dc2react.py from designs/{fname}.dc.html. Do not edit: change the design and recompile. */
/* eslint-disable */
// @ts-nocheck
import {{ Fragment }} from 'react';
import {{ DCLogic, useDC, route }} from '@/ui/dc';

const CSS = {json.dumps(css)};
const DEFAULTS = {json.dumps(defaults, ensure_ascii=False)};

{logic}

export default function {comp}(props) {{
  const V = useDC(Component, {{ ...DEFAULTS, ...props }});
  return (<>
    <style>{{CSS}}</style>
    {jsx}
  </>);
}}
"""
    open(os.path.join(OUT, comp + '.jsx'), 'w').write(out)
    return comp, len(out)


if __name__ == '__main__':
    tokens = open(os.path.join(DESIGNS, 'tokens.css')).read().rstrip('\n')
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]
    for f, (comp, dv) in SCREENS.items():
        if only and f not in only: continue
        print(*compile_screen(f, comp, dv, tokens))
