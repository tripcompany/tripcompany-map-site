/* ============================================================
   구글 애널리틱스(GA4) 연동
   - 측정 ID: G-54V354TPYY
   - 화면 하단 쿠키 동의 배너(cookie-consent.js)에서 방문자가 "동의"를
     선택했을 때만 실제로 방문 통계 쿠키를 심습니다(Google Consent
     Mode v2). "거부"를 선택했거나 아직 아무 것도 선택하지 않은
     상태에서는 통계가 저장되지 않습니다 — privacy.html 제6조에서
     안내하는 내용과 실제 동작을 맞추기 위함입니다.
   - cookie-consent.js와 이 스크립트는 로드되는 순서가 상황에 따라
     달라질 수 있어서, 저장된 동의 값은 localStorage에서 직접
     읽습니다(cookie-consent.js와 동일한 키 "tc_cookie_consent"를
     사용하므로, 그쪽 키 이름을 바꾸면 이 파일의 CONSENT_STORAGE_KEY도
     함께 바꿔주세요).
   ============================================================ */
(function () {
  "use strict";

  var MEASUREMENT_ID = "G-54V354TPYY";
  var CONSENT_STORAGE_KEY = "tc_cookie_consent"; // "granted" | "denied"

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  function readStoredConsent() {
    try {
      return window.localStorage.getItem(CONSENT_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function consentState(granted) {
    var value = granted ? "granted" : "denied";
    return {
      ad_storage: value,
      ad_user_data: value,
      ad_personalization: value,
      analytics_storage: value
    };
  }

  // 기본값: 이전에 이미 "동의"를 선택해둔 방문자라면 그 값을 바로 반영하고,
  // 그 외(거부/미선택)에는 전부 막아둔 채로 시작합니다.
  gtag("consent", "default", consentState(readStoredConsent() === "granted"));

  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID);

  // 배너에서 동의/거부를 선택하는 순간 바로 반영합니다.
  document.addEventListener("tc:cookie-consent-changed", function (e) {
    var granted = !!(e.detail && e.detail.consent === "granted");
    gtag("consent", "update", consentState(granted));
  });
})();
