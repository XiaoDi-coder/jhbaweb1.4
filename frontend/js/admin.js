(function () {
  var role = window.__authUser ? (window.__authUser.role || '') : '';
  var isAdmin = role === 'admin' || role === 'super_admin' || !!(window.__authUser && window.__authUser.isSuperAdmin);
  if (!window.__authUser || !isAdmin) {
    window.location.href = 'index.html';
    return;
  }

  var pendingList = document.getElementById('pending-list');
  var pendingEmpty = document.getElementById('pending-empty');
  var userList = document.getElementById('user-list');
  var createForm = document.getElementById('create-form');
  var newAccountInput = document.getElementById('new-account');
  var msgEl = document.getElementById('admin-msg');

  function showMsg(text, isError) {
    msgEl.textContent = text;
    msgEl.className = 'admin-msg ' + (isError ? 'error' : 'success');
    msgEl.style.display = 'block';
    setTimeout(function () { msgEl.style.display = 'none'; }, 4000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderPending() {
    pendingList.innerHTML = '<li class="text-muted">加载中...</li>';
    window.__api.admin.listApplications('pending').then(function (ret) {
      var list = (ret && ret.items) ? ret.items : [];
      pendingEmpty.style.display = list.length ? 'none' : 'block';
      pendingList.innerHTML = list.map(function (p) {
      var time = p.applied_at ? new Date(p.applied_at).toLocaleString('zh-CN') : '';
      return '<li class="pending-item">' +
        '<div><span class="file-name">' + escapeHtml(p.account) + '</span><div class="user-meta">申请时间：' + time + '</div></div>' +
        '<div class="flex gap-2">' +
        '<button type="button" class="btn btn-success btn-sm btn-approve" data-id="' + escapeHtml(p.id) + '">通过</button>' +
        '<button type="button" class="btn btn-danger btn-sm btn-reject" data-id="' + escapeHtml(p.id) + '">拒绝</button>' +
        '</div></li>';
      }).join('');

      pendingList.querySelectorAll('.btn-approve').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          window.__api.admin.approveApplication(id).then(function (r) {
            showMsg(r.message || '已通过', false);
            renderPending();
            renderUsers();
          }).catch(function (err) {
            showMsg(err && err.message ? err.message : '操作失败', true);
          });
        });
      });
      pendingList.querySelectorAll('.btn-reject').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          window.__api.admin.rejectApplication(id, '').then(function () {
            showMsg('已拒绝', false);
            renderPending();
          }).catch(function (err) {
            showMsg(err && err.message ? err.message : '操作失败', true);
          });
        });
      });
    }).catch(function (err) {
      pendingList.innerHTML = '<li class="text-muted">' + escapeHtml(err && err.message ? err.message : '加载失败') + '</li>';
    });
  }

  function renderUsers() {
    userList.innerHTML = '<li class="text-muted">加载中...</li>';
    window.__api.admin.listUsers().then(function (ret) {
      var list = (ret && ret.items) ? ret.items : [];
      userList.innerHTML = list.map(function (u) {
        var r = u.role === 'super_admin' ? '超级管理员' : (u.role === 'admin' ? '管理员' : '普通用户');
        var firstLogin = u.must_change_password ? '需修改密码' : '已修改密码';
        var time = u.created_at ? new Date(u.created_at).toLocaleString('zh-CN') : '';
        return '<li class="user-item">' +
          '<div><span class="file-name">' + escapeHtml(u.account) + '</span>' +
          '<div class="user-meta">' + r + ' · ' + firstLogin + ' · 创建于 ' + time + '</div></div>' +
          '</li>';
      }).join('');
    }).catch(function (err) {
      userList.innerHTML = '<li class="text-muted">' + escapeHtml(err && err.message ? err.message : '加载失败') + '</li>';
    });
  }

  createForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var account = newAccountInput.value.trim();
    window.__api.admin.createUser(account).then(function (r) {
      showMsg(r.message || '已创建', false);
      newAccountInput.value = '';
      renderUsers();
    }).catch(function (err) {
      showMsg(err && err.message ? err.message : '创建失败', true);
    });
  });

  renderPending();
  renderUsers();
})();
