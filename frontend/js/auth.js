/**
 * 后端版登录态初始化（配合 js/api.js）
 * - token 存储在 localStorage.authToken
 * - 用户信息存储在 localStorage.authUser
 */
(function (global) {
  function init() {
    if (!global.__api || !global.__api.session) return;
    var u = global.__api.session.getSavedUser();
    if (u) global.__authUser = u;
  }

  init();

  global.__auth = {
    logout: function () {
      try { delete global.__authUser; } catch (e) {}
      if (global.__api && global.__api.session) {
        global.__api.session.clearToken();
        global.__api.session.clearSavedUser();
      } else {
        try { localStorage.removeItem('authToken'); localStorage.removeItem('authUser'); } catch (e) {}
      }
    },
  };
})(typeof window !== 'undefined' ? window : this);
