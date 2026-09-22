# -*- coding: utf-8 -*-
"""여러 도시 페이지 자동 생성 — 구글시트(웹에 게시된 CSV)를 읽어 한 번에 만듭니다.

이 스크립트는 깃허브 액션이 몇 시간마다 자동으로 실행합니다.
구글시트의 각 탭(Cities/Timing/Spots/Stay/Rules/Route/VideoIndex/Videos)을
"웹에 게시 → CSV" 링크로 읽어와서, city_id별로 city/<slug>/index.html을 만듭니다.

원칙 (카가와 시험판 때와 동일)
 - 시트에 있는 값만 그린다. 없는 값은 지어내지 않고 "빈 자리"로 표시한다.
 - 사전조사(fact_*)와 트콤 판정(tc_*)은 시각적으로 반드시 구분한다.
 - 아직 검색엔진에 공개하지 않는다 (robots: noindex, nofollow). Cities 탭에 published 열을 추가해
   Y로 표시하면 그 도시만 공개(index, follow)되고, 빈 자리 표시도 함께 사라진다.
"""
import csv
import datetime
import html
import io
import json
import os
import re
import urllib.request

SITE = 'https://tripcompany.world'
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_ROOT = os.path.join(REPO_ROOT, 'city')
OUT_ROOT_COUNTRY = os.path.join(REPO_ROOT, 'country')

# "핵심_도시페이지" 구글시트 — 파일 > 공유 > 웹에 게시, 탭별 CSV 링크
CSV_URLS = {
    'Cities': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=710832486&single=true&output=csv',
    'Timing': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=198050972&single=true&output=csv',
    'Spots': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=1952617673&single=true&output=csv',
    'Stay': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=388167611&single=true&output=csv',
    'Rules': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=888055413&single=true&output=csv',
    'Route': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=1206356054&single=true&output=csv',
    'VideoIndex': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=1318190129&single=true&output=csv',
    # Videos 탭: city_id / video_id 열이 있는 구글시트 탭입니다. (제목과 공개일은 유튜브에서 자동으로 가져옵니다)
    'Videos': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-HbwesUrsUo6wmYDv_pO2aKJULe-WsJgTPOyIE7CbRZ_VyJxchQGa5JIMZO0fVLPV-tzp-Rjlk_nh/pub?gid=1750048788&single=true&output=csv',
    # 국가 페이지용 탭 4개 — 아직 시트에 만들어지지 않았으면 빈 문자열로 둡니다.
    # 탭을 만들고 '웹에 게시' CSV 링크를 받으면 이 자리에 채워 넣습니다. 빈 채로
    # 두는 동안은 국가 페이지가 하나도 만들어지지 않고, 기존 도시 페이지 생성에는
    # 전혀 영향이 없습니다.
    'Countries': '',
    'Regions': '',
    'Season': '',
    'Basics': '',
}

COUNTRY_NAME = {'392': '일본', '840': '미국', '156': '중국'}
COUNTRY_ALPHA2 = {'392': 'JP', '840': 'US', '156': 'CN'}

# 지금 만들고 있는 도시가 공개(published) 상태인지. build_city_page가 그 도시 값으로 바꿔주고,
# slot()이 이 값을 보고 '빈 자리' 표시를 보여줄지 말지 정합니다.
_PUBLISHED = False

GRADE_CLASS = {
    '필수': 'must', '권장': 'reco', '시간 되면': 'maybe', '굳이': 'skip', '취향별': 'taste',
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


def is_city_published(city):
    """Cities.published 칸이 Y/공개 등으로 표시돼 있으면 그 도시는 공개 상태입니다."""
    return (city.get('published', '') or '').strip().upper() in ('Y', 'YES', '공개', 'TRUE', '1')


def is_country_published(country):
    """Countries.published 칸이 Y/공개 등으로 표시돼 있으면 그 나라 페이지는 공개 상태입니다."""
    return (country.get('published', '') or '').strip().upper() in ('Y', 'YES', '공개', 'TRUE', '1')


def alt_names(en, local):
    parts = [p.strip() for p in (en, local) if p and p.strip()]
    return ' · '.join(parts)


_VIDEO_ID_PATTERNS = [
    r'(?:[?&]v=)([A-Za-z0-9_-]{11})',
    r'youtu\.be/([A-Za-z0-9_-]{11})',
    r'shorts/([A-Za-z0-9_-]{11})',
    r'embed/([A-Za-z0-9_-]{11})',
]


def extract_video_id(raw):
    """시트에 순수 영상ID 대신 유튜브 주소 전체를 붙여넣어도 알아서 ID만 뽑아냅니다.
    (실수로 전체 주소를 넣으면 임베드가 깨지고 제목도 못 가져오는 문제가 있었음)"""
    raw = (raw or '').strip()
    if not raw:
        return ''
    if re.fullmatch(r'[A-Za-z0-9_-]{11}', raw):
        return raw
    for pattern in _VIDEO_ID_PATTERNS:
        m = re.search(pattern, raw)
        if m:
            return m.group(1)
    return raw


def slot(field, hint=''):
    if _PUBLISHED:
        return ''
    return (f'<span class="slot"><span class="slot-field">{e(field)}</span>'
            + (f'<span class="slot-hint">{e(hint)}</span>' if hint else '') + '</span>')


def grade_badge(g, field, hint=''):
    if not g:
        return slot(field, hint)
    return f'<span class="grade grade-{GRADE_CLASS.get(g, "maybe")}">{e(g)}</span>'


_TITLE_CACHE = {}
_DATE_CACHE = {}


def fetch_video_title(video_id):
    """유튜브 oEmbed로 영상 제목을 가져옵니다. 실패해도 전체 빌드가 멈추지 않도록
    무슨 일이 있어도 예외를 삼키고 빈 문자열을 돌려줍니다."""
    if not video_id or is_example(video_id):
        return ''
    if video_id in _TITLE_CACHE:
        return _TITLE_CACHE[video_id]
    title = ''
    try:
        url = f'https://www.youtube.com/oembed?url=https://youtu.be/{video_id}&format=json'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        title = data.get('title', '') or ''
    except Exception:
        title = ''
    _TITLE_CACHE[video_id] = title
    return title


def fetch_video_published_date(video_id):
    """영상 시청 페이지에 있는 공개일 메타데이터를 읽어옵니다(oEmbed엔 발행일이 없어서
    별도로 가져옴). 역시 실패하면 빈 문자열만 돌려주고 빌드는 멈추지 않습니다."""
    if not video_id or is_example(video_id):
        return ''
    if video_id in _DATE_CACHE:
        return _DATE_CACHE[video_id]
    date_str = ''
    try:
        url = f'https://www.youtube.com/watch?v={video_id}'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            page = resp.read().decode('utf-8', errors='ignore')
        for pattern in (
            r'itemprop="datePublished" content="(\d{4}-\d{2}-\d{2})"',
            r'itemprop="uploadDate" content="(\d{4}-\d{2}-\d{2})"',
            r'"publishDate":"(\d{4}-\d{2}-\d{2})',
            r'"uploadDate":"(\d{4}-\d{2}-\d{2})',
        ):
            m = re.search(pattern, page)
            if m:
                date_str = m.group(1)
                break
    except Exception:
        date_str = ''
    _DATE_CACHE[video_id] = date_str
    return date_str


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
  .toc-bar{ position:sticky; top:0; z-index:950; background:var(--panel); border-bottom:1px solid var(--border); }
  .toc-bar .wrap{ display:flex; gap:8px; padding:10px 24px; overflow-x:auto; }
  .toc-bar a{ flex:0 0 auto; color:var(--ink); background:var(--bg); border:1px solid var(--border);
    border-radius:999px; padding:6px 14px; font-size:0.82rem; font-weight:700; text-decoration:none; white-space:nowrap; }
  .toc-bar a:hover{ background:var(--accent-soft); color:var(--accent-strong); border-color:var(--accent-soft); }
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
  .spot, .stay-item, .rule{ background:var(--panel); border:1px solid var(--border); border-radius:12px; }
  .stay-item, .rule{ padding:15px 17px; }
  .spot{ padding:0; overflow:hidden; }
  .spot-body{ padding:15px 17px; min-width:0; }
  .spot.has-photo{ display:flex; flex-direction:column; }
  .spot-photo{ width:100%; aspect-ratio:16/9; }
  .spot-photo img{ width:100%; height:100%; object-fit:cover; display:block; }
  .spot-head{ display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
  .spot-name{ font-weight:700; }
  .spot-alt{ font-size:0.78rem; color:var(--ink-soft); margin:3px 0 0; }
  .grade{ font-size:0.74rem; font-weight:800; padding:3px 10px; border-radius:999px; }
  .grade-must{ background:var(--accent-soft); color:var(--accent-strong); }
  .grade-maybe{ background:#eeece4; color:#6b6555; }
  .grade-reco{ background:#d8e8f6; color:#1c567f; }
  .grade-skip{ background:#f0e4e0; color:#8d4b33; }
  .grade-taste{ background:#ece4f6; color:#6b3fa0; }
  .ts{ font-size:0.76rem; font-weight:700; background:#eceae2; border-radius:5px; padding:2px 7px; text-decoration:none; }
  .map-link{ display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px;
    border-radius:999px; background:#eceae2; color:var(--ink-soft); flex-shrink:0; }
  .map-link:hover{ background:var(--accent-soft); color:var(--accent-strong); }

  /* 제휴 예약 버튼(클룩·마이리얼트립 — 스팟별, 트립닷컴 — 숙소 섹션 전체 1개) */
  .book-actions{ display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
  .book-btn{ display:inline-flex; align-items:center; font-size:0.78rem; font-weight:700;
    color:var(--money); background:var(--money-soft); border:1px solid var(--money-line);
    border-radius:999px; padding:5px 12px; text-decoration:none; }
  .book-btn:hover{ background:var(--money-line); }
  .stay-cta{ margin-top:16px; display:flex; }
  .stay-cta a{ display:inline-flex; align-items:center; gap:8px; font-size:0.92rem; font-weight:700;
    color:#fff; background:var(--money); border-radius:10px; padding:12px 18px; text-decoration:none; }
  .stay-cta a:hover{ background:#7c5522; }

  .rule-list, .stay-list, .vi-list{ list-style:none; padding:0; margin:0; display:grid; gap:12px; }
  .rule-list{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  .rule-q{ margin:0; font-weight:700; font-size:0.95rem; }
  .rule .tc{ font-weight:400; }
  .stay-item .tc{ font-weight:500; }

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

  .videos-section{ background:var(--panel); border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
  .vscroll-wrap{ position:relative; }
  .vscroll{ display:flex; gap:14px; overflow-x:auto; scroll-snap-type:x proximity;
    padding:4px 2px 14px; -webkit-overflow-scrolling:touch; scrollbar-width:thin; }
  .vscroll::-webkit-scrollbar{ height:8px; }
  .vscroll::-webkit-scrollbar-thumb{ background:var(--border); border-radius:8px; }
  .vcard{ flex:0 0 240px; scroll-snap-align:start; background:var(--bg); border:1px solid var(--border);
    border-radius:12px; overflow:hidden; cursor:pointer; text-align:left; padding:0; font:inherit; color:inherit; }
  .vcard-thumb{ position:relative; aspect-ratio:16/9; background:#000; display:block; }
  .vcard-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
  .vcard-play{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
  .vcard-play svg{ width:44px; height:44px; filter:drop-shadow(0 1px 4px rgba(0,0,0,0.5)); }
  .vcard-body{ padding:11px 13px 13px; display:block; }
  .vcard-title{ font-size:0.88rem; font-weight:700; margin:0 0 6px; line-height:1.35; display:-webkit-box;
    -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .vcard-date{ display:block; font-size:0.74rem; color:var(--ink-soft); }
  .vscroll-arrow{ position:absolute; top:38%; width:34px; height:34px; border-radius:999px; border:1px solid var(--border);
    background:#fff; box-shadow:0 2px 6px rgba(0,0,0,0.12); display:flex; align-items:center; justify-content:center;
    cursor:pointer; font-size:1.1rem; color:var(--ink); z-index:2; }
  .vscroll-arrow.prev{ left:-6px; }
  .vscroll-arrow.next{ right:-6px; }
  @media (max-width:820px){ .vscroll-arrow{ display:none; } }

  .vmodal{ position:fixed; inset:0; background:rgba(10,15,13,0.86); display:none; align-items:center;
    justify-content:center; padding:24px; z-index:1000; }
  .vmodal.open{ display:flex; }
  .vmodal-box{ width:100%; max-width:860px; }
  .vmodal-frame-wrap{ position:relative; width:100%; padding-top:56.25%; background:#000; border-radius:10px; overflow:hidden; }
  .vmodal-frame-wrap iframe{ position:absolute; inset:0; width:100%; height:100%; border:0; }
  .vmodal-close{ display:block; margin:12px auto 0; background:rgba(255,255,255,0.14); color:#fff;
    border:1px solid rgba(255,255,255,0.3); border-radius:999px; padding:7px 18px; font-size:0.85rem; cursor:pointer; }

  .home-fab{ position:fixed; left:18px; bottom:18px; z-index:900; display:inline-flex; align-items:center; justify-content:center;
    width:44px; height:44px; background:var(--accent-strong); color:#fff; text-decoration:none;
    border-radius:999px; box-shadow:0 4px 14px rgba(22,78,65,0.35); }
  .home-fab:hover{ background:var(--accent); }
  .share-fab{ position:fixed; right:18px; bottom:18px; z-index:900; display:inline-flex; align-items:center; gap:7px;
    background:var(--accent-strong); color:#fff; border:none; cursor:pointer; font-family:inherit; font-size:0.84rem; font-weight:700;
    padding:10px 16px; border-radius:999px; box-shadow:0 4px 14px rgba(22,78,65,0.35); }
  .share-fab:hover{ background:var(--accent); }
  @media (max-width:520px){ .share-fab .fab-text{ display:none; } .share-fab{ padding:12px; } }

  /* ===== 쿠키 동의 배너 (메인 사이트 style.css와 동일) ===== */
  .cookie-consent-banner{ position:fixed; left:0; right:0; bottom:0; z-index:3000; background:#ffffff;
    border-top:1px solid var(--border); box-shadow:0 -4px 16px rgba(0,0,0,0.1); padding:14px 16px;
    display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; }
  .cookie-consent-text{ margin:0; flex:1 1 260px; min-width:200px; font-size:0.82rem; line-height:1.5; color:var(--ink); }
  .cookie-consent-text a{ color:var(--accent); font-weight:600; }
  .cookie-consent-actions{ display:flex; gap:8px; flex-shrink:0; }
  .cookie-consent-btn{ min-height:40px; padding:9px 18px; border-radius:8px; border:1px solid var(--border);
    font-size:0.85rem; font-weight:700; cursor:pointer; }
  .cookie-consent-reject{ background:#ffffff; color:var(--ink); }
  .cookie-consent-reject:hover{ background:#f2f2ef; }
  .cookie-consent-accept{ background:var(--accent); border-color:var(--accent); color:#ffffff; }
  .cookie-consent-accept:hover{ background:#185c4c; }
  @media (max-width:480px){
    .cookie-consent-banner{ flex-direction:column; align-items:stretch; }
    .cookie-consent-actions{ justify-content:stretch; }
    .cookie-consent-btn{ flex:1; }
  }
'''

PAGE_CSS_COUNTRY = '''
:root{
  --paper:#f4f7f6; --surface:#ffffff; --sunk:#eaf0ee; --deep:#123d36;
  --ink:#14201e; --ink2:#33423f; --muted:#5d6b68; --faint:#8a9794;
  --rule:#dde4e2; --rule2:#c7d1ce;
  --a:#00897a; --a2:#c85207; --a3:#2b5fb8;
  --a-soft:#d6ece7; --a2-soft:#f7e2d3; --a3-soft:#dbe5f6;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
 font-family:"IBM Plex Sans KR","Apple SD Gothic Neo",system-ui,sans-serif;
 font-size:15.5px;line-height:1.72;-webkit-font-smoothing:antialiased}
.wrap{max-width:940px;margin:0 auto;padding-inline:20px}
h1,h2,h3{font-family:"Gothic A1","Apple SD Gothic Neo",system-ui,sans-serif;font-weight:800;text-wrap:balance;margin:0;letter-spacing:-.02em}
p{margin:0 0 .9em}
a{color:inherit}

.preview-bar{background:#2b2f2d;color:#fff;font-size:0.84rem;padding:10px 24px;text-align:center}
.preview-bar b{color:#ffd9a0}

nav{background:var(--surface);border-bottom:1px solid var(--rule);position:sticky;top:0;z-index:20}
nav .wrap{display:flex;align-items:center;gap:14px;height:52px}
.brand{font-family:"Gothic A1",sans-serif;font-weight:800;font-size:15px;letter-spacing:-.01em}
.crumb{font-size:13px;color:var(--muted)}
.crumb b{color:var(--ink);font-weight:500}
.crumb a{color:var(--muted);text-decoration:none}
.crumb a:hover{color:var(--ink)}

.hero{background:var(--deep);color:#fff;padding-block:46px 40px}
.hero .wrap{max-width:940px}
.kicker{font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:#7fd7c4;font-weight:600;margin-bottom:14px}
.hero h1{font-size:clamp(28px,5.6vw,44px);line-height:1.16;margin-bottom:18px;color:#fff}
.verdict{font-size:17.5px;color:#cfe5df;max-width:600px;margin-bottom:28px}
.hstats{display:flex;flex-wrap:wrap;gap:10px}
.chip{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:7px 14px;font-size:13px;color:#eaf5f2}
.chip b{font-family:"IBM Plex Mono",monospace;font-weight:600;color:#fff}

section{padding-block:52px 0}
.shead{margin-bottom:8px}
h2{font-size:clamp(20px,3.6vw,27px);line-height:1.3}
.lead{font-size:16.5px;color:var(--ink2);margin-bottom:24px;max-width:640px}
strong{font-weight:600;color:var(--ink)}
.hr{height:1px;background:var(--rule);margin-top:54px}

.regions{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
@media(max-width:700px){.regions{grid-template-columns:1fr}}
.rc{background:var(--surface);border:1px solid var(--rule);padding:20px 20px 18px;display:flex;flex-direction:column}
.rc .rtop{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}
.rc h3{font-size:19px}
.rc .cities{font-size:12.5px;color:var(--faint);margin-bottom:12px}
.rc .who{font-size:14.5px;color:var(--ink2);margin-bottom:12px;flex:1}
.rc .who b{color:var(--ink)}
.rc .meta{display:flex;gap:14px;font-size:12px;color:var(--muted);border-top:1px solid var(--rule);padding-top:11px;flex-wrap:wrap}
.rc .meta span{display:flex;gap:5px}
.rc .meta b{color:var(--ink2);font-weight:500}

.rules{display:grid;gap:1px;background:var(--rule);border:1px solid var(--rule)}
.rule{background:var(--surface);display:grid;grid-template-columns:200px 1fr;gap:18px;padding:15px 20px}
@media(max-width:640px){.rule{grid-template-columns:1fr;gap:5px}}
.rule .q{font-size:14px;color:var(--muted);font-weight:500}
.rule .a{font-size:15px;color:var(--ink)}

.group{margin-top:26px}
.gname{display:flex;align-items:baseline;gap:10px;margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid var(--rule)}
.gname h3{font-size:15px}
.cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:8px}
.city{background:var(--surface);border:1px solid var(--rule);padding:11px 13px;text-decoration:none;display:block;transition:border-color .12s}
.city:hover{border-color:var(--a)}
.city.soon{opacity:.55}
.city .n{font-weight:600;font-size:14.5px;margin-bottom:3px;color:var(--ink)}
.city .t{font-size:12px;color:var(--muted);line-height:1.5}
.city .soon-badge{font-family:"IBM Plex Mono",monospace;font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px;display:inline-block;margin-bottom:5px;background:var(--a2-soft);color:var(--a2)}

.tw{overflow-x:auto;border:1px solid var(--rule);background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:13.8px;min-width:520px}
th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--rule);vertical-align:top}
thead th{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);font-weight:600;background:var(--sunk)}
tbody tr:last-child td{border-bottom:0}
td.nm{font-weight:600;white-space:nowrap}
td.vd b{color:var(--a);font-weight:600}

.basics{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1px;background:var(--rule);border:1px solid var(--rule)}
.bi{background:var(--surface);padding:15px 17px}
.bi .k{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);font-weight:600;margin-bottom:5px}
.bi .v{font-size:14px;color:var(--ink2);line-height:1.6}

.slot{ display:inline-flex; align-items:center; gap:6px; background:#f1eefa; color:#8a7ab8;
  border:1px dashed #8a7ab8; border-radius:7px; padding:2px 9px; font-size:0.76rem; font-weight:600; }
.slot-field{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:0.72rem; }
.slot-hint{ font-weight:500; opacity:0.85; }

.asof{font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--faint);margin-top:10px}

footer{padding-block:40px 70px}
footer p{font-size:13px;color:var(--faint)}
footer a{color:var(--a);font-weight:600;text-decoration:none}
footer a:hover{text-decoration:underline}
'''

SHARE_JS = '''
(function(){
  var btn = document.getElementById('shareFab');
  var label = document.getElementById('shareFabLabel');
  if(!btn) return;
  var timer = null;
  function showFeedback(msg){
    if(!label) return;
    label.textContent = msg;
    clearTimeout(timer);
    timer = setTimeout(function(){ label.textContent = '공유'; }, 1600);
  }
  btn.addEventListener('click', function(){
    var url = window.location.href;
    var title = document.title;
    if(navigator.share){
      navigator.share({ title: title, url: url }).catch(function(){ /* 방문자가 공유창을 그냥 닫음 */ });
      return;
    }
    if(navigator.clipboard){
      navigator.clipboard.writeText(url).then(function(){ showFeedback('복사됨!'); }, function(){ showFeedback('복사 실패'); });
    }
  });
})();
'''

VIDEO_JS = '''
(function(){
  var scroller = document.getElementById('vscroll');
  document.querySelectorAll('[data-vscroll]').forEach(function(btn){
    btn.addEventListener('click', function(){
      if(!scroller) return;
      var dir = btn.getAttribute('data-vscroll') === 'next' ? 1 : -1;
      scroller.scrollBy({ left: dir * (scroller.clientWidth * 0.8), behavior: 'smooth' });
    });
  });
  var modal = document.getElementById('vmodal');
  var frameWrap = document.getElementById('vmodalFrame');
  var closeBtn = document.getElementById('vmodalClose');
  // autoplay=1로 강제 재생시키지 않습니다 — 유튜브 정책상 광고가 붙으려면
  // 스크립트가 강제로 트는 게 아니라 방문자가 플레이어 안에서 직접 눌러야
  // 하는 click-to-play여야 합니다(메인 지도 페이지 app.js의 openVideoModal과
  // 동일한 이유). 모달이 열리면 유튜브 썸네일과 재생 버튼만 뜨고, 방문자가
  // 그 안에서 한 번 더 눌러야 재생이 시작됩니다.
  function openVideo(id){
    if(!modal || !frameWrap || !id) return;
    frameWrap.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?rel=0" title="영상 재생" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    modal.classList.add('open');
  }
  function closeVideo(){
    if(!modal) return;
    modal.classList.remove('open');
    if(frameWrap) frameWrap.innerHTML = '';
  }
  document.querySelectorAll('.vcard').forEach(function(card){
    card.addEventListener('click', function(){ openVideo(card.getAttribute('data-video-id')); });
  });
  if(closeBtn) closeBtn.addEventListener('click', closeVideo);
  if(modal) modal.addEventListener('click', function(evt){ if(evt.target === modal) closeVideo(); });
  document.addEventListener('keydown', function(evt){ if(evt.key === 'Escape') closeVideo(); });
})();
'''


CITY_TRACKING_JS = '''
(function(){
  var CITY_SLUG = document.body.getAttribute('data-city-slug') || '';
  function trackEvent(name, params){
    if (typeof window.gtag !== 'function') return;
    try { window.gtag('event', name, params || {}); } catch(e){ /* 통계 전송 실패가 화면 동작을 막지 않도록 무시 */ }
  }
  /* 이 페이지에서 보내는 맞춤 이벤트 네 가지:
   *   - spot_click       : 스팟 카드의 지도 아이콘을 눌렀을 때 (어느 명소에 관심 있는지)
   *   - spot_video_click : 스팟 카드의 "영상에서 보기" 링크를 눌렀을 때
   *   - toc_click        : 상단 목차(핵심조언/조건별팁/가볼곳/숙소)를 눌렀을 때
   *   - affiliate_click  : 클룩·마이리얼트립 예약 버튼을 눌렀을 때 (메인페이지와 동일한 이벤트명이라
   *                        GA4에서 광고 클릭 통계를 한 곳에서 같이 볼 수 있습니다) */
  document.addEventListener('click', function(event){
    var adEl = event.target.closest('[data-ad-network]');
    if (adEl) {
      trackEvent('affiliate_click', {
        ad_network: adEl.dataset.adNetwork || '',
        ad_placement: adEl.dataset.adPlacement || '',
        ad_label: adEl.dataset.adLabel || '',
        city_slug: CITY_SLUG,
        link_url: adEl.href || ''
      });
      return;
    }
    var spotEl = event.target.closest('[data-spot-click]');
    if (spotEl) {
      trackEvent('spot_click', { spot_name: spotEl.dataset.spotClick || '', city_slug: CITY_SLUG });
      return;
    }
    var tsEl = event.target.closest('[data-spot-video-click]');
    if (tsEl) {
      trackEvent('spot_video_click', {
        spot_name: tsEl.dataset.spotVideoClick || '',
        ts_label: tsEl.textContent || '',
        city_slug: CITY_SLUG
      });
      return;
    }
    var tocEl = event.target.closest('[data-toc-click]');
    if (tocEl) {
      trackEvent('toc_click', {
        section_label: tocEl.dataset.tocClick || '',
        city_slug: CITY_SLUG
      });
    }
  });
})();
'''


def build_city_page(city, timing, spots, stay, rules, route, vindex, videos, related_cities=None, country_page_url=''):
    city_id = city['city_id']
    slug = city_id.lower()
    name = city.get('city_name_ko', city_id)
    country = COUNTRY_NAME.get(city.get('country_code', ''), '')
    alpha2 = COUNTRY_ALPHA2.get(city.get('country_code', ''), '')
    hero_img = city.get('hero_image_url', '').strip()
    # 스팟 사진(photo_url)과 똑같은 방식 — Imgur 같은 외부 서비스 대신 저장소 안
    # 이미지 경로(예: images/cities/jp-kagawa/hero.jpg)를 써도 되도록, http(s) 주소가
    # 아니면 사이트 맨 위 기준 절대경로가 되게 앞에 "/"를 자동으로 붙여줍니다.
    if hero_img and not hero_img.startswith('http') and not hero_img.startswith('/'):
        hero_img = '/' + hero_img
    hero_style = ''
    if hero_img:
        hero_style = (
            ' style="background-image:linear-gradient(150deg, rgba(8,8,8,0.82) 0%, '
            "rgba(15,15,15,0.5) 55%, rgba(20,20,20,0.28) 100%), url('" + e(hero_img) + "'); "
            'background-size:cover; background-position:center;"'
        )

    # 공유(카카오톡 등) 미리보기 이미지 — 도시마다 다른 hero_image_url이 있으면 그 사진을,
    # 없으면 기존 공용 이미지를 씁니다. hero_img는 이미 위에서 "/"로 시작하는 절대경로나
    # http(s) 주소로 정리돼 있어서, 절대 URL(https://...)로만 한 번 더 바꿔줍니다.
    if hero_img:
        og_image = hero_img if hero_img.startswith('http') else SITE + hero_img
    else:
        og_image = SITE + '/images/og-image.jpg'

    # 숙소 예약(트립닷컴) — 도시 하나당 링크 1개만. "어느 구역에 묵을까" 섹션 맨
    # 아래에 버튼으로 붙습니다. 시트 칸이 비어있으면 버튼 자체가 안 뜹니다.
    trip_com_url = (city.get('trip_com_url') or '').strip()

    # 같은 나라의 다른 "공개된" 도시 페이지로 가는 링크(도시 페이지 하단). 아직 준비
    # 중(비공개)인 페이지는 링크하지 않습니다 — main()에서 country_code 기준으로 미리
    # 골라서 넘겨줍니다.
    related_cities = related_cities or []
    related_links = ' · '.join(
        f'<a href="/city/{e(r["slug"])}/">{e(r["name"])}</a>' for r in related_cities
    )

    global _PUBLISHED
    is_published = is_city_published(city)
    _PUBLISHED = is_published

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
        {'<p class="tc">' + e(t.get('tc_warn (직접)')) + '</p>' if t.get('tc_warn (직접)') else ('' if is_published else '<p class="tc tc-empty">' + slot('Timing.tc_warn', '트콤이 직접 겪은 주의점 한 줄') + '</p>')}
      </li>''')

    spots_html = []
    for area in areas:
        items = [s for s in spots if s['area'] == area]
        cards = []
        for s in items:
            note = s.get('tc_note (한 줄)', '')
            fact = s.get('fact_note (사전조사)', '')
            ts = s.get('video_ts', '')
            map_url = s.get('map_url', '').strip()
            # 실제 예약 가능한 티켓/투어 상품이 있는 스팟에만 채우는 칸입니다. 둘 다
            # 비어있으면 버튼 자체가 안 뜨고(map_url과 같은 방식), 어느 한쪽만 채워도
            # 그쪽 버튼만 뜹니다.
            klook_url = s.get('klook_url', '').strip()
            myrealtrip_url = s.get('myrealtrip_url', '').strip()
            # 시트에 "images/spots/..."처럼 맨 앞 슬래시 없이 적어도, 도시 페이지는
            # city/도시코드/ 하위 경로에 있어서 사이트 맨 위 기준 절대경로로 안 잡아주면
            # 엉뚱한 위치에서 이미지를 찾게 됩니다. http(s) 주소가 아니면 앞에 "/"를 붙여줍니다.
            photo = s.get('photo_url', '').strip()
            if photo and not photo.startswith('http') and not photo.startswith('/'):
                photo = '/' + photo
            alt = alt_names(s.get('spot_name_en'), s.get('spot_name_local'))
            spot_name_ko = (s.get('spot_name_ko') or '').strip()
            photo_alt = (spot_name_ko + ' 사진') if spot_name_ko else ''
            photo_html = (
                '<span class="spot-photo"><img src="' + e(photo) + '" alt="' + e(photo_alt) + '" loading="lazy"></span>'
                if photo else ''
            )
            cards.append(f'''
        <li class="spot{' has-photo' if photo else ''}">
          {photo_html}
          <div class="spot-body">
            <div class="spot-head">
              {grade_badge(s.get('tc_grade'), 'Spots.tc_grade')}
              <span class="spot-name">{e(s.get('spot_name_ko'))}</span>
              {'<a class="ts" href="#video-index" data-spot-video-click="' + e(spot_name_ko) + '">' + e(ts) + '</a>' if ts else ''}
              {'<a class="map-link" data-spot-click="' + e(spot_name_ko) + '" href="' + e(map_url) + '" target="_blank" rel="noopener noreferrer" aria-label="구글지도에서 위치 보기" title="구글지도에서 위치 보기"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"></path><circle cx="12" cy="10" r="2.5"></circle></svg></a>' if map_url else ''}
            </div>
            {'<p class="spot-alt">' + e(alt) + '</p>' if alt else ''}
            {'<p class="tc">' + e(note) + '</p>' if note else ('' if is_published else '<p class="tc tc-empty">' + slot('Spots.tc_note', '왜 이 등급인지 20자 내외') + '</p>')}
            {'<p class="fact">' + e(fact) + '</p>' if fact else ''}
            {(
                '<div class="book-actions">'
                + ('<a class="book-btn" data-ad-network="klook" data-ad-placement="city_spot_card" data-ad-label="' + e(spot_name_ko) + '" href="' + e(klook_url) + '" target="_blank" rel="noopener noreferrer">클룩에서 티켓 예약</a>' if klook_url else '')
                + ('<a class="book-btn" data-ad-network="myrealtrip" data-ad-placement="city_spot_card" data-ad-label="' + e(spot_name_ko) + '" href="' + e(myrealtrip_url) + '" target="_blank" rel="noopener noreferrer">마이리얼트립에서 투어 보기</a>' if myrealtrip_url else '')
                + '</div>'
            ) if (klook_url or myrealtrip_url) else ''}
          </div>
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
        {'<p class="tc">' + e(rec) + '</p>' if rec else ('' if is_published else '<p class="tc tc-empty">' + slot('Rules.recommendation', '이 조건이면 어떻게 하라고 할 것인가') + '</p>')}
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
        {'<p class="tc">' + e(note) + '</p>' if note else ('' if is_published else '<p class="tc tc-empty">' + slot('Stay.tc_note', '이 구역을 고르는 이유 한 줄') + '</p>')}
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

    videos_html = []
    for v in videos:
        vid = v.get('video_id', '')
        vtitle = v.get('_title', '')
        vdate = v.get('_date', '')
        vdate_disp = vdate.replace('-', '.') if vdate else ''
        ex = is_example(vid)
        thumb = f'https://img.youtube.com/vi/{vid}/hqdefault.jpg' if vid else ''
        vthumb_alt = vtitle if vtitle else f'{name} 여행 영상'
        videos_html.append(f'''
        <button class="vcard{' is-example' if ex else ''}" type="button" data-video-id="{e(vid)}" aria-label="영상 재생">
          <span class="vcard-thumb">
            {'<img src="' + e(thumb) + '" alt="' + e(vthumb_alt) + '" loading="lazy">' if thumb else ''}
            <span class="vcard-play"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.45)"/><path d="M9.5 7.5v9l8-4.5z" fill="#fff"/></svg></span>
            {'<span class="ex-tag" style="position:absolute;top:6px;right:6px;">예시</span>' if ex else ''}
          </span>
          <span class="vcard-body">
            {'<span class="vcard-title">' + e(vtitle) + '</span>' if vtitle else ''}
            {'<span class="vcard-date">' + e(vdate_disp) + ' 공개</span>' if vdate_disp else ''}
          </span>
        </button>''')

    tagline = city.get('hero_tagline', '')
    one_line = city.get('tc_one_line', '')
    checked = city.get('checked_at', '')
    grades_filled = len([s for s in spots if s.get('tc_grade')])

    toc_items = []
    if timing:
        toc_items.append(('timing', '핵심 조언'))
    if rules:
        toc_items.append(('rules', '조건별 팁'))
    if spots:
        toc_items.append(('spots', '가볼 곳'))
    if stay:
        toc_items.append(('stay', '숙소'))
    toc_html = ''.join(f'<a href="#{sec_id}" data-toc-click="{label}">{label}</a>' for sec_id, label in toc_items)

    title_h1 = f'{name}, 뭘 보고 뭘 버릴까'
    title_tag = f'{name} 여행, 뭘 보고 뭘 버릴까 · 트립콤파니 여행지도'
    meta_desc = one_line or tagline or f'{name} 여행에서 예약이 필요한 곳, 시간 제약이 있는 곳, 그리고 트립콤파니가 직접 가보고 내린 판정.'

    jsonld = f'''{{
  "@context": "https://schema.org",
  "@type": "TravelGuide",
  "name": "{e(name)} 여행 가이드 · 트립콤파니 여행지도",
  "url": "{SITE}/city/{slug}/",
  "image": "{e(og_image)}",
  "about": {{ "@type": "Place", "name": "{e(name)}", "address": {{ "@type": "PostalAddress", "addressCountry": "{alpha2}" }} }},
  "publisher": {{ "@type": "Organization", "name": "트립콤파니" }}
}}'''

    # 아직 아무 탭도 채워지지 않은 도시는 페이지를 만들지 않고 건너뜁니다.
    has_any = timing or spots or stay or rules or route or vindex or videos or tagline or one_line
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

    spots_section = ''
    if spots:
        spots_section = f'''
<section id="spots" style="background:var(--panel); border-top:1px solid var(--border); border-bottom:1px solid var(--border);">
  <div class="wrap">
    <h2>가볼 곳 판정{'' if is_published else f' <span style="font-size:0.85rem; font-weight:500; color:var(--ink-soft);">({grades_filled}/{len(spots)}곳 판정 완료)</span>'}</h2>
    <p class="section-sub">
      <span class="grade grade-must">필수</span> 이거 안 보면 온 의미 없음 ·
      <span class="grade grade-reco">권장</span> 그 구역 가면 꼭 들러야 함 ·
      <span class="grade grade-maybe">시간 되면</span> 일정 빠듯하면 버려도 됨 ·
      <span class="grade grade-skip">굳이</span> 그렇게 권장하지 않음 ·
      <span class="grade grade-taste">취향별</span> 호불호 갈림, 취향 맞으면 가볼 만함
    </p>
    {''.join(spots_html)}
  </div>
</section>'''

    stay_section = ''
    if stay:
        stay_section = f'''
<section id="stay" style="background:var(--panel); border-top:1px solid var(--border); border-bottom:1px solid var(--border);">
  <div class="wrap">
    <h2>어느 구역에 묵을까</h2>
    <p class="section-sub">호텔 하나를 찍어주지 않고 <strong>구역</strong>으로 답합니다.</p>
    <p class="section-sub" style="margin-top:-14px;">
      <span class="grade grade-must">추천</span> 고민되면 여기, 도시당 1곳만 ·
      <span class="grade grade-maybe">조건부</span> 특정 조건일 때만 ·
      <span class="grade grade-skip">비추천</span> 여기는 잡지 마세요
    </p>
    <ul class="stay-list">{''.join(stay_html)}</ul>
    {(
        '<div class="stay-cta"><a href="' + e(trip_com_url) + '" target="_blank" rel="noopener noreferrer">'
        + e(name) + ' 숙소 보러 가기 (트립닷컴)</a></div>'
    ) if trip_com_url else ''}
  </div>
</section>'''

    vindex_section = ''
    if vindex:
        vindex_section = f'''
<section id="video-index" style="background:var(--panel); border-top:1px solid var(--border);">
  <div class="wrap">
    <h2>영상에서 바로 찾아보기</h2>
    <p class="section-sub">글로 옮기지 않고 해당 장면으로 보냅니다.</p>
    <ul class="vi-list">{''.join(vindex_html)}</ul>
  </div>
</section>'''

    videos_section = ''
    if videos:
        videos_section = f'''
<section id="videos" class="videos-section">
  <div class="wrap">
    <h2>트립콤파니가 다녀온 영상</h2>
    <p class="section-sub">눌러서 바로 재생 · 옆으로 넘겨서 더 보기</p>
    <div class="vscroll-wrap">
      <button class="vscroll-arrow prev" type="button" aria-label="이전 영상" data-vscroll="prev">&#8249;</button>
      <div class="vscroll" id="vscroll">{''.join(videos_html)}</div>
      <button class="vscroll-arrow next" type="button" aria-label="다음 영상" data-vscroll="next">&#8250;</button>
    </div>
  </div>
</section>'''

    page = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- {'검색엔진에 공개된 페이지입니다 (Cities.published = Y).' if is_published else '아직 준비 단계라 검색엔진에는 노출하지 않습니다. Cities.published 열을 Y로 바꾸면 공개됩니다.'} -->
<meta name="robots" content="{'index, follow' if is_published else 'noindex, nofollow'}">
<title>{e(title_tag)}</title>
<meta name="description" content="{e(meta_desc)}">
<link rel="canonical" href="{SITE}/city/{slug}/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="트립콤파니 여행지도">
<meta property="og:title" content="{e(title_h1)}">
<meta property="og:url" content="{SITE}/city/{slug}/">
<meta property="og:image" content="{e(og_image)}">
<script type="application/ld+json">{jsonld}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-54V354TPYY"></script>
<script src="/analytics.js"></script>
<style>{PAGE_CSS}</style>
</head>
<body data-city-slug="{slug}">

{'' if is_published else '<div class="preview-bar"><b>자동 생성 미리보기</b> — 구글시트가 바뀔 때마다 자동으로 다시 만들어집니다. 보라색 점선은 <b>아직 비어 있는 시트 칸</b>입니다.</div>'}

<div class="hero"{hero_style}>
  <div class="wrap">
    <p class="eyebrow">{e(country)} · {e(name)}</p>
    <h1>{e(title_h1)}</h1>
    <p class="tagline">{e(tagline) if tagline else slot('Cities.hero_tagline', '요약이 아니라 판정 한 문장')}</p>
    {'<p class="tagline" style="font-size:0.95rem; opacity:0.92;">' + e(one_line) + '</p>' if one_line else ''}
    <span class="checked">정보 기준: {e(checked) if checked else ('' if is_published else '— (Cities.checked_at 비어 있음)')}</span>
    {'' if (hero_img or is_published) else '<div style="margin-top:10px;">' + slot('Cities.hero_image_url', '도시 사진 없음 (헤더 배경)') + '</div>'}
  </div>
</div>

{'<nav class="toc-bar"><div class="wrap">' + toc_html + '</div></nav>' if toc_items else ''}

{videos_section}

{'<section class="timing" id="timing"><div class="wrap"><h2>놓치면 여행이 망가지는 것</h2><p class="section-sub">예약·간조·영업시간처럼 <strong>가서 알면 늦는 것</strong>만 모았습니다.</p><ul class="timing-list">' + ''.join(timing_html) + '</ul></div></section>' if timing else ''}

{'<section id="rules"><div class="wrap"><h2>당신의 조건이면 이렇게 하세요</h2><p class="section-sub">같은 도시라도 렌터카 유무와 일정 길이에 따라 답이 달라집니다.</p><ul class="rule-list">' + ''.join(rules_html) + '</ul></div></section>' if rules else ''}

{spots_section}
{stay_section}
{route_section}
{vindex_section}

<footer>
  <div class="wrap">
    <p style="margin:0 0 8px; font-weight:700;">트립콤파니 여행지도</p>
    {'<p style="margin:0 0 8px; opacity:0.85;">' + e(country) + '의 다른 도시 가이드 → ' + related_links + '</p>' if related_links else ''}
    {'<p style="margin:0 0 8px; opacity:0.85;">' + e(country) + ' 전체 가이드 보기 → <a href="' + e(country_page_url) + '">' + e(country) + ' 여행 가이드</a></p>' if country_page_url else ''}
    <p style="margin:0; opacity:0.8;">지도에서 다른 도시 보기 → <a href="/">tripcompany.world</a></p>
  </div>
</footer>

<a class="home-fab" href="/" aria-label="지도로 돌아가기" title="지도로 돌아가기">
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8"></path><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"></path></svg>
</a>

<button class="share-fab" id="shareFab" type="button" aria-label="이 페이지 링크 공유하기">
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"></path></svg>
  <span class="fab-text" id="shareFabLabel">공유</span>
</button>

{'<div class="vmodal" id="vmodal"><div class="vmodal-box"><div class="vmodal-frame-wrap" id="vmodalFrame"></div><button class="vmodal-close" type="button" id="vmodalClose">닫기 ✕</button></div></div>' if videos else ''}

{'<script>' + VIDEO_JS + '</script>' if videos else ''}
<script>{SHARE_JS}</script>
<script src="/cookie-consent.js"></script>
<script>{CITY_TRACKING_JS}</script>

</body>
</html>
'''
    return page, slug


def build_country_page(country, regions, rules, cities_by_region, season, basics, video_count=0):
    """국가 가이드 페이지 하나를 만듭니다. build_city_page와 원칙은 같습니다 —
    시트에 있는 값만 그리고, 없는 값은 slot()으로 빈 자리 표시를 합니다.
    이 나라에 대한 데이터가 어느 탭에도 하나도 없으면 페이지를 만들지 않고 건너뜁니다."""
    cc = (country.get('country_code') or '').strip()
    alpha2 = COUNTRY_ALPHA2.get(cc, '')
    slug = alpha2.lower()
    name = country.get('country_name_ko') or COUNTRY_NAME.get(cc, '') or cc

    has_any = bool(
        regions or rules or cities_by_region or season or basics
        or country.get('hero_title') or country.get('tc_verdict')
    )
    if not slug or not has_any:
        return None, slug

    global _PUBLISHED
    is_published = is_country_published(country)
    _PUBLISHED = is_published

    title_h1 = country.get('hero_title') or f'{name} 여행, 어디로 갈까'
    verdict = country.get('tc_verdict', '')
    checked = country.get('checked_at', '')

    published_city_total = sum(
        1 for lst in cities_by_region.values() for c in lst if c.get('published')
    )

    hstats = [f'<span class="chip">다루는 도시 <b>{published_city_total}곳</b></span>']
    if video_count:
        hstats.append(f'<span class="chip">영상 <b>{video_count}편+</b></span>')

    regions_html = []
    for r in regions:
        rid = r.get('region_id', '')
        member_cities = cities_by_region.get(rid, [])
        city_names = ' · '.join(c['name'] for c in member_cities)
        who = r.get('tc_who', '')
        meta_bits = []
        if r.get('flight_time'):
            meta_bits.append(f'<span>인천 <b>{e(r["flight_time"])}</b></span>')
        if r.get('recommend_nights'):
            meta_bits.append(f'<span>추천 <b>{e(r["recommend_nights"])}</b></span>')
        regions_html.append(f'''
    <div class="rc">
      <div class="rtop"><h3>{e(r.get('region_name_ko'))}</h3></div>
      {'<div class="cities">' + e(city_names) + '</div>' if city_names else ''}
      <p class="who">{('<b>' + e(who) + '</b>') if who else ('' if is_published else slot('Regions.tc_who', '이 권역은 이런 사람이 갑니다'))}</p>
      {'<div class="meta">' + ''.join(meta_bits) + '</div>' if meta_bits else ''}
    </div>''')

    rules_html = []
    for r in rules:
        rec = r.get('recommendation (직접)', '')
        rules_html.append(f'''
    <div class="rule">
      <div class="q">{e(r.get('condition (조건)'))}</div>
      <div class="a">{e(rec) if rec else ('' if is_published else slot('Rules.recommendation', '이 조건이면 어디로 보낼 것인가'))}</div>
    </div>''')

    def _city_card(c):
        if c.get('published'):
            return f'''
      <a class="city" href="/city/{e(c['slug'])}/">
        <div class="n">{e(c['name'])}</div>
        {'<div class="t">' + e(c.get('one_line', '')) + '</div>' if c.get('one_line') else ''}
      </a>'''
        return f'''
      <div class="city soon">
        <span class="soon-badge">준비 중</span>
        <div class="n">{e(c['name'])}</div>
      </div>'''

    groups_html = []
    for r in regions:
        rid = r.get('region_id', '')
        member_cities = cities_by_region.get(rid, [])
        if not member_cities:
            continue
        cards = ''.join(_city_card(c) for c in member_cities)
        groups_html.append(f'''
    <div class="group">
      <div class="gname"><h3>{e(r.get('region_name_ko'))}</h3></div>
      <div class="cgrid">{cards}</div>
    </div>''')
    # region_id가 비어있는(아직 권역 배정 안 된) 도시들도 놓치지 않고 보여줍니다.
    unassigned = cities_by_region.get('', [])
    if unassigned:
        cards = ''.join(_city_card(c) for c in unassigned)
        groups_html.append(f'''
    <div class="group">
      <div class="gname"><h3>권역 미배정</h3></div>
      <div class="cgrid">{cards}</div>
    </div>''')

    season_rows = ''.join(
        f'<tr><td class="nm">{e(s.get("period"))}</td><td class="vd"><b>{e(s.get("recommend"))}</b></td>'
        f'<td>{e(s.get("avoid"))}</td><td>{e(s.get("note"))}</td></tr>'
        for s in season
    )

    basics_html = ''.join(
        f'<div class="bi"><div class="k">{e(b.get("key"))}</div><div class="v">{e(b.get("value"))}</div></div>'
        for b in basics
    )

    verdict_html = e(verdict) if verdict else ('' if is_published else slot('Countries.tc_verdict', '이 나라는 어떻게 고르라고 할 것인가, 한 문장'))

    page = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- {'검색엔진에 공개된 페이지입니다 (Countries.published = Y).' if is_published else '아직 준비 단계라 검색엔진에는 노출하지 않습니다. Countries 탭의 published 열을 Y로 바꾸면 공개됩니다.'} -->
<meta name="robots" content="{'index, follow' if is_published else 'noindex, nofollow'}">
<title>{e(title_h1)} · 트립콤파니 여행지도</title>
<meta name="description" content="{e(verdict) if verdict else e(name) + ' 여행, 어디로 갈지 도시별로 정리했습니다.'}">
<link rel="canonical" href="{SITE}/country/{slug}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="트립콤파니 여행지도">
<meta property="og:title" content="{e(title_h1)}">
<meta property="og:url" content="{SITE}/country/{slug}/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@700;800&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-54V354TPYY"></script>
<script src="/analytics.js"></script>
<style>{PAGE_CSS_COUNTRY}</style>
</head>
<body data-country-slug="{slug}">

{'' if is_published else '<div class="preview-bar"><b>자동 생성 미리보기</b> — 아직 비공개 상태입니다. Countries 탭의 published 열을 Y로 바꾸기 전까지는 검색엔진에 노출되지 않고, 지도·도시 페이지에서도 연결되지 않습니다.</div>'}

<nav><div class="wrap">
  <span class="brand">트립콤파니 여행지도</span>
  <span class="crumb"><a href="/">지도</a> › <b>{e(name)}</b></span>
</div></nav>

<div class="hero"><div class="wrap">
  <div class="kicker">국가 가이드 · {e(name)}</div>
  <h1>{e(title_h1)}</h1>
  <p class="verdict">{verdict_html}</p>
  <div class="hstats">{''.join(hstats)}</div>
</div></div>

<div class="wrap">

{'<section><div class="shead"><h2>권역부터 고르세요</h2></div><p class="lead">도시를 하나씩 보면 끝이 없습니다. 큰 덩어리를 먼저 정하면 나머지가 쉬워집니다.</p><div class="regions">' + ''.join(regions_html) + '</div></section>' if regions else ''}

{'<div class="hr"></div>' if regions and (rules or groups_html) else ''}

{'<section><div class="shead"><h2>이런 경우라면</h2></div><p class="lead">조건이 정해져 있으면 답도 거의 정해집니다.</p><div class="rules">' + ''.join(rules_html) + '</div></section>' if rules else ''}

{'<div class="hr"></div>' if rules and groups_html else ''}

{'<section><div class="shead"><h2>도시 ' + str(published_city_total) + '곳</h2></div><p class="lead">권역별로 묶었습니다. 이름을 누르면 그 도시의 가이드로 갑니다.</p>' + ''.join(groups_html) + '</section>' if groups_html else ''}


{'<div class="hr"></div>' if groups_html and season else ''}

{'<section><div class="shead"><h2>언제 가나</h2></div><p class="lead">시기가 먼저 정해져 있다면 이 표부터 보세요.</p><div class="tw"><table><thead><tr><th>시기</th><th>추천</th><th>피할 곳</th><th>한 줄</th></tr></thead><tbody>' + season_rows + '</tbody></table></div></section>' if season else ''}

{'<div class="hr"></div>' if season and basics else ''}

{'<section><div class="shead"><h2>공통으로 챙길 것</h2></div><p class="lead">도시와 상관없이 나라 전체에 해당하는 것만 모았습니다.</p><div class="basics">' + basics_html + '</div>' + ('<p class="asof">정보 기준: ' + e(checked) + '</p>' if checked else '') + '</section>' if basics else ''}

</div>

<footer><div class="wrap">
  <p style="margin:0 0 8px; font-weight:700;">트립콤파니 여행지도</p>
  <p style="margin:0; opacity:0.8;">지도에서 다른 나라 보기 → <a href="/">tripcompany.world</a></p>
</div></footer>

</body>
</html>
'''
    return page, slug


def build_sitemap(published, published_countries=None):
    """공개(published) 상태인 도시/나라들의 주소를 sitemap.xml에 자동으로 반영합니다.
    사람이 매번 손으로 도시 한 줄씩 추가/삭제할 필요 없이, Cities.published /
    Countries.published 값만 바꾸면 이 파일이 그 다음 자동 빌드 때 알아서 최신
    상태로 다시 만들어집니다.
    (그래서 이 파일은 항상 이 스크립트가 통째로 새로 씁니다 — 수동으로 고쳐도 다음 실행 때 덮어써집니다.)"""
    today = datetime.date.today().isoformat()
    entries = [
        ('/', today, 'weekly', '1.0'),
        ('/privacy.html', today, 'monthly', '0.3'),
    ]
    for _cid, slug, checked in published:
        lastmod = checked.strip() if checked and checked.strip() else today
        entries.append((f'/city/{slug}/', lastmod, 'weekly', '0.7'))
    for _cc, slug, checked in (published_countries or []):
        lastmod = checked.strip() if checked and checked.strip() else today
        entries.append((f'/country/{slug}/', lastmod, 'weekly', '0.8'))

    urls = []
    for path_part, lastmod, changefreq, priority in entries:
        urls.append(
            f'  <url>\n    <loc>{SITE}{path_part}</loc>\n'
            f'    <lastmod>{e(lastmod)}</lastmod>\n'
            f'    <changefreq>{changefreq}</changefreq>\n'
            f'    <priority>{priority}</priority>\n  </url>'
        )
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + '\n'.join(urls) + '\n</urlset>\n')


def main(local_files=None):
    cities = fetch_csv('Cities', CSV_URLS['Cities'], local_files)

    # 나라(country_code)별로 "공개된" 도시 목록을 미리 만들어둡니다 — 도시 페이지
    # 하단에 같은 나라의 다른 도시로 가는 링크를 넣기 위해서입니다. country_code가
    # 비어있는 도시는 묶을 기준이 없으니 건너뜁니다.
    published_by_country = {}
    for c in cities:
        if not is_city_published(c):
            continue
        cc = (c.get('country_code') or '').strip()
        if not cc:
            continue
        published_by_country.setdefault(cc, []).append({
            'city_id': c['city_id'],
            'slug': c['city_id'].lower(),
            'name': c.get('city_name_ko', c['city_id']),
        })
    for _cc, _lst in published_by_country.items():
        _lst.sort(key=lambda r: r['name'])
    timing_all = fetch_csv('Timing', CSV_URLS['Timing'], local_files)
    spots_all = fetch_csv('Spots', CSV_URLS['Spots'], local_files)
    stay_all = fetch_csv('Stay', CSV_URLS['Stay'], local_files)
    rules_all = fetch_csv('Rules', CSV_URLS['Rules'], local_files)
    route_all = fetch_csv('Route', CSV_URLS['Route'], local_files)
    vindex_all = fetch_csv('VideoIndex', CSV_URLS['VideoIndex'], local_files)
    # CSV_URLS['Videos']가 실제 주소가 아니면(설정 전이면) 조용히 건너뜁니다.
    if local_files and 'Videos' in local_files:
        videos_all = fetch_csv('Videos', CSV_URLS['Videos'], local_files)
    elif CSV_URLS.get('Videos', '').startswith('http'):
        videos_all = fetch_csv('Videos', CSV_URLS['Videos'], local_files)
    else:
        videos_all = []

    def _optional_csv(key):
        """국가 페이지용 탭은 아직 시트에 없을 수 있습니다. URL이 안 채워져 있으면
        (테스트용 local_files에도 없으면) 조용히 빈 리스트를 돌려줍니다."""
        url = CSV_URLS.get(key, '')
        if local_files and key in local_files:
            return fetch_csv(key, url, local_files)
        if url.startswith('http'):
            return fetch_csv(key, url, local_files)
        return []

    countries_all = _optional_csv('Countries')
    regions_all = _optional_csv('Regions')
    season_all = _optional_csv('Season')
    basics_all = _optional_csv('Basics')

    cities_by_country = {}
    for c in cities:
        ccc = (c.get('country_code') or '').strip()
        if ccc:
            cities_by_country.setdefault(ccc, []).append(c)

    country_page_url = {}  # country_code -> 그 나라 페이지 절대경로(공개된 경우만)
    published_countries = []
    country_made = []
    for country in countries_all:
        ccc = (country.get('country_code') or '').strip()
        if not ccc:
            continue
        c_regions = sorted(
            [r for r in regions_all if (r.get('country_code') or '').strip() == ccc],
            key=lambda r: r.get('region_name_ko', '')
        )
        c_alpha2 = COUNTRY_ALPHA2.get(ccc, '')
        c_rules = [r for r in rules_all if (r.get('city_id') or '').strip().upper() == c_alpha2]
        c_season = [s for s in season_all if (s.get('country_code') or '').strip() == ccc]
        c_basics = [b for b in basics_all if (b.get('country_code') or '').strip() == ccc]

        cities_by_region = {}
        for c in cities_by_country.get(ccc, []):
            rid = (c.get('region_id') or '').strip()
            cities_by_region.setdefault(rid, []).append({
                'city_id': c['city_id'],
                'slug': c['city_id'].lower(),
                'name': c.get('city_name_ko', c['city_id']),
                'one_line': c.get('tc_one_line', ''),
                'published': is_city_published(c),
            })
        for _lst in cities_by_region.values():
            _lst.sort(key=lambda x: x['name'])

        country_city_ids = {c['city_id'] for c in cities_by_country.get(ccc, [])}
        video_count = sum(1 for v in videos_all if v.get('city_id') in country_city_ids)

        c_page, c_slug = build_country_page(
            country, c_regions, c_rules, cities_by_region, c_season, c_basics, video_count
        )
        if c_page is None:
            continue
        c_out_dir = os.path.join(OUT_ROOT_COUNTRY, c_slug)
        os.makedirs(c_out_dir, exist_ok=True)
        with open(os.path.join(c_out_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(c_page)
        country_made.append((ccc, c_slug))
        if is_country_published(country):
            published_countries.append((ccc, c_slug, country.get('checked_at', '')))
            country_page_url[ccc] = f'/country/{c_slug}/'

    made = []
    skipped = []
    published = []
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
        videos = [r for r in videos_all if r.get('city_id') == cid and r.get('video_id')]
        for v in videos:
            v['video_id'] = extract_video_id(v.get('video_id', ''))
            v['_title'] = fetch_video_title(v.get('video_id', ''))
            v['_date'] = fetch_video_published_date(v.get('video_id', ''))
        # 아직 비공개(비공개/일부공개 등)라 유튜브에서 제목을 못 가져온 영상은
        # 화면에 깨진 카드로 보이지 않도록 아예 숨깁니다. 나중에 그 영상이 공개로
        # 바뀌면 다음 자동 빌드 때 제목을 가져오는 데 성공해서 저절로 나타납니다.
        videos = [v for v in videos if is_example(v.get('video_id', '')) or v.get('_title')]

        cc = (city.get('country_code') or '').strip()
        related_cities = [
            r for r in published_by_country.get(cc, []) if r['city_id'] != cid
        ]
        page, slug = build_city_page(city, timing, spots, stay, rules, route, vindex, videos, related_cities, country_page_url.get(cc, ''))
        if page is None:
            skipped.append(cid)
            continue
        out_dir = os.path.join(OUT_ROOT, slug)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(page)
        made.append((cid, slug, len(spots)))
        if is_city_published(city):
            published.append((cid, slug, city.get('checked_at', '')))

    sitemap_path = os.path.join(REPO_ROOT, 'sitemap.xml')
    with open(sitemap_path, 'w', encoding='utf-8') as f:
        f.write(build_sitemap(published, published_countries))

    # 지도 화면(index.html/app.js)이 "이 도시는 안내 페이지가 있다"는 걸
    # 알 수 있도록, 공개된 도시의 city_id 목록만 따로 내보냅니다. 지도 쪽
    # Cities 탭과 이 시트(핵심_도시페이지) 둘 다 같은 city_id(예: JP-TOKYO)를
    # 쓴다는 전제로 만들었습니다 — 다르면 이 파일만으로는 매칭이 안 됩니다.
    published_ids_path = os.path.join(OUT_ROOT, 'published.json')
    with open(published_ids_path, 'w', encoding='utf-8') as f:
        json.dump(sorted({cid for cid, _slug, _checked in published}), f, ensure_ascii=False)

    print('생성 완료:', len(made), '개 도시')
    for cid, slug, n in made:
        print(f'  - {cid} -> city/{slug}/index.html (스팟 {n}개)')
    if skipped:
        print('건너뜀(아직 아무 탭도 안 채워짐):', ', '.join(skipped))
    print('sitemap.xml 갱신 완료 (공개 도시', len(published), '개, 공개 국가', len(published_countries), '개 포함)')
    if country_made:
        print('국가 페이지 생성:', len(country_made), '개')
        for ccc, c_slug in country_made:
            pub_mark = '공개' if any(x[0] == ccc for x in published_countries) else '비공개(미리보기)'
            print(f'  - {ccc} -> country/{c_slug}/index.html ({pub_mark})')


if __name__ == '__main__':
    main()
