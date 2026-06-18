(function () {
  var locale = window.__hmrLocale || {};
  var DRAWER_ID = "hmrMatrixMessageDrawer";
  var MASK_ID = "hmrMatrixMessageDrawerMask";
  var BODY_OPEN_CLASS = "hmr-matrix-drawer-open";
  var STYLE_ID = "hmrMatrixDrawerStyle";
  var ADMIN_ENTRY_ITEM_CLASS = "hmr-admin-entry-item";
  var adminEntryState = {
    checked: false,
    visible: false,
    adminUrl: "/admin/index.html"
  };
  var HMR_E2EE_ENABLED = false;
  var FACTORY_ROOM_ALIAS = "#hmr-factory:localhost";
  var ROOM_PREVIEW_REDIRECT_GUARD = "hmr_room_preview_redirect_guard";
  var ROOM_AFTER_LEAVE_REDIRECT_FLAG = "hmr_room_after_leave_redirect_flag";
  var ENCRYPTED_BOT_REDIRECT_GUARD = "hmr_encrypted_bot_redirect_guard";
  var FACTORY_PREVIEW_REDIRECT_GUARD = "hmr_factory_preview_redirect_guard";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  function isRoomView() {
    return String(window.location.hash || "").indexOf("#/room") === 0;
  }

  function isAuthHash(hash) {
    var val = String(hash || "").toLowerCase();
    return val.indexOf("#/login") === 0 || val.indexOf("#/welcome") === 0 || val.indexOf("#/soft_logout") === 0;
  }

  function redirectToUnifiedLoginIfNeeded() {
    if (isAuthHash(window.location.hash || "")) {
      window.location.replace("/welcome.html");
    }
  }

  function clearCryptoClientStorageIfDisabled() {
    if (HMR_E2EE_ENABLED === true) return;
    try {
      var removeKeys = [];
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = String(localStorage.key(i) || "");
        if (!key) continue;
        if (key.indexOf("mx_crypto_") === 0 || key.indexOf("mx_secure_backup") === 0) {
          removeKeys.push(key);
        }
      }
      for (var j = 0; j < removeKeys.length; j += 1) {
        localStorage.removeItem(removeKeys[j]);
      }
    } catch {}
    try {
      if (window.indexedDB && typeof window.indexedDB.deleteDatabase === "function") {
        window.indexedDB.deleteDatabase("matrix-js-sdk:crypto");
        window.indexedDB.deleteDatabase("matrix-js-sdk::crypto");
      }
    } catch {}
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "body." + BODY_OPEN_CLASS + " .mx_RoomView { transition: margin-right .18s ease; margin-right: 420px; }",
      "#" + MASK_ID + " { position: fixed; inset: 0; background: rgba(8, 15, 28, 0.25); z-index: 9998; opacity: 0; pointer-events: none; transition: opacity .18s ease; }",
      "#" + MASK_ID + ".open { opacity: 1; pointer-events: auto; }",
      "#" + DRAWER_ID + " { position: fixed; top: 0; right: 0; height: 100vh; width: 420px; max-width: 92vw; background: #fff; border-left: 1px solid #e1e8f5; box-shadow: -16px 0 40px rgba(18, 38, 72, 0.2); z-index: 9999; transform: translateX(100%); transition: transform .2s ease; display: flex; flex-direction: column; }",
      "#" + DRAWER_ID + ".open { transform: translateX(0); }",
      "#" + DRAWER_ID + " .hmr-hd { min-height: 56px; padding: 10px 14px; border-bottom: 1px solid #e6edf8; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: linear-gradient(180deg,#f8fbff,#f4f8ff); }",
      "#" + DRAWER_ID + " .hmr-hd strong { font-size: 15px; color: #14233b; }",
      "#" + DRAWER_ID + " .hmr-close { border: 0; width: 30px; height: 30px; border-radius: 8px; cursor: pointer; background: #edf3ff; color: #2f4b79; font-size: 16px; }",
      "#" + DRAWER_ID + " .hmr-bd { padding: 14px; overflow: auto; display: grid; gap: 12px; }",
      "#" + DRAWER_ID + " .hmr-meta { border: 1px solid #dfebff; border-radius: 12px; background: #f9fcff; padding: 10px 12px; display: grid; gap: 8px; }",
      "#" + DRAWER_ID + " .hmr-meta-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 13px; }",
      "#" + DRAWER_ID + " .hmr-meta-row span { color: #6280aa; }",
      "#" + DRAWER_ID + " .hmr-meta-row strong { color: #1e385f; font-weight: 600; text-align: right; word-break: break-all; }",
      "#" + DRAWER_ID + " .hmr-msg { border: 1px solid #d8e6ff; border-radius: 12px; background: #fff; padding: 10px 12px; color: #1c314f; font-size: 14px; line-height: 1.75; white-space: pre-wrap; word-break: break-word; }",
      "#" + DRAWER_ID + " .hmr-actions { display: flex; gap: 8px; flex-wrap: wrap; }",
      "#" + DRAWER_ID + " .hmr-actions button { border: 1px solid #bed2f7; background: #f2f7ff; color: #24508e; border-radius: 10px; min-height: 34px; padding: 0 10px; cursor: pointer; font-size: 12px; }",
      "#" + DRAWER_ID + " .hmr-actions button:hover { filter: brightness(1.03); }",
      "." + ADMIN_ENTRY_ITEM_CLASS + " { color: #1a4f98 !important; font-weight: 600 !important; }",
      ".mx_AuthFooter { display: none !important; }",
      ".mx_SetupEncryptionToast, .mx_ToastContainer .mx_SetupEncryptionToast, .mx_ToastContainer .mx_GenericToast.mx_SetupEncryptionToast { display: none !important; }",
      ".mx_ToastContainer .mx_Toast:has(.mx_SetupEncryptionToast), .mx_ToastContainer .mx_SetupEncryptionToast:has(button) { display: none !important; }",
      "@media (max-width: 980px) { body." + BODY_OPEN_CLASS + " .mx_RoomView { margin-right: 0; } #" + DRAWER_ID + " { width: 100vw; max-width: 100vw; } }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function ensureNodes() {
    var mask = document.getElementById(MASK_ID);
    if (!mask) {
      mask = document.createElement("div");
      mask.id = MASK_ID;
      document.body.appendChild(mask);
    }

    var drawer = document.getElementById(DRAWER_ID);
    if (!drawer) {
      drawer = document.createElement("aside");
      drawer.id = DRAWER_ID;
      drawer.setAttribute("aria-hidden", "true");
      drawer.innerHTML = [
        '<div class="hmr-hd"><strong>会话详情</strong><button class="hmr-close" type="button" aria-label="关闭">×</button></div>',
        '<div class="hmr-bd">',
        '<div class="hmr-meta">',
        '<div class="hmr-meta-row"><span>发送方</span><strong data-k="sender">-</strong></div>',
        '<div class="hmr-meta-row"><span>时间</span><strong data-k="time">-</strong></div>',
        '<div class="hmr-meta-row"><span>事件ID</span><strong data-k="eventId">-</strong></div>',
        "</div>",
        '<div class="hmr-msg" data-k="body">-</div>',
        '<div class="hmr-actions">',
        '<button type="button" data-a="copy">复制消息</button>',
        '<button type="button" data-a="quote">@引用到输入框</button>',
        "</div>",
        "</div>"
      ].join("");
      document.body.appendChild(drawer);
    }
    return { mask: mask, drawer: drawer };
  }

  function openDrawer(data) {
    var nodes = ensureNodes();
    var drawer = nodes.drawer;
    var mask = nodes.mask;
    drawer.querySelector('[data-k="sender"]').textContent = data.sender || "-";
    drawer.querySelector('[data-k="time"]').textContent = data.time || "-";
    drawer.querySelector('[data-k="eventId"]').textContent = data.eventId || "-";
    drawer.querySelector('[data-k="body"]').textContent = data.body || "-";
    drawer.dataset.message = data.body || "";
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    mask.classList.add("open");
    document.body.classList.add(BODY_OPEN_CLASS);
  }

  function closeDrawer() {
    var drawer = document.getElementById(DRAWER_ID);
    var mask = document.getElementById(MASK_ID);
    if (drawer) {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
    }
    if (mask) mask.classList.remove("open");
    document.body.classList.remove(BODY_OPEN_CLASS);
  }

  function getText(node, selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var n = node.querySelector(selectors[i]);
      var t = (n && n.textContent ? n.textContent : "").trim();
      if (t) return t;
    }
    return "";
  }

  function extractMessage(tile) {
    var sender = getText(tile, [
      ".mx_SenderProfile_name",
      ".mx_DisambiguatedProfile_displayName",
      ".mx_EventTile_sender",
      "[data-testid='member-name']"
    ]);
    var time = getText(tile, ["time", ".mx_MessageTimestamp", ".mx_EventTile_timestamp"]);
    var body = getText(tile, [
      ".mx_MTextBody",
      ".mx_EventTile_body",
      ".mx_EventTile_line .mx_Body",
      ".mx_EventTile_content"
    ]);
    if (!body) {
      body = (tile.textContent || "").trim().replace(/\s+/g, " ");
      if (body.length > 1200) body = body.slice(0, 1200) + " ...";
    }
    var eventId = String(tile.getAttribute("data-event-id") || "").trim();
    if (!eventId) {
      var token = String(tile.getAttribute("data-scroll-tokens") || "").trim();
      if (token) eventId = token;
    }
    return { sender: sender, time: time, body: body, eventId: eventId };
  }

  function insertQuoteToComposer(text) {
    var composer = document.querySelector(".mx_BasicMessageComposer_input");
    if (!composer) return;
    var quoted = ["> " + String(text || "").replace(/\n/g, "\n> "), ""].join("\n");
    composer.focus();
    try {
      document.execCommand("insertText", false, quoted);
    } catch {
      composer.textContent = (composer.textContent || "") + quoted;
    }
  }

  function normalizeDisplayText(input) {
    return locale.normalizeDisplayText ? locale.normalizeDisplayText(input) : String(input || "").replace(/[']/g, "'").replace(/\s+/g, " ").trim();
  }

  function normalizeText(input) {
    return locale.normalizeText ? locale.normalizeText(input) : String(input || "").trim().toLowerCase();
  }

  function findPromptContainer(node) {
    if (!(node instanceof Element)) return null;
    return (
      node.closest(".mx_Toast, .mx_Dialog, .mx_Modal, .mx_SetupEncryptionToast, .mx_GenericToast, [role='dialog'], [aria-modal='true']")
      || node.closest(".mx_LeftPanel")
      || node.closest(".mx_LeftPanel div")
      || node.closest("div")
      || null
    );
  }

  function looksLikeRecoveryPrompt(container) {
    if (!(container instanceof Element)) return false;
    var text = normalizeDisplayText(container.textContent || "");
    if (!text) return false;
    if (!locale.shouldSuppressRecoveryPromptText(text)) return false;
    var hasAction = Boolean(
      container.querySelector("button, .mx_AccessibleButton, [role='button']")
    );
    return hasAction;
  }

  function looksLikeSessionVerificationPrompt(container) {
    if (!(container instanceof Element)) return false;
    var text = normalizeDisplayText(container.textContent || "");
    if (!text) return false;
    if (!locale.shouldSuppressSessionVerificationPromptText(text)) return false;
    var hasAction = Boolean(
      container.querySelector("button, .mx_AccessibleButton, [role='button']")
    );
    return hasAction;
  }

  function suppressSessionVerificationCards(root) {
    if (HMR_E2EE_ENABLED === true) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var containers = scope.querySelectorAll(
      ".mx_ContextualMenu, .mx_Popover, .mx_Toast, .mx_Dialog, .mx_Modal, " +
      ".mx_GenericToast, .mx_SetupEncryptionToast, [role='dialog'], [aria-modal='true'], [role='menu']"
    );
    for (var i = 0; i < containers.length; i += 1) {
      var container = containers[i];
      if (!(container instanceof Element)) continue;
      if (!looksLikeSessionVerificationPrompt(container)) continue;
      var clicked = clickFirst(container, [
        "稍后再说",
        "后启用再说",
        "稍后",
        "跳过",
        "忽略",
        "verify later",
        "later",
        "skip",
        "not now",
        "dismiss"
      ]);
      if (!clicked) {
        clicked = clickFirst(container, ["关闭", "close", "x"]);
      }
      if (!clicked) {
        container.style.setProperty("display", "none", "important");
      }
    }
  }

  function forceSuppressSessionVerification(root) {
    if (HMR_E2EE_ENABLED === true) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var buttons = scope.querySelectorAll("button, .mx_AccessibleButton, [role='button']");
    for (var i = 0; i < buttons.length; i += 1) {
      var btn = buttons[i];
      if (!(btn instanceof Element)) continue;
      var label = normalizeDisplayText(btn.textContent || "").toLowerCase();
      if (!(label === "验证" || label === "verify")) continue;
      var cursor = btn;
      var card = null;
      for (var depth = 0; depth < 14 && cursor; depth += 1) {
        var txt = normalizeDisplayText(cursor.textContent || "");
        if (locale.shouldSuppressSessionVerificationPromptText(txt)) {
          card = cursor;
          break;
        }
        cursor = cursor.parentElement;
      }
      if (!card) continue;
      var clicked = clickFirst(card, [
        "稍后再说",
        "后启用再说",
        "稍后",
        "跳过",
        "忽略",
        "later",
        "skip",
        "dismiss"
      ]);
      if (!clicked) {
        card.style.setProperty("display", "none", "important");
      }
    }
  }

  function looksLikeLogoutEncryptionWarning(container) {
    if (!(container instanceof Element)) return false;
    var text = normalizeDisplayText(container.textContent || "");
    if (!text) return false;
    if (!locale.shouldSuppressLogoutEncryptionWarningText(text)) return false;
    var hasAction = Boolean(
      container.querySelector("button, .mx_AccessibleButton, [role='button']")
    );
    return hasAction;
  }

  function clickFirst(container, labels) {
    if (!(container instanceof Element)) return false;
    var buttons = container.querySelectorAll("button, .mx_AccessibleButton, [role='button']");
    for (var i = 0; i < buttons.length; i += 1) {
      var btn = buttons[i];
      var label = normalizeDisplayText(btn.textContent || "").toLowerCase();
      if (!label) continue;
      for (var j = 0; j < labels.length; j += 1) {
        if (label === labels[j]) {
          try { btn.click(); } catch {}
          return true;
        }
      }
    }
    return false;
  }

  function suppressRecoveryPrompts(root) {
    if (HMR_E2EE_ENABLED === true) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var seedNodes = scope.querySelectorAll(
      ".mx_LeftPanel *, .mx_Toast *, .mx_Dialog *, .mx_Modal *, [role='dialog'] *, [aria-modal='true'] *"
    );
    for (var bi = 0; bi < seedNodes.length; bi += 1) {
      var seed = seedNodes[bi];
      if (!(seed instanceof Element)) continue;
      var wrap = findPromptContainer(seed);
      if (!looksLikeRecoveryPrompt(wrap)) continue;
      var cls = String((wrap && wrap.className) || "").toLowerCase();
      var inLeftPanel = Boolean(wrap.closest(".mx_LeftPanel"));
      var safeContainer = inLeftPanel || cls.indexOf("toast") >= 0 || cls.indexOf("dialog") >= 0 || cls.indexOf("modal") >= 0 || wrap.getAttribute("role") === "dialog";
      if (!safeContainer) continue;

      var clicked = clickFirst(wrap, ["忽略", "跳过", "稍后", "skip", "later", "not now", "dismiss"]);
      if (!clicked) {
        clicked = clickFirst(wrap, ["关闭", "close", "x"]);
      }
      if (!clicked) {
        // Fallback only for safe toast/dialog containers.
        wrap.style.setProperty("display", "none", "important");
      }
    }

    for (var si = 0; si < seedNodes.length; si += 1) {
      var sessionSeed = seedNodes[si];
      if (!(sessionSeed instanceof Element)) continue;
      var sessionWrap = findPromptContainer(sessionSeed);
      if (!looksLikeSessionVerificationPrompt(sessionWrap)) continue;
      var sessionCls = String((sessionWrap && sessionWrap.className) || "").toLowerCase();
      var sessionInLeftPanel = Boolean(sessionWrap.closest(".mx_LeftPanel"));
      var sessionSafeContainer = sessionInLeftPanel || sessionCls.indexOf("toast") >= 0 || sessionCls.indexOf("dialog") >= 0 || sessionCls.indexOf("modal") >= 0 || sessionWrap.getAttribute("role") === "dialog";
      if (!sessionSafeContainer) continue;

      var sessionClicked = clickFirst(sessionWrap, [
        "后启用再说",
        "稍后",
        "跳过",
        "忽略",
        "verify later",
        "later",
        "skip",
        "not now",
        "dismiss"
      ]);
      if (!sessionClicked) {
        sessionClicked = clickFirst(sessionWrap, ["关闭", "close", "x"]);
      }
      if (!sessionClicked) {
        sessionWrap.style.setProperty("display", "none", "important");
      }
    }

    for (var li = 0; li < seedNodes.length; li += 1) {
      var logoutSeed = seedNodes[li];
      if (!(logoutSeed instanceof Element)) continue;
      var logoutWrap = findPromptContainer(logoutSeed);
      if (!looksLikeLogoutEncryptionWarning(logoutWrap)) continue;
      var logoutCls = String((logoutWrap && logoutWrap.className) || "").toLowerCase();
      var logoutSafeContainer = logoutCls.indexOf("toast") >= 0 || logoutCls.indexOf("dialog") >= 0 || logoutCls.indexOf("modal") >= 0 || logoutWrap.getAttribute("role") === "dialog";
      if (!logoutSafeContainer) continue;

      var logoutClicked = clickFirst(logoutWrap, [
        "我不想要我的加密消息",
        "继续退出",
        "退出登录",
        "注销",
        "退出",
        "i don't want my encrypted messages",
        "sign out anyway",
        "sign out",
        "log out"
      ]);
      if (!logoutClicked) {
        logoutWrap.style.setProperty("display", "none", "important");
      }
    }

    var allButtons = scope.querySelectorAll("button, .mx_AccessibleButton, [role='button']");
    for (var ai = 0; ai < allButtons.length; ai += 1) {
      var btn = allButtons[ai];
      if (!(btn instanceof Element)) continue;
      var label = normalizeDisplayText(btn.textContent || "").toLowerCase();
      if (!(label === "忽略" || label === "稍后" || label === "跳过" || label === "skip" || label === "later" || label === "not now")) continue;
      var cursor = btn;
      var matched = false;
      for (var depth = 0; depth < 6 && cursor; depth += 1) {
        var txt = normalizeDisplayText(cursor.textContent || "").toLowerCase();
        if (locale.shouldSuppressRecoveryPromptText(txt)) {
          matched = true;
          break;
        }
        cursor = cursor.parentElement;
      }
      if (!matched) continue;
      try { btn.click(); } catch {}
    }

    for (var vi = 0; vi < allButtons.length; vi += 1) {
      var verifyBtn = allButtons[vi];
      if (!(verifyBtn instanceof Element)) continue;
      var verifyLabel = normalizeDisplayText(verifyBtn.textContent || "").toLowerCase();
      if (
        !(verifyLabel === "后启用再说"
          || verifyLabel === "稍后"
          || verifyLabel === "跳过"
          || verifyLabel === "忽略"
          || verifyLabel === "verify later"
          || verifyLabel === "later"
          || verifyLabel === "skip"
          || verifyLabel === "not now")
      ) continue;
      var verifyCursor = verifyBtn;
      var verifyMatched = false;
      for (var vDepth = 0; vDepth < 6 && verifyCursor; vDepth += 1) {
        var verifyTxt = normalizeDisplayText(verifyCursor.textContent || "").toLowerCase();
        if (locale.shouldSuppressSessionVerificationPromptText(verifyTxt)) {
          verifyMatched = true;
          break;
        }
        verifyCursor = verifyCursor.parentElement;
      }
      if (!verifyMatched) continue;
      try { verifyBtn.click(); } catch {}
    }

    for (var oi = 0; oi < allButtons.length; oi += 1) {
      var logoutBtn = allButtons[oi];
      if (!(logoutBtn instanceof Element)) continue;
      var logoutLabel = normalizeDisplayText(logoutBtn.textContent || "").toLowerCase();
      if (
        !(logoutLabel === "我不想要我的加密消息"
          || logoutLabel === "继续退出"
          || logoutLabel === "退出登录"
          || logoutLabel === "注销"
          || logoutLabel === "退出"
          || logoutLabel === "i don't want my encrypted messages"
          || logoutLabel === "sign out anyway"
          || logoutLabel === "sign out"
          || logoutLabel === "log out")
      ) continue;
      var logoutCursor = logoutBtn;
      var logoutMatched = false;
      for (var oDepth = 0; oDepth < 8 && logoutCursor; oDepth += 1) {
        var logoutTxt = normalizeDisplayText(logoutCursor.textContent || "").toLowerCase();
        if (locale.shouldSuppressLogoutEncryptionWarningText(logoutTxt)) {
          logoutMatched = true;
          break;
        }
        logoutCursor = logoutCursor.parentElement;
      }
      if (!logoutMatched) continue;
      try { logoutBtn.click(); } catch {}
    }
  }

  function shouldTreatAsRoomPreviewPrompt(text) {
    var t = normalizeDisplayText(text).toLowerCase();
    if (!t) return false;
    return (
      t.indexOf("不能被预览") >= 0
      || t.indexOf("你想加入吗") >= 0
      || t.indexOf("加入讨论") >= 0
      || t.indexOf("can't be previewed") >= 0
      || t.indexOf("would you like to join") >= 0
      || t.indexOf("join the discussion") >= 0
    );
  }

  function isFactoryBotPreview(scope) {
    var roomView = scope.querySelector(".mx_RoomView");
    var txt = normalizeDisplayText(roomView && roomView.textContent || "").toLowerCase();
    if (!txt) return false;
    var hasFactoryName = txt.indexOf("数字工厂bot") >= 0 || txt.indexOf("digital factory") >= 0;
    if (!hasFactoryName) return false;
    return shouldTreatAsRoomPreviewPrompt(txt);
  }

  function redirectFactoryPreviewToServiceRoom(root) {
    if (!isRoomView()) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    if (!isFactoryBotPreview(scope)) return;
    var guarded = String(sessionStorage.getItem(FACTORY_PREVIEW_REDIRECT_GUARD) || "") === "1";
    if (guarded) return;
    var targetHash = toRoomAliasHash(FACTORY_ROOM_ALIAS);
    if (!targetHash) return;
    sessionStorage.setItem(FACTORY_PREVIEW_REDIRECT_GUARD, "1");
    window.location.hash = targetHash;
  }

  function redirectRoomPreviewToDefault(root) {
    var armed = String(sessionStorage.getItem(ROOM_AFTER_LEAVE_REDIRECT_FLAG) || "") === "1";
    if (!armed) return;
    if (!isRoomView()) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var roomView = scope.querySelector(".mx_RoomView");
    if (!roomView) return;
    if (!shouldTreatAsRoomPreviewPrompt(roomView.textContent || "")) return;
    var guarded = String(sessionStorage.getItem(ROOM_PREVIEW_REDIRECT_GUARD) || "") === "1";
    if (guarded) return;
    sessionStorage.setItem(ROOM_PREVIEW_REDIRECT_GUARD, "1");
    sessionStorage.removeItem(ROOM_AFTER_LEAVE_REDIRECT_FLAG);
    window.location.hash = "#/home";
  }

  function loadRuntimeFlags() {
    return fetch("/config.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("config load failed");
        return res.json();
      })
      .then(function (cfg) {
        var hmr = cfg && typeof cfg === "object" ? cfg.hmr : null;
        if (hmr && typeof hmr === "object" && typeof hmr.e2ee_enabled === "boolean") {
          HMR_E2EE_ENABLED = hmr.e2ee_enabled;
        }
        if (hmr && typeof hmr === "object" && typeof hmr.factory_room_alias === "string" && hmr.factory_room_alias.trim()) {
          FACTORY_ROOM_ALIAS = hmr.factory_room_alias.trim();
        }
      })
      .catch(function () {});
  }

  function toRoomAliasHash(alias) {
    var raw = String(alias || "").trim();
    if (!raw) return "";
    return "#/room/" + encodeURIComponent(raw);
  }

  function redirectEncryptedFactoryDmToServiceRoom(root) {
    if (HMR_E2EE_ENABLED === true) return;
    if (!isRoomView()) return;
    var guarded = String(sessionStorage.getItem(ENCRYPTED_BOT_REDIRECT_GUARD) || "") === "1";
    if (guarded) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var roomHeader = scope.querySelector(".mx_RoomHeader, .mx_RoomView_header, .mx_RoomHeader_wrapper");
    var roomNameText = normalizeDisplayText(roomHeader && roomHeader.textContent || "").toLowerCase();
    if (roomNameText.indexOf("数字工厂bot") < 0 && roomNameText.indexOf("digital factory") < 0) return;
    var roomView = scope.querySelector(".mx_RoomView");
    var bodyText = normalizeDisplayText(roomView && roomView.textContent || "").toLowerCase();
    var encrypted = bodyText.indexOf("已启动加密") >= 0 || bodyText.indexOf("end-to-end encrypted") >= 0;
    if (!encrypted) return;
    var targetHash = toRoomAliasHash(FACTORY_ROOM_ALIAS);
    if (!targetHash) return;
    sessionStorage.setItem(ENCRYPTED_BOT_REDIRECT_GUARD, "1");
    window.location.hash = targetHash;
  }

  function suppressEncryptionUiHints(root) {
    if (HMR_E2EE_ENABLED === true) return;
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var iconNodes = scope.querySelectorAll(
      ".mx_EventTile_e2eIcon, .mx_E2EIcon, [data-testid='e2e-icon'], " +
      "[title*='Encrypted by a device not verified by its owner'], [title*='not verified'], [title*='未验证'], " +
      "[aria-label*='Encrypted by a device not verified by its owner'], [aria-label*='not verified'], [aria-label*='未验证']"
    );
    for (var i = 0; i < iconNodes.length; i += 1) {
      var icon = iconNodes[i];
      if (!(icon instanceof Element)) continue;
      icon.style.setProperty("display", "none", "important");
    }

    var noticeNodes = scope.querySelectorAll(
      ".mx_RoomView .mx_EventTile, .mx_RoomView .mx_Notice, .mx_RoomView .mx_GenericEventListSummary, .mx_RoomView .mx_Toast"
    );
    for (var j = 0; j < noticeNodes.length; j += 1) {
      var node = noticeNodes[j];
      if (!(node instanceof Element)) continue;
      var text = normalizeDisplayText(node.textContent || "").toLowerCase();
      if (!text) continue;
      var isEncryptionHint = (
        text.indexOf("已启用加密") >= 0
        || text.indexOf("end-to-end encrypted") >= 0
        || text.indexOf("verify this device") >= 0
        || text.indexOf("验证此设备") >= 0
        || text.indexOf("session verification") >= 0
        || text.indexOf("会话验证") >= 0
      );
      if (!isEncryptionHint) continue;
      node.style.setProperty("display", "none", "important");
    }

    var composers = scope.querySelectorAll("textarea[placeholder], input[placeholder], [contenteditable='true'][aria-label]");
    for (var k = 0; k < composers.length; k += 1) {
      var composer = composers[k];
      if (!(composer instanceof Element)) continue;
      var ph = String(composer.getAttribute("placeholder") || composer.getAttribute("aria-label") || "");
      var low = normalizeDisplayText(ph).toLowerCase();
      if (!low) continue;
      if (low.indexOf("encrypted message") >= 0 || low.indexOf("加密消息") >= 0) {
        if (composer.hasAttribute("placeholder")) composer.setAttribute("placeholder", "发送消息......");
        if (composer.hasAttribute("aria-label")) composer.setAttribute("aria-label", "发送消息");
      }
    }
  }

  function applyAllLocalizationAndSuppression(root) {
    locale.applyUiTextLocalization(root);
    suppressRecoveryPrompts(root);
    suppressSessionVerificationCards(root);
    forceSuppressSessionVerification(root);
    suppressEncryptionUiHints(root);
    redirectRoomPreviewToDefault(root);
    redirectFactoryPreviewToServiceRoom(root);
    redirectEncryptedFactoryDmToServiceRoom(root);
  }

  function getMatrixUserId() {
    return String(localStorage.getItem("mx_user_id") || "").trim();
  }

  function hasNotificationLabel(text) {
    var t = normalizeText(text);
    return t === "通知" || t === "notifications";
  }

  function openAdminInNewTab() {
    var url = String(adminEntryState.adminUrl || "/admin/index.html");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function findNotificationAnchor() {
    var nodes = document.querySelectorAll("button, a, [role='menuitem']");
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!(node instanceof Element)) continue;
      if (node.closest("#" + DRAWER_ID)) continue;
      if (!node.offsetParent) continue;
      if (!hasNotificationLabel(node.textContent || "")) continue;
      return node;
    }
    return null;
  }

  function ensureAdminEntryItem() {
    var old = document.querySelectorAll("." + ADMIN_ENTRY_ITEM_CLASS);
    if (!adminEntryState.visible) {
      old.forEach(function (n) { n.remove(); });
      return;
    }
    if (old.length > 1) {
      for (var i = 1; i < old.length; i += 1) old[i].remove();
    }
    if (old.length === 1) return;
    var anchor = findNotificationAnchor();
    if (!anchor || !anchor.parentElement) return;
    var item;
    if (anchor.tagName === "A") {
      item = document.createElement("a");
      item.href = String(adminEntryState.adminUrl || "/admin/index.html");
      item.target = "_blank";
      item.rel = "noopener noreferrer";
    } else {
      item = document.createElement("button");
      item.type = "button";
      item.addEventListener("click", function (event) {
        event.preventDefault();
        openAdminInNewTab();
      });
    }
    item.className = String(anchor.className || "").trim() + " " + ADMIN_ENTRY_ITEM_CLASS;
    item.setAttribute("role", anchor.getAttribute("role") || "menuitem");
    item.textContent = "管理后台";
    anchor.parentElement.insertBefore(item, anchor);
  }

  function fetchAdminEntryCapability() {
    if (adminEntryState.checked) return Promise.resolve();
    adminEntryState.checked = true;
    var matrixUserId = getMatrixUserId();
    if (!matrixUserId) {
      adminEntryState.visible = false;
      return Promise.resolve();
    }
    var query = "/api/auth/matrix-admin-entry?matrixUserId=" + encodeURIComponent(matrixUserId);
    return fetch(query, { credentials: "include", cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("admin entry capability request failed");
        return r.json();
      })
      .then(function (data) {
        adminEntryState.visible = Boolean(data && data.showAdminEntry);
        adminEntryState.adminUrl = String((data && data.adminUrl) || "/admin/index.html");
      })
      .catch(function () {
        adminEntryState.visible = false;
      });
  }

  function watchAdminEntryMenu() {
    fetchAdminEntryCapability().then(function () {
      ensureAdminEntryItem();
      applyAllLocalizationAndSuppression(document);
      var observer = new MutationObserver(function () {
        ensureAdminEntryItem();
        applyAllLocalizationAndSuppression(document);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setInterval(function () {
        ensureAdminEntryItem();
        applyAllLocalizationAndSuppression(document);
      }, 500);
    });
  }

  function bindGlobalEvents() {
    document.addEventListener("click", function (event) {
      if (!isRoomView()) return;
      var target = event.target;
      if (!(target instanceof Element)) return;

      var leaveBtn = target.closest("button, .mx_AccessibleButton, [role='button']");
      if (leaveBtn) {
        var leaveLabel = normalizeDisplayText(leaveBtn.textContent || "").toLowerCase();
        if (
          leaveLabel.indexOf("离开房间") >= 0
          || leaveLabel === "离开"
          || leaveLabel.indexOf("leave room") >= 0
          || leaveLabel === "leave"
        ) {
          sessionStorage.setItem(ROOM_AFTER_LEAVE_REDIRECT_FLAG, "1");
        }
      }

      // Intercept voice/video call buttons to provide feedback when call infra unavailable
      var callBtn = target.closest("[aria-label='Voice call'], [aria-label='Video call'], [aria-label='语音通话'], [aria-label='视频通话'], [aria-label='Start voice call'], [aria-label='Start video call'], [aria-label='发起语音通话'], [aria-label='发起视频通话']");
      if (callBtn) {
        // Let Element Web handle the click natively; if call infra is configured it will work.
        // We just ensure the button's aria-label is localized.
        var callLabel = String(callBtn.getAttribute("aria-label") || "");
        var UI_TEXT_MAP = locale.UI_TEXT_MAP || {};
        if (UI_TEXT_MAP[callLabel]) {
          callBtn.setAttribute("aria-label", UI_TEXT_MAP[callLabel]);
          callBtn.setAttribute("title", UI_TEXT_MAP[callLabel]);
        }
        // Don't block the event — let Element Web try the call
      }

      if (target.closest("#" + MASK_ID) || target.closest("#" + DRAWER_ID + " .hmr-close")) {
        closeDrawer();
        return;
      }

      var actionBtn = target.closest("#" + DRAWER_ID + " [data-a]");
      if (actionBtn) {
        var drawer = document.getElementById(DRAWER_ID);
        if (!drawer) return;
        var action = String(actionBtn.getAttribute("data-a") || "");
        var message = String(drawer.dataset.message || "");
        if (action === "copy" && message) {
          navigator.clipboard && navigator.clipboard.writeText(message).catch(function () {});
        }
        if (action === "quote" && message) {
          insertQuoteToComposer(message);
        }
        return;
      }

      var tile = target.closest(".mx_EventTile");
      if (!tile) return;
      if (target.closest("a, button, input, textarea, .mx_ReactionsRow")) return;
      var data = extractMessage(tile);
      if (!data.body) return;
      openDrawer(data);
    }, true);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeDrawer();
    });
  }

  ready(function () {
    loadRuntimeFlags().finally(function () {
      clearCryptoClientStorageIfDisabled();
      var languageChanged = locale.ensurePreferredLanguage();
      locale.tryReloadForLanguageApply(languageChanged);
      redirectToUnifiedLoginIfNeeded();
      if (!isRoomView()) sessionStorage.removeItem(ROOM_PREVIEW_REDIRECT_GUARD);
      window.addEventListener("hashchange", redirectToUnifiedLoginIfNeeded);
      window.addEventListener("hashchange", function () {
        if (!isRoomView()) {
          sessionStorage.removeItem(ROOM_PREVIEW_REDIRECT_GUARD);
          sessionStorage.removeItem(ROOM_AFTER_LEAVE_REDIRECT_FLAG);
          sessionStorage.removeItem(ENCRYPTED_BOT_REDIRECT_GUARD);
          sessionStorage.removeItem(FACTORY_PREVIEW_REDIRECT_GUARD);
        }
      });
      ensureStyle();
      ensureNodes();
      bindGlobalEvents();
      applyAllLocalizationAndSuppression(document);
      watchAdminEntryMenu();
    });
  });
})();
