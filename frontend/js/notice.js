(function () {
  var listEl = document.getElementById('notice-list');
  var adminWrap = document.getElementById('notice-admin-wrap');
  var noticeForm = document.getElementById('notice-form');
  var noticeEditId = document.getElementById('notice-edit-id');
  var noticeTitle = document.getElementById('notice-title');
  var noticeContent = document.getElementById('notice-content');
  var cancelBtn = document.getElementById('notice-cancel-btn');

  function isAdmin() {
    var u = window.__authUser;
    return u && (u.role === 'admin' || u.role === 'super_admin');
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function render(items) {
    if (!listEl) return;
    if (!items || !items.length) {
      listEl.innerHTML = '<p class="text-muted">暂无公告。</p>';
      return;
    }
    var admin = isAdmin();
    listEl.innerHTML = items.map(function (n) {
      var time = n.created_at ? new Date(n.created_at).toLocaleString('zh-CN') : '';
      var author = n.author_name || n.author_account || '管理员';
      var preview = (n.content || '').slice(0, 120);
      var more = n.content && n.content.length > 120 ? '…' : '';
      var actions = admin
        ? '<div class="notice-item-actions mt-2"><button type="button" class="btn btn-primary btn-sm notice-btn-view" data-id="' + escapeHtml(String(n.id)) + '">查看</button> <button type="button" class="btn btn-outline btn-sm notice-btn-edit" data-id="' + escapeHtml(String(n.id)) + '">编辑</button> <button type="button" class="btn btn-danger btn-sm notice-btn-delete" data-id="' + escapeHtml(String(n.id)) + '">删除</button></div>'
        : '';
      return '<div class="card notice-item" data-id="' + escapeHtml(String(n.id)) + '" data-view="1">' +
        '<h2 class="card-title">' + escapeHtml(n.title) + '</h2>' +
        '<p class="text-muted mb-0">' + escapeHtml(preview) + more + '</p>' +
        '<div class="file-meta mt-1">' + escapeHtml(author) + ' · ' + escapeHtml(time) + '</div>' +
        actions +
        '</div>';
    }).join('');

    listEl.querySelectorAll('.notice-item').forEach(function (el) {
      var viewBtn = el.querySelector('.notice-btn-view');
      var editBtn = el.querySelector('.notice-btn-edit');
      var delBtn = el.querySelector('.notice-btn-delete');
      if (viewBtn) {
        viewBtn.addEventListener('click', function (e) { e.stopPropagation(); openView(el.getAttribute('data-id')); });
      }
      if (editBtn) {
        editBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = editBtn.getAttribute('data-id');
          window.__api.notices.get(id).then(function (ret) {
            var n = ret.notice;
            startEdit(String(n.id), n.title || '', n.content || '');
          }).catch(function (err) {
            alert(err && err.message ? err.message : '加载失败');
          });
        });
      }
      if (delBtn) {
        delBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = delBtn.getAttribute('data-id');
          if (!confirm('确定删除该公告？')) return;
          window.__api.notices.remove(id).then(function () { load(); }).catch(function (err) {
            alert(err && err.message ? err.message : '删除失败');
          });
        });
      }
      if (!admin) {
        el.addEventListener('click', function () {
          openView(el.getAttribute('data-id'));
        });
      }
    });
  }

  function openView(id) {
    window.__api.notices.get(id).then(function (ret) {
      var n = ret.notice;
      alert((n.title || '') + '\n\n' + (n.content || ''));
    }).catch(function (err) {
      alert(err && err.message ? err.message : '加载失败');
    });
  }

  function startEdit(id, title, content) {
    if (noticeEditId) noticeEditId.value = id || '';
    if (noticeTitle) noticeTitle.value = title || '';
    if (noticeContent) noticeContent.value = content || '';
    var submitBtn = document.getElementById('notice-submit-btn');
    if (submitBtn) submitBtn.textContent = id ? '保存' : '发布';
    if (adminWrap) adminWrap.style.display = 'block';
  }

  function load() {
    listEl.innerHTML = '<p class="text-muted">加载中...</p>';
    window.__api.notices.list().then(function (ret) {
      render(ret.items || []);
    }).catch(function (err) {
      listEl.innerHTML = '<p class="text-muted">' + escapeHtml(err && err.message ? err.message : '加载失败') + '</p>';
    });
  }

  function init() {
    if (!listEl) return;
    if (isAdmin() && adminWrap) adminWrap.style.display = 'block';
    if (noticeForm) {
      noticeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var id = noticeEditId && noticeEditId.value ? noticeEditId.value.trim() : '';
        var title = noticeTitle && noticeTitle.value ? noticeTitle.value.trim() : '';
        var content = noticeContent && noticeContent.value ? noticeContent.value.trim() : '';
        if (!title || !content) return;
        if (id) {
          window.__api.notices.update(id, title, content).then(function () {
            noticeForm.reset();
            if (noticeEditId) noticeEditId.value = '';
            document.getElementById('notice-submit-btn').textContent = '发布';
            load();
          }).catch(function (err) {
            alert(err && err.message ? err.message : '更新失败');
          });
        } else {
          window.__api.notices.create(title, content).then(function () {
            noticeForm.reset();
            load();
          }).catch(function (err) {
            alert(err && err.message ? err.message : '发布失败');
          });
        }
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        noticeForm.reset();
        if (noticeEditId) noticeEditId.value = '';
        document.getElementById('notice-submit-btn').textContent = '发布';
      });
    }
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
