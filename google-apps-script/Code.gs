/*
 * 트콤 "지금 여기 있어요" 위치를 폰에서 한 번에 업데이트하기 위한
 * 구글 앱스 스크립트(Apps Script)입니다.
 *
 * 설치 방법은 README.md의 "12. 트콤 실시간 위치 표시하기" 항목을 참고하세요.
 * 요약하면:
 *   1) 구글시트에서 확장 프로그램 > Apps Script 를 엽니다.
 *   2) 기본으로 생긴 Code.gs 내용을 지우고 이 파일 내용을 그대로 붙여넣습니다.
 *   3) 왼쪽에서 "+" > HTML 을 눌러 파일 이름을 정확히 "Page" 로 만들고,
 *      같은 폴더의 Page.html 내용을 그대로 붙여넣습니다.
 *   4) 배포 > 새 배포 > 유형: 웹 앱 으로 배포합니다.
 *
 * 이 스크립트는 시트 안에서 만든 "컨테이너 바인딩" 스크립트라서
 * SpreadsheetApp.getActiveSpreadsheet()가 자동으로 이 스프레드시트를 가리킵니다
 * (스프레드시트 ID를 따로 적어줄 필요가 없습니다).
 */

// Status 탭 이름입니다. 탭 이름을 바꿨다면 여기도 맞춰서 바꿔주세요.
const SHEET_NAME = "Status";

/* 웹 앱 주소로 접속했을 때 보여줄 페이지(Page.html)를 돌려줍니다. */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("Page")
    .setTitle("트콤 위치 업데이트")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover");
}

/* Page.html에서 위치 권한으로 읽은 위도/경도(와 직접 입력한 지명)를
 * 받아서, Status 탭 2번째 줄(데이터 한 줄)에 그대로 덮어씁니다.
 * 헤더 줄(1행)에서 lat/lng/location_name/updated_at 칸이 몇 번째
 * 열인지 찾아서 쓰기 때문에, 열 순서를 바꿔도 문제없이 동작합니다. */
function updateLocation(lat, lng, locationName) {
  if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) {
    throw new Error("위도/경도 값이 올바르지 않습니다.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(
      '"' + SHEET_NAME + '" 탭을 찾을 수 없습니다. README 12번 항목대로 먼저 탭과 헤더를 만들어주세요.'
    );
  }

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(function (h) {
      return String(h).trim();
    });

  const latCol = headers.indexOf("lat") + 1;
  const lngCol = headers.indexOf("lng") + 1;
  const nameCol = headers.indexOf("location_name") + 1;
  const updatedCol = headers.indexOf("updated_at") + 1;

  if (latCol === 0 || lngCol === 0) {
    throw new Error('헤더 1행에 "lat", "lng" 칸이 보이지 않습니다. 철자와 띄어쓰기를 확인해주세요.');
  }

  const row = 2; // 항상 두 번째 줄(데이터 한 줄)만 씁니다.
  sheet.getRange(row, latCol).setValue(lat);
  sheet.getRange(row, lngCol).setValue(lng);

  if (nameCol > 0 && locationName) {
    sheet.getRange(row, nameCol).setValue(locationName);
  }
  if (updatedCol > 0) {
    const tz = ss.getSpreadsheetTimeZone();
    const now = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm");
    sheet.getRange(row, updatedCol).setValue(now);
  }

  return { lat: lat, lng: lng, locationName: locationName || "" };
}
