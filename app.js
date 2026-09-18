/* =========================================================
 * 트립컴퍼니 가이드 지도 - 메인 로직
 *
 * 화면 흐름: 세계지도(has_video 국가 강조) → 국가 클릭 시 확대 + 도시 마커 표시
 *            → 도시 클릭 시 해당 도시 영상만 필터링
 *
 * 데이터는 CONFIG.dataSource 값에 따라 아래 셋 중 하나에서 불러옵니다.
 *   'sample' : data/sample-data.js 의 테스트 데이터 (지금 바로 확인 가능)
 *   'csv'    : 구글시트를 "웹에 게시"해서 만든 CSV 링크에서 직접 불러오기 (완전 무료, 요청 횟수 제한 없음)
 *   'sheetdb': 구글시트를 SheetDB API로 연결해서 불러오기 (무료 플랜은 월 500회 요청 제한)
 * ========================================================= */

const CONFIG = {
  dataSource: "csv",

  // 구글시트 각 탭을 File > 공유 > 웹에 게시(Publish to web) 에서
  // 탭별로 "쉼표로 구분된 값(.csv)" 형식으로 게시한 뒤 나온 링크를 그대로 붙여넣으세요.
  // (README.md 의 "웹 게시 + CSV로 무료로 계속 쓰기" 항목에 단계별 설명이 있습니다)
  csv: {
    countries: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=831903528&single=true&output=csv",
    cities: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=682817820&single=true&output=csv",
    videos: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=838162849&single=true&output=csv",
    // 트콤의 "지금 여기 있어요" 실시간 위치 마커용 (선택 기능 — 안 쓰려면 빈
    // 문자열로 두면 마커가 그냥 표시되지 않을 뿐 나머지는 그대로 작동합니다).
    // 구글시트에 "Status"라는 새 탭을 만들고 README의 "트콤 실시간 위치
    // 표시하기" 항목대로 게시한 뒤 그 CSV 링크를 여기 붙여넣으세요.
    status: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=420959830&single=true&output=csv",
    // 도시/나라별 맞춤 제휴 광고용(선택 기능 — 비워두면 기능 자체가 꺼질
    // 뿐 나머지는 그대로 작동합니다). 구글시트에 "LocalAds"라는 새 탭을
    // 만들고 README 19번 항목대로 게시한 뒤 그 CSV 링크를 여기 붙여넣으면
    // 켜집니다. 한 도시(또는 나라)에 여러 줄을 등록해두면, 그중 하나를
    // 매번 무작위로 골라서 보여줍니다.
    localAds: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrcaGFAhrYkiFSNP5H690mCVc8BBluKatYLRnPjUBJ90McxduvtkM3lZ57h6rbEH4TGfQIKHEV9Duu/pub?gid=1988500641&single=true&output=csv"
  },

  sheetdb: {
    // 예: "https://sheetdb.io/api/v1/abcd1234efgh"
    baseUrl: "https://sheetdb.io/api/v1/YOUR_API_ID"
  },

  // 세계 국경 데이터 (50m 해상도 — 110m보다 해안선/국경선이 훨씬 디테일합니다).
  // jsDelivr가 npm 패키지를 그대로 서빙합니다. 참고로 50m 데이터에는 싱가포르 같은
  // 작은 나라의 도형도 들어있어서, 110m에서는 아예 안 보이던 나라들도 자체 모양으로
  // 표시됩니다(그래도 그것보다 더 작은 나라를 위해 map_center 수동 지정 기능은 남겨뒀습니다).
  worldTopoUrl: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json",

  map: {
    initialCenter: [18, 10],
    initialZoom: 2,
    minZoom: 2,
    maxZoom: 8,
    // 접속자 위치를 확인하면(페이지 첫 로딩 시 자동으로, 또는 왼쪽 위 "내 위치"
    // 버튼을 눌렀을 때) 이 줌 레벨로 그 지역 전체가 넓게 보이도록 맞춥니다.
    visitorZoom: 4,
    // 싱가포르처럼 세계 국경 데이터에 도형이 아예 없어서 map_center 좌표로
    // 대신 이동하는 나라를 선택했을 때 사용하는 줌 레벨입니다.
    tinyCountryZoom: 6,
    // 도시 검색 결과나 공유 링크(?region=)로 특정 도시를 보여줄 때, 그 도시
    // 주변이 얼마나 빽빽한지에 맞춰 줌을 자동으로 정합니다(README 24번 항목).
    //  - cityFocusSeparationPx: 가장 가까운 이웃 도시 점과 화면에서 최소
    //    이 정도(픽셀)는 떨어져 보이도록 줌을 맞춥니다. 오사카·교토·고베처럼
    //    붙어있는 지역은 자동으로 가까이, 미국처럼 듬성듬성한 곳은 멀리서
    //    보여주게 되는 기준값입니다. 키우면 전체적으로 더 확대됩니다.
    //  - cityFocusMinZoom: 주변에 도시가 아주 멀리 있거나 하나도 없을 때도
    //    세계지도까지 축소되지는 않도록 막아주는 하한선입니다.
    // (예전에는 70/4였는데, 도시로 확대했을 때 화면이 너무 바짝 당겨져서
    // 주변 맥락이 안 보인다는 의견에 따라 절반 수준으로 낮춰서 전체적으로
    // 한 단계(zoom -1)씩 더 넓게 보이도록 했습니다 — README 27번 참고.)
    cityFocusSeparationPx: 35,
    cityFocusMinZoom: 3
  },

  // 접속자의 IP로 대략적인 위치를 확인해서 초기 지도 위치를 그쪽으로 맞춥니다.
  // 왼쪽 위 "내 위치" 버튼을 눌렀을 때도 이 값을 그대로 재사용합니다(같은
  // 지역을 다시 넓게 보여줌). 무료·키 불필요·요청 횟수 제한 없는 geojs.io
  // 서비스를 사용합니다. 실패하면 조용히 map.initialCenter/initialZoom
  // 기본값으로 남습니다.
  geoLocate: {
    enabled: true,
    apiUrl: "https://get.geojs.io/v1/ip/geo.json"
  },

  // 여행하는트콤이 지금 실제로 있는 위치를 지도 위에 동그란 얼굴 사진으로
  // 보여주는 "지금 여기 있어요" 마커 설정입니다. Status 탭(CONFIG.csv.status)이
  // 비어있거나 값을 못 불러오면 마커 없이 나머지 지도는 평소대로 작동합니다.
  trekomStatus: {
    enabled: true,
    label: "트콤",
    avatarImage: "images/trekom-live-avatar.jpg",
    // 몇 분마다 페이지 새로고침 없이 위치를 다시 확인할지(분 단위). 트콤이
    // 구글시트 셀을 고치면 이미 열려있는 화면에도 이 시간 안에 자동 반영됩니다.
    refreshIntervalMinutes: 5
  },

  // 아고다(Agoda) 숙소 예약 제휴 배너 설정입니다. 애드센스 승인 전까지 헤더 아래
  // 큰 광고 자리와 영상 목록 아래 작은 광고 자리를 "지금 보고 있는 나라/도시
  // 숙소 예약" 아고다 제휴 배너로 대신 채웁니다.
  //
  // cid 칸에 아고다 파트너 센터(partners.agoda.com)에서 발급받은 나의 CID 값을
  // 넣으면 자동으로 켜집니다. 비어있으면 지금까지처럼 빈 "광고 영역" 표시만
  // 남고 나머지는 전혀 영향이 없습니다. 자세한 설명은 README 14번 항목 참고.
  agoda: {
    cid: ""
  },

  // 클룩(Klook) 어필리에이트 배너 설정입니다. 헤더 아래 큰 광고 자리(#ad-slot-top)에서
  // 아고다보다 우선적으로 표시됩니다(아고다는 국가/도시에 따라 자동으로 바뀌는 텍스트
  // 배너라, 헤더는 클룩 이미지 배너로 고정하고 아고다는 지금 트립닷컴이 우선 차지한
  // 영상 목록 아래 작은 자리에서 다음 순위로 대기합니다).
  //
  // enabled를 false로 바꾸면 즉시 꺼지고, 헤더는 다시 원래 로직(클룩 → 아고다 →
  // 빈 광고 영역 순서)대로 다음 순위를 보여줍니다. redirectUrl 자리에는 클룩
  // 파트너 센터(affiliate.klook.com)에서 발급받은 나의 리다이렉트 링크를 그대로
  // 붙여넣으면 됩니다. 자세한 설명은 README 15번 항목 참고.
  klook: {
    enabled: true,
    redirectUrl: "https://affiliate.klook.com/redirect?aid=89998&aff_adid=1425111&k_site=https%3A%2F%2Fwww.klook.com%2Fen-US%2Fcar-rentals%2F",
    bannerImage: "images/klook-banner.svg"
  },

  // 트립닷컴(Trip.com) 호텔 예약 제휴 배너 설정입니다. 영상 목록 아래 작은
  // 광고 자리(inline)에서 아고다보다 우선적으로 표시됩니다(아고다는 승인 전이라
  // 지금은 이 자리도 빈 "광고 영역"만 보이는 상태였는데, 트립닷컴으로 채웁니다).
  //
  // enabled를 false로 바꾸면 즉시 꺼지고, 그 자리는 다시 원래 순서(트립닷컴 →
  // 아고다 → 빈 광고 영역)대로 다음 순위를 보여줍니다. redirectUrl 자리에는
  // 트립닷컴에서 발급받은 나의 제휴 링크를 그대로 붙여넣으면 됩니다. 자세한
  // 설명은 README 17번 항목 참고.
  tripcom: {
    enabled: true,
    redirectUrl: "https://www.trip.com/t/mM69FZbSIW2",
    bannerImage: "images/tripcom-banner.svg"
  },

  // 최근에 영상이 새로 올라온 지역에 지도 위 점 옆에 작은 "N" 배지를
  // 붙여주는 기능입니다. Videos 탭에 added_date 칸(YYYY-MM-DD 형식으로
  // 그 영상을 추가한 날짜)을 채워두면 자동으로 계산됩니다 — 어떤 지역이
  // NEW인지 직접 고를 필요는 없습니다. 자세한 설명은 README 21번 항목
  // 참고.
  newBadge: {
    enabled: true,
    // 최신순으로 최대 몇 곳까지 배지를 붙일지.
    maxLocations: 3,
    // 이 기간(일)이 지난 지역은 아무리 최근 순위 안에 들어도 배지에서
    // 제외됩니다(오래된 영상인데 계속 NEW로 남는 걸 막기 위함).
    withinDays: 30
  }
};

let map;
let countryLayer;
let cityMarkersLayer;
let worldCityMarkersLayer;
let cityMarkersById = {};
let selectedCountryCode = null;
let selectedCityId = null;
let trekomLiveMarker = null;

/* 오른쪽 영상 패널 상단의 채널별 필터 탭에서 지금 선택된 값입니다.
 * "all"(전체보기) / "trip"(트립콤파니) / "trekom"(여행하는트콤) 중 하나이며,
 * getFilteredVideos()가 이 값을 반영해서 목록을 걸러줍니다. 나라를 새로
 * 고르거나(selectCountry) 세계지도로 돌아갈 때(handleBackButtonClick)는
 * "전체보기"로 초기화하지만, 같은 나라 안에서 다른 도시를 고를 때는
 * (selectCity) 방문자가 고른 필터를 그대로 유지합니다. */
let activeChannelFilter = "all";

let DATA = { countries: [], cities: [], videos: [], localAds: [] };

/* 안내 페이지(city/도시코드/index.html)가 실제로 공개된 도시의 city_id
 * 집합입니다. generate_cities.py가 빌드할 때마다 city/published.json으로
 * 내보내는 값을 읽어 채웁니다 — 지도 쪽 Cities 탭과 도시 안내 페이지 쪽
 * Cities 탭이 같은 city_id(예: JP-TOKYO)를 쓴다는 전제입니다. */
let PUBLISHED_CITY_IDS = new Set();

/* city/published.json은 같은 사이트 안의 정적 파일이라 실패할 일이
 * 거의 없지만, 혹시 아직 파일이 없거나 네트워크 문제가 있어도 지도
 * 자체는 그대로 동작해야 하므로 실패하면 조용히 빈 집합을 돌려줍니다. */
async function loadPublishedCityIds() {
  try {
    const res = await fetch("/city/published.json", { cache: "no-store" });
    if (!res.ok) return new Set();
    const ids = await res.json();
    return new Set((ids || []).map((id) => String(id)));
  } catch (err) {
    return new Set();
  }
}

/* ---------- 데이터 로딩 ---------- */

async function fetchSheet(tabName) {
  const url = `${CONFIG.sheetdb.baseUrl}?sheet=${encodeURIComponent(tabName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${tabName} 시트를 불러오지 못했습니다 (${res.status})`);
  return res.json();
}

/* ---- CSV 파서 (쉼표/따옴표/줄바꿈이 섞인 값도 안전하게 처리) ---- */

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

/* ---------- 시트에서 받은 데이터 걸러내기(방어) ----------
 * 구글시트에는 "video_id만 적어두고 아직 영상 주소는 안 넣은 줄", 편집하다
 * 남은 빈 줄 같은 게 자연스럽게 생깁니다. 이런 줄을 그대로 화면에 그리면
 * 제목 없는 회색 깨진 카드가 영상 목록에 섞이고(클릭하면 빈 유튜브 주소로
 * 이동), 헤더의 "OO개의 가이드" 숫자도 실제보다 부풀려집니다.
 * 그래서 데이터를 받아온 직후 한 곳에서 한 번만 걸러냅니다 — 여기만 통과하면
 * 영상 목록·추천 목록·도시 마커·통계·검색 어디에서도 다시 나타나지 않습니다.
 *   - 영상: 유튜브 주소에서 영상 ID를 못 뽑아내는 줄은 제외
 *   - 도시: city_id나 도시 이름이 비어있는 줄은 제외(지도에 찍을 수도, 목록에
 *     이름을 보여줄 수도 없는 줄입니다)
 *   - 나라: country_code가 비어있는 줄은 제외
 * 시트 원본은 그대로 두고 "화면에 그릴 때만" 거르는 방식이라, 나중에 시트에
 * 주소를 채워 넣으면 아무 것도 안 해도 그 줄이 다시 살아납니다. */
function sanitizeData(data) {
  const raw = data || {};
  return {
    countries: (raw.countries || []).filter((c) => String(c.country_code || "").trim()),
    cities: (raw.cities || []).filter(
      (c) => String(c.city_id || "").trim() && String(c.city_name_ko || "").trim()
    ),
    videos: (raw.videos || []).filter((v) => extractYoutubeId(v.youtube_url)),
    localAds: raw.localAds || []
  };
}

async function loadAllData() {
  if (CONFIG.dataSource === "sample") {
    return window.SAMPLE_DATA;
  }

  if (CONFIG.dataSource === "csv") {
    const [countries, cities, videos] = await Promise.all([
      fetchCsv(CONFIG.csv.countries),
      fetchCsv(CONFIG.csv.cities),
      fetchCsv(CONFIG.csv.videos)
    ]);
    return { countries, cities, videos };
  }

  // 'sheetdb'
  const [countries, cities, videos] = await Promise.all([
    fetchSheet("Countries"),
    fetchSheet("Cities"),
    fetchSheet("Videos")
  ]);
  return { countries, cities, videos };
}

/* ---------- 구글시트 데이터 임시 저장(캐시) ----------
 * 구글시트 CSV는 방문할 때마다 새로 받아오는데, 구글 쪽 응답이 느린 날에는
 * 지도에 점이 찍히기까지 몇 초가 걸리기도 합니다. 그래서 한 번 받아온
 * 데이터를 방문자 브라우저에 저장해뒀다가, 다음 방문 때 일단 그걸로 화면을
 * 즉시 그려주고 최신 데이터는 뒤에서 조용히 받아와 교체합니다
 * (stale-while-revalidate 방식).
 *
 * 그래서 구글시트를 수정하면 "다음 방문부터 느리게 반영"되는 게 아니라,
 * 그 방문 안에서 1~2초 뒤 자동으로 최신 내용으로 바뀝니다. 캐시는 어디까지나
 * "첫 화면을 빨리 띄우기 위한 임시 사본"이고, 항상 최신 데이터를 받아오는
 * 동작 자체는 그대로입니다.
 *
 * 저장 위치는 방문자 브라우저 안(localStorage)이고, 저장하는 내용은
 * 구글시트에 적힌 공개 정보(나라·도시·영상 목록)뿐입니다 — 방문자 개인에
 * 관한 정보는 저장하지 않습니다. 시크릿 모드나 저장 공간이 꽉 찬 경우처럼
 * 저장이 안 되는 환경에서는 조용히 캐시 없이(지금까지와 똑같이) 동작합니다.
 *
 * 키 이름 끝의 v1은 형식 버전입니다. 나중에 데이터 구조가 바뀌면 이 숫자를
 * 올려서, 예전 형식으로 저장된 캐시를 자동으로 무시하게 만들면 됩니다. */
const DATA_CACHE_KEY = "tc_data_cache_v1";
const DATA_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 하루가 지난 사본은 버립니다.

function readDataCache() {
  try {
    const raw = window.localStorage.getItem(DATA_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.savedAt || !parsed.data) return null;
    if (Date.now() - parsed.savedAt > DATA_CACHE_MAX_AGE_MS) return null;

    // 형식이 조금이라도 이상하면(예전 버전, 저장 중 잘림 등) 없는 셈 칩니다.
    const data = parsed.data;
    if (!Array.isArray(data.countries) || !Array.isArray(data.cities) || !Array.isArray(data.videos)) {
      return null;
    }
    if (data.countries.length === 0) return null;

    // 이 캐시는 걸러내기 기능이 없던 예전 버전이 저장해둔 것일 수도 있어서,
    // 최신 데이터와 똑같이 한 번 걸러서 돌려줍니다.
    return sanitizeData({
      countries: data.countries,
      cities: data.cities,
      videos: data.videos,
      localAds: Array.isArray(data.localAds) ? data.localAds : []
    });
  } catch (err) {
    return null;
  }
}

function writeDataCache(data) {
  // 샘플 데이터로 테스트 중일 때는 저장하지 않습니다 — 나중에 실제 시트로
  // 바꿔서 열었을 때 샘플이 잠깐 보이는 혼란을 막기 위해서입니다.
  if (CONFIG.dataSource === "sample") return;
  try {
    window.localStorage.setItem(
      DATA_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        data: {
          countries: data.countries || [],
          cities: data.cities || [],
          videos: data.videos || [],
          localAds: data.localAds || []
        }
      })
    );
  } catch (err) {
    /* 시크릿 모드·저장 공간 부족 등 — 캐시는 없어도 되는 기능이라 무시합니다. */
  }
}

/* 트콤의 "지금 여기 있어요" 실시간 위치 한 줄을 불러옵니다. 완전히 선택 기능이라
 * Status 탭을 아직 안 만들었거나(csv 링크가 비어있음) 불러오다 실패해도 그냥
 * null을 돌려줄 뿐, 지도의 나머지 부분에는 전혀 영향을 주지 않습니다.
 *
 * 항상 "마지막 줄"을 씁니다 — Apps Script 방식(README 12번, 항상 2번째 줄
 * 하나만 덮어씀)과 구글 폼 방식(README 12-B번, 제출할 때마다 새 줄이 맨
 * 아래에 추가됨) 둘 다 이 규칙 하나로 문제없이 동작합니다. */
async function loadTrekomStatus() {
  if (!CONFIG.trekomStatus.enabled) return null;
  try {
    if (CONFIG.dataSource === "sample") {
      return (window.SAMPLE_DATA && window.SAMPLE_DATA.trekomStatus) || null;
    }
    if (CONFIG.dataSource === "csv") {
      if (!CONFIG.csv.status) return null;
      const rows = await fetchCsv(CONFIG.csv.status);
      return rows[rows.length - 1] || null;
    }
    const rows = await fetchSheet("Status");
    return rows[rows.length - 1] || null;
  } catch (err) {
    console.warn("트콤 현재 위치 정보를 불러오지 못했습니다(선택 기능이라 지도 표시에는 영향 없습니다).", err);
    return null;
  }
}

/* 도시/나라별 맞춤 제휴 광고(LocalAds 탭) 전체를 불러옵니다. 완전히 선택
 * 기능이라 탭을 아직 안 만들었거나(csv 링크가 비어있음) 불러오다 실패해도
 * 빈 배열을 돌려줄 뿐, 나머지 표시에는 전혀 영향을 주지 않습니다. */
async function loadLocalAds() {
  try {
    if (CONFIG.dataSource === "sample") {
      return (window.SAMPLE_DATA && window.SAMPLE_DATA.localAds) || [];
    }
    if (CONFIG.dataSource === "csv") {
      if (!CONFIG.csv.localAds) return [];
      return await fetchCsv(CONFIG.csv.localAds);
    }
    return await fetchSheet("LocalAds");
  } catch (err) {
    console.warn("지역별 맞춤 광고를 불러오지 못했습니다(선택 기능이라 나머지 표시에는 영향 없습니다).", err);
    return [];
  }
}

/* ---------- 유틸 ---------- */

function isTrue(v) {
  return String(v).trim().toUpperCase() === "TRUE";
}

function findCountry(code) {
  return DATA.countries.find((c) => String(c.country_code) === String(code));
}

function countryHasVideo(code) {
  const c = findCountry(code);
  return !!c && isTrue(c.has_video);
}

function countryName(code) {
  const c = findCountry(code);
  return c ? c.country_name_ko : code;
}

function extractYoutubeId(url) {
  if (!url) return "";
  const m = String(url).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/
  );
  return m ? m[1] : "";
}

/* 구글시트에서 받은 주소를 href/src에 넣기 전에 한 번 거릅니다.
 * http/https로 시작하는 주소만 통과시키고(상대경로도 허용), 그 외
 * (javascript:, data: 등)는 빈 문자열로 만들어서 링크를 아예 만들지
 * 않습니다. 시트는 우리가 관리하지만, 실수로 이상한 값이 들어가도 사이트가
 * 깨지거나 위험해지지 않도록 하는 안전장치입니다. escapeHtml()과 함께
 * 씁니다(이 함수는 "위험한 주소인지", escapeHtml은 "마크업을 깨뜨리는
 * 따옴표 등이 들어있는지"를 각각 담당합니다). */
function safeUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/[^/]/.test(raw)) return raw; // 같은 사이트 안의 경로(/images/...)
  return "";
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

/* ---- 채널 구분 (트립콤파니 / 여행하는트콤) ----
 * Videos 탭에 channel 열을 추가해서 "여행하는트콤"이라고 적으면 그 채널로 인식하고,
 * 비어 있거나 다른 값이면 기존처럼 트립콤파니로 처리합니다 (기존 데이터와 호환). */
const CHANNEL_LABEL = { trip: "트립콤파니", trekom: "여행하는트콤" };

function normalizeChannel(raw) {
  return String(raw || "").trim() === "여행하는트콤" ? "trekom" : "trip";
}

/* ---- 여러 도시를 한 번에 다루는 "비교" 영상 ----
 * 도쿄·오사카·후쿠오카·삿포로 물가 비교처럼 여러 도시를 한 영상에서 다루는
 * 콘텐츠는, Videos 탭 city_id 칸에 그 도시들의 city_id를 쉼표(,)로 이어
 * 적으면 됩니다(예: "JP-TOKYO,JP-OSAKA,JP-FUKUOKA,JP-SAPPORO"). 같은 영상을
 * 도시 수만큼 여러 번 복사해 넣을 필요 없이 한 행으로 해결됩니다. city_id가
 * 비어있으면 지금까지처럼 "국가 전체" 개요 영상이고, city_id 하나만 있으면
 * 지금까지처럼 그 도시 전용 영상입니다. */
function videoCityIds(video) {
  return String(video.city_id || "")
    .split(/[,;]/)
    .map((id) => id.trim())
    .filter(Boolean);
}

/* 특정 도시에 등록된 영상들의 채널 종류를 모아서 돌려줍니다 (Set of 'trip' | 'trekom').
 * 여러 도시를 함께 다루는 비교 영상도 관련된 모든 도시에 포함해서 계산합니다. */
function cityChannels(cityId) {
  const set = new Set();
  DATA.videos
    .filter((v) => videoCityIds(v).includes(String(cityId)))
    .forEach((v) => set.add(normalizeChannel(v.channel)));
  return set;
}

/* ---- 여러 나라를 한 번에 다루는 "국가 비교" 영상 ----
 * "일본 vs 베트남 물가 비교"처럼 여러 나라를 한 영상에서 다루는 콘텐츠는,
 * Videos 탭 country_code 칸에 그 나라들의 country_code를 쉼표(,)로 이어
 * 적으면 됩니다(예: "392,704"). city_id 칸의 비교 영상 기능과 똑같은
 * 방식이며, 이 경우 city_id는 비워두는 게 원칙입니다(도시 단위 비교가
 * 아니라 나라 단위 비교이기 때문입니다). */
function videoCountryIds(video) {
  return String(video.country_code || "")
    .split(/[,;]/)
    .map((id) => id.trim())
    .filter(Boolean);
}

/* 싱가포르처럼 "도시가 곧 국가"라 Cities 탭에 도시를 따로 등록하지 않은 나라를 위한
 * 도우미들. 그 나라의 국가 단위 영상(country_code만 있고 city_id는 비어있는 영상)의
 * 채널 종류를 모아서 돌려줍니다. 여러 나라를 함께 다루는 비교 영상도 관련된
 * 모든 나라에 포함해서 계산합니다. */
function countryVideoChannels(code) {
  const set = new Set();
  DATA.videos
    .filter((v) => videoCountryIds(v).includes(String(code)))
    .forEach((v) => set.add(normalizeChannel(v.channel)));
  return set;
}

/* 도시가 곧 국가인 나라(위 함수 설명 참고)의 영상 개수. 지도 위 점에
 * 마우스를 올렸을 때 "영상 N개"를 보여주는 데 씁니다. */
function countryVideoCount(code) {
  return DATA.videos.filter((v) => videoCountryIds(v).includes(String(code))).length;
}

/* 지도 위 점(도시/국가)에 마우스를 올렸을 때 이름 옆에 붙는 "영상 N개" /
 * "영상 준비중" 문구를 만듭니다. 검색 결과 목록에서 쓰던 표현과 통일했습니다. */
function videoCountLabel(count) {
  return count > 0 ? ` · 영상 ${count}개` : " · 영상 준비중";
}

/* Cities 탭에 그 나라의 도시가 한 곳도 등록되어 있지 않은지 확인합니다. */
function countryHasNoCities(code) {
  return !DATA.cities.some((c) => String(c.country_code) === String(code));
}

/* has_video가 TRUE이면서 Cities 탭에 도시가 하나도 없는 나라 코드 목록 —
 * 이런 나라는 지도에 클릭할 점이 하나도 없어서, 나라 중심에 대신 점을 하나
 * 그려줘야 세계지도에서 눈에 띄고 클릭도 할 수 있습니다. */
function countriesWithoutCities() {
  const codes = new Set(DATA.countries.map((c) => c.country_code).filter(countryHasVideo));
  return [...codes].filter(countryHasNoCities);
}

/* 국가 중심 좌표를 구합니다. 싱가포르처럼 아주 작은 나라는 이 지도가 쓰는 세계
 * 국경 데이터(110m 저해상도)에 도형 자체가 아예 없는 경우가 있어서, 그럴 땐
 * 도형에서 중심을 계산할 수가 없습니다. 그래서 먼저 Countries 탭에 사람이 직접
 * 적어둔 map_center_lat/map_center_lng 값이 있는지 확인하고, 있으면 그 값을
 * 그대로 쓰고, 없을 때만 국경 도형(본토 기준)에서 중심을 계산합니다. */
function getCountryCenter(code) {
  const country = findCountry(code);
  if (country) {
    const lat = parseFloat(country.map_center_lat);
    const lng = parseFloat(country.map_center_lng);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return L.latLng(lat, lng);
    }
  }
  if (!countryLayer) return null;
  const layer = countryLayer.getLayers().find((l) => String(l.feature.id) === String(code));
  if (!layer) return null;
  return getMainlandCenter(layer);
}

/* ---------- 최근 업데이트 지역 "NEW" 배지 ----------
 * Videos 탭에 added_date 칸(YYYY-MM-DD 형식으로 그 영상을 추가한 날짜)을
 * 채워두면, 그 날짜 기준으로 가장 최근에 영상이 추가된 지역
 * CONFIG.newBadge.maxLocations 곳까지 자동으로 계산해서 지도 위 점에
 * 작은 "N" 배지를 붙여줍니다. added_date가 비어있는 영상은 그냥 계산에서
 * 빠질 뿐 나머지 표시에는 전혀 영향이 없습니다.
 *
 * 영상 하나가 도시 여러 곳을 함께 다루는 비교 영상이면(city_id에 여러
 * 도시) 그 도시들 전부가 각각 후보가 됩니다. city_id 없이 country_code만
 * 있는 "나라 전체" 영상은, 그 나라에 이미 Cities 탭에 등록된 도시가
 * 있으면 어느 점 하나에 배지를 달아야 할지 애매해지므로 건너뛰고, 도시가
 * 아예 없는 나라(예: 싱가포르처럼 나라 자체가 점 하나로 표시되는 경우)일
 * 때만 그 나라 점의 후보로 넣습니다.
 *
 * CONFIG.newBadge.withinDays가 지난 지역은 아무리 최근 순위 안에 들어도
 * 자동으로 제외됩니다. computeNewLocations()는 데이터를 불러온 직후
 * main()에서 한 번 호출해두면 되고, 그 뒤로는 isNewCity()/isNewCountry()
 * 로 결과를 확인해서 지도를 그릴 때 배지 여부만 물어보면 됩니다. */

function parseAddedDate(raw) {
  const str = String(raw || "").trim();
  if (!str) return null;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
}

let newLocationKeys = new Set();

function computeNewLocations() {
  newLocationKeys = new Set();
  if (!CONFIG.newBadge || !CONFIG.newBadge.enabled) return;

  const cityIdSet = new Set(DATA.cities.map((c) => c.city_id));
  const countriesWithCitySet = new Set(DATA.cities.map((c) => String(c.country_code)));
  const latest = new Map(); // "city:JP-TOKYO" 또는 "country:392" -> 가장 최근 Date

  DATA.videos.forEach((v) => {
    const date = parseAddedDate(v.added_date);
    if (!date) return;

    const cityIds = videoCityIds(v).filter((id) => cityIdSet.has(id));
    if (cityIds.length > 0) {
      cityIds.forEach((id) => {
        const key = "city:" + id;
        if (!latest.has(key) || date > latest.get(key)) latest.set(key, date);
      });
      return;
    }

    videoCountryIds(v)
      .filter((code) => !countriesWithCitySet.has(String(code)))
      .forEach((code) => {
        const key = "country:" + code;
        if (!latest.has(key) || date > latest.get(key)) latest.set(key, date);
      });
  });

  const cutoff = Date.now() - CONFIG.newBadge.withinDays * 24 * 60 * 60 * 1000;
  newLocationKeys = new Set(
    [...latest.entries()]
      .filter(([, date]) => date.getTime() >= cutoff)
      .sort((a, b) => b[1] - a[1])
      .slice(0, CONFIG.newBadge.maxLocations)
      .map(([key]) => key)
  );
}

function isNewCity(cityId) {
  return newLocationKeys.has("city:" + cityId);
}

function isNewCountry(countryCode) {
  return newLocationKeys.has("country:" + String(countryCode));
}

/* 영상 목록 카드용 — 지도 배지와 달리 "상위 3곳" 순위와 무관하게, 그
 * 영상 자체의 added_date가 CONFIG.newBadge.withinDays 이내면 새 영상으로
 * 봅니다(목록에는 지도처럼 자리가 부족해서 개수를 제한할 이유가 없습니다). */
function isVideoNew(video) {
  if (!CONFIG.newBadge || !CONFIG.newBadge.enabled) return false;
  const date = parseAddedDate(video.added_date);
  if (!date) return false;
  const cutoff = Date.now() - CONFIG.newBadge.withinDays * 24 * 60 * 60 * 1000;
  return date.getTime() >= cutoff;
}

/* 채널 구성(하나만 있는지, 둘 다 있는지)에 맞는 지도 마커 아이콘을 만듭니다.
 * 여행하는트콤 점은 트립콤파니 점보다 조금 작고 다른 색이며, 둘 다 있으면
 * 오른쪽 아래로 살짝 겹쳐서 두 점이 함께 보이도록 배치합니다. isNew를
 * true로 주면 오른쪽 위에 작은 "N" 배지가 추가로 붙습니다. */
function buildCityIcon(channels, selected, isNew) {
  const hasTrip = channels.has("trip");
  const hasTrekom = channels.has("trekom");
  let inner = "";
  if (hasTrip) inner += '<span class="city-dot city-dot-trip"></span>';
  if (hasTrekom) inner += '<span class="city-dot city-dot-trekom"></span>';
  // Cities 탭에는 있지만 Videos 탭에 아직 그 도시의 영상이 하나도 없는 경우 —
  // 흰색 점으로 표시해서 "영상 준비중" 도시라는 걸 구분할 수 있게 합니다.
  if (!hasTrip && !hasTrekom) inner = '<span class="city-dot city-dot-empty"></span>';
  if (isNew) inner += '<span class="city-new-badge" aria-hidden="true">N</span>';

  return L.divIcon({
    className: "city-icon-wrapper",
    html: `<span class="city-icon${selected ? " is-selected" : ""}">${inner}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

/* ---------- 지도 초기화 ---------- */

/* ---------- 지도 이동을 부드럽게 보이게 하는 설정 ----------
 * 이 지도에는 배경 타일 이미지가 없고, 나라 도형을 SVG로 직접 그립니다.
 * 그런데 Leaflet은 성능을 위해 "지금 화면 + 약간의 여유분"만 그려두고,
 * 화면이 움직이는 동안에는 이미 그려둔 그림을 통째로 밀거나 늘릴 뿐
 * 새로 그리지는 않습니다(다시 그리는 건 이동이 끝난 뒤).
 *
 * 그래서 멀리 날아가는 애니메이션(flyTo) 중에는 아직 그려지지 않은 영역을
 * 지나가게 되어, 나라 도형이 사라진 빈 화면처럼 보였습니다(도시 점은
 * 별도의 요소라 그대로 따라다녀서 점만 떠다니는 것처럼 보였습니다).
 *
 * 두 가지로 해결합니다.
 *  1) 미리 그려두는 여유분(padding)을 기본값 0.1에서 크게 늘려서, 웬만한
 *     짧은 이동은 이동 중에도 도형이 계속 보이게 합니다.
 *  2) 그 여유분을 벗어날 만큼 멀리 이동할 때는 아예 날아가지 않고, 아주
 *     짧게 화면을 흐렸다가 목적지에서 다시 선명해지게 합니다. 빈 지도를
 *     가로지르는 모습 자체를 없애는 방식입니다. */
const MAP_RENDERER_PADDING = 1.5;
const MAP_FADE_MS = 160;

function initMap() {
  map = L.map("map", {
    zoomControl: false,
    minZoom: CONFIG.map.minZoom,
    maxZoom: CONFIG.map.maxZoom,
    worldCopyJump: true,
    renderer: L.svg({ padding: MAP_RENDERER_PADDING })
  }).setView(CONFIG.map.initialCenter, CONFIG.map.initialZoom);

  L.control.zoom({ position: "bottomright" }).addTo(map);
  cityMarkersLayer = L.layerGroup().addTo(map);
  worldCityMarkersLayer = L.layerGroup().addTo(map);

  map.on("zoomend", updateMarkerZoomScale);
  updateMarkerZoomScale();
}

/* 지도를 확대할수록(줌 레벨이 높을수록) 도시 점이 조금씩 더 크게 보이도록
 * CSS 변수(--marker-zoom-scale)를 갱신합니다. 최소 줌에서는 1배, 최대 줌에서는
 * 약 1.6배까지 커집니다. .city-icon 쪽에서 이 변수를 읽어서 실제 크기에 반영합니다. */
function updateMarkerZoomScale() {
  const zoom = map.getZoom();
  const minZ = CONFIG.map.minZoom;
  const maxZ = CONFIG.map.maxZoom;
  const t = maxZ > minZ ? (zoom - minZ) / (maxZ - minZ) : 0;
  const clampedT = Math.min(1, Math.max(0, t));
  const scale = 1 + clampedT * 0.6;
  document.getElementById("map").style.setProperty("--marker-zoom-scale", scale.toFixed(2));
}

/* 접속자의 대략적인 위치(IP 기반)를 확인해서 { center:[lat,lng], zoom } 형태로
 * 돌려줍니다. 실패하거나(네트워크 차단 등) 값이 이상하면 null을 돌려줍니다.
 * 페이지 로딩 시 한 번 호출된 뒤에는 결과(성공/실패 모두)를 그대로 재사용해서,
 * 왼쪽 위 "내 위치" 버튼을 여러 번 눌러도 매번 새로 요청하지 않습니다. */
let visitorViewPromise = null;

function getVisitorView() {
  if (!CONFIG.geoLocate.enabled) return Promise.resolve(null);
  if (!visitorViewPromise) {
    visitorViewPromise = fetch(CONFIG.geoLocate.apiUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return null;
        const lat = parseFloat(data.latitude);
        const lng = parseFloat(data.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
        return { center: [lat, lng], zoom: CONFIG.map.visitorZoom };
      })
      .catch((err) => {
        console.warn("접속자 위치를 확인하지 못했습니다. 기본 지도 위치를 사용합니다.", err);
        return null;
      });
  }
  return visitorViewPromise;
}

/* 초기 지도 위치를 접속자의 대략적인 위치 근처로 옮깁니다. 사용자가 이미
 * 국가를 선택한 뒤라면(응답이 오기 전에 빠르게 클릭한 경우) 건드리지 않습니다. */
async function applyVisitorView() {
  if (selectedCountryCode) return;
  const view = await getVisitorView();
  if (!view || selectedCountryCode) return;
  // 첫 위치 잡기라 애니메이션 없이 곧바로 옮깁니다(위치 응답이 늦게 와도
  // 화면이 출렁이지 않도록).
  map.setView(view.center, view.zoom, { animate: false });
}

/* 영상이 있는 모든 도시를 작은 점으로 표시합니다.
 * excludeCountryCode를 주면 그 나라의 도시는 제외합니다 — 선택된 나라의 도시는
 * renderCityMarkers()가 별도로(선택 강조 포함) 그리기 때문에 겹치지 않게 하기 위함입니다. */
function renderWorldCityMarkers(excludeCountryCode) {
  worldCityMarkersLayer.clearLayers();
  DATA.cities
    .filter((city) => countryHasVideo(city.country_code))
    .filter((city) => excludeCountryCode == null || String(city.country_code) !== String(excludeCountryCode))
    .forEach((city) => {
      const lat = parseFloat(city.lat);
      const lng = parseFloat(city.lng);
      // Cities 탭에 위도/경도가 비어있거나 숫자가 아닌 값이 들어있는 행은
      // 건너뜁니다 — 여기서 그냥 진행하면 지도 전체가 에러로 멈춰버립니다.
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        console.warn(`Cities 탭: "${city.city_name_ko || city.city_id}"의 위도/경도 값이 올바르지 않아 지도에 표시하지 않았습니다.`, city);
        return;
      }
      const channels = cityChannels(city.city_id);
      const isNew = isNewCity(city.city_id);
      const suffix = videoCountLabel(cityVideoCount(city.city_id)) + (isNew ? " · NEW" : "");
      L.marker([lat, lng], {
        icon: buildCityIcon(channels, false, isNew)
      })
        .addTo(worldCityMarkersLayer)
        .bindTooltip(`${countryName(city.country_code)} · ${city.city_name_ko}${suffix}`, {
          className: "city-tooltip"
        })
        .on("click", () => {
          // 나라 전체로 맞췄다가 다시 도시로 확대하면 화면이 두 번 움직이므로,
          // 나라 쪽 이동은 건너뛰고 곧바로 그 도시를 적당한 거리에서 보여줍니다
          // (검색·랜덤 여행지·공유 링크와 동일한 방식 — 어떤 방법으로 도시를
          // 골라도 항상 같은 방식으로 그 도시가 화면에 보이도록 통일했습니다).
          selectCountry(city.country_code, "city_marker", { skipMapMove: true });
          selectCity(city.city_id, "city_marker");
          focusCityOnMap(city, { animate: true });
        });
    });

  // 싱가포르처럼 Cities 탭에 도시를 따로 등록하지 않은 나라는, 나라 중심에
  // 국가 단위 영상 채널 색으로 점을 하나 그려서 세계지도에서도 클릭할 수 있게 합니다.
  countriesWithoutCities()
    .filter((code) => excludeCountryCode == null || String(code) !== String(excludeCountryCode))
    .forEach((code) => {
      const center = getCountryCenter(code);
      if (!center) return;
      const isNew = isNewCountry(code);
      L.marker(center, { icon: buildCityIcon(countryVideoChannels(code), false, isNew) })
        .addTo(worldCityMarkersLayer)
        .bindTooltip(`${countryName(code)}${videoCountLabel(countryVideoCount(code))}${isNew ? " · NEW" : ""}`, { className: "city-tooltip" })
        .on("click", () => selectCountry(code, "city_marker"));
    });
}

async function loadWorldGeo() {
  const res = await fetch(CONFIG.worldTopoUrl);
  const topo = await res.json();
  return topojson.feature(topo, topo.objects.countries);
}

function styleCountry(feature) {
  const active = countryHasVideo(feature.id);
  const isSelected = selectedCountryCode && String(feature.id) === String(selectedCountryCode);
  return {
    weight: isSelected ? 1.4 : 0.6,
    color: "#ffffff",
    fillColor: active ? "#1f6f5c" : "#dfe3e6",
    fillOpacity: active ? (isSelected ? 1 : 0.85) : 0.45
  };
}

/* 지도 테두리(geo)는 국가/도시/영상 데이터(DATA)보다 먼저 도착할 수 있습니다
 * (캐시가 없는 첫 방문일 때 특히 그렇습니다) — 그래서 예전에는 여기서
 * "영상이 있는 나라만" 골라 클릭·마우스오버·툴팁을 걸어뒀더니, 이 함수가
 * 실행되는 바로 그 순간의 DATA가 아직 비어있으면 모든 나라가 "영상 없음"으로
 * 판단되어 아무 이벤트도 연결되지 않았습니다. 나중에 실제 데이터가 도착해도
 * 이미 만들어진 지도 도형에 이벤트를 다시 걸어주는 코드는 없어서, 나라를
 * 클릭해도 영영 반응이 없는 상태가 되어버렸습니다(색칠도 마찬가지 이유로
 * 계속 회색으로 남아있었습니다).
 *
 * 그래서 이제는 이벤트 자체는 나라마다 항상 걸어두고, "영상이 있는 나라인지"는
 * 매번 이벤트가 실제로 일어나는 순간에 다시 확인합니다. 이렇게 하면 지도
 * 테두리가 데이터보다 먼저 그려지든 나중에 그려지든 항상 정확하게 동작합니다. */
function renderWorld(geo) {
  countryLayer = L.geoJSON(geo, {
    style: styleCountry,
    onEachFeature: (feature, layer) => {
      layer.on("mouseover", () => {
        if (countryHasVideo(feature.id)) layer.setStyle({ fillOpacity: 1 });
      });
      layer.on("mouseout", () => layer.setStyle(styleCountry(feature)));
      layer.on("click", () => {
        if (countryHasVideo(feature.id)) selectCountry(feature.id, "map");
      });
      // 내용(country name)뿐 아니라 툴팁 자체도 "영상이 있을 때만" 보여주고
      // 싶어서, 열리는 순간(tooltipopen)에 다시 확인해서 아니면 바로 닫습니다.
      layer.bindTooltip(() => countryName(feature.id), { sticky: true, className: "city-tooltip" });
      layer.on("tooltipopen", () => {
        if (!countryHasVideo(feature.id)) layer.closeTooltip();
      });
    }
  }).addTo(map);
}

/* ---------- 트콤 실시간 위치 마커 ----------
 * Status 탭 한 줄(lat, lng, location_name, updated_at)을 동그란 얼굴 사진
 * 마커로 지도 위에 표시합니다. 나라/도시 선택과 무관하게 항상 지도 위에
 * 떠 있도록 cityMarkersLayer/worldCityMarkersLayer가 아니라 지도에 직접
 * 올립니다(그래서 나라를 클릭해서 확대해도 사라지지 않습니다). */
function renderTrekomLiveMarker(status) {
  if (trekomLiveMarker) {
    map.removeLayer(trekomLiveMarker);
    trekomLiveMarker = null;
  }
  if (!status) return;

  const lat = parseFloat(status.lat);
  const lng = parseFloat(status.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    console.warn("Status 탭: lat/lng 값이 올바르지 않아 트콤 실시간 위치 마커를 표시하지 않았습니다.", status);
    return;
  }

  // 얼굴 사진 원(56px)을 실제 좌표 바로 위에 "핀"처럼 띄우고, 그 아래 작은
  // 꼬리(tail)만 정확한 좌표를 가리키게 만듭니다. 예전처럼 원을 좌표에 정중앙
  // 정렬하면 그 자리의 도시 점(영상 마커)을 완전히 덮어버려서 클릭할 수
  // 없었는데, 이렇게 위로 띄우면 도시 점이 항상 트콤 마커 아래로 그대로
  // 드러나서 클릭할 수 있습니다.
  const icon = L.divIcon({
    className: "trekom-live-icon-wrapper",
    html: `
      <span class="trekom-live-marker">
        <span class="trekom-live-pulse"></span>
        <img class="trekom-live-photo" src="${CONFIG.trekomStatus.avatarImage}" alt="${escapeHtml(CONFIG.trekomStatus.label)}">
        <span class="trekom-live-badge">현재 위치</span>
        <span class="trekom-live-tail"></span>
      </span>`,
    iconSize: [56, 70],
    // 앵커를 원의 중심이 아니라 꼬리 끝(맨 아래)으로 둬서, 실제 좌표에는
    // 꼬리 끝만 닿고 원·배지·파동은 전부 그 위로 떠 있게 됩니다.
    iconAnchor: [28, 70]
  });

  const locationName = String(status.location_name || "").trim();
  const updatedText = formatRelativeKo(pickUpdatedAt(status));
  const tooltipHtml =
    `<strong>${escapeHtml(CONFIG.trekomStatus.label)} 지금 여기 있어요${locationName ? " · " + escapeHtml(locationName) : ""}</strong>` +
    (updatedText ? `<br>${escapeHtml(updatedText)}` : "");

  trekomLiveMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000, riseOnHover: true })
    .addTo(map)
    .bindTooltip(tooltipHtml, { className: "trekom-live-tooltip", direction: "top", offset: [0, -74] });
}

/* updated_at 칸 이름을 찾습니다. Apps Script 방식은 "updated_at" 칸을 직접
 * 쓰지만, 구글 폼 방식(README 12-B번)으로 연결한 응답 시트는 구글이 자동으로
 * 만드는 "타임스탬프"(계정 언어가 한국어일 때) 칸을 대신 씁니다 — 그 칸
 * 이름도 함께 확인해서, 어느 방식으로 연결했든 상대 시간이 표시되게 합니다. */
function pickUpdatedAt(status) {
  return status.updated_at || status["타임스탬프"] || status.Timestamp || "";
}

/* Status 탭의 updated_at 값을 "3시간 전 업데이트"처럼 사람이 읽기 편한
 * 상대 시간으로 바꿔줍니다. 값이 없거나 날짜로 해석할 수 없으면 빈 문자열을
 * 돌려줘서 툴팁에 그 줄이 아예 안 보이게 합니다. */
function formatRelativeKo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금 업데이트";
  if (diffMin < 60) return `${diffMin}분 전 업데이트`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전 업데이트`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}일 전 업데이트`;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} 업데이트`;
}

/* 트콤이 이동해서 구글시트 Status 탭 셀을 고쳐도, 이미 사이트를 열어둔
 * 사람의 화면에는 새로고침 전까지 반영이 안 됩니다. 그래서 일정 시간마다
 * 조용히 Status 탭만 다시 불러와서 마커 위치를 갱신합니다. */
function startTrekomLiveMarkerAutoRefresh() {
  const minutes = CONFIG.trekomStatus.refreshIntervalMinutes;
  if (!CONFIG.trekomStatus.enabled || !minutes) return;
  window.setInterval(async () => {
    const status = await loadTrekomStatus();
    renderTrekomLiveMarker(status);
  }, minutes * 60 * 1000);
}

/* ---------- 상태 전환 ---------- */

/* 프랑스처럼 국경 데이터상 본토와 멀리 떨어진 해외 영토(예: 프랑스령 기아나)가
 * 하나의 국가 도형(MultiPolygon)에 함께 들어있는 경우, 그냥 getBounds()를 쓰면
 * 그 해외 영토까지 포함한 범위로 지도가 필요 이상으로 축소돼버립니다.
 *
 * 반대로 예전 버전처럼 "가장 넓은 조각 하나"만 기준으로 쓰면, 일본(홋카이도·
 * 혼슈·규슈·시코쿠), 말레이시아(말레이 반도·보르네오섬), 필리핀(루손·비사야·
 * 민다나오)처럼 나라 자체가 여러 섬으로 나뉘어 있는 경우 본토의 상당 부분이
 * 화면 밖으로 잘려나가 오히려 너무 확대된 것처럼 보입니다.
 *
 * 그래서 조각들 중 면적이 가장 넓은 조각을 "본토" 기준점으로 삼고, 그로부터
 * 일정 거리(MAIN_BOUNDS_CLUSTER_KM) 안에 있는 다른 조각들은 같은 나라의
 * 본토로 보고 범위에 함께 포함시킵니다. 그보다 훨씬 멀리 떨어진 조각(예:
 * 유럽 본토 기준 남미의 프랑스령 기아나)만 예외적으로 제외됩니다. */
const MAIN_BOUNDS_CLUSTER_KM = 2200;

/* 위경도 좌표 목록(하나의 폴리곤 외곽선)의 대략적인 면적을 계산합니다.
 * 신발끈 공식을 위경도에 그대로 적용한 값이라 실제 km² 단위는 아니지만,
 * 같은 나라 안의 여러 조각끼리 "어느 쪽이 더 넓은가"를 비교하는 용도로는
 * 충분합니다. */
function approxRingArea(latlngs) {
  let area = 0;
  for (let i = 0; i < latlngs.length; i++) {
    const p1 = latlngs[i];
    const p2 = latlngs[(i + 1) % latlngs.length];
    area += p1.lng * p2.lat - p2.lng * p1.lat;
  }
  return Math.abs(area) / 2;
}

/* 나라 중심에 동그라미 점 마커 하나를 찍을 때(개별 도시 영상이 없고
 * 나라 단위 영상만 있는 경우, 예: 스페인) 쓰는 "본토 중심" 계산입니다.
 * getMainBounds처럼 가까운 조각들을 묶어서 범위를 넓히지 않고, 면적이
 * 가장 넓은 조각(본토) 하나의 중심만 그대로 씁니다 — 스페인의 카나리아
 * 제도처럼 본토에서 멀리 떨어진 작은 섬 때문에 점 위치가 남서쪽으로
 * 밀리는 문제를 막기 위해서입니다. (나라를 클릭했을 때 지도를 맞추는
 * 확대 범위는 getMainBounds를 그대로 쓰므로 이 함수와는 무관합니다.) */
function getMainlandCenter(layer) {
  const geometry = layer.feature && layer.feature.geometry;
  if (!geometry || geometry.type !== "MultiPolygon") {
    return layer.getBounds().getCenter();
  }

  const parts = layer.getLatLngs();
  const pieces = [];

  parts.forEach((rings) => {
    const outerRing = rings[0];
    if (!outerRing || outerRing.length === 0) return;
    pieces.push({
      bounds: L.latLngBounds(outerRing),
      area: approxRingArea(outerRing)
    });
  });

  if (pieces.length === 0) return layer.getBounds().getCenter();

  pieces.sort((a, b) => b.area - a.area);
  return pieces[0].bounds.getCenter();
}

function getMainBounds(layer) {
  const geometry = layer.feature && layer.feature.geometry;
  if (!geometry || geometry.type !== "MultiPolygon") {
    return layer.getBounds();
  }

  const parts = layer.getLatLngs(); // MultiPolygon: [ [ [ring...] ], [ [ring...] ], ... ]
  const pieces = [];

  parts.forEach((rings) => {
    const outerRing = rings[0];
    if (!outerRing || outerRing.length === 0) return;
    const bounds = L.latLngBounds(outerRing);
    pieces.push({
      bounds,
      area: approxRingArea(outerRing),
      center: bounds.getCenter()
    });
  });

  if (pieces.length === 0) return layer.getBounds();

  // 면적이 가장 넓은 조각을 본토 기준점으로 삼습니다.
  pieces.sort((a, b) => b.area - a.area);
  const main = pieces[0];

  const combined = L.latLngBounds(main.bounds.getSouthWest(), main.bounds.getNorthEast());
  pieces.slice(1).forEach((piece) => {
    if (main.center.distanceTo(piece.center) <= MAIN_BOUNDS_CLUSTER_KM * 1000) {
      combined.extend(piece.bounds);
    }
  });

  return combined;
}

/* ---------- 도시 하나를 보여줄 때의 "적당한 거리" 계산 ----------
 * 오사카·교토·고베처럼 도시들이 촘촘히 붙어있는 곳은 바짝 당겨야 점들이
 * 서로 구분되고, 미국처럼 도시 사이가 수백 km씩 떨어진 곳은 그렇게 당겨봐야
 * 화면에 점 하나만 덩그러니 남아서 어디인지 감이 안 옵니다.
 *
 * 그래서 고정된 줌 값을 쓰지 않고, "가장 가까운 이웃 도시가 화면에서 최소
 * 일정 픽셀(CONFIG.map.cityFocusSeparationPx) 떨어져 보이는 줌"을 그때그때
 * 계산합니다. 이웃이 가까우면 자동으로 많이 확대되고, 이웃이 멀면 자동으로
 * 넓게 보여주게 되는 셈입니다.
 *
 * 계산은 웹 메르카토르 지도의 기본 성질을 그대로 씁니다. 줌 0에서 적도의
 * 1픽셀은 약 156543m이고, 줌이 1 오를 때마다 절반이 되며, 위도가 높아질수록
 * cos(위도)만큼 줄어듭니다. 따라서 거리 d(m)를 p픽셀로 보이게 하려면
 *     2^줌 = p × 156543 × cos(위도) ÷ d
 * 가 되고, 양변에 로그를 씌우면 필요한 줌이 바로 나옵니다.
 *
 * 마지막으로 지도가 허용하는 범위(CONFIG.map.cityFocusMinZoom ~ maxZoom)
 * 안으로 잘라줍니다. 이웃 도시가 아예 없는 경우에는 하한값을 씁니다. */
const METERS_PER_PIXEL_AT_ZOOM_0 = 156543.03392;

/* 위도·경도 두 지점 사이의 거리(m). 지구를 구로 보는 하버사인 공식입니다. */
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/* 이 도시에서 가장 가까운 다른 도시까지의 거리(m). 비교 대상이 하나도
 * 없으면 null을 돌려줍니다. */
function nearestCityDistanceMeters(target) {
  const lat = parseFloat(target.lat);
  const lng = parseFloat(target.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  let nearest = Infinity;
  DATA.cities.forEach((city) => {
    if (String(city.city_id) === String(target.city_id)) return;
    const otherLat = parseFloat(city.lat);
    const otherLng = parseFloat(city.lng);
    if (Number.isNaN(otherLat) || Number.isNaN(otherLng)) return;
    const d = distanceMeters(lat, lng, otherLat, otherLng);
    // 좌표를 똑같이 적어둔 중복 행(거리 0)은 기준으로 삼지 않습니다.
    if (d > 0 && d < nearest) nearest = d;
  });
  return nearest === Infinity ? null : nearest;
}

function zoomForCity(city) {
  const cfg = CONFIG.map;
  const minZoom = cfg.cityFocusMinZoom;
  const nearest = nearestCityDistanceMeters(city);
  if (nearest == null) return minZoom;

  const lat = parseFloat(city.lat);
  const metersPerPixelAtZoom0 = METERS_PER_PIXEL_AT_ZOOM_0 * Math.cos((lat * Math.PI) / 180);
  const zoom = Math.log2((cfg.cityFocusSeparationPx * metersPerPixelAtZoom0) / nearest);

  return Math.max(minZoom, Math.min(cfg.maxZoom, Math.round(zoom * 10) / 10));
}

/* 이번 이동을 "날아가는 애니메이션"으로 보여줘도 도형이 끊기지 않을지
 * 판단합니다. 미리 그려둔 여유 영역(MAP_RENDERER_PADDING) 안에서 움직이는
 * 경우에만 true입니다.
 *
 * 축소(줌아웃)에 특히 엄격한 이유: 한 단계 축소될 때마다 화면에 담기는
 * 면적이 네 배로 늘어나서, 미리 그려둔 영역을 순식간에 벗어납니다. */
function canAnimateMapMove(latlng, targetZoom) {
  if (targetZoom < map.getZoom() - 1) return false;

  const size = map.getSize();
  const from = map.latLngToContainerPoint(map.getCenter());
  const to = map.latLngToContainerPoint(L.latLng(latlng));
  const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));

  // 여유분을 그대로 다 쓰지 않고 70%까지만 인정해서 안전하게 둡니다.
  return distance <= Math.min(size.x, size.y) * MAP_RENDERER_PADDING * 0.7;
}

let mapFadeTimer = null;

/* 화면을 아주 잠깐 흐렸다가 곧바로 목적지로 옮기고 다시 선명하게 만듭니다.
 * 날아가는 동안 빈 지도가 보이는 것보다, 장면이 바뀌듯 전환되는 쪽이
 * 훨씬 깔끔합니다. */
function jumpMapWithFade(latlng, zoom) {
  const el = document.getElementById("map");
  if (!el) {
    map.setView(latlng, zoom, { animate: false });
    return;
  }

  clearTimeout(mapFadeTimer);
  el.classList.add("is-map-fading");
  mapFadeTimer = setTimeout(() => {
    // animate: false라서 이 줄이 끝나는 순간 목적지 도형까지 다시 그려집니다.
    map.setView(latlng, zoom, { animate: false });
    // 새로 그려진 화면이 한 번 표시된 다음 프레임에 선명하게 되돌립니다.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.remove("is-map-fading"));
    });
  }, MAP_FADE_MS);
}

/* 지도 이동은 전부 이 함수를 거칩니다 — 가까운 거리면 부드럽게 날아가고,
 * 멀면 흐렸다 나타나는 방식으로 자동으로 갈라집니다. */
function moveMapTo(latlng, zoom, options) {
  const opts = options || {};
  if (!opts.animate) {
    map.setView(latlng, zoom, { animate: false });
    return;
  }
  if (canAnimateMapMove(latlng, zoom)) {
    map.flyTo(latlng, zoom);
  } else {
    jumpMapWithFade(latlng, zoom);
  }
}

/* 도시 하나를 화면 가운데에 적당한 거리로 보여줍니다.
 * animate: 검색처럼 방문자가 지도를 보고 있는 중이면 부드럽게 전환하고,
 * 공유 링크로 막 들어온 경우처럼 첫 화면이면 곧바로 그 자리에 띄웁니다. */
function focusCityOnMap(city, options) {
  const opts = options || {};
  const lat = parseFloat(city.lat);
  const lng = parseFloat(city.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  moveMapTo([lat, lng], zoomForCity(city), { animate: !!opts.animate });
}

/* source는 통계용입니다 — "map"(지도 클릭), "random"(랜덤 여행지 버튼),
 * "deep_link"(?region= 주소로 바로 들어온 경우), "search"(도시 검색)를
 * 구분해서 GA4로 보냅니다.
 *
 * options.skipMapMove를 주면 나라 전체로 맞추는 지도 이동을 건너뜁니다 —
 * 도시 검색처럼 "나라를 고른 뒤 곧바로 그 도시로 확대"하는 경우에, 나라
 * 맞추기와 도시 확대가 연달아 실행되며 화면이 두 번 움직이는 걸 막기
 * 위해서입니다. */
function selectCountry(code, source, options) {
  const opts = options || {};
  selectedCountryCode = String(code);
  selectedCityId = null;
  activeChannelFilter = "all"; // 새 나라를 고르면 채널 필터를 "전체보기"로 되돌립니다.

  if (!opts.skipMapMove) {
    const layer = countryLayer.getLayers().find((l) => String(l.feature.id) === selectedCountryCode);
    if (layer) {
      map.fitBounds(getMainBounds(layer), { padding: [30, 30] });
    } else {
      // 싱가포르처럼 세계 국경 데이터(110m 저해상도)에는 도형 자체가 없는 아주 작은
      // 나라는 fitBounds를 쓸 도형이 없으므로, map_center 좌표로 대신 이동합니다.
      const center = getCountryCenter(selectedCountryCode);
      if (center) map.setView(center, CONFIG.map.tinyCountryZoom);
    }
  }
  countryLayer.eachLayer((l) => l.setStyle(styleCountry(l.feature)));

  renderCityMarkers(selectedCountryCode);
  renderWorldCityMarkers(selectedCountryCode);
  updateBackButton();
  renderVideoPanel();
  renderHeaderAdBanner();
  syncUrlWithSelection();
  trackRegionSelect("country", source);
  scrollMapTopIntoViewIfBelowTop();
}

/* 지도 상단이 이미 화면 꼭대기보다 위로 스크롤되어 있으면(= 지도 상단이
 * 화면 밖으로 넘어간 상태) 그대로 두고, 지도 상단이 아직 화면 꼭대기보다
 * 아래(= 화면 안에 보이는 상태)라면 지도 상단이 화면 꼭대기에 딱 맞춰지도록
 * 그만큼만 끌어올립니다. 이미 화면 꼭대기와 정확히 맞아있거나 그보다 위에
 * 있으면 아무 것도 하지 않으므로, 모바일에서 영상을 이어서 고를 때 화면이
 * 불필요하게 움직이지 않습니다. */
function scrollMapTopIntoViewIfBelowTop() {
  if (window.innerWidth > 860) return;
  const mapEl = document.getElementById("map");
  if (!mapEl) return;
  const top = mapEl.getBoundingClientRect().top;
  if (top > 0) {
    window.scrollBy({ top, left: 0, behavior: "smooth" });
  }
}

/* ---------- 왼쪽 위 버튼: "내 위치" ----------
 * 예전에는 나라를 선택하면 이 버튼이 "← 세계지도로"로 바뀌는 두 가지 모드가
 * 있었지만, 지금은 항상 "내 위치" 버튼 하나만 있습니다. 나라를 선택한 상태든
 * 아니든 언제 눌러도 나라 선택을 풀고 접속자의 대략적인 지역이 넓게 보이는
 * 화면(페이지에 처음 접속했을 때와 같은 화면)으로 돌아갑니다.
 *
 * 브라우저 GPS 권한을 요청해서 정확한 좌표로 바짝 확대하는 방식이 아니라,
 * CONFIG.geoLocate(IP 기반) 결과를 그대로 재사용해서 그 지역 전체가 넓게
 * 보이도록 이동합니다 — 권한 팝업이 뜨지 않고, 페이지 로딩 시 이미 확인해둔
 * 값을 재사용하므로 거의 즉시 이동합니다. */
function updateBackButton() {
  const btn = document.getElementById("back-btn");
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="3"></circle>' +
    '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path>' +
    "</svg>" +
    '<span class="back-btn-label">내 위치</span>';
  btn.title = "내 위치 주변으로 이동";
}

async function handleBackButtonClick() {
  // 나라/도시 선택을 풀고 세계지도 마커 상태로 되돌립니다.
  selectedCountryCode = null;
  selectedCityId = null;
  activeChannelFilter = "all"; // 세계지도로 돌아가면 채널 필터도 "전체보기"로 되돌립니다.
  cityMarkersLayer.clearLayers();
  renderWorldCityMarkers();
  if (countryLayer) countryLayer.eachLayer((l) => l.setStyle(styleCountry(l.feature)));
  updateBackButton();
  renderVideoPanel();
  renderHeaderAdBanner();
  syncUrlWithSelection();

  // 접속자의 대략적인 지역(페이지 로딩 시 확인해둔 값을 재사용, 없으면
  // 기본 초기 위치)이 넓게 보이도록 이동합니다.
  const view = await getVisitorView();
  const target = view || { center: CONFIG.map.initialCenter, zoom: CONFIG.map.initialZoom };
  moveMapTo(target.center, target.zoom, { animate: true });
}

function renderCityMarkers(countryCode) {
  cityMarkersLayer.clearLayers();
  cityMarkersById = {};

  // 싱가포르처럼 Cities 탭에 도시가 하나도 없는 나라를 확대했을 때도, 나라 중심에
  // 점이 계속 보이도록 세계지도용 점과 동일하게 하나 그려줍니다.
  if (countryHasNoCities(countryCode)) {
    const center = getCountryCenter(countryCode);
    if (center) {
      const isNew = isNewCountry(countryCode);
      L.marker(center, { icon: buildCityIcon(countryVideoChannels(countryCode), false, isNew) })
        .addTo(cityMarkersLayer)
        .bindTooltip(`${countryName(countryCode)}${videoCountLabel(countryVideoCount(countryCode))}${isNew ? " · NEW" : ""}`, { className: "city-tooltip" });
    }
  }

  const cities = DATA.cities.filter((c) => String(c.country_code) === String(countryCode));
  cities.forEach((city) => {
    const lat = parseFloat(city.lat);
    const lng = parseFloat(city.lng);
    // Cities 탭에 위도/경도가 비어있거나 숫자가 아닌 값이 들어있는 행은
    // 건너뜁니다 — 여기서 그냥 진행하면 지도 전체가 에러로 멈춰버립니다.
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      console.warn(`Cities 탭: "${city.city_name_ko || city.city_id}"의 위도/경도 값이 올바르지 않아 지도에 표시하지 않았습니다.`, city);
      return;
    }
    const channels = cityChannels(city.city_id);
    const isNew = isNewCity(city.city_id);
    const suffix = videoCountLabel(cityVideoCount(city.city_id)) + (isNew ? " · NEW" : "");
    const marker = L.marker([lat, lng], {
      icon: buildCityIcon(channels, false, isNew)
    })
      .addTo(cityMarkersLayer)
      .bindTooltip(`${city.city_name_ko}${suffix}`, { className: "city-tooltip" })
      .on("click", () => {
        // 이미 나라 화면(국가 전체)까지는 확대돼 있는 상태이므로, 여기서는
        // 나라 이동 없이 곧바로 이 도시로 한 번 더 확대합니다 — 검색으로
        // 같은 도시를 골랐을 때와 똑같은 화면이 되도록 통일했습니다.
        selectCity(city.city_id, "city_marker");
        focusCityOnMap(city, { animate: true });
      });
    cityMarkersById[city.city_id] = marker;
  });
}

/* 지금 화면에 있는 도시 점들의 아이콘을 현재 선택 상태에 맞게 다시 칠합니다.
 * (선택된 도시는 진한 색, 최근 업데이트된 도시는 N 배지) */
function refreshCityMarkerIcons() {
  Object.entries(cityMarkersById).forEach(([id, marker]) => {
    marker.setIcon(buildCityIcon(cityChannels(id), id === selectedCityId, isNewCity(id)));
  });
}

function selectCity(cityId, source) {
  selectedCityId = String(cityId);
  refreshCityMarkerIcons();
  renderVideoPanel();
  renderHeaderAdBanner();
  syncUrlWithSelection();
  trackRegionSelect("city", source);
  scrollMapTopIntoViewIfBelowTop();
}

/* ---------- 오른쪽 영상 패널 ---------- */

function getFilteredVideos() {
  if (!selectedCountryCode) return [];
  let list;
  if (selectedCityId) {
    // 도시 하나만 담긴 영상은 물론, 그 도시를 포함한 여러 도시 비교 영상도 함께 보여줍니다.
    list = DATA.videos.filter((v) => videoCityIds(v).includes(selectedCityId));
  } else {
    // "국가 전체" 화면에서는 city_id가 비어있는 개요 영상만 보여줍니다. 여러
    // 도시를 함께 다루는 비교 영상(도시 2곳 이상)은 나라를 선택했을 때는 나오지
    // 않고, 그 비교에 포함된 도시들 중 하나를 선택했을 때만(위 selectedCityId
    // 분기) 보입니다. country_code에 여러 나라가 쉼표로 적혀있는 "국가 비교"
    // 영상은 city_id가 비어있는 한(나라 단위 비교) 그중 이 나라가 포함되어
    // 있으면 함께 보여줍니다.
    list = DATA.videos.filter((v) => {
      if (!videoCountryIds(v).includes(selectedCountryCode)) return false;
      return videoCityIds(v).length === 0;
    });
  }
  if (activeChannelFilter !== "all") {
    list = list.filter((v) => normalizeChannel(v.channel) === activeChannelFilter);
  }
  return sortVideosByOrder(list);
}

/* Videos 탭의 sort_order 값(숫자가 작을수록 먼저)에 맞춰 정렬합니다.
 * sort_order가 비어있거나 숫자가 아닌 영상은 맨 뒤로 보내고, 그 안에서는
 * (또는 값이 아예 없어서 아직 sort_order를 안 쓰는 경우에는 전체적으로)
 * 시트에 있던 원래 순서를 그대로 유지합니다(안정 정렬). */
function sortVideosByOrder(list) {
  return list
    .map((v, index) => ({ v, index }))
    .sort((a, b) => {
      const orderA = parseFloat(a.v.sort_order);
      const orderB = parseFloat(b.v.sort_order);
      const hasA = !Number.isNaN(orderA);
      const hasB = !Number.isNaN(orderB);
      if (hasA && hasB && orderA !== orderB) return orderA - orderB;
      if (hasA && !hasB) return -1;
      if (!hasA && hasB) return 1;
      return a.index - b.index;
    })
    .map((item) => item.v);
}

/* ---------- 지역별 맞춤 제휴 광고 (영상 카드들 사이에 끼워 넣는 카드) ----------
 * 도쿄에서는 "도쿄 디즈니랜드", 오사카에서는 "오사카 유니버설 스튜디오"처럼,
 * 그 도시(또는 나라)에서만 보이는 광고를 영상 카드들 사이에 영상 카드와 똑같은
 * 생김새로 자연스럽게 섞어서 보여줍니다. 완전히 선택 사항이며, 등록해둔
 * 도시/나라에서만 나타나고 다른 지역에서는 전혀 표시되지 않습니다.
 *
 * 구글시트에 "LocalAds"라는 새 탭을 만들고 다음 다섯 칸을 채워서 씁니다.
 *   city_id         이 도시를 선택했을 때 적용 (Cities 탭의 city_id와 동일)
 *   country_code    city_id가 비어있을 때, 아직 도시를 고르지 않은 "나라
 *                    전체" 화면에 적용 (Countries 탭의 country_code와 동일)
 *   local_ad_label  카드에 보일 문구 (예: "도쿄 디즈니랜드 입장권 예약하기")
 *   local_ad_url    클릭하면 이동할 제휴 링크
 *   local_ad_image  섬네일로 쓸 이미지 URL (비워두면 🎫 아이콘으로 대체)
 *
 * 같은 city_id(또는 country_code)로 여러 줄을 등록해두면, 그 지역을 볼
 * 때마다 그중 하나를 무작위로 골라서 보여줍니다 — 도시 하나에 광고를
 * 여러 개 걸고 싶을 때는 그냥 줄을 더 추가하면 됩니다. 자세한 설명과
 * 등록 방법은 README 19번 항목 참고. */

function localAdsForSelection() {
  if (selectedCityId) {
    return DATA.localAds.filter((a) => String(a.city_id || "").trim() === selectedCityId);
  }
  if (selectedCountryCode) {
    return DATA.localAds.filter(
      (a) => !String(a.city_id || "").trim() && String(a.country_code || "").trim() === selectedCountryCode
    );
  }
  return [];
}

/* 해당 지역에 걸린 광고 중 하나를 무작위로 골라 돌려줍니다. label과 url이
 * 둘 다 채워진 줄만 후보로 삼고(둘 중 하나라도 비어있으면 등록 실수로 보고
 * 건너뜁니다), 후보가 하나도 없으면 null을 돌려줘서 카드 자체가 나타나지
 * 않습니다. */
function localAdForSelection() {
  const candidates = localAdsForSelection().filter((a) => a.local_ad_label && a.local_ad_url);
  if (candidates.length === 0) return null;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  return { label: picked.local_ad_label, url: picked.local_ad_url, image: picked.local_ad_image || "" };
}

/* 영상 카드와 똑같은 마크업/클래스(.video-card)를 재사용해서 목록 안에
 * 자연스럽게 섞이도록 하되, data-local-ad 속성으로 영상 카드와 구분해서
 * 클릭했을 때 재생 모달이 아니라 제휴 링크로 바로 이동하게 합니다
 * (bindVideoModalEvents의 클릭 핸들러 참고). "제휴 광고" 배지로 광고임을
 * 분명히 표시합니다. */
function buildLocalAdCardHtml() {
  const ad = localAdForSelection();
  if (!ad) return "";
  // 시트에서 온 주소라서 href/src에 넣기 전에 safeUrl() + escapeHtml()을 거칩니다.
  const adUrl = safeUrl(ad.url);
  if (!adUrl) return ""; // 주소가 비었거나 이상하면 광고 카드 자체를 만들지 않습니다.
  const adImage = safeUrl(ad.image);
  const thumb = adImage
    ? `<img src="${escapeHtml(adImage)}" alt="" loading="lazy">`
    : `<span class="video-card-ad-icon" aria-hidden="true">🎫</span>`;
  return `
    <a class="video-card video-card-ad" href="${escapeHtml(adUrl)}" target="_blank" rel="noopener sponsored nofollow" data-local-ad="true"
       data-ad-network="local_ad" data-ad-placement="video_list" data-ad-label="${escapeHtml(ad.label)}">
      ${thumb}
      <div class="video-card-info">
        <p class="video-title">${escapeHtml(ad.label)}</p>
        <p class="video-guide">
          <span class="channel-tag channel-tag-ad">제휴 광고</span>
        </p>
      </div>
    </a>`;
}

/* ---------- 아고다(Agoda) 숙소 예약 제휴 배너 ----------
 * CONFIG.agoda.cid를 채우면, 헤더 아래 큰 광고 자리(#ad-slot-top)와 영상
 * 목록 맨 아래 작은 광고 자리가 자동으로 "지금 보고 있는 나라/도시 숙소
 * 예약" 아고다 제휴 배너로 바뀝니다. cid가 비어있으면 기존처럼 빈 "광고
 * 영역" 표시만 남습니다.
 *
 * Countries 탭에 agoda_country_slug, Cities 탭에 agoda_slug 열(둘 다 선택
 * 사항)을 추가하면 아고다의 실제 도시/국가 페이지로 바로 연결됩니다.
 *   - Cities  agoda_slug        예: tokyo-jp, bangkok-th, hanoi-vn
 *   - Countries agoda_country_slug  예: japan, thailand, vietnam
 * 안 채워도 동작은 합니다(아고다 홈으로 연결). 자세한 설명과 슬러그 찾는
 * 방법은 README 14번 항목 참고. */

function agodaEnabled() {
  return !!(CONFIG.agoda && CONFIG.agoda.cid);
}

function agodaUrl(path) {
  const sep = path.includes("?") ? "&" : "?";
  return `https://www.agoda.com${path}${sep}cid=${encodeURIComponent(CONFIG.agoda.cid)}`;
}

/* 지금 선택된 도시/나라에 맞는 아고다 링크와 화면에 보여줄 지명을 고릅니다.
 * 도시 슬러그 > 나라 슬러그 > (슬러그가 없으면) 아고다 홈 순서로 대신합니다. */
function agodaLinkForSelection() {
  const city = selectedCityId ? DATA.cities.find((c) => c.city_id === selectedCityId) : null;
  const country = selectedCountryCode ? findCountry(selectedCountryCode) : null;

  if (city && city.agoda_slug) {
    return { url: agodaUrl(`/city/${city.agoda_slug}.html`), place: city.city_name_ko };
  }
  if (country && country.agoda_country_slug) {
    return { url: agodaUrl(`/country/${country.agoda_country_slug}/popular-hotels.html`), place: country.country_name_ko };
  }
  return {
    url: agodaUrl("/"),
    place: city ? city.city_name_ko : country ? country.country_name_ko : ""
  };
}

/* variant: "leaderboard"(헤더 큰 자리) | "inline"(영상 목록 아래 작은 자리) */
/* variant: "leaderboard"(헤더 큰 자리 — #ad-slot-top이 이미 ad-slot/ad-slot-leaderboard
 * 클래스를 갖고 있으므로, 비활성 상태에서는 그 안에 들어갈 내용(span)만 돌려줍니다)
 * | "inline"(영상 목록 아래 작은 자리 — 감싸는 요소가 따로 없어서 div까지 함께 돌려줍니다) */
function buildAgodaBannerHtml(variant) {
  if (!agodaEnabled()) {
    if (variant === "inline") {
      return `<div class="ad-slot ad-slot-inline" aria-hidden="true"><span>광고 영역</span></div>`;
    }
    return `<span>광고 영역 (728×90)</span>`;
  }

  const { url, place } = agodaLinkForSelection();
  const headline = place ? `${escapeHtml(place)} 숙소` : "다음 여행 숙소";
  const variantClass = variant === "inline" ? " agoda-banner-inline" : " agoda-banner-leaderboard";
  const placement = variant === "inline" ? "inline" : "header";

  return `
    <a class="agoda-banner${variantClass}" href="${escapeHtml(url)}" target="_blank" rel="noopener sponsored nofollow"
       data-ad-network="agoda" data-ad-placement="${placement}" data-ad-label="${headline}">
      <span class="agoda-banner-icon" aria-hidden="true">🏨</span>
      <span class="agoda-banner-text">
        <strong>${headline} 최저가로 예약하기</strong>
        <span class="agoda-banner-sub">제휴 링크 · 예약하시면 트콤 가이드 제작에 도움이 돼요</span>
      </span>
      <span class="agoda-banner-cta">보러가기 &#8599;</span>
    </a>`;
}

/* ---------- 클룩(Klook) 어필리에이트 배너 (헤더 전용) ----------
 * CONFIG.klook.enabled가 true면 헤더 아래 큰 광고 자리(#ad-slot-top)에
 * images/klook-banner.svg 이미지 배너가 표시되고, CONFIG.klook.redirectUrl로
 * 링크됩니다. 국가/도시별로 바뀌는 텍스트 배너가 아니라 항상 같은 고정
 * 이미지입니다. 자세한 설명은 README 15번 항목 참고. */

function klookEnabled() {
  return !!(CONFIG.klook && CONFIG.klook.enabled && CONFIG.klook.redirectUrl);
}

function buildKlookBannerHtml() {
  const url = CONFIG.klook.redirectUrl;
  const img = CONFIG.klook.bannerImage || "images/klook-banner.svg";
  return `
    <a class="klook-banner" href="${escapeHtml(url)}" target="_blank" rel="noopener sponsored nofollow"
       data-ad-network="klook" data-ad-placement="header" data-ad-label="클룩 렌터카">
      <img src="${img}" width="728" height="90" alt="클룩(Klook) 렌터카 예약하기 - 제휴 링크">
    </a>`;
}

/* 헤더 아래 큰 광고 자리(#ad-slot-top)를 지금 선택 상태에 맞춰 다시 그립니다.
 * 세계지도 화면, 나라 선택, 도시 선택이 바뀔 때마다 호출해서 배너가 항상
 * 최신 상태를 반영하도록 유지합니다.
 *
 * 우선순위: 클룩(고정 이미지 배너) → 아고다(선택한 나라/도시에 맞춘 텍스트
 * 배너) → 빈 "광고 영역" 표시. 클룩은 나라/도시에 따라 바뀌지 않는 고정
 * 배너라 헤더 큰 자리를 먼저 차지합니다. 영상 목록 아래 작은 자리
 * (buildInlineAdHtml)는 트립닷컴 → 아고다 순서로 별도로 정해집니다.
 *
 * #ad-slot-top은 index.html에 이미 "ad-slot ad-slot-leaderboard" 클래스와
 * aria-hidden="true"가 있는 고정 요소입니다. 배너가 켜지면 실제로 클릭할
 * 수 있는 링크가 되므로 "ad-slot"(점선 placeholder 배경) 클래스와
 * aria-hidden을 함께 빼서, 스크린 리더에서도 정상적으로 읽히게 합니다. */
function renderHeaderAdBanner() {
  const slot = document.getElementById("ad-slot-top");
  if (!slot) return;
  const enabled = klookEnabled() || agodaEnabled();
  slot.classList.toggle("ad-slot", !enabled);
  if (enabled) {
    slot.removeAttribute("aria-hidden");
  } else {
    slot.setAttribute("aria-hidden", "true");
  }
  if (klookEnabled()) {
    slot.innerHTML = buildKlookBannerHtml();
  } else {
    slot.innerHTML = buildAgodaBannerHtml("leaderboard");
  }
}

/* 헤더 아래 "OO개국 OO개 도시 OO개의 가이드" 요약 문구(#site-stats).
 * 데이터가 새로 로드/갱신될 때마다 다시 계산해서 항상 최신 숫자를 보여줍니다.
 *
 * - 나라 수: Countries 탭에서 has_video가 TRUE인(=지도에 색칠되는) 나라만.
 * - 도시 수: Cities 탭 중에서 영상이 하나라도 연결된 도시만(아직 "영상
 *   준비중"인 도시는 실제로 볼 가이드가 없으므로 뺍니다).
 * - 가이드(영상) 수: Videos 탭에서 channel이 "여행하는트콤"인 것만 뺀
 *   나머지(=트립콤파니 채널) 영상 개수. 여러 도시를 함께 다루는 비교
 *   영상도 한 행 = 한 편으로 셉니다. */
function renderSiteStats() {
  const el = document.getElementById("site-stats");
  if (!el) return;

  const countryCount = DATA.countries.filter((c) => countryHasVideo(c.country_code)).length;
  const cityCount = DATA.cities.filter((c) => cityChannels(c.city_id).size > 0).length;
  const videoCount = DATA.videos.filter((v) => normalizeChannel(v.channel) !== "trekom").length;

  if (!countryCount && !cityCount && !videoCount) {
    el.textContent = "";
    return;
  }

  el.textContent = `${countryCount}개국 · ${cityCount}개 도시 · ${videoCount}개의 가이드`;
}

/* ---------- 트립닷컴(Trip.com) 호텔 예약 제휴 배너 (영상 목록 아래 작은 자리 전용) ----------
 * CONFIG.tripcom.enabled가 true면 영상 목록 아래 작은 광고 자리에
 * images/tripcom-banner.svg 이미지 배너가 표시되고, CONFIG.tripcom.redirectUrl로
 * 링크됩니다. 클룩 헤더 배너와 마찬가지로 국가/도시별로 바뀌지 않는 고정
 * 이미지입니다. 자세한 설명은 README 17번 항목 참고. */

function tripcomEnabled() {
  return !!(CONFIG.tripcom && CONFIG.tripcom.enabled && CONFIG.tripcom.redirectUrl);
}

function buildTripcomBannerHtml() {
  const url = CONFIG.tripcom.redirectUrl;
  const img = CONFIG.tripcom.bannerImage || "images/tripcom-banner.svg";
  return `
    <a class="tripcom-banner" href="${escapeHtml(url)}" target="_blank" rel="noopener sponsored nofollow"
       data-ad-network="tripcom" data-ad-placement="inline" data-ad-label="트립닷컴 호텔 예약">
      <img src="${img}" width="400" height="70" alt="트립닷컴(Trip.com) 호텔 특가 예약하기 - 제휴 링크">
    </a>`;
}

/* 영상 목록 아래 작은 광고 자리의 내용을 고릅니다.
 * 우선순위: 트립닷컴(고정 이미지 배너) → 아고다(선택한 나라/도시에 맞춘 텍스트
 * 배너) → 빈 "광고 영역" 표시. */
function buildInlineAdHtml() {
  if (tripcomEnabled()) return buildTripcomBannerHtml();
  return buildAgodaBannerHtml("inline");
}

/* 오른쪽 영상 패널 상단의 채널별 필터 탭("전체보기"/"트립콤파니"/"여행하는트콤")을
 * 현재 선택 상태(activeChannelFilter)에 맞게 다시 그립니다. 나라를 아직
 * 고르기 전에는 걸러볼 영상 목록 자체가 없으므로 탭 전체를 숨깁니다. */
function renderChannelTabs() {
  const tabsEl = document.getElementById("channel-tabs");
  if (!tabsEl) return;

  if (!selectedCountryCode) {
    tabsEl.hidden = true;
    return;
  }
  tabsEl.hidden = false;

  tabsEl.querySelectorAll(".channel-tab").forEach((btn) => {
    const isActive = btn.dataset.channelFilter === activeChannelFilter;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    // 탭 묶음은 Tab 키로 "탭 하나"에만 들어오고, 그 안에서는 화살표로
    // 옮겨다니는 것이 표준 동작입니다(roving tabindex). 그래서 선택된 탭만
    // 키보드 초점을 받을 수 있게 해둡니다.
    btn.setAttribute("tabindex", isActive ? "0" : "-1");
  });
}

/* 채널 탭 버튼을 클릭했을 때 필터 상태를 바꾸고 목록을 다시 그립니다.
 * #channel-tabs 컨테이너 하나에만 이벤트를 걸어서 위임(event delegation)
 * 방식으로 처리합니다(버튼은 매번 다시 그려지는 게 아니라 고정 마크업이지만,
 * 다른 목록들과 일관된 방식을 씁니다). */
function bindChannelTabEvents() {
  const tabsEl = document.getElementById("channel-tabs");
  if (!tabsEl) return;

  tabsEl.addEventListener("click", (event) => {
    const btn = event.target.closest(".channel-tab");
    if (!btn) return;
    activateChannelTab(btn.dataset.channelFilter || "all");
  });

  // 키보드 사용자를 위한 화살표 이동 — 탭 묶음 안에서는 ←/→(위/아래)로
  // 옆 탭으로 옮겨가고, Home/End로 처음·마지막 탭으로 갑니다. 옮겨간 탭은
  // 바로 선택됩니다(마우스로 누른 것과 같은 동작이라 GA4 이벤트도 같이
  // 나갑니다 — 방문자가 직접 고른 것이 맞으니까요).
  tabsEl.addEventListener("keydown", (event) => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (keys.indexOf(event.key) === -1) return;
    const btns = Array.from(tabsEl.querySelectorAll(".channel-tab"));
    if (btns.length === 0) return;
    const current = btns.indexOf(event.target.closest(".channel-tab"));
    if (current === -1) return;

    let next;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = btns.length - 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + btns.length) % btns.length;
    else next = (current + 1) % btns.length;

    event.preventDefault();
    activateChannelTab(btns[next].dataset.channelFilter || "all");
    // 다시 그린 뒤에도 같은 자리의 버튼에 초점이 남아있도록 직접 옮겨줍니다.
    const moved = tabsEl.querySelectorAll(".channel-tab")[next];
    if (moved) moved.focus();
  });
}

/* 탭을 실제로 선택하는 한 곳 — 마우스 클릭과 키보드 이동이 모두 여기를
 * 거칩니다. 이미 선택된 탭이면 아무 것도 하지 않습니다(다시 그리지도,
 * GA4 이벤트를 보내지도 않습니다). */
function activateChannelTab(filter) {
  if (filter === activeChannelFilter) return;
  const previousFilter = activeChannelFilter;
  activeChannelFilter = filter;
  renderVideoPanel();
  // 목록을 다시 그린 뒤에 보내야 result_count(필터 적용 후 영상 개수)가
  // 방문자가 실제로 보게 된 화면과 일치합니다.
  trackChannelFilter(filter, previousFilter);
}

/* 채널 필터 탭을 "방문자가 직접 눌렀을 때"만 GA4로 보냅니다. 나라를 새로
 * 고르거나 세계지도로 돌아가면서 필터가 "전체보기"로 자동 초기화되는 경우는
 * 방문자의 선택이 아니므로 집계에 넣지 않습니다(안 그러면 지도 클릭 수만큼
 * "전체보기"가 부풀려집니다).
 * result_count는 탭을 누른 결과 실제로 몇 개의 영상이 남았는지라서, 0으로
 * 잡히는 조합(예: 이 지역엔 여행하는트콤 영상이 없음)을 GA4에서 바로
 * 찾아볼 수 있습니다. */
function trackChannelFilter(filter, previousFilter) {
  const headingEl = document.getElementById("panel-heading");
  trackEvent("channel_filter", {
    filter_channel: filter,
    filter_label: channelFilterLabel(filter),
    previous_filter: previousFilter || "",
    region_type: selectedCityId ? "city" : "country",
    region_name: headingEl ? headingEl.textContent.trim() : "",
    region_slug: currentRegionSlug(),
    result_count: getFilteredVideos().length
  });
}

/* 탭 값("all"/"trip"/"trekom")을 사람이 읽는 이름으로 바꿔줍니다. GA4
 * 보고서에서 filter_channel 대신 바로 읽히는 값을 쓰고 싶을 때를 위한
 * filter_label 용도입니다. */
function channelFilterLabel(filter) {
  if (filter === "all") return "전체보기";
  return CHANNEL_LABEL[filter] || String(filter || "");
}

function renderVideoPanel() {
  const heading = document.getElementById("panel-heading");
  const listEl = document.getElementById("video-list");
  updateShareButton();
  updateCityGuideButton();
  renderChannelTabs();

  if (!selectedCountryCode) {
    heading.textContent = "지도에서 국가를 선택해보세요";
    listEl.innerHTML =
      `<p class="panel-empty">짙게 표시된 국가를 클릭(모바일은 터치)하면 관련 가이드 영상을 보실 수 있습니다.</p>` +
      buildInlineAdHtml();
    return;
  }

  const country = findCountry(selectedCountryCode);
  const city = selectedCityId ? DATA.cities.find((c) => c.city_id === selectedCityId) : null;
  heading.textContent = city
    ? `${country ? country.country_name_ko : ""} · ${city.city_name_ko}`
    : `${country ? country.country_name_ko : ""} 전체`;

  const list = getFilteredVideos();
  const localAdHtml = buildLocalAdCardHtml();

  if (list.length === 0) {
    // 채널 필터 때문에 0개가 된 것인지("트립콤파니" 탭인데 이 지역엔 트립콤파니
    // 영상이 없는 경우)와, 필터와 상관없이 애초에 영상이 없는 것인지를 구분해서
    // "영상이 아예 없다"는 오해를 하지 않도록 안내 문구를 다르게 보여줍니다.
    let emptyMsg;
    if (activeChannelFilter !== "all") {
      emptyMsg = `${escapeHtml(CHANNEL_LABEL[activeChannelFilter])} 영상은 아직 없습니다. 다른 탭도 확인해보세요.`;
    } else {
      emptyMsg = city
        ? `${escapeHtml(city.city_name_ko)} 영상은 준비중입니다. 조금만 기다려주세요!`
        : "아직 등록된 영상이 없습니다.";
    }
    listEl.innerHTML = `<p class="panel-empty">${emptyMsg}</p>` + localAdHtml + buildInlineAdHtml();
    return;
  }

  const cardsHtml = list.map((v) => {
    const vid = extractYoutubeId(v.youtube_url);
    const channel = normalizeChannel(v.channel);
    // 도시(또는 나라) 2곳 이상을 함께 다루는 비교 영상이면, 무엇을 비교하는지
    // 작게 표시해줍니다(예: "도쿄 · 오사카 · 후쿠오카 · 삿포로 비교",
    // "일본 · 베트남 비교"). 도시 비교가 더 구체적이라 우선합니다.
    const compareCityIds = videoCityIds(v);
    const compareCountryIds = videoCountryIds(v);
    let compareLine = "";
    if (compareCityIds.length >= 2) {
      const names = compareCityIds.map((id) => {
        const c = DATA.cities.find((city) => city.city_id === id);
        return c ? c.city_name_ko : id;
      });
      compareLine = `<p class="video-compare">${escapeHtml(names.join(" · "))} 비교</p>`;
    } else if (compareCountryIds.length >= 2) {
      const names = compareCountryIds.map((id) => countryName(id));
      compareLine = `<p class="video-compare">${escapeHtml(names.join(" · "))} 비교</p>`;
    }
    const isNew = isVideoNew(v);
    return `
    <a class="video-card" href="https://www.youtube.com/watch?v=${vid}" target="_blank" rel="noopener noreferrer"
       data-video-id="${vid}" data-video-title="${escapeHtml(v.title)}">
      <img src="https://img.youtube.com/vi/${vid}/mqdefault.jpg" alt="" loading="lazy">
      <div class="video-card-info">
        <p class="video-title">${escapeHtml(v.title)}</p>
        ${compareLine}
        <p class="video-guide">
          <span class="channel-tag channel-tag-${channel}">${CHANNEL_LABEL[channel]}</span>
          ${v.guide_name ? escapeHtml(v.guide_name) : ""}
          ${isNew ? '<span class="video-new-badge" aria-hidden="true">NEW</span>' : ""}
        </p>
      </div>
    </a>`;
  });

  // 지역별 맞춤 광고가 있으면, 영상 카드가 2개 이상일 때는 두 번째 카드
  // 뒤에, 1개뿐일 때는 그 뒤에 끼워 넣어서 영상들 사이에 자연스럽게
  // 섞이도록 합니다.
  if (localAdHtml) {
    cardsHtml.splice(Math.min(2, cardsHtml.length), 0, localAdHtml);
  }

  listEl.innerHTML = cardsHtml.join("") + buildInlineAdHtml();
}

/* ---------- 영상 재생 모달 ----------
 * 영상 카드를 클릭하면 새 탭으로 유튜브에 보내는 대신, 지도 위에 크게 뜨는
 * 모달 안에서 재생합니다(모달이 뜨면 유튜브 썸네일/재생 버튼이 먼저 보이고,
 * 방문자가 그 버튼을 한 번 더 눌러야 실제로 재생이 시작됩니다 — 자바스크립트로
 * 강제 재생시키지 않는 이유는 아래 openVideoModal 주석 참고, 광고/수익과
 * 관련 있습니다). youtube-nocookie.com + rel=0으로 재생이 끝난 뒤 다른
 * 채널의 추천 영상이 뜨는 걸 최대한 줄였고, 모달 안에는 원본 유튜브
 * 페이지로 가는 링크도 남겨뒀습니다(구독/댓글 등은 거기서).
 *
 * 모달 하단에는 "이어서 볼 영상" 추천 목록도 함께 보여줍니다. 추천 대상은
 * 현재 오른쪽 패널에 표시 중인 영상 목록(getFilteredVideos())을 그대로
 * 재사용합니다 — 지금 보고 있는 나라/도시와 관련된 영상이라 사이트를 떠나지
 * 않고도 계속 둘러볼 만합니다. */
let modalRelatedPool = [];

function openVideoModal(videoId, title, relatedPool) {
  if (!videoId) return;
  const modal = document.getElementById("video-modal");
  const iframe = document.getElementById("video-modal-iframe");
  const titleEl = document.getElementById("video-modal-title");
  const ytLink = document.getElementById("video-modal-yt-link");

  // autoplay=1로 강제 재생시키지 않습니다 — 유튜브 공식 정책상 광고가 붙으려면
  // "스크립트로 강제 재생"이 아니라 "방문자가 직접 클릭하는 재생(click-to-play)"
  // 이어야 합니다. 모달이 열리면 유튜브 썸네일과 재생 버튼만 뜨고, 방문자가
  // 그 안에서 한 번 더 눌러야 재생이 시작되는데, 그래야 광고가 정상적으로
  // 붙어서 채널 수익으로 이어집니다. README "임베드 영상 광고/수익" 항목 참고.
  iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
  iframe.title = title || "영상 재생";
  titleEl.textContent = title || "";
  ytLink.href = `https://www.youtube.com/watch?v=${videoId}`;

  // relatedPool이 넘어오면(영상 목록에서 새로 열었을 때) 추천 목록의 기준을
  // 새로 갱신하고, 넘어오지 않으면(추천 목록 안의 영상을 클릭했을 때) 방금
  // 전 추천 목록을 그대로 유지한 채 방금 재생을 시작한 영상만 목록에서 뺍니다.
  if (relatedPool) modalRelatedPool = relatedPool;
  renderModalRelated(modalRelatedPool, videoId);

  modal.hidden = false;
  document.body.style.overflow = "hidden";

  // 어떤 영상이 실제로 재생됐는지 GA4로 보냅니다. relatedPool이 넘어왔다는 건
  // 오른쪽 영상 목록에서 새로 연 것이고, 안 넘어왔으면 모달 아래 "이어서 볼
  // 영상"에서 이어 본 것이라 open_source로 구분해둡니다.
  const video = DATA.videos.find((v) => extractYoutubeId(v.youtube_url) === videoId);
  const headingEl = document.getElementById("panel-heading");
  trackEvent("video_open", {
    video_id: videoId,
    video_title: title || "",
    video_channel: video ? CHANNEL_LABEL[normalizeChannel(video.channel)] : "",
    region_name: headingEl ? headingEl.textContent.trim() : "",
    region_slug: currentRegionSlug(),
    open_source: relatedPool ? "video_list" : "related_list"
  });
}

function closeVideoModal() {
  const modal = document.getElementById("video-modal");
  const iframe = document.getElementById("video-modal-iframe");
  if (modal.hidden) return;
  modal.hidden = true;
  iframe.src = ""; // 백그라운드에서 소리가 계속 나지 않도록 재생 중지
  document.body.style.overflow = "";
}

/* 추천 풀(pool)에서 지금 재생 중인 영상만 뺀 뒤, 썸네일 카드 목록으로 그립니다.
 * 보여줄 영상이 하나도 없으면(예: 그 도시 영상이 이거 하나뿐인 경우) 섹션 자체를
 * 숨겨서 빈 자리가 어색하게 남지 않도록 합니다. */
function renderModalRelated(videos, excludeVideoId) {
  const section = document.getElementById("video-modal-related");
  const listEl = document.getElementById("video-modal-related-list");
  if (!section || !listEl) return;

  const items = (videos || [])
    .map((v) => ({ v, vid: extractYoutubeId(v.youtube_url) }))
    .filter((item) => item.vid && item.vid !== excludeVideoId)
    .slice(0, 8);

  if (items.length === 0) {
    section.hidden = true;
    listEl.innerHTML = "";
    return;
  }

  section.hidden = false;
  listEl.innerHTML = items
    .map(
      ({ v, vid }) => `
      <button type="button" class="video-modal-related-item" data-video-id="${vid}" data-video-title="${escapeHtml(v.title)}">
        <img src="https://img.youtube.com/vi/${vid}/mqdefault.jpg" alt="" loading="lazy">
        <span class="video-modal-related-item-title">${escapeHtml(v.title)}</span>
      </button>`
    )
    .join("");
}

/* ---------- 제휴 광고 클릭 통계 (GA4) ----------
 * 클룩·아고다·트립닷컴·지역별 맞춤 광고 링크에 공통으로 data-ad-network /
 * data-ad-placement / data-ad-label 속성을 붙여두고, document 전체에 클릭
 * 이벤트 하나만 걸어서 그 속성이 있는 링크를 클릭할 때마다 GA4로
 * "affiliate_click" 이벤트를 보냅니다. 헤더 배너, 영상 목록 아래 배너,
 * 지역별 광고 카드는 나라/도시가 바뀔 때마다 innerHTML로 통째로 다시
 * 그려지는데, document에 한 번만 걸어두는 위임(event delegation) 방식이라
 * 다시 그려질 때마다 이벤트를 새로 걸어줄 필요가 없습니다.
 *
 * GA4의 "이벤트" 보고서(또는 실시간 보고서)에서 affiliate_click 이벤트를
 * 찾고, ad_network(klook/agoda/tripcom/local_ad)·ad_placement(header/
 * inline/video_list)·ad_label 파라미터로 어떤 광고가 얼마나 클릭됐는지
 * 나눠볼 수 있습니다. 쿠키 동의를 거부한 방문자의 클릭은 다른 모든 GA4
 * 이벤트와 마찬가지로 Consent Mode 설정에 따라 실제 집계에 반영되지
 * 않습니다.
 *
 * 참고: 하단 "채널별 최신 영상" 가운데 자리의 트립닷컴 광고(iframe)는
 * 트립닷컴이 직접 제공하는 화면이 우리 페이지 안에 그대로 떠 있는
 * 것이라, 브라우저 보안 정책상 그 안에서 일어나는 클릭은 우리 쪽
 * 자바스크립트로 감지할 수 없습니다. 그래서 이 자리는 이 통계에서
 * 빠집니다 — 실제 링크(<a> 태그)로 되어 있는 나머지 광고들만 집계됩니다. */
function bindAffiliateClickTracking() {
  document.addEventListener("click", (event) => {
    const el = event.target.closest("[data-ad-network]");
    if (!el) return;
    trackEvent("affiliate_click", {
      ad_network: el.dataset.adNetwork || "",
      ad_placement: el.dataset.adPlacement || "",
      ad_label: el.dataset.adLabel || "",
      link_url: el.href || ""
    });
  });
}

/* ---------- GA4 이벤트 전송 공통 함수 ----------
 * 이 사이트가 GA4로 보내는 맞춤 이벤트는 지금 일곱 가지입니다.
 *   - affiliate_click : 제휴 광고 클릭 (README 20번 항목)
 *   - region_select   : 지도에서 나라/도시를 선택 (어느 지역이 인기 있는지)
 *   - video_open      : 영상 재생 모달을 열었을 때 (어떤 영상이 실제로 재생됐는지)
 *   - share_click     : 영상 패널의 "공유" 버튼을 눌렀을 때
 *   - channel_filter  : 오른쪽 영상 목록 위 채널 필터 탭을 눌렀을 때 (README 39번 항목)
 *   - city_search     : 도시 검색창에서 검색 결과를 골랐을 때
 *   - city_search_no_result : 검색했는데 결과가 하나도 없을 때
 * 광고 차단기 등으로 gtag이 아예 없을 수도 있으므로 항상 확인한 뒤 보내고,
 * 전송이 실패하더라도 화면 동작에는 영향이 없도록 감싸뒀습니다. */
function trackEvent(name, params) {
  if (typeof window.gtag !== "function") return;
  try {
    window.gtag("event", name, params || {});
  } catch (err) {
    /* 통계 전송 실패가 사이트 동작을 막지 않도록 조용히 무시합니다. */
  }
}

/* region_select 이벤트에 함께 보낼 값들을 만듭니다. 지도 클릭인지, 랜덤
 * 여행지 버튼인지, 공유 링크(?region=)로 바로 들어온 것인지를 select_source로
 * 구분해두면, 나중에 "사람들이 진짜 관심 있어서 고른 지역"만 따로 볼 수
 * 있습니다. */
function trackRegionSelect(type, source) {
  const country = selectedCountryCode ? findCountry(selectedCountryCode) : null;
  const city =
    type === "city" && selectedCityId
      ? DATA.cities.find((c) => c.city_id === selectedCityId)
      : null;

  trackEvent("region_select", {
    region_type: type,
    region_name: city
      ? `${country ? country.country_name_ko : ""} · ${city.city_name_ko}`
      : (country ? country.country_name_ko : ""),
    region_slug: currentRegionSlug(),
    select_source: source || "map"
  });
}

/* 영상 목록(#video-list)은 매번 innerHTML로 통째로 다시 그려지기 때문에,
 * 카드 하나하나가 아니라 목록 컨테이너에 이벤트를 한 번만 걸어두고
 * 위임(event delegation) 방식으로 클릭을 잡습니다. 모달 안의 추천 목록도
 * 매번 통째로 다시 그려지므로 같은 방식으로 처리합니다. */
function bindVideoModalEvents() {
  document.getElementById("video-list").addEventListener("click", (event) => {
    const card = event.target.closest(".video-card");
    if (!card) return;
    // 지역별 맞춤 광고 카드(video-card-ad)는 영상이 아니라 제휴 링크이므로,
    // 재생 모달을 띄우지 않고 href가 가리키는 새 탭으로 그대로 이동시킵니다.
    if (card.dataset.localAd) return;
    // 가운데 클릭, Ctrl/Cmd/Shift/Alt+클릭은 "새 탭에서 열기" 같은 브라우저
    // 기본 동작을 그대로 존중하고 모달을 띄우지 않습니다.
    if (event.button === 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    openVideoModal(card.dataset.videoId, card.dataset.videoTitle, getFilteredVideos());
  });

  document.getElementById("video-modal-related-list").addEventListener("click", (event) => {
    const item = event.target.closest(".video-modal-related-item");
    if (!item) return;
    openVideoModal(item.dataset.videoId, item.dataset.videoTitle);
  });

  document.getElementById("video-modal-close").addEventListener("click", closeVideoModal);
  document.getElementById("video-modal-backdrop").addEventListener("click", closeVideoModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeVideoModal();
  });
}

/* ---------- 랜덤 여행지 추천 ----------
 * has_video인 나라 중 하나를 무작위로 골라 지도를 그쪽으로 이동시키고,
 * 그 나라에 영상이 있는 도시가 있으면 그중 하나도 함께 무작위로 골라
 * 바로 선택해줍니다(패널에 영상이 바로 뜹니다). 이미 보고 있는 나라와
 * 똑같은 나라가 다시 뽑히면 심심하니, 고를 수 있는 다른 나라가 있는 한
 * 지금 나라는 후보에서 뺍니다. */
function goToRandomDestination() {
  const countryCodes = DATA.countries
    .filter((c) => isTrue(c.has_video))
    .map((c) => String(c.country_code));
  if (countryCodes.length === 0) return;

  let candidates = countryCodes;
  if (selectedCountryCode && countryCodes.length > 1) {
    candidates = countryCodes.filter((code) => code !== selectedCountryCode);
  }
  const code = candidates[Math.floor(Math.random() * candidates.length)];

  // 어느 도시를 보여줄지 먼저 정합니다 — 도시까지 정해진 경우에는 나라
  // 전체로 맞추는 이동을 건너뛰고(화면이 두 번 움직이지 않도록) 곧바로 그
  // 도시를 주변 밀도에 맞는 거리로 보여주기 위해서입니다. 싱가포르처럼
  // 보여줄 도시가 없는 나라는 지금까지처럼 나라 전체를 맞춰줍니다.
  const citiesWithVideo = DATA.cities.filter(
    (c) => String(c.country_code) === code && cityChannels(c.city_id).size > 0
  );
  const city =
    citiesWithVideo.length > 0
      ? citiesWithVideo[Math.floor(Math.random() * citiesWithVideo.length)]
      : null;

  selectCountry(code, "random", { skipMapMove: !!city });

  if (city) {
    selectCity(city.city_id, "random");
    focusCityOnMap(city, { animate: true });
  }
}

/* ---------- 주소창 ?region= 값으로 특정 도시/나라 바로 열기 ----------
 * 예: https://tripcompany.world/map?region=osaka 로 들어오면 오사카가 이미
 * 선택된 화면으로 바로 열립니다. Netlify의 _redirects 파일이 "/map" 경로를
 * index.html로 연결해주기 때문에 가능한 기능이라, 이 사이트를 옮기거나
 * 다시 배포할 때 _redirects 파일도 항상 함께 올려야 합니다(README 22번
 * 항목 참고). 참고로 "/map"이 아니라 그냥 "https://tripcompany.world/?region=osaka"처럼
 * 주소 맨 끝에 붙여도 똑같이 동작합니다.
 *
 * region 값은 대소문자 구분 없이 아래 순서로 찾습니다.
 *   1. Cities 탭 city_id 전체와 일치 (예: "jp-osaka")
 *   2. city_id에서 국가 코드 뒷부분만 일치 (예: "osaka" → "JP-OSAKA")
 *   3. Cities 탭 agoda_slug와 일치 (예: "osaka-jp")
 *   4. 위에서 도시를 못 찾았으면 Countries 탭 agoda_country_slug와 일치
 *      (예: "japan" → 일본 국가 전체 화면)
 * 전부 못 찾으면 에러 없이 그냥 평소 첫 화면을 보여줍니다. */
function findCityBySlug(rawSlug) {
  const slug = String(rawSlug || "").trim().toLowerCase();
  if (!slug) return null;

  const byFullId = DATA.cities.find((c) => String(c.city_id).toLowerCase() === slug);
  if (byFullId) return byFullId;

  const bySuffix = DATA.cities.find((c) => {
    const parts = String(c.city_id).split("-");
    return parts.length > 1 && parts.slice(1).join("-").toLowerCase() === slug;
  });
  if (bySuffix) return bySuffix;

  return DATA.cities.find((c) => String(c.agoda_slug || "").toLowerCase() === slug) || null;
}

function findCountryBySlug(rawSlug) {
  const slug = String(rawSlug || "").trim().toLowerCase();
  if (!slug) return null;
  const bySlug = DATA.countries.find(
    (c) => String(c.agoda_country_slug || "").toLowerCase() === slug
  );
  if (bySlug) return bySlug;
  // agoda_country_slug를 안 채운 나라도 링크를 만들 수 있도록, 국가 코드
  // 숫자(예: 392)도 그대로 받아줍니다.
  return DATA.countries.find((c) => String(c.country_code).toLowerCase() === slug) || null;
}

function applyRegionDeepLink() {
  const region = new URLSearchParams(window.location.search).get("region");
  if (!region) return;

  const city = findCityBySlug(region);
  if (city) {
    // 나라 전체로 맞췄다가 다시 도시로 확대하면 화면이 두 번 움직이므로,
    // 나라 쪽 이동은 건너뛰고 곧바로 그 도시를 적당한 거리에서 보여줍니다.
    selectCountry(city.country_code, "deep_link", { skipMapMove: true });
    selectCity(city.city_id, "deep_link");
    focusCityOnMap(city);
    return;
  }

  const country = findCountryBySlug(region);
  if (country) {
    selectCountry(country.country_code, "deep_link");
  }
}

/* ---------- 주소창 동기화 & 공유 ----------
 * 방문자가 지도에서 도시를 고를 때마다 주소창도 그 도시의 주소
 * (?region=osaka)로 조용히 바뀝니다. 그래서 지금 보고 있는 화면의 주소를
 * 그대로 복사해서 친구에게 보내면, 받은 사람도 똑같이 오사카가 선택된
 * 화면으로 바로 들어오게 됩니다.
 *
 * history.pushState가 아니라 replaceState를 쓰는 이유: pushState를 쓰면
 * 도시를 고를 때마다 방문 기록이 쌓여서, 유튜브에서 넘어온 방문자가
 * 뒤로가기를 눌렀을 때 유튜브로 못 돌아가고 이전에 고른 도시들을 하나씩
 * 거슬러 올라가게 됩니다. 주소 공유라는 목적은 replaceState만으로 충분히
 * 달성되면서 뒤로가기는 평소대로 동작하도록 이렇게 했습니다.
 *
 * 또 한 가지: 주소를 다시 쓸 때 utm_source 같은 기존 파라미터는 일부러
 * 남기지 않습니다. 유입 통계는 페이지가 처음 열릴 때 GA4가 이미 기록해뒀고,
 * 여기서 그대로 남겨두면 방문자가 그 주소를 공유했을 때 남의 유입 경로까지
 * 내 채널 유입으로 잘못 집계되기 때문입니다. */
function citySlugOf(city) {
  const parts = String(city.city_id).split("-");
  const slug = parts.length > 1 ? parts.slice(1).join("-") : String(city.city_id);
  return slug.toLowerCase();
}

function currentRegionSlug() {
  if (selectedCityId) {
    const city = DATA.cities.find((c) => c.city_id === selectedCityId);
    if (city) return citySlugOf(city);
  }
  if (selectedCountryCode) {
    const country = findCountry(selectedCountryCode);
    if (country && country.agoda_country_slug) {
      return String(country.agoda_country_slug).toLowerCase();
    }
    return String(selectedCountryCode);
  }
  return "";
}

function currentShareUrl() {
  const base = window.location.origin + window.location.pathname;
  const slug = currentRegionSlug();
  return slug ? `${base}?region=${encodeURIComponent(slug)}` : base;
}

function syncUrlWithSelection() {
  try {
    window.history.replaceState(null, "", currentShareUrl());
  } catch (err) {
    /* file:// 로 직접 열었을 때 등 주소를 바꿀 수 없는 환경에서는 무시합니다. */
  }
}

/* 나라/도시를 고른 상태에서만 패널 제목 옆에 "공유" 버튼을 보여줍니다. */
function updateShareButton() {
  const btn = document.getElementById("share-btn");
  if (!btn) return;
  btn.hidden = !selectedCountryCode;
}

/* 특정 도시를 골랐고, 그 도시의 안내 페이지(city/도시코드/)가 실제로
 * 공개된 경우에만 패널 제목 옆에 "자세하게 살펴보기" 버튼을 보여줍니다.
 * (나라만 고른 상태나, 아직 안내 페이지가 없는/비공개인 도시에서는
 * 숨겨둡니다.) */
function updateCityGuideButton() {
  const btn = document.getElementById("city-guide-btn");
  if (!btn) return;
  const city = selectedCityId ? DATA.cities.find((c) => c.city_id === selectedCityId) : null;
  if (city && PUBLISHED_CITY_IDS.has(String(city.city_id))) {
    btn.href = `/city/${String(city.city_id).toLowerCase()}/`;
    btn.hidden = false;
  } else {
    btn.hidden = true;
    btn.removeAttribute("href");
  }
}

function handleCityGuideClick() {
  trackEvent("city_guide_click", {
    region_type: "city",
    region_name: selectedCityId
      ? (DATA.cities.find((c) => c.city_id === selectedCityId) || {}).city_name_ko || ""
      : "",
    region_slug: currentRegionSlug()
  });
}

function bindCityGuideButton() {
  const btn = document.getElementById("city-guide-btn");
  if (!btn) return;
  btn.addEventListener("click", handleCityGuideClick);
}

let shareFeedbackTimer = null;

function showShareFeedback(message) {
  const label = document.querySelector("#share-btn .share-btn-label");
  if (!label) return;
  label.textContent = message;
  clearTimeout(shareFeedbackTimer);
  shareFeedbackTimer = setTimeout(() => {
    label.textContent = "공유";
  }, 1600);
}

/* 휴대폰에서는 카카오톡·메시지 등으로 바로 보낼 수 있는 기본 공유창을 띄우고,
 * 그 기능이 없는 PC 브라우저에서는 주소를 클립보드에 복사해줍니다. */
async function handleShareClick() {
  const url = currentShareUrl();
  const headingEl = document.getElementById("panel-heading");
  const place = headingEl ? headingEl.textContent.trim() : "";

  trackEvent("share_click", {
    region_slug: currentRegionSlug(),
    region_name: place,
    share_method: navigator.share ? "web_share" : "clipboard"
  });

  if (navigator.share) {
    try {
      await navigator.share({
        title: place ? `${place} 여행 가이드 영상` : "트립콤파니 여행지도",
        url
      });
    } catch (err) {
      /* 방문자가 공유창을 그냥 닫은 경우이므로 아무 것도 하지 않습니다. */
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    showShareFeedback("복사됨!");
  } catch (err) {
    showShareFeedback("복사 실패");
  }
}

function bindShareButton() {
  const btn = document.getElementById("share-btn");
  if (!btn) return;
  btn.addEventListener("click", handleShareClick);
}

/* ---------- 지도 위 도시 검색 ----------
 * 도시가 늘어날수록 지도에서 눈으로 찾기가 번거로워지므로, 이름을 쳐서 바로
 * 갈 수 있게 했습니다. 한글 이름(오사카)뿐 아니라 영문 city_id 뒷부분(osaka),
 * 나라 이름(일본)으로도 찾을 수 있습니다.
 *
 * 고르고 나면 그 도시를 "적당한 거리"로 보여줍니다 — 얼마나 확대할지는
 * 주변 도시와의 거리에 따라 자동으로 정해집니다(zoomForCity 참고).
 *
 * 아직 영상이 없는 도시(지도에 흰 점으로 표시되는 "준비중")도 검색 결과에
 * 함께 나옵니다. 실제로 그 지역을 찾는 사람이 있다는 뜻이라 숨기지 않고
 * "영상 준비중"이라고 표시만 해줍니다. */
const SEARCH_MAX_RESULTS = 8;
let searchResults = [];
let searchActiveIndex = -1;
let searchNoResultTimer = null;

function cityVideoCount(cityId) {
  return DATA.videos.filter((v) => videoCityIds(v).includes(String(cityId))).length;
}

function searchCities(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];

  const scored = [];
  DATA.cities.forEach((city) => {
    const nameKo = String(city.city_name_ko || "").toLowerCase();
    const slug = citySlugOf(city);
    const countryKo = String(countryName(city.country_code) || "").toLowerCase();

    // 점수가 낮을수록 위에 보여줍니다 — 이름이 검색어로 "시작"하는 도시를
    // 이름 중간에 걸린 도시보다 먼저 보여주기 위한 순서입니다.
    let score = -1;
    if (nameKo.startsWith(q)) score = 0;
    else if (slug.startsWith(q)) score = 1;
    else if (nameKo.includes(q)) score = 2;
    else if (slug.includes(q)) score = 3;
    else if (countryKo.includes(q)) score = 4;
    if (score < 0) return;

    scored.push({ city, score, hasVideo: cityChannels(city.city_id).size > 0 });
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    // 같은 점수라면 영상이 있는 도시를 먼저 보여줍니다.
    if (a.hasVideo !== b.hasVideo) return a.hasVideo ? -1 : 1;
    return String(a.city.city_name_ko).localeCompare(String(b.city.city_name_ko), "ko");
  });

  return scored.slice(0, SEARCH_MAX_RESULTS).map((item) => item.city);
}

function renderSearchResults(query) {
  const listEl = document.getElementById("city-search-results");
  const inputEl = document.getElementById("city-search-input");
  if (!listEl || !inputEl) return;

  searchResults = searchCities(query);
  searchActiveIndex = -1;

  if (searchResults.length === 0) {
    listEl.hidden = true;
    listEl.innerHTML = "";
    inputEl.setAttribute("aria-expanded", "false");
    scheduleNoResultTracking(query);
    return;
  }

  clearTimeout(searchNoResultTimer);
  listEl.innerHTML = searchResults
    .map((city, index) => {
      const count = cityVideoCount(city.city_id);
      const meta = count > 0 ? `영상 ${count}개` : "영상 준비중";
      return `
        <li role="option" id="city-search-option-${index}" aria-selected="false"
            class="map-search-result" data-index="${index}">
          <span class="map-search-result-name">${escapeHtml(city.city_name_ko)}</span>
          <span class="map-search-result-meta">${escapeHtml(countryName(city.country_code))} · ${meta}</span>
        </li>`;
    })
    .join("");
  listEl.hidden = false;
  inputEl.setAttribute("aria-expanded", "true");
}

/* 검색어를 두 글자 이상 쳤는데 결과가 없는 경우를, 잠깐 기다렸다가(타자를
 * 치는 중간 단계마다 보내지 않도록) GA4로 보냅니다. "사람들이 찾는데 아직
 * 영상이 없는 지역"을 알 수 있어서 다음 콘텐츠를 정할 때 쓸모가 있습니다. */
function scheduleNoResultTracking(query) {
  clearTimeout(searchNoResultTimer);
  const q = String(query || "").trim();
  if (q.length < 2 || DATA.cities.length === 0) return;
  searchNoResultTimer = setTimeout(() => {
    trackEvent("city_search_no_result", { search_query: q });
  }, 1200);
}

function closeSearchResults() {
  const listEl = document.getElementById("city-search-results");
  const inputEl = document.getElementById("city-search-input");
  if (listEl) {
    listEl.hidden = true;
    listEl.innerHTML = "";
  }
  if (inputEl) inputEl.setAttribute("aria-expanded", "false");
  searchResults = [];
  searchActiveIndex = -1;
}

function highlightSearchResult(index) {
  const listEl = document.getElementById("city-search-results");
  const inputEl = document.getElementById("city-search-input");
  if (!listEl) return;
  const items = [...listEl.querySelectorAll(".map-search-result")];
  items.forEach((el, i) => {
    const active = i === index;
    el.classList.toggle("is-active", active);
    el.setAttribute("aria-selected", active ? "true" : "false");
  });
  searchActiveIndex = index;
  if (inputEl) {
    if (index >= 0) inputEl.setAttribute("aria-activedescendant", "city-search-option-" + index);
    else inputEl.removeAttribute("aria-activedescendant");
  }
  if (index >= 0 && items[index]) items[index].scrollIntoView({ block: "nearest" });
}

function chooseSearchResult(index) {
  const city = searchResults[index];
  if (!city) return;

  const inputEl = document.getElementById("city-search-input");
  const query = inputEl ? inputEl.value.trim() : "";

  trackEvent("city_search", {
    search_query: query,
    city_name: city.city_name_ko,
    region_slug: citySlugOf(city),
    has_video: cityChannels(city.city_id).size > 0 ? "yes" : "no"
  });

  clearTimeout(searchNoResultTimer);
  if (inputEl) {
    inputEl.value = city.city_name_ko;
    inputEl.blur();
  }
  updateSearchClearButton();
  closeSearchResults();

  // 나라 이동은 건너뛰고(화면이 두 번 움직이지 않도록) 곧바로 그 도시를
  // 주변 밀도에 맞는 거리에서 보여줍니다.
  selectCountry(city.country_code, "search", { skipMapMove: true });
  selectCity(city.city_id, "search");
  focusCityOnMap(city, { animate: true });
}

function updateSearchClearButton() {
  const inputEl = document.getElementById("city-search-input");
  const clearEl = document.getElementById("city-search-clear");
  if (!inputEl || !clearEl) return;
  clearEl.hidden = inputEl.value.length === 0;
}

function bindCitySearch() {
  const inputEl = document.getElementById("city-search-input");
  const listEl = document.getElementById("city-search-results");
  const clearEl = document.getElementById("city-search-clear");
  if (!inputEl || !listEl) return;

  inputEl.addEventListener("input", () => {
    updateSearchClearButton();
    renderSearchResults(inputEl.value);
  });

  inputEl.addEventListener("focus", () => {
    if (inputEl.value.trim()) renderSearchResults(inputEl.value);
  });

  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSearchResults();
      inputEl.blur();
      return;
    }
    if (searchResults.length === 0) {
      // 결과 목록이 없을 때 엔터를 누르면 첫 글자만으로 다시 찾아봅니다.
      if (event.key === "Enter") renderSearchResults(inputEl.value);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlightSearchResult((searchActiveIndex + 1) % searchResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      highlightSearchResult((searchActiveIndex - 1 + searchResults.length) % searchResults.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      chooseSearchResult(searchActiveIndex >= 0 ? searchActiveIndex : 0);
    }
  });

  // 목록은 매번 다시 그려지므로 목록 전체에 한 번만 걸어둡니다(위임).
  listEl.addEventListener("mousedown", (event) => {
    // mousedown 시점에 input의 blur가 먼저 일어나 목록이 닫히는 걸 막습니다.
    event.preventDefault();
  });
  listEl.addEventListener("click", (event) => {
    const item = event.target.closest(".map-search-result");
    if (!item) return;
    chooseSearchResult(Number(item.dataset.index));
  });
  listEl.addEventListener("mousemove", (event) => {
    const item = event.target.closest(".map-search-result");
    if (item) highlightSearchResult(Number(item.dataset.index));
  });

  if (clearEl) {
    clearEl.addEventListener("click", () => {
      inputEl.value = "";
      updateSearchClearButton();
      closeSearchResults();
      inputEl.focus();
    });
  }

  // 검색창 밖을 누르면 목록을 닫습니다.
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".map-search")) closeSearchResults();
  });
}

/* ---------- 첫 화면 그리기 / 최신 데이터로 갈아끼우기 ---------- */

/* 데이터를 처음 손에 넣었을 때(캐시든 방금 받아온 것이든) 화면 전체를 그립니다. */
function renderLoadedData() {
  computeNewLocations();
  // 지도 테두리(countryLayer)는 데이터가 도착하기 전에 이미 그려져 있을 수
  // 있어서(renderWorld 참고), 데이터가 실제로 준비된 지금 색칠을 다시
  // 맞춰줍니다 — 안 그러면 영상이 있는 나라도 계속 회색으로 남아있게 됩니다.
  if (countryLayer) countryLayer.eachLayer((l) => l.setStyle(styleCountry(l.feature)));
  renderWorldCityMarkers();
  renderVideoPanel();
  renderHeaderAdBanner();
  renderSiteStats();
  applyRegionDeepLink();
  hideMapLoadingState();
}

/* 캐시로 먼저 그려둔 화면을, 방금 받아온 최신 데이터로 조용히 갈아끼웁니다.
 * 방문자가 이미 고른 나라/도시와 지금 보고 있는 지도 위치는 그대로 두는 게
 * 핵심입니다 — 여기서 selectCountry()를 다시 부르면 지도가 갑자기 움직여서
 * 보고 있던 화면이 튀어버립니다. */
function applyFreshData(fresh) {
  DATA = fresh;
  computeNewLocations();

  // 그 사이 시트에서 지워진 나라/도시를 고른 상태였다면 선택을 풀어줍니다.
  if (selectedCountryCode && !findCountry(selectedCountryCode)) {
    selectedCountryCode = null;
    selectedCityId = null;
  }
  if (selectedCityId && !DATA.cities.some((c) => c.city_id === selectedCityId)) {
    selectedCityId = null;
  }

  if (countryLayer) countryLayer.eachLayer((l) => l.setStyle(styleCountry(l.feature)));
  renderWorldCityMarkers(selectedCountryCode);
  if (selectedCountryCode) {
    renderCityMarkers(selectedCountryCode);
    refreshCityMarkerIcons();
  } else {
    cityMarkersLayer.clearLayers();
    cityMarkersById = {};
  }
  updateBackButton();
  renderVideoPanel();
  renderHeaderAdBanner();
  renderSiteStats();
  syncUrlWithSelection();

  // 캐시가 오래돼서 공유 링크(?region=)의 도시를 못 찾았던 경우, 최신
  // 데이터가 도착한 지금 다시 한 번 시도합니다. 방문자가 이미 다른 지역을
  // 고른 뒤라면 그 선택을 존중해서 건드리지 않습니다.
  if (!selectedCountryCode) applyRegionDeepLink();
}

/* ---------- 시작 ---------- */

async function main() {
  initMap();
  updateBackButton();
  document.getElementById("back-btn").addEventListener("click", handleBackButtonClick);
  document.getElementById("random-btn").addEventListener("click", goToRandomDestination);
  bindVideoModalEvents();
  bindAffiliateClickTracking();
  bindShareButton();
  bindCityGuideButton();
  bindCitySearch();
  bindChannelTabEvents();

  // 데이터 로딩과 별개로 진행 — 실패해도 지도/데이터 표시에는 영향 없음
  applyVisitorView();

  // 공개된 도시 목록도 나라/도시 데이터와 별개로 받아옵니다. 늦게 도착해도
  // 도착하는 대로 "자세하게 살펴보기" 버튼 표시 여부만 다시 계산합니다.
  loadPublishedCityIds().then((ids) => {
    PUBLISHED_CITY_IDS = ids;
    updateCityGuideButton();
  });

  let renderedFromCache = false;

  try {
    // 네 가지 요청을 한꺼번에 출발시켜 둡니다(기다리는 건 아래에서 따로).
    // 이렇게 해야 처음 방문한 사람도 예전처럼 모든 요청이 동시에 진행됩니다.
    const geoPromise = loadWorldGeo();
    const dataPromise = loadAllData();
    const statusPromise = loadTrekomStatus();
    const adsPromise = loadLocalAds();
    // 아래 await까지 시간차가 있어서, 그 사이에 실패하면 브라우저가 "처리되지
    // 않은 오류"로 잘못 경고합니다. 실제 처리는 아래 await + catch에서 하므로
    // 여기서는 경고만 막아둡니다.
    dataPromise.catch(() => {});

    // 세계 국경 데이터는 CDN이 브라우저에 캐시해두기 때문에 재방문 시에는
    // 네트워크를 타지 않고 거의 즉시 준비됩니다. 지도를 그리려면 반드시
    // 필요한 값이라 이것부터 기다립니다.
    const geo = await geoPromise;
    renderWorld(geo);

    // 트콤 현재 위치 마커는 나라/도시 데이터와 아무 상관이 없으므로, 자기
    // 차례가 오는 대로 따로 그립니다. 구글시트 쪽이 느리거나 실패해도 이
    // 마커는 영향을 받지 않습니다.
    statusPromise.then((status) => {
      renderTrekomLiveMarker(status);
      startTrekomLiveMarkerAutoRefresh();
    });

    // 1단계 — 지난 방문 때 저장해둔 사본이 있으면 그걸로 화면을 즉시 띄웁니다.
    const cached = readDataCache();
    if (cached) {
      DATA = cached;
      renderLoadedData();
      renderedFromCache = true;
    }

    // 2단계 — 최신 데이터는 어느 경우든 새로 받아옵니다. 캐시로 이미 화면을
    // 띄워둔 상태라면 방문자는 기다림 없이 둘러보는 중이고, 잠시 뒤 내용만
    // 조용히 최신으로 바뀝니다.
    const [freshData, localAds] = await Promise.all([dataPromise, adsPromise]);
    freshData.localAds = localAds;
    // 빈 줄·주소 없는 영상 줄을 여기서 한 번에 걸러냅니다(sanitizeData 주석 참고).
    // 아래 writeDataCache()에도 걸러낸 결과가 저장되므로 다음 방문 때도 깨끗합니다.
    const data = sanitizeData(freshData);

    if (renderedFromCache) {
      applyFreshData(data);
    } else {
      DATA = data;
      renderLoadedData();
    }
    writeDataCache(data);
  } catch (err) {
    console.error(err);
    // 저장해둔 사본으로 이미 정상적인 화면을 띄워둔 상태라면, 최신 데이터를
    // 받아오다 실패했더라도 에러 화면으로 덮어쓰지 않습니다. 방문자 입장에선
    // (조금 오래됐을 수는 있어도) 지도가 멀쩡히 동작하는 편이 훨씬 낫습니다.
    if (renderedFromCache) {
      console.warn("최신 데이터를 받아오지 못해, 이전에 저장해둔 내용으로 계속 표시합니다.");
      return;
    }
    showMapLoadingError(
      "지도 또는 데이터를 불러오지 못했습니다. 인터넷 연결과 CONFIG 설정을 확인해주세요."
    );
  }
}

/* 로딩이 끝났을 때 스켈레톤/스피너를 부드럽게(fade-out) 사라지게 합니다.
 * hidden 속성을 바로 주는 대신 opacity 트랜지션이 끝난 뒤 hidden 처리해서,
 * 화면 전환이 뚝 끊기지 않고 자연스럽게 보이도록 했습니다. */
function hideMapLoadingState() {
  const skeleton = document.getElementById("map-skeleton");
  const status = document.getElementById("map-status");
  skeleton.classList.add("is-hidden");
  status.classList.add("is-hidden");
  window.setTimeout(() => {
    skeleton.hidden = true;
    status.hidden = true;
  }, 400);
}

/* 로딩 실패 시에는 스켈레톤 shimmer만 멈추고, 스피너는 빨간 원 형태로 바꿔서
 * 에러 상태임을 보여주며, 안내 문구를 그대로 표시합니다. */
function showMapLoadingError(message) {
  document.getElementById("map-skeleton").classList.add("is-hidden");
  document.getElementById("map-status-spinner").classList.add("is-error");
  document.getElementById("map-status-text").textContent = message;
}

main();
