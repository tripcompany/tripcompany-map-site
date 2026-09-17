/* =========================================================
 * 트립컴퍼니 도시 가이드 페이지 (city.html) 전용 로직
 *
 * 이 페이지는 지도(index.html/app.js)와는 별도의 "도시 하나짜리 상세
 * 페이지"입니다. 아직 실제 공개용은 아니고 준비 단계라서, 어디에도 링크가
 * 걸려있지 않습니다 — 아래 주소로 직접 열어서 미리 확인하는 용도입니다.
 *
 *   city.html?id=도시ID   (예: city.html?id=JP-TOKYO)
 *   id를 안 붙이고 그냥 열면 아직 준비 안 된 도시도 바로 느낌을 볼 수 있게
 *   "상하이" 예시 데이터로 채워서 보여줍니다.
 *
 * 데이터는 기존 지도와 같은 구글시트를 그대로 재사용합니다(Countries/
 * Cities/Videos/LocalAds). 이 페이지 전용으로 새로 만들어야 하는 탭은
 * 아래 CONFIG.csv의 cityPages/cityStay/cityTours/citySpots/cityBudget
 * 다섯 개뿐이고, 자주 묻는 질문(FAQ)은 탭이 아니라 "도시별 구글독스 문서
 * 1개"에서 가져옵니다. 전부 비워두면 에러 없이 "상하이" 예시로만 동작하고,
 * 하나씩 채워 넣을 때마다 그 부분만 실제 내용으로 바뀝니다.
 * ========================================================= */

const CONFIG = {
  // 기존 지도(app.js)에 이미 등록된 시트를 그대로 재사용합니다. 값이
  // app.js의 CONFIG.csv와 다르면 안 되므로, 나중에 시트 구조를 바꾸면
  // 이 페이지도 함께 손봐야 합니다.
  csv: {
    countries: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=831903528&single=true&output=csv",
    cities: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=682817820&single=true&output=csv",
    videos: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=838162849&single=true&output=csv",
    // 도시/나라별 맞춤 제휴 광고 — 지도와 완전히 같은 탭을 그대로 재사용해서
    // "로컬 특가" 자리에 보여줍니다. 지도에서 이미 켜져 있으면 여기서도
    // 자동으로 같이 켜집니다.
    localAds: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=1988500641&single=true&output=csv",

    // ↓↓↓ 아래 다섯 개는 도시 가이드 페이지 전용 "새" 탭입니다. 구글시트에
    // 탭을 새로 만들고 File → 공유 → 웹에 게시(Publish to web)에서
    // "쉼표로 구분된 값(.csv)"로 게시한 뒤 그 링크를 여기 붙여넣으세요
    // (README "도시 가이드 페이지" 항목에 탭별 열 이름과 예시가 있습니다).
    // 비워두면 그 섹션만 "상하이" 예시 데이터(id를 안 줬을 때) 또는
    // "준비 중이에요" 안내 문구로 대신 표시될 뿐, 나머지 섹션과 페이지
    // 전체 동작에는 전혀 영향이 없습니다.

    // CityPages: city_id, hero_tagline, best_season, flight_time,
    //            currency_code, currency_name_ko, price_level, faq_doc_url
    cityPages: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=401342820&single=true&output=csv",
    // CityStay: city_id, tier, area_name, transit_note, price_range, comment
    //   (예약 버튼은 지역별로 따로 두지 않고 아래 CONFIG.agoda로 만든
    //    "도시 전체" 링크 하나만 씁니다 — 바로 아래 주석 참고.)
    cityStay: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=1112316236&single=true&output=csv",
    // CityTours: city_id, rank, name, price_from, comment, link_url
    cityTours: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=1762203244&single=true&output=csv",
    // CitySpots: city_id, timeslot, place_name, note
    citySpots: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=713349070&single=true&output=csv",
    // CityBudget: city_id, item, range, comment
    //   (여행 기간이 3박이든 일주일이든 사람마다 달라서, 항목별 예상
    //    범위만 보여주고 합계는 따로 계산하지 않습니다.)
    cityBudget: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=1346214685&single=true&output=csv"
  },

  // 아고다(Agoda) 숙소 예약 제휴 — app.js의 CONFIG.agoda.cid와 똑같은
  // 값을 넣어주세요. "숙소 제안" 섹션의 지역 카드(가성비/중급/럭셔리 등)는
  // 정보와 코멘트만 보여주고, 예약 버튼은 이 cid로 만든 "그 도시 전체"
  // 검색 링크로 가는 버튼 하나만 아래에 둡니다.
  //
  // (아고다가 "이 지역만", "이 가격대만" 걸러서 보여주는 딥링크를
  // 지원하는지 확인해봤는데 안 되는 걸로 확인돼서, 지역 카드마다 버튼을
  // 따로 두는 대신 이렇게 하나로 정리했습니다. 나중에 그런 딥링크가
  // 되는 제휴 링크를 찾으면 그때 지역별 버튼으로 다시 나눌 수 있습니다.)
  agoda: {
    cid: ""
  },

  // 여행 준비물 2가지(eSIM/유심, 여행자보험)는 도시마다 다르지 않고 사이트
  // 전체가 같이 쓰는 제휴 링크라 시트가 아니라 여기 직접 넣습니다.
  prep: {
    esimUrl: "",
    insuranceUrl: ""
  },

  // 하단 "여행하는트콤 구독하기" 버튼이 이동할 채널 주소입니다.
  trekomChannelUrl: ""
};

/* ---------- CSV 유틸 (app.js와 동일한 로직) ---------- */

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // 무시 (\r\n 줄바꿈 대응)
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvToObjects(text) {
  const rows = parseCsv(text).filter((r) => !(r.length === 1 && r[0].trim() === ""));
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] !== undefined ? r[idx].trim() : "";
    });
    return obj;
  });
}

async function fetchCsv(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV를 불러오지 못했습니다 (${res.status})`);
  const text = await res.text();
  return csvToObjects(text);
}

/* 탭 URL이 비어있거나 불러오는 데 실패해도 그 섹션만 빈 채로 남을 뿐, 페이지
 * 전체는 항상 정상적으로 뜨도록 감싸는 헬퍼입니다(app.js의 loadLocalAds
 * 등과 동일한 패턴). */
async function fetchCityTab(url) {
  if (!url) return [];
  try {
    return await fetchCsv(url);
  } catch (err) {
    console.warn("도시 페이지용 시트를 하나 불러오지 못했습니다(해당 섹션만 비어있는 상태로 표시됩니다).", err);
    return [];
  }
}

/* ---------- 그 외 유틸 (app.js와 동일한 로직) ---------- */

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

function extractYoutubeId(url) {
  if (!url) return "";
  const m = String(url).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/
  );
  return m ? m[1] : "";
}

const CHANNEL_LABEL = { trip: "트립콤파니", trekom: "여행하는트콤" };

function normalizeChannel(raw) {
  return String(raw || "").trim() === "여행하는트콤" ? "trekom" : "trip";
}

/* 영상 하나가 여러 도시를 다룰 수 있어서(예: "JP-TOKYO,JP-OSAKA"), 쉼표로
 * 나눠 배열로 돌려줍니다 — app.js의 videoCityIds와 동일합니다. */
function videoCityIds(video) {
  return String(video.city_id || "")
    .split(/[,;]/)
    .map((id) => id.trim())
    .filter(Boolean);
}

/* ---------- 아이콘 (고정된 SVG라 안전하게 그대로 삽입) ---------- */

const ICON_CALENDAR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>';
const ICON_COIN = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5-1.3 2-3 2.5-3 1.1-3 2.5 1.3 2.5 3 2.5 3-1.1 3-2.5"/></svg>';
const ICON_PLANE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16l20-7-7 20-3-8-8-3-2-2z"/></svg>';
const ICON_SIM = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h3"/></svg>';
const ICON_SHIELD = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>';
const ICON_CHEVRON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const TIMESLOT_ICONS = { "아침": "🌅", "오후": "☀️", "저녁": "🌆", "밤": "🌙" };

/* ---------- 미리보기용 예시 데이터 (상하이) ----------
 * 아직 구글시트/독스에 아무것도 채우지 않았어도, city.html을
 * "city.html?id=CN-SHANGHAI"로 열거나 id 없이 그냥 열면 이 예시 내용으로
 * 채워져서 완성됐을 때 느낌을 바로 확인할 수 있습니다. 다른 도시 id로 열면
 * (예: city.html?id=JP-TOKYO) 이 예시는 쓰이지 않고, 시트에 아직 데이터가
 * 없는 섹션은 "준비 중이에요" 안내만 표시됩니다. */

const SAMPLE_CITY_ID = "CN-SHANGHAI";

const SAMPLE_CITY = {
  meta: {
    city_name_ko: "상하이",
    country_name_ko: "중국",
    hero_tagline: "낮에는 옛 골목 사이 카페, 밤에는 와이탄 스카이라인 — 하루 안에 두 개의 도시를 만나는 곳.",
    best_season: "3~5월 · 9~11월",
    flight_time: "인천에서 2시간 10분",
    currency_code: "CNY",
    currency_name_ko: "위안",
    price_level: "중간"
  },
  videos: [
    { title: "상하이를 0부터 제대로 알려드림", guide_name: "지역 가이드", summary_ko: "비자·유심·숙소 위치까지, 처음 상하이를 준비할 때 헷갈리는 것들을 순서대로 정리했어요." },
    { title: "상하이 여행이 환상적이거나 파멸적인 15가지 이유", guide_name: "장단점", summary_ko: "좋았던 점과 별로였던 점을 가감없이 15개로 정리했어요. 일정 짜기 전에 한 번은 보고 가세요." },
    { title: "상하이 여행에서 해야하는 것들, 싹 다 알려드립니다", guide_name: "컨텐츠", summary_ko: "와이탄부터 골목 카페까지, 놓치면 아쉬운 경험들만 모아봤어요." },
    { title: "상하이 여행 핵심 꿀팁 7가지와 필수여행단어장 배포", guide_name: "여행팁", summary_ko: "현지에서 바로 쓰는 문장과 실수 방지 팁, 단어장까지 한 번에 담았어요." }
  ],
  stay: [
    { tier: "가성비", area_name: "인민광장 지역", transit_note: "지하철 2·8호선 도보 5분, 어디서 묵어도 이동이 편해요", price_range: "5~9만원대", comment: "[예시] 처음 상하이 오시면 일단 여기부터 잡으세요, 어디를 가든 동선이 꼬이질 않아요." },
    { tier: "중급", area_name: "신텐디 지역", transit_note: "옛 스쿠먼 골목 사이, 감성 카페가 몰려있는 동네", price_range: "10~18만원대", comment: "[예시] 하루쯤은 예쁜 카페에서 여유 부리고 싶다, 싶으시면 여기가 정답이에요." },
    { tier: "럭셔리", area_name: "와이탄 지역", transit_note: "강 건너 푸동 스카이라인이 보이는 리버뷰 숙소가 많아요", price_range: "25만원~", comment: "[예시] 창밖 야경 보려고 여행 왔다 싶을 정도로, 돈 값 하는 뷰예요." }
  ],
  tours: [
    { rank: "1", name: "와이탄 야경 크루즈", price_from: "4.9만원~", comment: "[예시 — 실제 코멘트로 교체] 상하이 처음 왔으면 이거 하나는 진짜 꼭 하세요, 사진보다 실물이 훨씬 나아요.", link_url: "" },
    { rank: "2", name: "동방명주 전망대 패스트트랙", price_from: "3.2만원~", comment: "[예시] 대기 줄만 30분 넘게 봤어요, 패스트트랙 값 그대로 하는 곳입니다.", link_url: "" },
    { rank: "3", name: "주가각 수향마을 당일투어", price_from: "5.5만원~", comment: "[예시] 시내랑 완전히 다른 느낌이라 하루 정도는 빼서 다녀올 만해요.", link_url: "" },
    { rank: "4", name: "상하이 서커스 관람권", price_from: "6.1만원~", comment: "[예시] 호불호는 갈리는데, 아이 동반이면 반응이 제일 좋았어요.", link_url: "" },
    { rank: "5", name: "티엔즈팡 골목 미식투어", price_from: "4.4만원~", comment: "[예시] 배 든든히 채우고 가세요, 먹다 보면 끝이 없어요.", link_url: "" }
  ],
  spots: [
    { timeslot: "아침", place_name: "와이탄 산책", note: "사람 적을 때가 제일 좋아요, 인민광장 지역 숙소면 가까워요" },
    { timeslot: "아침", place_name: "티엔즈팡 브런치 카페", note: "골목 사이 감성 카페가 많아요" },
    { timeslot: "오후", place_name: "위위안 정원", note: "전통 정원과 시장이 함께 있어요" },
    { timeslot: "오후", place_name: "난징동루 쇼핑", note: "걷기만 해도 구경거리가 많아요" },
    { timeslot: "저녁", place_name: "신텐디 디너", note: "옛 골목 사이 분위기 좋은 식당이 많아요, 신텐디 지역 숙소면 걸어서도 가능해요" },
    { timeslot: "저녁", place_name: "프랑스 조계지 골목", note: "가로수길과 유럽풍 건물이 이어져요" },
    { timeslot: "밤", place_name: "와이탄 야경", note: "강 건너 푸동 스카이라인이 진짜예요, 야경 크루즈로 더 가까이 볼 수 있어요" },
    { timeslot: "밤", place_name: "동방명주 전망대", note: "패스트트랙 예약 추천, 줄이 꽤 길어요" }
  ],
  budget: [
    { item: "항공권 (왕복)", range: "28~45만원", comment: "[예시] 화요일 출발 · 평일 귀국이면 이 범위 아래쪽도 자주 나와요." },
    { item: "숙소 (3박)", range: "20~90만원", comment: "[예시] 위 세 지역 기준으로 뽑은 범위예요, 성수기엔 한 단계 위로 잡아두는 걸 추천해요." },
    { item: "식비", range: "12~20만원", comment: "[예시] 로컬 식당 위주면 아래쪽, 신텐디 같은 관광지 근처면 위쪽에 가까워요." },
    { item: "투어 · 입장료", range: "10~18만원", comment: "[예시] 위 TOP5 중 두세 개만 골라도 이 정도면 충분해요." }
  ],
  faq: [
    { question: "[예시 질문] 상하이 여행에 비자가 필요한가요?", answerParagraphs: ["[예시 답변] 실제 답변으로 교체해주세요."] },
    { question: "[예시 질문] 여행하기 가장 좋은 시기는 언제인가요?", answerParagraphs: ["[예시 답변] 실제 답변으로 교체해주세요."] },
    { question: "[예시 질문] 구글맵을 쓸 수 있나요?", answerParagraphs: ["[예시 답변] 실제 답변으로 교체해주세요."] },
    { question: "[예시 질문] 신용카드가 잘 통용되나요?", answerParagraphs: ["[예시 답변] 실제 답변으로 교체해주세요."] },
    { question: "[예시 질문] 공항에서 시내까지 얼마나 걸리나요?", answerParagraphs: ["[예시 답변] 실제 답변으로 교체해주세요."] }
  ]
};

/* ---------- 아고다(Agoda) 링크 ----------
 * "숙소 제안" 섹션의 유일한 예약 버튼이 쓰는 링크입니다. app.js의
 * agodaLinkForSelection과 같은 방식(도시 슬러그 > 나라 슬러그 순서)이며,
 * 아고다가 지역/가격대별로 걸러진 딥링크를 지원하는지 확인되지 않아서
 * 처음엔 지역 카드마다 버튼을 하나씩 뒀었는데, 결국 다 같은 "도시 전체"
 * 링크로만 연결되는 게 오히려 오해를 줄 수 있어서 지금은 지역 카드
 * 아래에 이 링크로 가는 버튼 하나만 둡니다. 나중에 지역별 딥링크가 실제로
 * 되는 제휴 링크를 확인하게 되면 그때 다시 지역별 버튼으로 되돌릴 수
 * 있습니다. */

function agodaEnabled() {
  return !!(CONFIG.agoda && CONFIG.agoda.cid);
}

function agodaUrl(path) {
  const sep = path.includes("?") ? "&" : "?";
  return `https://www.agoda.com${path}${sep}cid=${encodeURIComponent(CONFIG.agoda.cid)}`;
}

function buildAgodaFallbackLink(data) {
  if (!agodaEnabled()) return "#";
  if (data.cityRow && data.cityRow.agoda_slug) {
    return agodaUrl(`/city/${data.cityRow.agoda_slug}.html`);
  }
  if (data.countryRow && data.countryRow.agoda_country_slug) {
    return agodaUrl(`/country/${data.countryRow.agoda_country_slug}/popular-hotels.html`);
  }
  return agodaUrl("/");
}

/* ---------- 자주 묻는 질문 — 구글독스에서 불러오기 ----------
 * CityPages 탭의 faq_doc_url 칸에 "웹에 게시"한 구글독스 링크를 넣어두면,
 * 그 문서를 그대로 불러와서 "제목(H1~H6)" 하나당 질문 하나, 그 아래
 * 이어지는 문단(P)들을 답변으로 인식해서 아코디언으로 보여줍니다.
 *
 * 문서 작성 규칙:
 *   - 질문은 "제목1" 같은 제목 스타일로 적어주세요 (본문 문단이 아니라
 *     반드시 제목 스타일이어야 질문으로 인식됩니다).
 *   - 그 아래에 답변을 일반 문단으로 이어서 적으면 됩니다(여러 문단
 *     가능). 다음 제목이 나오기 전까지의 문단을 모두 답변으로 묶습니다.
 *   - 문서를 File → 공유 → 웹에 게시(Publish to web)로 게시한 뒤 나온
 *     링크를 그대로 붙여넣으면 됩니다.
 *
 * 시트 값을 그대로 HTML로 꽂아넣지 않도록(보안), 문서에서는 텍스트만
 * 뽑아내고 이 페이지가 직접 만든 안전한 태그(<p>)로만 다시 감쌉니다. */

async function loadFaqFromDoc(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`FAQ 문서를 불러오지 못했습니다 (${res.status})`);
    const html = await res.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    if (!parsed.body) return [];

    const nodes = parsed.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p");
    const items = [];
    let current = null;
    nodes.forEach((el) => {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      if (/^H[1-6]$/.test(el.tagName)) {
        current = { question: text, answerParagraphs: [] };
        items.push(current);
      } else if (current) {
        current.answerParagraphs.push(text);
      }
    });
    return items.filter((item) => item.answerParagraphs.length > 0);
  } catch (err) {
    console.warn("FAQ 구글독스를 불러오지 못했습니다(FAQ 섹션만 비어있는 상태로 표시됩니다).", err);
    return [];
  }
}

/* ---------- 데이터 모으기 ---------- */

async function loadCityPageData(cityId) {
  const [
    countries, cities, videos, localAds,
    cityPages, cityStay, cityTours, citySpots, cityBudget
  ] = await Promise.all([
    fetchCityTab(CONFIG.csv.countries),
    fetchCityTab(CONFIG.csv.cities),
    fetchCityTab(CONFIG.csv.videos),
    fetchCityTab(CONFIG.csv.localAds),
    fetchCityTab(CONFIG.csv.cityPages),
    fetchCityTab(CONFIG.csv.cityStay),
    fetchCityTab(CONFIG.csv.cityTours),
    fetchCityTab(CONFIG.csv.citySpots),
    fetchCityTab(CONFIG.csv.cityBudget)
  ]);

  const isSample = cityId === SAMPLE_CITY_ID;

  const cityRow = cities.find((c) => c.city_id === cityId) || null;
  const countryRow = cityRow
    ? countries.find((c) => String(c.country_code) === String(cityRow.country_code)) || null
    : null;
  const metaRow = cityPages.find((r) => r.city_id === cityId) || null;
  const meta = metaRow || (isSample ? SAMPLE_CITY.meta : {});

  const cityName = cityRow ? cityRow.city_name_ko : (isSample ? SAMPLE_CITY.meta.city_name_ko : cityId);
  const countryName = countryRow ? countryRow.country_name_ko : (isSample ? SAMPLE_CITY.meta.country_name_ko : "");

  const stayRows = cityStay.filter((r) => r.city_id === cityId);
  const tourRows = cityTours
    .filter((r) => r.city_id === cityId)
    .sort((a, b) => (Number(a.rank) || 0) - (Number(b.rank) || 0));
  const spotRows = citySpots.filter((r) => r.city_id === cityId);
  const budgetRows = cityBudget.filter((r) => r.city_id === cityId);
  const videoRows = videos.filter((v) => videoCityIds(v).includes(cityId));
  const localAdRows = localAds.filter((a) => String(a.city_id || "").trim() === cityId);

  const faqDocUrl = metaRow && metaRow.faq_doc_url ? metaRow.faq_doc_url : "";
  let faqItems = faqDocUrl ? await loadFaqFromDoc(faqDocUrl) : [];
  if (!faqItems.length && isSample) faqItems = SAMPLE_CITY.faq;

  return {
    cityId,
    isSample,
    cityRow,
    countryRow,
    meta,
    cityName,
    countryName,
    faqDocUrl,
    videos: videoRows.length ? videoRows : (isSample ? SAMPLE_CITY.videos : []),
    stay: stayRows.length ? stayRows : (isSample ? SAMPLE_CITY.stay : []),
    tours: tourRows.length ? tourRows : (isSample ? SAMPLE_CITY.tours : []),
    spots: spotRows.length ? spotRows : (isSample ? SAMPLE_CITY.spots : []),
    budget: budgetRows.length ? budgetRows : (isSample ? SAMPLE_CITY.budget : []),
    localAds: localAdRows,
    faq: faqItems
  };
}

/* ---------- 화면 그리기 ---------- */

function chipHtml(icon, text) {
  return `<span style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.14); border:1px solid rgba(255,255,255,0.3); padding:7px 13px; border-radius:999px; font-size:0.84rem;">${icon}${escapeHtml(text)}</span>`;
}

/* 도시 데이터가 준비된 뒤, <head>의 title/설명/canonical/OG/트위터
 * 태그/JSON-LD를 전부 "이 도시" 기준으로 다시 채워 넣습니다.
 *
 * city.html은 도시마다 다른 파일이 아니라 city.html?id=CN-SHANGHAI처럼
 * 하나의 파일을 쿼리스트링만 바꿔 재사용하는 구조라서, canonical/og:url을
 * 도시별로 정확히 채워주지 않으면 검색엔진이 "다 같은 페이지"로 보고
 * 한 도시만 대표로 남기고 나머지는 중복으로 접어버릴 수 있습니다(그러면
 * 도시를 아무리 추가해도 실제로 검색에 잡히는 페이지는 하나뿐인 상태가
 * 됩니다). 그래서 title뿐 아니라 이 함수에서 한 번에 전부 도시별 값으로
 * 맞춰줍니다. */
function updatePageSeo(data, meta) {
  const pageUrl = `https://tripcompany.world/city.html?id=${encodeURIComponent(data.cityId)}`;
  const title = `${data.cityName} 여행 가이드 · 트립콤파니 여행지도`;
  const description = meta.hero_tagline
    ? `${data.cityName} 여행 가이드 - ${meta.hero_tagline}`
    : `${data.cityName} 여행 가이드 · 트립콤파니 여행지도`;

  document.title = title;

  const setAttr = (id, attr, value) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute(attr, value);
  };

  setAttr("meta-description", "content", description);
  setAttr("page-canonical", "href", pageUrl);
  setAttr("og-title", "content", title);
  setAttr("og-description", "content", description);
  setAttr("og-url", "content", pageUrl);
  setAttr("twitter-title", "content", title);
  setAttr("twitter-description", "content", description);

  const jsonLd = document.getElementById("page-jsonld");
  if (jsonLd) {
    jsonLd.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      url: pageUrl,
      description,
      inLanguage: "ko-KR",
      isPartOf: { "@type": "WebSite", name: "트립콤파니 여행지도", url: "https://tripcompany.world/" }
    });
  }
}

function renderHero(data) {
  const meta = data.meta || {};

  updatePageSeo(data, meta);

  document.getElementById("hero-eyebrow").innerHTML = data.countryName
    ? `<span>${escapeHtml(data.countryName)}</span><span style="opacity:0.5;">·</span><span>도시 가이드</span>`
    : `<span>도시 가이드</span>`;

  document.getElementById("hero-title").textContent = data.cityName;
  document.getElementById("hero-tagline").textContent = meta.hero_tagline || "";

  const chips = [];
  if (meta.best_season) chips.push(chipHtml(ICON_CALENDAR, `최적 시기 ${meta.best_season}`));
  if (meta.currency_code && meta.currency_name_ko) {
    const priceText = meta.price_level ? ` · 물가 ${meta.price_level}` : "";
    chips.push(chipHtml(ICON_COIN, `${meta.currency_name_ko}(${meta.currency_code})${priceText}`));
  }
  if (meta.flight_time) chips.push(chipHtml(ICON_PLANE, meta.flight_time));
  document.getElementById("hero-chips").innerHTML = chips.join("");
}

const VIDEO_GRADIENTS = [
  "linear-gradient(135deg,#1f6f5c,#0c2f27)",
  "linear-gradient(135deg,#2c8570,#164e41)",
  "linear-gradient(135deg,#3a9c83,#1f6f5c)",
  "linear-gradient(135deg,#164e41,#2c8570)"
];

function renderVideos(data) {
  const sub = document.getElementById("videos-sub");
  const grid = document.getElementById("videos-grid");
  sub.textContent = `${data.cityName} 관련 가이드 영상 모음`;

  if (!data.videos.length) {
    grid.innerHTML = `<p class="empty-note">아직 등록된 영상이 없어요.</p>`;
    return;
  }

  grid.innerHTML = data.videos.map((v, idx) => {
    const channel = normalizeChannel(v.channel);
    const vid = extractYoutubeId(v.youtube_url);
    const thumbImg = vid
      ? `<img src="https://img.youtube.com/vi/${encodeURIComponent(vid)}/mqdefault.jpg" alt="" loading="lazy" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover;">`
      : "";
    const href = v.youtube_url ? v.youtube_url : "#";
    const guideLine = v.guide_name ? `${CHANNEL_LABEL[channel]} · ${v.guide_name}` : CHANNEL_LABEL[channel];
    const summary = v.summary_ko
      ? `<span style="font-size:0.78rem; color:var(--ink-soft); line-height:1.55;">${escapeHtml(v.summary_ko)}</span>`
      : "";
    return `
      <a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="card" style="overflow:hidden; display:flex; flex-direction:column;">
        <div class="video-thumb" style="background:${VIDEO_GRADIENTS[idx % VIDEO_GRADIENTS.length]};">
          ${thumbImg}
          <div class="play-dot" style="position:relative; z-index:1;"><svg width="14" height="14" viewBox="0 0 24 24" fill="#164e41"><path d="M7 5l13 7-13 7z"/></svg></div>
        </div>
        <div style="padding:14px 16px 16px; display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:0.86rem; font-weight:700; line-height:1.35;">${escapeHtml(v.title || "")}</span>
          <span style="font-size:0.76rem; color:var(--ink-soft);">${escapeHtml(guideLine)}</span>
          ${summary}
        </div>
      </a>`;
  }).join("");
}

/* 지역 카드(가성비/중급/럭셔리 등)는 "이 도시는 이런 동네들이 있다"는
 * 정보와 트립콤파니의 코멘트를 보여주는 용도로만 쓰고, 실제 예약 버튼은
 * 카드마다 따로 두지 않고 아래에 도시 전체로 연결되는 버튼 하나만
 * 둡니다 — 아고다가 지역/가격대별로 걸러진 딥링크를 지원하지 않아서,
 * 카드마다 버튼을 따로 둬도 결국 다 똑같은 "도시 전체" 링크로만
 * 연결되던 것을 정직하게 하나로 합쳤습니다 (README 30번 항목 참고). */
function renderStay(data) {
  const grid = document.getElementById("stay-grid");
  const ctaBox = document.getElementById("stay-cta");

  if (!data.stay.length) {
    grid.innerHTML = `<p class="empty-note">숙소 추천 정보를 준비 중이에요.</p>`;
    ctaBox.innerHTML = "";
    return;
  }

  grid.innerHTML = data.stay.map((row) => {
    const comment = row.comment ? `<p class="comment-note">${escapeHtml(row.comment)}</p>` : "";
    const tier = row.tier
      ? `<span style="font-size:0.74rem; font-weight:700; letter-spacing:0.02em; color:var(--money); text-transform:uppercase;">${escapeHtml(row.tier)}</span>`
      : "";
    const transit = row.transit_note
      ? `<span style="color:var(--ink-soft); font-size:0.86rem;">${escapeHtml(row.transit_note)}</span>`
      : "";
    return `
      <div class="card stay-card">
        ${tier}
        <span style="font-weight:700; font-size:1.02rem;">${escapeHtml(row.area_name || "")}</span>
        ${transit}
        ${comment}
        <div style="display:flex; align-items:baseline; gap:4px; margin-top:auto;">
          <span style="font-size:1.05rem; font-weight:800;">${escapeHtml(row.price_range || "")}</span>
          <span style="font-size:0.8rem; color:var(--ink-soft);">/ 1박</span>
        </div>
      </div>`;
  }).join("");

  const cityLabel = data.cityName || "이 도시";
  ctaBox.innerHTML = `
    <a class="btn btn-money" style="width:100%; max-width:360px;" href="${escapeHtml(buildAgodaFallbackLink(data))}" target="_blank" rel="noopener sponsored">
      ${escapeHtml(cityLabel)} 숙소 전체 보기 →
    </a>`;
}

function renderTours(data) {
  const grid = document.getElementById("tours-grid");
  if (!data.tours.length) {
    grid.innerHTML = `<p class="empty-note">투어 · 액티비티 추천을 준비 중이에요.</p>`;
    return;
  }
  grid.innerHTML = data.tours.map((row, idx) => {
    const rankLabel = row.rank || String(idx + 1);
    const comment = row.comment ? `<p class="comment-note">${escapeHtml(row.comment)}</p>` : "";
    const priceLine = row.price_from
      ? `<span style="color:var(--ink-soft); font-size:0.8rem;">${escapeHtml(row.price_from)}</span>`
      : "";
    const linkHtml = row.link_url
      ? `<a href="${escapeHtml(row.link_url)}" target="_blank" rel="noopener sponsored" style="font-size:0.8rem; font-weight:700; color:var(--money); margin-top:auto;">예약 →</a>`
      : "";
    return `
      <div class="card tour-card">
        <span style="width:30px; height:30px; border-radius:50%; background:var(--accent-soft); color:var(--accent-strong); font-weight:800; font-size:0.86rem; display:flex; align-items:center; justify-content:center;">${escapeHtml(String(rankLabel))}</span>
        <span style="font-weight:700; font-size:0.9rem; line-height:1.35;">${escapeHtml(row.name || "")}</span>
        ${comment}
        ${priceLine}
        ${linkHtml}
      </div>`;
  }).join("");
}

function renderPrep() {
  const grid = document.getElementById("prep-grid");
  const esimHref = CONFIG.prep.esimUrl || "#";
  const insuranceHref = CONFIG.prep.insuranceUrl || "#";
  grid.innerHTML = `
    <div class="card prep-card">
      <div class="prep-icon">${ICON_SIM}</div>
      <span style="font-weight:700; font-size:0.92rem;">eSIM · 유심</span>
      <span style="color:var(--ink-soft); font-size:0.82rem;">공항 도착 즉시 데이터 연결</span>
      <a href="${escapeHtml(esimHref)}" target="_blank" rel="noopener sponsored" style="font-size:0.8rem; font-weight:700; color:var(--money);">알아보기 →</a>
    </div>
    <div class="card prep-card">
      <div class="prep-icon">${ICON_SHIELD}</div>
      <span style="font-weight:700; font-size:0.92rem;">여행자보험</span>
      <span style="color:var(--ink-soft); font-size:0.82rem;">분실·의료비 대비, 5분 가입</span>
      <a href="${escapeHtml(insuranceHref)}" target="_blank" rel="noopener sponsored" style="font-size:0.8rem; font-weight:700; color:var(--money);">알아보기 →</a>
    </div>`;
}

function renderSpots(data) {
  const grid = document.getElementById("spots-grid");
  if (!data.spots.length) {
    grid.innerHTML = `<p class="empty-note">시간대별 추천 장소를 준비 중이에요.</p>`;
    return;
  }
  const groups = {};
  const order = [];
  data.spots.forEach((row) => {
    const key = row.timeslot || "기타";
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(row);
  });

  grid.innerHTML = order.map((key) => {
    const icon = TIMESLOT_ICONS[key] || "📍";
    const spotsHtml = groups[key].map((row) => `
      <div class="timeslot-spot">
        <span style="font-weight:700; font-size:0.92rem;">${escapeHtml(row.place_name || "")}</span>
        ${row.note ? `<span style="color:var(--ink-soft); font-size:0.82rem; line-height:1.6;">${escapeHtml(row.note)}</span>` : ""}
      </div>`).join("");
    return `
      <div class="card timeslot-card">
        <div class="timeslot-icon" style="font-size:16px;">${icon}</div>
        <span style="font-weight:800; font-size:0.72rem; letter-spacing:0.04em; text-transform:uppercase; color:var(--ink-soft);">${escapeHtml(key)}</span>
        ${spotsHtml}
      </div>`;
  }).join("");
}

function renderBudget(data) {
  const sub = document.getElementById("budget-sub");
  const list = document.getElementById("budget-list");

  if (!data.budget.length) {
    sub.textContent = "";
    list.innerHTML = `<p class="empty-note">예상 경비 정보를 준비 중이에요.</p>`;
    return;
  }

  // 여행 기간이 3박이든 일주일이든 사람마다 달라서 "총합계"는 의미가
  // 없다고 판단해 뺐습니다 — 항목별 예상 범위만 보여줍니다.
  sub.textContent = "실제 비용은 여행 기간·시즌·항공권 시점에 따라 달라질 수 있어요";

  list.innerHTML = data.budget.map((row) => {
    const comment = row.comment ? `<p class="comment-note">${escapeHtml(row.comment)}</p>` : "";
    return `
      <div class="budget-item">
        <div class="budget-row"><span style="font-weight:600;">${escapeHtml(row.item || "")}</span><span style="text-align:right; font-weight:700; font-variant-numeric:tabular-nums;">${escapeHtml(row.range || "")}</span></div>
        ${comment}
      </div>`;
  }).join("");
}

function renderLocalAd(data) {
  const section = document.getElementById("localad-section");
  const slot = document.getElementById("localad-slot");
  const candidates = data.localAds.filter((a) => a.local_ad_label && a.local_ad_url);

  if (!candidates.length) {
    section.style.display = "none";
    slot.innerHTML = "";
    return;
  }

  const ad = candidates[Math.floor(Math.random() * candidates.length)];
  const thumb = ad.local_ad_image
    ? `<img src="${escapeHtml(ad.local_ad_image)}" alt="" style="width:100%; height:100%; object-fit:cover;">`
    : `<span style="font-size:18px;">🎫</span>`;

  section.style.display = "";
  slot.innerHTML = `
    <a href="${escapeHtml(ad.local_ad_url)}" target="_blank" rel="noopener sponsored nofollow" class="card" style="display:flex; align-items:center; justify-content:space-between; gap:16px; padding:20px 24px; border-color:var(--money-line); background:var(--money-soft);">
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="width:38px; height:38px; border-radius:9px; background:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden;">
          ${thumb}
        </div>
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span style="font-weight:700; font-size:0.94rem;">${escapeHtml(ad.local_ad_label)}</span>
          <span style="font-size:0.8rem; color:var(--ink-soft);">지역별 맞춤 제휴 광고</span>
        </div>
      </div>
      <span style="font-weight:700; color:var(--money); font-size:0.86rem; flex-shrink:0;">받기 →</span>
    </a>`;
}

function renderFaq(data) {
  const sub = document.getElementById("faq-sub");
  const list = document.getElementById("faq-list");

  if (!data.faq.length) {
    sub.textContent = "";
    list.innerHTML = `<p class="empty-note">자주 묻는 질문을 준비 중이에요.</p>`;
    return;
  }

  sub.textContent = "질문과 답변 모두 트립콤파니가 직접 작성해요";

  list.innerHTML = data.faq.map((item, idx) => {
    const paragraphs = (item.answerParagraphs.length ? item.answerParagraphs : [""])
      .map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    return `
      <details class="faq-item"${idx === 0 ? " open" : ""}>
        <summary>
          <span style="font-weight:700; font-size:0.95rem;">${escapeHtml(item.question)}</span>
          ${ICON_CHEVRON}
        </summary>
        <div class="faq-answer">${paragraphs}</div>
      </details>`;
  }).join("");
}

function renderFooter(data) {
  document.getElementById("footer-sub").textContent = `${data.cityName}에서 촬영한 여행기, 여행하는트콤에서도 확인해보세요`;
  const subscribe = document.getElementById("footer-subscribe");
  if (CONFIG.trekomChannelUrl) {
    subscribe.href = CONFIG.trekomChannelUrl;
  } else {
    subscribe.href = "#";
    subscribe.setAttribute("aria-disabled", "true");
  }
}

/* ---------- 목차 플로팅 + 현재 위치 강조 ---------- */

function setupTocScrollSpy() {
  const links = Array.prototype.slice.call(document.querySelectorAll("#toc-nav a[data-toc]"));
  const byId = {};
  const sections = [];
  links.forEach((a) => {
    const sec = document.querySelector(a.getAttribute("href"));
    if (sec) { byId[sec.id] = a; sections.push(sec); }
  });
  if (!sections.length || typeof IntersectionObserver === "undefined") return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const link = byId[entry.target.id];
      if (!link) return;
      links.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
    });
  }, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });

  sections.forEach((sec) => observer.observe(sec));
}

/* ---------- 초기화 ---------- */

async function initCityPage() {
  const params = new URLSearchParams(window.location.search);
  const cityId = params.get("id") || SAMPLE_CITY_ID;

  const data = await loadCityPageData(cityId);

  renderHero(data);
  renderVideos(data);
  renderStay(data);
  renderTours(data);
  renderPrep();
  renderSpots(data);
  renderBudget(data);
  renderLocalAd(data);
  renderFaq(data);
  renderFooter(data);
  setupTocScrollSpy();
}

initCityPage();
