# -*- coding: utf-8 -*-
"""여러 도시 페이지 자동 생성 — 구글시트(웹에 게시된 CSV)를 읽어 한 번에 만듭니다.

이 스크립트는 깃허브 액션이 몇 시간마다 자동으로 실행합니다.
구글시트의 각 탭(Cities/Timing/Spots/Stay/Rules/Route/VideoIndex)을
"웹에 게시 → CSV" 링크로 읽어와서, city_id별로 city/<slug>/index.html을 만듭니다.

원칙 (카가와 시험판 때와 동일)
 - 시트에 있는 값만 그린다. 없는 값은 지어내지 않고 "빈 자리"로 표시한다.
 - 사전조사(fact_*)와 트콤 판정(tc_*)은 시각적으로 반드시 구분한다.
 - 아직 검색엔진에 공개하지 않는다 (robots: noindex, nofollow). 공개는 사람이 결정한다.
"""
import csv
import html
import io
import os
import urllib.request

SITE = 'https://tripcompany.world'
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_ROOT = os.path.join(REPO_ROOT, 'city')

# "핵심_도시페이지" 구글시트 — 파일 > 공유 > 웹에 게시, 탭별 CSV 링크
CSV_URLS = {
    'Cities': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=710832486&single=true&output=csv',
    'Timing': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=198050972&single=true&output=csv',
    'Spots': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=1952617673&single=true&output=csv',
    'Stay': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=388167611&single=true&output=csv',
    'Rules': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=888055413&single=true&output=csv',
    'Route': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=1206356054&single=true&output=csv',
    'VideoIndex': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=1318190129&single=true&output=csv',
}

COUNTRY_NAME = {'392': '일본', '840': '미국', '156': '중국'}
COUNTRY_ALPHA2 = {'392': 'JP', '840': 'US', '156': 'CN'}

GRADE_CLASS = {
    '필수': 'must', '권장': 'reco', '시간 되면': 'maybe', '굳이': 'skip',
    '추천': 'must', '조건부': 'maybe', '비추천': 'skip',
    '기본': 'must',
}
TYPE_CLASS = {
    '예약': 'book', '간조': 'tide', '간조+일몰': 'tide',
    '영업시간': 'hours', '휴관일': 'closed', '운행': 'transit',
}


def fetch_csv(name, url, local_files=None):
    """local_files가 주어지면(테스트용) 그 파일을 읽고, 아니면 실제로 구글시트에서 받아옵니다."""
    if local_files and name in local_files:
        with open(local_files[name], encoding='utf-8') as f:
            text = f.read()
    else:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for r in reader:
        obj = {(k or '').strip(): (v or '').strip() for k, v in r.items() if k is not None}
        if any(v for k, v in obj.items() if k != 'city_id'):
            rows.append(obj)
    return rows


def e(s):
    return html.escape(str(s or ''), quote=True)


def is_example(*vals):
    return any('(예시)' in (v or '') for v in vals)


def alt_names(en, local):
    parts = [p.strip() for p in (en, local) if p and p.strip()]
    return ' · '.join(parts)


def slot(field, hint=''):
    return (f'<span class="slot"><span class="slot-field">{e(field)}</span>'
            + (f'<span class="slot-hint">{e(hint)}</span>' if hint else '') + '</span>')


def grade_badge(g, field, hint=''):
    if not g:
        return slot(field, hint)
    return f'<span class="grade grade-{GRADE_CLASS.get(g, "maybe")}">{e(g)}</span>'


PAGE_CSS = '''
  :root{
    --accent:#1f6f5c; --accent-strong:#164e41; --accent-soft:#cfe3de;
    --ink:#1f2523; --ink-soft:#5b655f; --bg:#f7f7f4; --panel:#ffffff;
    --border:#e3e2dc; --money:#96692a; --money-soft:#f1e4cc; --money-line:#e3cfa0;
    --warn:#b4451f; --warn-soft:#fdeee7; --warn-line:#f3cfc1;
    --slot:#8a7ab8; --slot-soft:#f1eefa;
  }
  *{ box-sizing:border-box; }
  html{ scroll-behavior:smooth; }
  body{ margin:0; background:var(--bg); color:var(--ink); line-height:1.65;
    font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif; }
  a{ color:var(--accent-strong); }
  .wrap{ max-width:1000px; margin:0 auto; padding:0 24px; }
  section{ padding:52px 0; scroll-margin-top:64px; }
  h2{ font-size:1.45rem; font-weight:800; margin:0 0 4px; letter-spacing:-0.01em; }
  .section-sub{ color:var(--ink-soft); font-size:0.92rem; margin:0 0 24px; }

  .preview-bar{ background:#2b2f2d; color:#fff; font-size:0.84rem; padding:10px 24px; text-align:center; }
  .preview-bar b{ color:#ffd9a0; }

  .hero{ background:linear-gradient(150deg,var(--accent-strong) 0%,var(--accent) 62%,#2c8570 100%); color:#fff; padding:56px 0 48px; }
  .hero .eyebrow{ font-size:0.8rem; font-weight:700; opacity:0.9; letter-spacing:0.02em; }
  .hero h1{ font-size:2.4rem; font-weight:800; margin:10px 0 14px; letter-spacing:-0.02em; }
  .hero .tagline{ font-size:1.08rem; max-width:52ch; margin:0; }
  .hero .chips{ display:flex; flex-wrap:wrap; gap:8px; margin-top:20px; }
  .hero .chips a{ color:#fff; background:rgba(255,255,255,0.16); border:1px solid rgba(255,255,255,0.28);
    border-radius:999px; padding:5px 13px; font-size:0.82rem; font-weight:600; text-decoration:none; }
  .checked{ display:inline-block; margin-top:18px; font-size:0.78rem; background:rgba(0,0,0,0.18);
    border-radius:6px; padding:4px 10px; }

  .slot{ display:inline-flex; align-items:center; gap:6px; background:var(--slot-soft); color:var(--slot);
    border:1px dashed var(--slot); border-radius:7px; padding:2px 9px; font-size:0.76rem; font-weight:600; }
  .slot-field{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:0.72rem; }
  .slot-hint{ font-weight:500; opacity:0.85; }

  .tc{ margin:6px 0 0; font-size:0.94rem; color:var(--ink); font-weight:600; }
  .tc-empty{ font-weight:400; }
  .tc-warn{ color:var(--warn); }
  .fact{ margin:6px 0 0; font-size:0.86rem; color:var(--ink-soft); padding-left:10px; border-left:2px solid var(--border); }

  .timing{ background:var(--warn-soft); border-top:1px solid var(--warn-line); border-bottom:1px solid var(--warn-line); }
  .timing h2{ color:var(--warn); }
  .timing-list{ list-style:none; padding:0; margin:0; display:grid; gap:14px; grid-template-columns:repeat(2,minmax(0,1fr)); }
  .timing-item{ background:#fff; border:1px solid var(--warn-line); border-radius:12px; padding:16px 18px; }
  .timing-head{ display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
  .timing-target{ font-weight:700; }
  .ttype{ font-size:0.72rem; font-weight:700; padding:3px 9px; border-radius:999px; }
  .ttype-book{ background:#fde2d6; color:#a53b12; }
  .ttype-tide{ background:#d8e8f6; color:#1c567f; }
  .ttype-hours{ background:#f5e6c4; color:#8a6412; }
  .ttype-closed{ background:#e6e3ef; color:#54497a; }
  .ttype-transit{ background:#dcebe3; color:#1f6f5c; }

  .area{ margin-bottom:34px; scroll-margin-top:64px; }
  .area-name{ font-size:1.05rem; margin:0 0 12px; display:flex; align-items:baseline; gap:8px; }
  .area-count{ font-size:0.8rem; color:var(--ink-soft); font-weight:500; }
  .spot-list{ list-style:none; padding:0; margin:0; display:grid; gap:12px; grid-template-columns:repeat(2,minmax(0,1fr)); }
  .spot, .stay-item, .rule{ background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:15px 17px; }
  .spot-head{ display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
  .spot-name{ font-weight:700; }
  .spot-alt{ font-size:0.78rem; color:var(--ink-soft); }
  .grade{ font-size:0.74rem; font-weight:800; padding:3px 10px; border-radius:999px; }
  .grade-must{ background:var(--accent-soft); color:var(--accent-strong); }
  .grade-maybe{ background:#eeece4; color:#6b6555; }
  .grade-reco{ background:#d8e8f6; color:#1c567f; }
  .grade-skip{ background:#f0e4e0; color:#8d4b33; }
  .ts{ font-size:0.76rem; font-weight:700; background:#eceae2; border-radius:5px; padding:2px 7px; text-decoration:none; }

  .rule-list, .stay-list, .vi-list{ list-style:none; padding:0; margin:0; display:grid; gap:12px; }
  .rule-list{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  .rule-q{ margin:0; font-weight:700; font-size:0.95rem; }
  .rule .tc{ font-weight:400; }

  table{ width:100%; border-collapse:collapse; font-size:0.9rem; background:var(--panel);
    border:1px solid var(--border); border-radius:12px; overflow:hidden; }
  th, td{ text-align:left; padding:11px 14px; border-bottom:1px solid var(--border); }
  th{ background:#f2f1ec; font-size:0.8rem; color:var(--ink-soft); }
  td.num{ text-align:right; font-variant-numeric:tabular-nums; font-weight:700; }
  td.muted{ color:var(--ink-soft); font-weight:400; }
  .diff{ font-size:0.82rem; color:var(--ink-soft); }
  .diff.up{ color:var(--warn); font-weight:700; }

  .vi-item{ display:flex; align-items:center; gap:10px; background:var(--panel);
    border:1px solid var(--border); border-radius:10px; padding:10px 14px; }
  .is-example{ opacity:0.72; }
  .ex-tag{ font-size:0.7rem; background:#eceae2; color:var(--ink-soft); border-radius:5px; padding:2px 7px; margin-left:6px; }
  .empty-note{ color:var(--ink-soft); font-size:0.9rem; background:var(--panel);
    border:1px dashed var(--border); border-radius:12px; padding:18px; }

  footer{ background:var(--accent-strong); color:#fff; padding:40px 0; font-size:0.88rem; }
  footer a{ color:#fff; }

  @media (max-width:820px){
    .hero h1{ font-size:1.9rem; }
    .timing-list, .spot-list, .rule-list{ grid-template-columns:1fr; }
    table{ display:block; overflow-x:auto; }
  }
'''


def build_city_page(city, timing, spots, stay, rules, route, vindex):
    city_id = city['city_id']
    slug = city_id.lower()
    name = city.get('city_name_ko', city_id)
    country = COUNTRY_NAME.get(city.get('country_code', ''), '')
    alpha2 = COUNTRY_ALPHA2.get(city.get('country_code', ''), '')

    areas = []
    for s in spots:
        if s['area'] not in areas:
            areas.append(s['area'])
    area_anchor = {a: f'area-{i + 1}' for i, a in enumerate(areas)}

    timing_html = []
    for t in timing:
        ttype = t.get('constraint_type', '')
        timing_html.append(f'''
      <li class="timing-item">
        <div class="timing-head">
          <span class="ttype ttype-{TYPE_CLASS.get(ttype, 'hours')}">{e(ttype)}</span>
          <span class="timing-target">{e(t.get('target'))}</span>
        </div>
        <p class="fact">{e(t.get('fact_detail (사전조사)'))}</p>
        {'<p class="tc">' + e(t.get('tc_warn (직접)')) + '</p>' if t.get('tc_warn (직접)') else '<p class="tc tc-empty">' + slot('Timing.tc_warn', '트콤이 직접 겪은 주의점 한 줄') + '</p>'}
      </li>''')

    spots_html = []
    for area in areas:
        items = [s for s in spots if s['area'] == area]
        cards = []
        for s in items:
            note = s.get('tc_note (한 줄)', '')
            fact = s.get('fact_note (사전조사)', '')
            ts = s.get('video_ts', '')
            alt = alt_names(s.get('spot_name_en'), s.get('spot_name_local'))
            cards.append(f'''
        <li class="spot">
          <div class="spot-head">
            {grade_badge(s.get('tc_grade'), 'Spots.tc_grade')}
            <span class="spot-name">{e(s.get('spot_name_ko'))}</span>
            {'<span class="spot-alt">' + e(alt) + '</span>' if alt else ''}
            {'<a class="ts" href="#video-index">' + e(ts) + '</a>' if ts else ''}
          </div>
          {'<p class="tc">' + e(note) + '</p>' if note else '<p class="tc tc-empty">' + slot('Spots.tc_note', '왜 이 등급인지 20자 내외') + '</p>'}
          {'<p class="fact">' + e(fact) + '</p>' if fact else ''}
        </li>''')
        spots_html.append(f'''
      <div class="area" id="{area_anchor.get(area, area)}">
        <h3 class="area-name">{e(area)} <span class="area-count">{len(items)}곳</span></h3>
        <ul class="spot-list">{''.join(cards)}</ul>
      </div>''')

    rules_html = []
    for r in rules:
        rec = r.get('recommendation (직접)', '')
        rules_html.append(f'''
      <li class="rule">
        <p class="rule-q">{e(r.get('condition (조건)'))}</p>
        {'<p class="tc">' + e(rec) + '</p>' if rec else '<p class="tc tc-empty">' + slot('Rules.recommendation', '이 조건이면 어떻게 하라고 할 것인가') + '</p>'}
      </li>''')

    stay_html = []
    for s in stay:
        note = s.get('tc_note', '')
        stay_html.append(f'''
      <li class="stay-item">
        <div class="spot-head">
          {grade_badge(s.get('tc_grade'), 'Stay.tc_grade', '추천 / 조건부 / 비추천 중 하나')}
          <span class="spot-name">{e(s.get('area_name'))}</span>
        </div>
        {'<p class="tc">' + e(note) + '</p>' if note else '<p class="tc tc-empty">' + slot('Stay.tc_note', '이 구역을 고르는 이유 한 줄') + '</p>'}
      </li>''')

    route_html = []
    for r in route:
        ex = is_example(r.get('from'), r.get('tc_note'))
        try:
            diff = int(float(r.get('actual_min') or 0)) - int(float(r.get('map_min') or 0))
        except ValueError:
            diff = 0
        diff_txt = (f'구글맵보다 +{diff}분' if diff > 0 else (f'구글맵보다 {diff}분' if diff < 0 else '구글맵과 같음'))
        route_html.append(f'''
      <tr class="{'is-example' if ex else ''}">
        <td>{e(r.get('from'))} → {e(r.get('to'))}{'<span class="ex-tag">예시</span>' if ex else ''}</td>
        <td>{e(r.get('transport'))}</td>
        <td class="num">{e(r.get('actual_min'))}분</td>
        <td class="num muted">{e(r.get('map_min'))}분</td>
        <td class="diff {'up' if diff > 0 else ''}">{diff_txt}</td>
        <td>{e(r.get('tc_note'))}</td>
      </tr>''')

    vindex_html = []
    for v in vindex:
        ex = is_example(v.get('label (이 지점에 뭐가 있나)'))
        vindex_html.append(f'''
      <li class="vi-item{' is-example' if ex else ''}">
        <span class="ts">{e(v.get('ts'))}</span>
        <span>{e(v.get('label (이 지점에 뭐가 있나)'))}</span>
        {'<span class="ex-tag">예시</span>' if ex else ''}
      </li>''')

    tagline = city.get('hero_tagline', '')
    one_line = city.get('tc_one_line', '')
    checked = city.get('checked_at', '')
    grades_filled = len([s for s in spots if s.get('tc_grade')])

    title_h1 = f'{name}, 뭘 보고 뭘 버릴까'
    title_tag = f'{name} 여행, 뭘 보고 뭘 버릴까 · 트립콤파니 여행지도'
    meta_desc = one_line or tagline or f'{name} 여행에서 예약이 필요한 곳, 시간 제약이 있는 곳, 그리고 트립콤파니가 직접 가보고 내린 판정.'

    jsonld = f'''{{
  "@context": "https://schema.org",
  "@type": "TravelGuide",
  "name": "{e(name)} 여행 가이드 · 트립콤파니 여행지도",
  "url": "{SITE}/city/{slug}/",
  "about": {{ "@type": "Place", "name": "{e(name)}", "address": {{ "@type": "PostalAddress", "addressCountry": "{alpha2}" }} }},
  "publisher": {{ "@type": "Organization", "name": "트립콤파니" }}
}}'''

    # 아직 아무 탭도 채워지지 않은 도시는 페이지를 만들지 않고 건너뜁니다.
    has_any = timing or spots or stay or rules or route or vindex or tagline or one_line
    if not has_any:
        return None, slug

    route_section = ''
    if route:
        route_section = f'''
<section id="route">
  <div class="wrap">
    <h2>주요 이동경로</h2>
    <p class="section-sub">구글맵 예상과 실제가 다르면, 그 차이가 정보입니다.</p>
    <table>
      <thead><tr><th>구간</th><th>이동</th><th>실제</th><th>구글맵</th><th>차이</th><th>메모</th></tr></thead>
      <tbody>{''.join(route_html)}</tbody>
    </table>
  </div>
</section>'''

    page = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- 아직 준비 단계라 검색엔진에는 노출하지 않습니다. 공개할 때 사람이 index, follow로 바꿉니다. -->
<meta name="robots" content="noindex, nofollow">
<title>{e(title_tag)}</title>
<meta name="description" content="{e(meta_desc)}">
<link rel="canonical" href="{SITE}/city/{slug}/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="트립콤파니 여행지도">
<meta property="og:title" content="{e(title_h1)}">
<meta property="og:url" content="{SITE}/city/{slug}/">
<meta property="og:image" content="{SITE}/images/og-image.jpg">
<script type="application/ld+json">{jsonld}</script>
<style>{PAGE_CSS}</style>
</head>
<body>

<div class="preview-bar">
  <b>자동 생성 미리보기</b> — 구글시트가 바뀔 때마다 자동으로 다시 만들어집니다. 보라색 점선은 <b>아직 비어 있는 시트 칸</b>입니다.
</div>

<div class="hero">
  <div class="wrap">
    <p class="eyebrow">{e(country)} · {e(name)}</p>
    <h1>{e(title_h1)}</h1>
    <p class="tagline">{e(tagline) if tagline else slot('Cities.hero_tagline', '요약이 아니라 판정 한 문장')}</p>
    {'<p class="tagline" style="font-size:0.95rem; opacity:0.92;">' + e(one_line) + '</p>' if one_line else ''}
    <div class="chips">
      {''.join(f'<a href="#{area_anchor.get(a, a)}">{e(a)}</a>' for a in areas)}
    </div>
    <span class="checked">정보 기준: {e(checked) if checked else '— (Cities.checked_at 비어 있음)'}</span>
  </div>
</div>

{'<section class="timing" id="timing"><div class="wrap"><h2>놓치면 여행이 망가지는 것</h2><p class="section-sub">예약·간조·영업시간처럼 <strong>가서 알면 늦는 것</strong>만 모았습니다. 회색 글은 사전조사한 사실, 굵은 글은 트립콤파니가 직접 덧붙인 경고입니다.</p><ul class="timing-list">' + ''.join(timing_html) + '</ul></div></section>' if timing else ''}

{'<section id="rules"><div class="wrap"><h2>당신의 조건이면 이렇게 하세요</h2><p class="section-sub">같은 도시라도 렌터카 유무와 일정 길이에 따라 답이 달라집니다.</p><ul class="rule-list">' + ''.join(rules_html) + '</ul></div></section>' if rules else ''}

<section id="spots" style="background:var(--panel); border-top:1px solid var(--border); border-bottom:1px solid var(--border);">
  <div class="wrap">
    <h2>가볼 곳 판정 <span style="font-size:0.85rem; font-weight:500; color:var(--ink-soft);">({grades_filled}/{len(spots)}곳 판정 완료)</span></h2>
    <p class="section-sub">
      <span class="grade grade-must">필수</span> 이거 안 보면 온 의미 없음 ·
      <span class="grade grade-reco">권장</span> 그 구역 가면 꼭 들러야 함 ·
      <span class="grade grade-maybe">시간 되면</span> 일정 빠듯하면 버려도 됨 ·
      <span class="grade grade-skip">굳이</span> 그렇게 권장하지 않음
    </p>
    {''.join(spots_html) if spots_html else '<p class="empty-note">Spots 탭이 비어 있습니다.</p>'}
  </div>
</section>

<section id="stay" style="background:var(--panel); border-top:1px solid var(--border); border-bottom:1px solid var(--border);">
  <div class="wrap">
    <h2>어느 구역에 묵을까</h2>
    <p class="section-sub">호텔 하나를 찍어주지 않고 <strong>구역</strong>으로 답합니다. 직접 묵은 곳과 그렇지 않은 곳을 구분해서 표시합니다.</p>
    <p class="section-sub" style="margin-top:-14px;">
      <span class="grade grade-must">추천</span> 고민되면 여기, 도시당 1곳만 ·
      <span class="grade grade-maybe">조건부</span> 특정 조건일 때만 ·
      <span class="grade grade-skip">비추천</span> 여기는 잡지 마세요
    </p>
    {'<ul class="stay-list">' + ''.join(stay_html) + '</ul>' if stay_html else '<p class="empty-note">Stay 탭이 비어 있습니다.</p>'}
  </div>
</section>
{route_section}
<section id="video-index" style="background:var(--panel); border-top:1px solid var(--border);">
  <div class="wrap">
    <h2>영상에서 바로 찾아보기</h2>
    <p class="section-sub">글로 옮기지 않고 해당 장면으로 보냅니다.</p>
    {'<ul class="vi-list">' + ''.join(vindex_html) + '</ul>' if vindex_html else '<p class="empty-note">VideoIndex 탭이 비어 있습니다.</p>'}
  </div>
</section>

<footer>
  <div class="wrap">
    <p style="margin:0 0 8px; font-weight:700;">트립콤파니 여행지도</p>
    <p style="margin:0; opacity:0.8;">지도에서 다른 도시 보기 → <a href="/">tripcompany.world</a></p>
  </div>
</footer>

</body>
</html>
'''
    return page, slug


def main(local_files=None):
    cities = fetch_csv('Cities', CSV_URLS['Cities'], local_files)
    timing_all = fetch_csv('Timing', CSV_URLS['Timing'], local_files)
    spots_all = fetch_csv('Spots', CSV_URLS['Spots'], local_files)
    stay_all = fetch_csv('Stay', CSV_URLS['Stay'], local_files)
    rules_all = fetch_csv('Rules', CSV_URLS['Rules'], local_files)
    route_all = fetch_csv('Route', CSV_URLS['Route'], local_files)
    vindex_all = fetch_csv('VideoIndex', CSV_URLS['VideoIndex'], local_files)

    made = []
    skipped = []
    for city in cities:
        cid = city['city_id']
        if not cid:
            continue
        timing = [r for r in timing_all if r.get('city_id') == cid and r.get('target')]
        spots = [r for r in spots_all if r.get('city_id') == cid and r.get('spot_name_ko')]
        stay = [r for r in stay_all if r.get('city_id') == cid and r.get('area_name')]
        rules = [r for r in rules_all if r.get('city_id') == cid and r.get('condition (조건)')]
        route = [r for r in route_all if r.get('city_id') == cid and r.get('from')]
        vindex = [r for r in vindex_all if r.get('city_id') == cid and (r.get('ts') or r.get('label (이 지점에 뭐가 있나)'))]

        page, slug = build_city_page(city, timing, spots, stay, rules, route, vindex)
        if page is None:
            skipped.append(cid)
            continue
        out_dir = os.path.join(OUT_ROOT, slug)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(page)
        made.append((cid, slug, len(spots)))

    print('생성 완료:', len(made), '개 도시')
    for cid, slug, n in made:
        print(f'  - {cid} -> city/{slug}/index.html (스팟 {n}개)')
    if skipped:
        print('건너뜀(아직 아무 탭도 안 채워짐):', ', '.join(skipped))


if __name__ == '__main__':
    main()
