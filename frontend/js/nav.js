/**
 * 全局导航组件
 * 管理网站导航栏的渲染、用户认证状态和交互
 * 所有页面复用此组件
 */
(function () {
  // ==================== 动态注入图标系统 ====================
  const iconScript = document.createElement('script');
  iconScript.src = 'https://unpkg.com/@phosphor-icons/web';
  document.head.appendChild(iconScript);

  // ==================== 配置 ====================
  const NAV_CONFIG = [
    { name: '首页', href: 'index.html', id: 'nav-home', icon: 'ph-house' },
    { name: '资源文件', href: 'files.html', id: 'nav-files', icon: 'ph-folder-open' },
    { name: '话题讨论', href: 'topics.html', id: 'nav-topics', icon: 'ph-chats-circle' },
    { name: '公告通知', href: 'notice.html', id: 'nav-notice', icon: 'ph-bell-ringing' },
    { name: '账号管理', href: 'admin.html', id: 'nav-admin', icon: 'ph-shield-check', superAdminOnly: true },
  ];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getActiveNavId() {
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    const isIndex = currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath.endsWith('/web');
    if (isIndex) return 'nav-home';
    if (currentPath.includes('files')) return 'nav-files';
    if (currentPath.includes('topics') || currentPath.includes('topic-detail')) return 'nav-topics';
    if (currentPath.includes('notice')) return 'nav-notice';
    if (currentPath.includes('admin')) return 'nav-admin';
    return '';
  }

  function isAdminUser() {
    if (!window.__authUser) return false;
    const role = window.__authUser.role || '';
    return role === 'admin' || role === 'super_admin' || !!(window.__authUser && window.__authUser.isSuperAdmin);
  }

  function getUserName() {
    if (!window.__authUser) return null;
    return window.__authUser.username || window.__authUser.account || window.__authUser.name || null;
  }

  function renderNavigation() {
    const activeId = getActiveNavId();
    const userName = getUserName();
    const isAdmin = isAdminUser();

    const navItems = NAV_CONFIG
      .filter(item => !item.superAdminOnly || isAdmin)
      .map(item => `
        <a href="${item.href}" class="nav-link ${item.id === activeId ? 'active' : ''}" id="${item.id}">
          <i class="ph ${item.icon}" style="font-size: 1.1em; margin-right: 4px; vertical-align: -0.1em;"></i>${item.name}
        </a>
      `).join('');

    const userActions = userName
      ? `
        <span class="nav-user"><i class="ph ph-user-circle" style="font-size: 1.2em;"></i> ${escapeHtml(userName)}</span>
        <a href="change-password.html" class="btn btn-outline btn-sm"><i class="ph ph-key"></i> 修改密码</a>
        <button type="button" class="btn btn-outline btn-sm" id="nav-logout"><i class="ph ph-sign-out"></i> 退出</button>
      `
      : `
        <a href="register.html" class="btn btn-outline btn-sm" style="border-color: rgba(255,255,255,0.5); color: #fff;"><i class="ph ph-user-plus"></i> 申请账号</a>
        <a href="login.html" class="btn btn-primary btn-sm" id="nav-login"><i class="ph ph-sign-in"></i> 登录</a>
      `;

    const navHtml = `
      <header class="site-header">
        <div class="header-inner">
          <a href="index.html" class="logo">
            <img src="images/logo.png" alt="公司LOGO" class="logo-img" onerror="this.outerHTML='<i class=\\'ph-fill ph-shield-check\\' style=\\'font-size: 32px; color: #f6ad55;\\'></i>'" />
            <span class="logo-text-wrap">
              <span class="logo-text">金华市保安服务有限公司</span>
              <span class="logo-sub">内部资源共享平台</span>
            </span>
          </a>
          <nav class="main-nav">${navItems}</nav>
          <div class="header-actions">${userActions}</div>
        </div>
      </header>
    `;

    const navRoot = document.getElementById('site-nav-root');
    if (navRoot) {
      navRoot.innerHTML = navHtml;
      const logoutBtn = document.getElementById('nav-logout');
      if (logoutBtn) logoutBtn.addEventListener('click', handleLogout, { once: true });
    }
  }

  function handleLogout() {
    if (!window.__authUser) return;
    try {
      if (window.__auth && typeof window.__auth.logout === 'function') window.__auth.logout();
      else { delete window.__authUser; try { localStorage.removeItem('authUser'); localStorage.removeItem('authToken'); } catch (e) {} }
      window.location.href = 'index.html';
    } catch (error) {
      window.location.href = 'index.html';
    }
  }

  function initAuthState() {
    try {
      if (window.__api && window.__api.session) {
        const savedUser = window.__api.session.getSavedUser();
        if (savedUser) window.__authUser = savedUser;
        return;
      }
      const savedUserStr = localStorage.getItem('authUser');
      if (savedUserStr) window.__authUser = JSON.parse(savedUserStr);
    } catch (error) {}
  }

  function checkPasswordChangeRequired() {
    if (!window.__authUser) return;
    const currentPath = window.location.pathname || '';
    if (window.__authUser.mustChangePassword && !currentPath.includes('change-password') && !currentPath.includes('login')) {
      window.location.href = 'change-password.html';
    }
  }

  initAuthState();
  checkPasswordChangeRequired();

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', renderNavigation); } 
  else { renderNavigation(); }
})();