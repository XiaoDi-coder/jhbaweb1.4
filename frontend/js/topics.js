(function () {
  function run() {
    var listEl = document.getElementById('topic-list');
    var emptyEl = document.getElementById('topic-empty');
    var createCard = document.getElementById('create-topic-card');
    var createForm = document.getElementById('create-topic-form');
    var btnNew = document.getElementById('btn-new-topic');
    var cancelBtn = document.getElementById('cancel-create');
    var searchInput = document.getElementById('topic-search');
    var searchCard = document.getElementById('topic-search-card');
    var currentSearchQuery = '';
    var allTopics = [];

  function addTopic(title, content) {
    var user = window.__authUser;
    if (!user) {
      alert('请先登录后再发布话题。');
      window.location.href = 'login.html?from=topics';
      return;
    }
    window.__api.topics.create(title, content || '').then(function () {
      createForm.reset();
      createCard.style.display = 'none';
      refresh();
    }).catch(function (err) {
      alert(err && err.message ? err.message : '发布失败');
    });
  }

  function removeTopic(id) {
    window.__api.topics.remove(id).then(function () {
      refresh();
    }).catch(function (err) {
      alert(err && err.message ? err.message : '删除失败');
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function render(list) {
    list = list || [];
    emptyEl.style.display = list.length ? 'none' : 'block';
    listEl.innerHTML = list.map(function (t) {
      var timeStr = t.created_at ? new Date(t.created_at).toLocaleString('zh-CN') : '';
      var author = t.author_name || t.author_account || '匿名';
      var canDelete = window.__authUser && (String(window.__authUser.id) === String(t.created_by) || window.__authUser.role === 'admin' || window.__authUser.role === 'super_admin');
      var deleteBtn = canDelete
        ? '<button type="button" class="btn btn-danger btn-sm delete-topic" data-id="' + escapeHtml(String(t.id)) + '">删除</button>'
        : '';
      var viewBtn = '<a class="btn btn-primary btn-sm" href="topic-detail.html?id=' + encodeURIComponent(t.id) + '">查看 / 评论</a>';
      return '<li class="topic-item">' +
        '<a href="topic-detail.html?id=' + encodeURIComponent(t.id) + '">' + escapeHtml(t.title) + '</a>' +
        '<div class="topic-meta">' + escapeHtml(author) + ' · ' + timeStr + ' · ' + (t.comment_count || 0) + ' 条评论</div>' +
        '<div class="topic-actions">' + viewBtn + (deleteBtn ? ' ' + deleteBtn : '') + '</div>' +
        '</li>';
    }).join('');

    listEl.querySelectorAll('.delete-topic').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('确定删除该话题？评论将一并清除。')) return;
        removeTopic(btn.getAttribute('data-id'));
      });
    });
  }

  btnNew.addEventListener('click', function () {
    if (!window.__authUser) {
      alert('请先登录后再发布话题。');
      window.location.href = 'login.html?from=topics';
      return;
    }
    createCard.style.display = 'block';
  });

  if (cancelBtn) cancelBtn.addEventListener('click', function () {
    createCard.style.display = 'none';
  });

  createForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = document.getElementById('topic-title').value.trim();
    if (!title) return;
    addTopic(title, document.getElementById('topic-content').value.trim());
  });

  function filterTopics(list, query) {
    if (!query || query.trim() === '') return list;
    var q = query.trim().toLowerCase();
    return list.filter(function (t) {
      return (t.title || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  function applySearch() {
    currentSearchQuery = (searchInput && searchInput.value) ? searchInput.value.trim() : '';
    var toShow = filterTopics(allTopics, currentSearchQuery);
    render(toShow);
  }

  function refresh() {
    listEl.innerHTML = '<li class="text-muted">加载中...</li>';
    window.__api.topics.list().then(function (ret) {
      allTopics = ret.items || [];
      var toShow = filterTopics(allTopics, currentSearchQuery);
      render(toShow);
    }).catch(function (err) {
      listEl.innerHTML = '<li class="text-muted">' + escapeHtml(err && err.message ? err.message : '加载失败') + '</li>';
    });
  }

  function onClear() {
    if (searchInput) searchInput.value = '';
    currentSearchQuery = '';
    render(allTopics);
  }

  if (searchCard) {
    searchCard.addEventListener('click', function (e) {
      var btn = e.target && (e.target.id ? e.target : (e.target.closest && e.target.closest('button')));
      var id = btn && (btn.id || (btn.getAttribute && btn.getAttribute('id')));
      if (id === 'btn-search-topic') { e.preventDefault(); e.stopPropagation(); applySearch(); return; }
      if (id === 'btn-clear-topic-search') { e.preventDefault(); e.stopPropagation(); onClear(); return; }
    });
  }
  if (searchInput) {
    searchInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applySearch(); }
    });
  }

  refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
