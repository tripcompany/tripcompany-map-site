/* ============================================================
   쿠키 동의 배너 (구글 애드센스 준비용)
   - 최초 방문 시 화면 하단에 동의/거부 배너를 보여줍니다.
   - 선택 결과는 localStorage에 저장되어, 한 번 선택하면 다시 묻지 않습니다.
   - window.TCConsent.isGranted() 로 다른 스크립트(예: 광고 스크립트)에서
     동의 여부를 확인할 수 있습니다.
   - Leaflet 등 외부 지도 라이브러리와 무관하게 동작하므로,
     지도 로딩과 상관없이 항상 정상적으로 뜹니다.
   ============================================================ */
(function () {
  "use strict";

  var STORAGE_KEY = "tc_cookie_consent"; // "granted" | "denied"
  var BANNER_ID = "cookie-consent-banner";

  function getConsent() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function saveConsent(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      // localStorage를 쓸 수 없는 환경(시크릿 모드 등)이면 이번 방문에서만 배너를 숨깁니다.
    }
    try {
      document.dispatchEvent(
        new CustomEvent("tc:cookie-consent-changed", { detail: { consent: value } })
      );
    } catch (e) {
      /* 구형 브라우저에서 CustomEvent 생성 실패 시 무시 */
    }
  }

  function removeBanner() {
    var el = document.getElementById(BANNER_ID);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function handleChoice(value) {
    saveConsent(value);
    removeBanner();
  }

  function buildBanner() {
    if (document.getElementById(BANNER_ID)) return;

    var wrap = document.createElement("div");
    wrap.id = BANNER_ID;
    wrap.className = "cookie-consent-banner";
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "쿠키 사용 동의 안내");

    var text = document.createElement("p");
    text.className = "cookie-consent-text";
    text.innerHTML =
      "이 사이트는 서비스 개선과 광고 제공을 위해 쿠키를 사용할 수 있어요. 자세한 내용은 " +
      '<a href="privacy.html" target="_blank" rel="noopener noreferrer">개인정보처리방침</a>에서 확인해주세요.';

    var actions = document.createElement("div");
    actions.className = "cookie-consent-actions";

    var rejectBtn = document.createElement("button");
    rejectBtn.type = "button";
    rejectBtn.id = "cookie-consent-reject";
    rejectBtn.className = "cookie-consent-btn cookie-consent-reject";
    rejectBtn.textContent = "거부";
    rejectBtn.addEventListener("click", function () {
      handleChoice("denied");
    });

    var acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.id = "cookie-consent-accept";
    acceptBtn.className = "cookie-consent-btn cookie-consent-accept";
    acceptBtn.textContent = "동의";
    acceptBtn.addEventListener("click", function () {
      handleChoice("granted");
    });

    actions.appendChild(rejectBtn);
    actions.appendChild(acceptBtn);
    wrap.appendChild(text);
    wrap.appendChild(actions);
    document.body.appendChild(wrap);
  }

  function init() {
    var current = getConsent();
    if (current === "granted" || current === "denied") return;

    if (document.body) {
      buildBanner();
    } else {
      document.addEventListener("DOMContentLoaded", buildBanner);
    }
  }

  window.TCConsent = {
    get: getConsent,
    isGranted: function () {
      return getConsent() === "granted";
    },
    isDenied: function () {
      return getConsent() === "denied";
    },
    set: function (value) {
      handleChoice(value === "granted" ? "granted" : "denied");
    },
    reset: function () {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        /* no-op */
      }
      removeBanner();
      init();
    }
  };

  init();
})();
