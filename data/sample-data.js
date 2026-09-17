/*
 * 샘플(테스트용) 데이터입니다.
 * 실제 서비스에서는 이 파일 대신 구글시트(SheetDB API)에서 데이터를 불러오도록
 * app.js 상단의 CONFIG.dataSource 값을 'sheetdb'로 바꾸면 됩니다.
 *
 * country_code 는 ISO 3166-1 "숫자" 코드입니다 (예: 대한민국=410, 일본=392).
 * 지도 경계 데이터(world-atlas)가 이 숫자 코드로 국가를 식별하기 때문에,
 * 구글시트의 Countries 탭에도 반드시 이 숫자 코드를 그대로 적어야 합니다.
 * (README.md 하단에 자주 쓰는 국가 코드 표가 있습니다)
 */
window.SAMPLE_DATA = {
  countries: [
    // agoda_country_slug는 선택 사항입니다 — 아고다 숙소 예약 제휴 배너(README
    // 14번 항목)에서, 아직 도시를 고르지 않은 "국가 전체" 화면에 그 나라
    // 숙소 페이지로 바로 연결하는 데 씁니다.
    { country_code: "392", country_name_ko: "일본", has_video: "TRUE", agoda_country_slug: "japan" },
    { country_code: "704", country_name_ko: "베트남", has_video: "TRUE", agoda_country_slug: "vietnam" },
    { country_code: "764", country_name_ko: "태국", has_video: "TRUE", agoda_country_slug: "thailand" },
    // 싱가포르는 일부러 Cities 탭에 도시를 추가하지 않은 샘플입니다. 이 지도가 쓰는
    // 세계 국경 데이터(110m 저해상도)에는 싱가포르처럼 아주 작은 나라의 도형이 아예
    // 없어서, map_center_lat/map_center_lng로 표시 위치를 직접 지정해야 합니다.
    { country_code: "702", country_name_ko: "싱가포르", has_video: "TRUE", map_center_lat: 1.3521, map_center_lng: 103.8198 }
  ],

  cities: [
    // agoda_slug도 선택 사항입니다 — 채워두면 아고다 배너가 그 도시의 실제
    // 숙소 목록 페이지로 바로 연결됩니다(예: tokyo-jp → agoda.com/city/tokyo-jp.html).
    { city_id: "JP-TOKYO", country_code: "392", city_name_ko: "도쿄", lat: 35.6762, lng: 139.6503, agoda_slug: "tokyo-jp" },
    { city_id: "JP-OSAKA", country_code: "392", city_name_ko: "오사카", lat: 34.6937, lng: 135.5023, agoda_slug: "osaka-jp" },
    // 아직 Videos 탭에 영상이 없는 도시 샘플 — 흰 점("영상 준비중")으로 표시되는지 확인용
    { city_id: "JP-KYOTO", country_code: "392", city_name_ko: "교토", lat: 35.0116, lng: 135.7681 },
    // 여러 도시 비교 영상(아래 v15) 샘플용으로 추가한 도시들
    { city_id: "JP-FUKUOKA", country_code: "392", city_name_ko: "후쿠오카", lat: 33.5904, lng: 130.4017 },
    { city_id: "JP-SAPPORO", country_code: "392", city_name_ko: "삿포로", lat: 43.0618, lng: 141.3545 },
    { city_id: "VN-HANOI", country_code: "704", city_name_ko: "하노이", lat: 21.0278, lng: 105.8342, agoda_slug: "hanoi-vn" },
    { city_id: "VN-DANANG", country_code: "704", city_name_ko: "다낭", lat: 16.0544, lng: 108.2022, agoda_slug: "danang-vn" },
    { city_id: "TH-BANGKOK", country_code: "764", city_name_ko: "방콕", lat: 13.7563, lng: 100.5018, agoda_slug: "bangkok-th" },
    { city_id: "TH-CHIANGMAI", country_code: "764", city_name_ko: "치앙마이", lat: 18.7883, lng: 98.9853, agoda_slug: "chiang-mai-th" }
  ],

  // youtube_url 은 샘플용 플레이스홀더 영상입니다. 실제 영상 URL로 교체해서 쓰세요.
  // channel 이 "여행하는트콤"이면 그 채널로, 비어있거나 다른 값이면 트립콤파니로 처리됩니다.
  videos: [
    { video_id: "v1", country_code: "392", city_id: "", channel: "", title: "[샘플] 일본 여행 전체 가이드", youtube_url: "https://youtu.be/dQw4w9WgXcQ", guide_name: "김가이드" },
    { video_id: "v2", country_code: "392", city_id: "JP-TOKYO", channel: "", title: "[샘플] 도쿄 시내 핵심 코스", youtube_url: "https://youtu.be/dQw4w9WgXcQ", guide_name: "김가이드" },
    { video_id: "v3", country_code: "392", city_id: "JP-TOKYO", channel: "", title: "[샘플] 도쿄 맛집 투어", youtube_url: "https://youtu.be/M7lc1UVf-VE", guide_name: "이가이드" },
    { video_id: "v4", country_code: "392", city_id: "JP-OSAKA", channel: "", title: "[샘플] 오사카 당일치기 코스", youtube_url: "https://youtu.be/M7lc1UVf-VE", guide_name: "박가이드" },
    { video_id: "v11", country_code: "392", city_id: "JP-TOKYO", channel: "여행하는트콤", title: "[샘플] 도쿄 브이로그", youtube_url: "https://youtu.be/jNQXAC9IVRw", guide_name: "" },
    // 여러 도시를 한 영상에서 비교하는 콘텐츠 샘플 — city_id에 쉼표로 도시들을
    // 나열하면, 같은 영상을 복사하지 않아도 일본 국가 전체 화면과 도쿄/오사카/
    // 후쿠오카/삿포로 각 도시 화면에 전부 자동으로 노출됩니다.
    { video_id: "v15", country_code: "392", city_id: "JP-TOKYO,JP-OSAKA,JP-FUKUOKA,JP-SAPPORO", channel: "", title: "[샘플] 도쿄·오사카·후쿠오카·삿포로 물가 비교", youtube_url: "https://youtu.be/M7lc1UVf-VE", guide_name: "김가이드" },
    // 여러 나라를 한 영상에서 비교하는 콘텐츠 샘플 — country_code에 쉼표로
    // 나라들을 나열하면(city_id는 비워둠), 일본 전체 화면과 베트남 전체
    // 화면 양쪽에 자동으로 노출됩니다.
    { video_id: "v16", country_code: "392,704", city_id: "", channel: "", title: "[샘플] 일본 vs 베트남 여행 물가 비교", youtube_url: "https://youtu.be/dQw4w9WgXcQ", guide_name: "최가이드" },

    { video_id: "v5", country_code: "704", city_id: "", channel: "", title: "[샘플] 베트남 여행 전체 가이드", youtube_url: "https://youtu.be/jNQXAC9IVRw", guide_name: "최가이드" },
    { video_id: "v6", country_code: "704", city_id: "VN-HANOI", channel: "", title: "[샘플] 하노이 구시가지 걷기", youtube_url: "https://youtu.be/jNQXAC9IVRw", guide_name: "최가이드" },
    { video_id: "v7", country_code: "704", city_id: "VN-DANANG", channel: "", title: "[샘플] 다낭 해변 & 호이안", youtube_url: "https://youtu.be/dQw4w9WgXcQ", guide_name: "정가이드" },
    { video_id: "v12", country_code: "704", city_id: "VN-DANANG", channel: "여행하는트콤", title: "[샘플] 다낭 브이로그", youtube_url: "https://youtu.be/M7lc1UVf-VE", guide_name: "" },

    { video_id: "v8", country_code: "764", city_id: "", channel: "", title: "[샘플] 태국 여행 전체 가이드", youtube_url: "https://youtu.be/M7lc1UVf-VE", guide_name: "한가이드" },
    { video_id: "v9", country_code: "764", city_id: "TH-BANGKOK", channel: "", title: "[샘플] 방콕 야시장 투어", youtube_url: "https://youtu.be/dQw4w9WgXcQ", guide_name: "한가이드" },
    { video_id: "v10", country_code: "764", city_id: "TH-CHIANGMAI", channel: "", title: "[샘플] 치앙마이 사원 코스", youtube_url: "https://youtu.be/jNQXAC9IVRw", guide_name: "오가이드" },
    { video_id: "v13", country_code: "764", city_id: "TH-CHIANGMAI", channel: "여행하는트콤", title: "[샘플] 치앙마이 브이로그", youtube_url: "https://youtu.be/dQw4w9WgXcQ", guide_name: "" },

    // 싱가포르: Cities 탭에 도시가 없어도 country_code + city_id 빈칸 조합만으로
    // 국가 단위 영상이 등록되고, 지도에는 나라 중심에 점이 자동으로 생깁니다.
    { video_id: "v14", country_code: "702", city_id: "", channel: "", title: "[샘플] 싱가포르 여행 전체 가이드", youtube_url: "https://youtu.be/dQw4w9WgXcQ", guide_name: "정가이드" }
  ],

  // 트콤의 "지금 여기 있어요" 실시간 위치 마커 샘플입니다. 실제 서비스에서는
  // 구글시트 Status 탭 한 줄이 이 자리를 대신합니다(README 참고).
  trekomStatus: {
    lat: 36.9856,
    lng: -110.0977,
    location_name: "모뉴먼트 밸리, 미국",
    updated_at: "2026-09-09"
  }
};
