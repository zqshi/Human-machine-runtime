(function () {
  var PREFERRED_LANGUAGE = "zh-hans";
  var LANGUAGE_RELOAD_FLAG = "hmr_lang_reloaded_once";
  var HMR_E2EE_ENABLED = false;
  var DRAWER_ID = "hmrMatrixMessageDrawer";

  // ── Eagerly set language in localStorage BEFORE Element Web's bundle parses it ──
  // This runs synchronously at <head> parse time, ensuring i18next picks up zh-hans
  // on first init rather than falling back to English.
  (function earlyLanguageSet() {
    try {
      localStorage.setItem("i18nextLng", PREFERRED_LANGUAGE);
      var raw = localStorage.getItem("mx_local_settings");
      var settings = raw ? JSON.parse(raw) : {};
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) settings = {};
      settings.language = PREFERRED_LANGUAGE;
      localStorage.setItem("mx_local_settings", JSON.stringify(settings));
    } catch {}
    try {
      if (document && document.documentElement) {
        document.documentElement.setAttribute("lang", PREFERRED_LANGUAGE);
      }
    } catch {}
  })();

  var UI_TEXT_MAP = {
    "Notifications": "通知",
    "Notification": "通知",
    "Unreads": "未读",
    "Unread": "未读",
    "Favourites": "收藏",
    "Favorites": "收藏",
    "Favourite": "收藏",
    "Favorite": "收藏",
    "Mentions": "提及",
    "Mention": "提及",
    "Invites": "邀请",
    "Invite": "邀请",
    "Low priority": "低优先级",
    "Low Priority": "低优先级",
    "Settings": "设置",
    "Security & Privacy": "安全与隐私",
    "Help & About": "帮助与关于",
    "Sign out": "退出登录",
    "Sign Out": "退出登录",
    "Start chat": "发起会话",
    "Explore rooms": "探索房间",
    "Create room": "创建房间",
    "People": "联系人",
    "Rooms": "房间",
    "Threads": "线程",
    "Search": "搜索",
    "Send": "发送",
    "Reply": "回复",
    "Cancel": "取消",
    "Save": "保存",
    "Close": "关闭",
    "Back": "返回",
    "Edit": "编辑",
    "Delete": "删除",
    "Copy": "复制",
    "Retry": "重试",
    "View source": "查看来源",
    "No chats yet": "暂无会话",
    "Get started by messaging someone or creating a room": "通过发起聊天或创建房间开始使用",
    "Get started by messaging someone or by creating a room": "通过发起聊天或创建房间开始使用",
    "Get started by messaging someone": "通过发起聊天开始使用",
    "You don't have favourite chats yet": "你还没有收藏会话",
    "You can add a chat to your favourites in the chat settings": "你可以在会话设置中将聊天添加到收藏",
    "You don't have any low priority rooms": "你没有低优先级房间",
    "You don't have direct chats with anyone yet": "你还没有与任何人进行私聊",
    "You can deselect filters in order to see your other chats": "你可以取消筛选以查看其他会话",
    "You're not in any room yet": "你还未加入任何房间",
    "You don't have any unread invites": "你没有未读邀请",
    "You don't have any unread messages": "你没有未读消息",
    "You don't have any unread mentions": "你没有未读提及",
    "You don't have any unread notifications": "你没有未读通知",
    "Congrats! You don't have any unread messages": "太好了，你没有未读消息",
    "Congrats! You don't have any unread messages": "太好了，你没有未读消息",
    "See all activity": "查看全部动态",
    "Show all chats": "显示全部会话",
    "Jump to date": "跳转日期",
    "Mark as read": "标记已读",
    "Mark as unread": "标记未读",
    "Invite": "邀请"
    ,
    "Confirm your identity": "确认你的身份",
    "Verify this device to set up secure messaging": "验证此设备以启用安全加密消息",
    "Use another device": "使用另一台设备",
    "Can't confirm?": "无法确认？",
    "Set up recovery": "设置恢复密钥",
    "Generate a recovery key that can be used to restore your encrypted message history in case you lose access to your devices.": "生成恢复密钥，用于在你无法访问设备时恢复加密消息历史。",
    "Generate a recovery key that can be used to restore your encrypted message history in case you lose access to your device.": "生成恢复密钥，用于在你无法访问设备时恢复加密消息历史。",
    "Continue": "继续",
    "Skip": "跳过",
    "Later": "稍后再说",
    "Verify": "验证",
    "Verification request": "验证请求",
    "Session verification": "会话验证",
    "Cross-signing": "跨设备签名",
    "Secure backup": "安全备份",
    "Recovery key": "恢复密钥",
    "Set up Secure Backup": "设置安全备份",
    "Set up secure backup": "设置安全备份",
    "Set up key backup": "设置密钥备份",
    "Encrypted by default": "默认启用加密",
    "Messages here are end-to-end encrypted.": "此处消息已启用端到端加密。",
    "Messages here are end-to-end encrypted. Verify": "此处消息已启用端到端加密。请验证",
    "other messages in this room cannot be trusted": "此房间中的其他消息暂无法信任",
    "Verify now": "立即验证",
    "Verify later": "稍后验证"
    ,
    "Settings: Encryption": "设置：加密",
    "Key storage": "密钥存储",
    "Allow key storage": "允许密钥存储",
    "Recovery": "恢复",
    "Advanced": "高级",
    "Encryption details": "加密详情",
    "Session ID:": "会话 ID：",
    "Session key:": "会话密钥：",
    "Export keys": "导出密钥",
    "Import keys": "导入密钥",
    "Reset cryptographic identity": "重置加密身份",
    "Other people's devices": "其他人的设备",
    "In encrypted rooms, only send messages to verified users": "在加密房间中，仅向已验证用户发送消息",
    "Learn more": "了解更多",
    "Account": "账号",
    "Encryption": "加密",
    "Voice call": "语音通话",
    "Video call": "视频通话",
    "Hangup": "挂断",
    "Mute microphone": "静音",
    "Unmute microphone": "取消静音",
    "Turn on camera": "打开摄像头",
    "Turn off camera": "关闭摄像头",
    "Start voice call": "发起语音通话",
    "Start video call": "发起视频通话",
    "Active call": "通话中",
    "Call": "通话",
    "Answer": "接听",
    "Decline": "拒绝",
    "Hold": "保持",
    "Resume": "恢复",
    "Dialpad": "拨号盘",
    "Ongoing call": "通话进行中",
    "Call ended": "通话已结束",
    "Call failed": "通话失败",
    "No answer": "无人接听",
    "Busy": "忙碌",
    "You missed a call": "你有一个未接来电",
    "Missed call": "未接来电",
    "Screen sharing": "屏幕共享",
    "Share screen": "共享屏幕",
    "Stop sharing": "停止共享"
  };
  var UI_PHRASE_MAP = {
    "Messages here are end-to-end encrypted.": "此处消息已启用端到端加密。",
    "Verify ": "请验证 ",
    " in their profile - tap on their profile picture.": " 的资料：点击其头像完成验证。",
    "in their profile - tap on their profile picture.": "在其资料页中点击头像完成验证。",
    "Verify this device": "验证此设备",
    "secure messaging": "安全加密消息",
    "Set up recovery": "设置恢复密钥",
    "recovery key": "恢复密钥",
    "encrypted message history": "加密消息历史",
    "Use another device": "使用另一台设备",
    "Can't confirm?": "无法确认？",
    "Store your cryptographic identity and message keys securely on the server. This will allow you to view your message history on any new devices.": "将你的加密身份和消息密钥安全存储在服务器上，以便你在新设备上查看消息历史。",
    "Store your cryptographic identity and message keys securely on the server.": "将你的加密身份和消息密钥安全存储在服务器上。",
    "This will allow you to view your message history on any new devices.": "这样你可以在新设备上查看消息历史。",
    "Recover your cryptographic identity and message history with a recovery key if you've lost all your existing devices.": "若你丢失了现有全部设备，可通过恢复密钥恢复加密身份和消息历史。",
    "Recover your cryptographic identity and message history with a recovery key": "通过恢复密钥恢复加密身份和消息历史",
    "if you've lost all your existing devices.": "（当你丢失现有全部设备时）。",
    "Warning: users who have not explicitly verified with you": "警告：未与你明确完成验证的用户",
    "will not receive your encrypted messages.": "将无法接收你的加密消息。",
    "Also, unverified devices of verified users will not receive your encrypted messages.": "此外，已验证用户的未验证设备也无法接收你的加密消息。",
    "Changes require an application restart to take effect.": "更改需重启应用后生效。",
    "Key storage": "密钥存储",
    "Recovery": "恢复",
    "Advanced": "高级",
    "Encryption details": "加密详情",
    "Export keys": "导出密钥",
    "Import keys": "导入密钥",
    "Reset cryptographic identity": "重置加密身份",
    "Other people's devices": "其他人的设备",
    "In encrypted rooms, only send messages to verified users": "在加密房间中，仅向已验证用户发送消息"
    ,
    "Send an encrypted message": "发送消息",
    "Send an encrypted message…": "发送消息……",
    "Send an encrypted message...": "发送消息......",
    "Voice call": "语音通话",
    "Video call": "视频通话",
    "Start voice call": "发起语音通话",
    "Start video call": "发起视频通话",
    "Hangup": "挂断",
    "Mute microphone": "静音",
    "Unmute microphone": "取消静音",
    "Turn on camera": "打开摄像头",
    "Turn off camera": "关闭摄像头",
    "Active call": "通话中",
    "Answer": "接听",
    "Decline": "拒绝",
    "Ongoing call": "通话进行中",
    "Call ended": "通话已结束",
    "Call failed": "通话失败",
    "No answer": "无人接听",
    "You missed a call": "你有一个未接来电",
    "Missed call": "未接来电",
    "Share screen": "共享屏幕",
    "Stop sharing": "停止共享",
    "Screen sharing": "屏幕共享"
  };
  var UI_REGEX_REPLACEMENTS = [
    { from: /Generate a recovery key that can be used to restore your encrypted message history in case you lose access to your devices\./gi, to: "生成恢复密钥，用于在你无法访问设备时恢复加密消息历史。" },
    { from: /Generate a recovery key that can be used to restore your encrypted message history\./gi, to: "生成恢复密钥，用于恢复加密消息历史。" },
    { from: /in case you lose access to your devices\./gi, to: "（当你无法访问设备时）。" },
    { from: /\bSettings:\s*Account\b/gi, to: "设置：账号" },
    { from: /\bSettings:\s*Encryption\b/gi, to: "设置：加密" },
    { from: /\bSet up recovery\b/gi, to: "设置恢复密钥" },
    { from: /\bPersonal info\b/gi, to: "个人信息" },
    { from: /\bDisplay Name\b/gi, to: "显示名称" },
    { from: /\bUsername\b/gi, to: "用户名" },
    { from: /\bAccount\b/gi, to: "账号" },
    { from: /\bLearn more\b/gi, to: "了解更多" }
  ];
  var RECOVERY_PROMPT_PATTERNS = [
    "设置恢复密钥",
    "set up recovery",
    "恢复密钥",
    "recovery key",
    "secure backup"
  ];
  var SESSION_VERIFICATION_PROMPT_PATTERNS = [
    "验证会话",
    "验证此会话",
    "会话验证",
    "其他用户可能不信任它",
    "session verification",
    "verify this session",
    "verify session",
    "can't be trusted"
  ];
  var LOGOUT_ENCRYPTION_WARNING_PATTERNS = [
    "你将失去你的加密消息的访问权",
    "这些密钥会从此设备删除",
    "在登出之前请备份密钥以免丢失",
    "lose access to your encrypted messages",
    "keys will be removed from this device",
    "before signing out make sure you've got keys"
  ];

  function isAuthHash(hash) {
    var val = String(hash || "").toLowerCase();
    return val.indexOf("#/login") === 0 || val.indexOf("#/welcome") === 0 || val.indexOf("#/soft_logout") === 0;
  }

  function ensurePreferredLanguage() {
    var changed = false;
    var prevLang = String(localStorage.getItem("i18nextLng") || "").trim().toLowerCase();
    if (prevLang !== PREFERRED_LANGUAGE) changed = true;
    localStorage.setItem("i18nextLng", PREFERRED_LANGUAGE);
    try {
      var raw = localStorage.getItem("mx_local_settings");
      var settings = raw ? JSON.parse(raw) : {};
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) settings = {};
      if (settings.language !== PREFERRED_LANGUAGE) {
        settings.language = PREFERRED_LANGUAGE;
        changed = true;
        localStorage.setItem("mx_local_settings", JSON.stringify(settings));
      }
      if (HMR_E2EE_ENABLED !== true) {
        settings.useE2eForGroupChats = false;
        settings.useE2eForDirectChats = false;
        settings.sendEncryptedMessagesInDms = false;
        settings.onlySendToVerifiedDevices = false;
        localStorage.setItem("mx_local_settings", JSON.stringify(settings));
      }
    } catch {
      changed = true;
      localStorage.setItem("mx_local_settings", JSON.stringify({ language: PREFERRED_LANGUAGE }));
    }
    try {
      if (document && document.documentElement) {
        document.documentElement.setAttribute("lang", PREFERRED_LANGUAGE);
      }
    } catch {}
    return changed;
  }

  function tryReloadForLanguageApply(changed) {
    if (!changed) return;
    if (isAuthHash(window.location.hash || "")) return;
    // Use localStorage with a short TTL instead of sessionStorage so that
    // hard-refresh (which preserves sessionStorage) can still trigger a
    // necessary reload when the language was wrong.
    try {
      var raw = localStorage.getItem(LANGUAGE_RELOAD_FLAG);
      if (raw) {
        var ts = parseInt(raw, 10);
        // Guard expires after 10 seconds — prevents infinite reload loops
        // while still allowing a fresh reload on hard-refresh.
        if (!isNaN(ts) && Date.now() - ts < 10000) return;
      }
      localStorage.setItem(LANGUAGE_RELOAD_FLAG, String(Date.now()));
    } catch {
      // If localStorage fails, skip reload to avoid loop
      return;
    }
    window.location.reload();
  }

  function normalizeText(input) {
    return String(input || "").trim().toLowerCase();
  }

  function normalizeDisplayText(input) {
    return String(input || "").replace(/[']/g, "'").replace(/\s+/g, " ").trim();
  }

  function setNodeTextIfSimple(node, nextText) {
    if (!(node instanceof Element)) return false;
    if (node.children && node.children.length > 0) return false;
    var before = normalizeDisplayText(node.textContent || "");
    if (!before || before === nextText) return false;
    node.textContent = nextText;
    return true;
  }

  function setNodeTextLoose(node, nextText) {
    if (!(node instanceof Element)) return false;
    if (node.querySelector("button, a, [role='button'], [role='menuitem']")) return false;
    var before = normalizeDisplayText(node.textContent || "");
    if (!before || before === nextText) return false;
    node.textContent = nextText;
    return true;
  }

  function replaceByPhrase(text) {
    var out = String(text || "");
    UI_REGEX_REPLACEMENTS.forEach(function (rule) {
      if (!rule || !rule.from || !rule.to) return;
      out = out.replace(rule.from, rule.to);
    });
    Object.keys(UI_PHRASE_MAP).forEach(function (from) {
      if (!from) return;
      var to = UI_PHRASE_MAP[from];
      if (!to) return;
      if (out.indexOf(from) >= 0) out = out.split(from).join(to);
    });
    return out;
  }

  function applyPhraseLocalizationToNode(node) {
    if (!(node instanceof Element)) return false;
    if (!node.offsetParent) return false;
    if (node.closest("#" + DRAWER_ID)) return false;
    var changed = false;
    var text = String(node.textContent || "");
    var replaced = replaceByPhrase(text);
    if (replaced !== text) {
      node.textContent = replaced;
      changed = true;
    }

    ["title", "aria-label", "placeholder"].forEach(function (attr) {
      var value = node.getAttribute(attr);
      if (!value) return;
      var next = replaceByPhrase(value);
      if (next !== value) {
        node.setAttribute(attr, next);
        changed = true;
      }
    });
    return changed;
  }

  function applyPhraseLocalizationToTextNodes(root) {
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    var node = walker.nextNode();
    while (node) {
      var parent = node.parentElement;
      if (parent && !parent.closest("#" + DRAWER_ID)) {
        var raw = String(node.nodeValue || "");
        var trimmed = normalizeDisplayText(raw);
        if (trimmed) {
          var replaced = replaceByPhrase(raw);
          if (replaced !== raw) node.nodeValue = replaced;
        }
      }
      node = walker.nextNode();
    }
  }

  function shouldSuppressRecoveryPromptText(text) {
    var t = normalizeDisplayText(text).toLowerCase();
    if (!t) return false;
    for (var i = 0; i < RECOVERY_PROMPT_PATTERNS.length; i += 1) {
      var p = String(RECOVERY_PROMPT_PATTERNS[i] || "").toLowerCase();
      if (!p) continue;
      if (t.indexOf(p) >= 0) return true;
    }
    return false;
  }

  function shouldSuppressSessionVerificationPromptText(text) {
    var t = normalizeDisplayText(text).toLowerCase();
    if (!t) return false;
    for (var i = 0; i < SESSION_VERIFICATION_PROMPT_PATTERNS.length; i += 1) {
      var p = String(SESSION_VERIFICATION_PROMPT_PATTERNS[i] || "").toLowerCase();
      if (!p) continue;
      if (t.indexOf(p) >= 0) return true;
    }
    return false;
  }

  function shouldSuppressLogoutEncryptionWarningText(text) {
    var t = normalizeDisplayText(text).toLowerCase();
    if (!t) return false;
    for (var i = 0; i < LOGOUT_ENCRYPTION_WARNING_PATTERNS.length; i += 1) {
      var p = String(LOGOUT_ENCRYPTION_WARNING_PATTERNS[i] || "").toLowerCase();
      if (!p) continue;
      if (t.indexOf(p) >= 0) return true;
    }
    return false;
  }

  function applyUiTextLocalization(root) {
    var scope = root instanceof Element || root instanceof Document ? root : document;
    var nodes = scope.querySelectorAll("button, a, [role='menuitem'], [role='button'], .mx_AccessibleButton, .mx_StyledButton");
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!(node instanceof Element)) continue;
      if (!node.offsetParent) continue;
      if (node.closest("#" + DRAWER_ID)) continue;
      var current = normalizeDisplayText(node.textContent || "");
      if (!current) continue;
      var mapped = UI_TEXT_MAP[current] || UI_TEXT_MAP[current.toLowerCase()];
      if (!mapped) continue;
      setNodeTextIfSimple(node, mapped);
      applyPhraseLocalizationToNode(node);
    }

    var passiveNodes = scope.querySelectorAll(
      ".mx_LeftPanel p, .mx_LeftPanel span, .mx_LeftPanel div, .mx_LeftPanel a, " +
      ".mx_HomePage p, .mx_HomePage span, .mx_HomePage div, .mx_HomePage a, .mx_HomePage h1, .mx_HomePage h2, .mx_HomePage h3, " +
      ".mx_Dialog p, .mx_Dialog span, .mx_Dialog div, .mx_Dialog h1, .mx_Dialog h2, .mx_Dialog h3, .mx_Dialog h4, " +
      ".mx_Modal p, .mx_Modal span, .mx_Modal div, .mx_Modal h1, .mx_Modal h2, .mx_Modal h3, .mx_Modal h4, " +
      ".mx_Toast p, .mx_Toast span, .mx_Toast div, " +
      ".mx_RoomView p, .mx_RoomView span"
    );
    for (var j = 0; j < passiveNodes.length; j += 1) {
      var el = passiveNodes[j];
      if (!(el instanceof Element)) continue;
      if (!el.offsetParent) continue;
      var text = normalizeDisplayText(el.textContent || "");
      if (!text) continue;
      var tMapped = UI_TEXT_MAP[text] || UI_TEXT_MAP[text.toLowerCase()];
      if (tMapped) {
        if (!setNodeTextIfSimple(el, tMapped)) {
          setNodeTextLoose(el, tMapped);
        }
      }
      applyPhraseLocalizationToNode(el);
    }

    var attrsNodes = scope.querySelectorAll("[title], [aria-label], input[placeholder], textarea[placeholder]");
    for (var k = 0; k < attrsNodes.length; k += 1) {
      applyPhraseLocalizationToNode(attrsNodes[k]);
    }
    applyPhraseLocalizationToTextNodes(scope);
  }

  // Expose to drawer script
  window.__hmrLocale = {
    PREFERRED_LANGUAGE: PREFERRED_LANGUAGE,
    UI_TEXT_MAP: UI_TEXT_MAP,
    RECOVERY_PROMPT_PATTERNS: RECOVERY_PROMPT_PATTERNS,
    SESSION_VERIFICATION_PROMPT_PATTERNS: SESSION_VERIFICATION_PROMPT_PATTERNS,
    LOGOUT_ENCRYPTION_WARNING_PATTERNS: LOGOUT_ENCRYPTION_WARNING_PATTERNS,
    ensurePreferredLanguage: ensurePreferredLanguage,
    tryReloadForLanguageApply: tryReloadForLanguageApply,
    normalizeText: normalizeText,
    normalizeDisplayText: normalizeDisplayText,
    applyUiTextLocalization: applyUiTextLocalization,
    applyPhraseLocalizationToTextNodes: applyPhraseLocalizationToTextNodes,
    shouldSuppressRecoveryPromptText: shouldSuppressRecoveryPromptText,
    shouldSuppressSessionVerificationPromptText: shouldSuppressSessionVerificationPromptText,
    shouldSuppressLogoutEncryptionWarningText: shouldSuppressLogoutEncryptionWarningText
  };
})();
