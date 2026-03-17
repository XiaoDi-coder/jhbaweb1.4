(function () {
  var params = new URLSearchParams(window.location.search);
  var topicId = params.get('id');

  function run() {
    var titleEl = document.getElementById('detail-title');
    var metaEl = document.getElementById('detail-meta');
    var contentEl = document.getElementById('detail-content');
    var actionsEl = document.getElementById('detail-actions');
    var commentList = document.getElementById('comment-list');
    var commentEmpty = document.getElementById('comment-empty');
    var commentForm = document.getElementById('comment-form');
    var commentFormWrap = document.getElementById('comment-form-wrap');
    if (!commentForm || !commentList) return;

  function addComment(content) {
    var user = window.__authUser;
    if (!user) {
      alert('请先登录后再评论。');
      window.location.href = 'login.html?from=topic-detail&id=' + encodeURIComponent(topicId || '');
      return;
    }
    if (!window.__api || !window.__api.topics || !window.__api.topics.addComment) {
      alert('接口未就绪，请刷新页面重试。');
      return;
    }
    window.__api.topics.addComment(topicId, content).then(function () {
      commentForm.reset();
      renderComments();
    }).catch(function (err) {
      alert(err && err.message ? err.message : '评论失败');
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderComments() {
    commentList.innerHTML = '<li class="text-muted">加载中...</li>';
    window.__api.topics.listComments(topicId).then(function (ret) {
      var comments = Array.isArray(ret) ? ret : (ret && ret.items ? ret.items : []);
      commentEmpty.style.display = comments.length ? 'none' : 'block';
      commentList.innerHTML = comments.map(function (c) {
      var timeStr = c.created_at ? new Date(c.created_at).toLocaleString('zh-CN') : '';
      var author = c.author_name || c.author_account || '匿名';
      return '<li class="comment-item">' +
        '<div class="comment-author">' + escapeHtml(author) + '</div>' +
        '<div class="comment-time">' + timeStr + '</div>' +
        '<div class="comment-body">' + escapeHtml(c.content) + '</div>' +
        '</li>';
      }).join('');
    }).catch(function (err) {
      commentList.innerHTML = '<li class="text-muted">' + escapeHtml(err && err.message ? err.message : '加载失败') + '</li>';
    });
  }

  function renderDetail() {
    if (!topicId) {
      titleEl.textContent = '话题不存在';
      metaEl.textContent = '';
      contentEl.textContent = '链接有误。';
      actionsEl.innerHTML = '<a href="topics.html" class="btn btn-primary">返回列表</a>';
      commentFormWrap.style.display = 'none';
      return;
    }

    titleEl.textContent = '加载中...';
    window.__api.topics.get(topicId).then(function (ret) {
      var topic = ret.topic;
      var author = topic.author_name || topic.author_account || '匿名';
      titleEl.textContent = topic.title;
      metaEl.textContent = author + ' · ' + (topic.created_at ? new Date(topic.created_at).toLocaleString('zh-CN') : '');
      contentEl.textContent = topic.content || '（无内容）';
      var canDelete = window.__authUser && (String(window.__authUser.id) === String(topic.created_by) || window.__authUser.role === 'admin' || window.__authUser.role === 'super_admin');
      actionsEl.innerHTML = canDelete
        ? '<button type="button" class="btn btn-danger btn-sm" id="detail-delete-topic">删除话题</button>'
        : '';
      var delBtn = document.getElementById('detail-delete-topic');
      if (delBtn) {
        delBtn.addEventListener('click', function () {
          if (!confirm('确定删除该话题？')) return;
          window.__api.topics.remove(topicId).then(function () {
            window.location.href = 'topics.html';
          }).catch(function (err) {
            alert(err && err.message ? err.message : '删除失败');
          });
        });
      }
      renderComments();
    }).catch(function () {
      titleEl.textContent = '话题不存在';
      metaEl.textContent = '';
      contentEl.textContent = '可能已被删除或链接有误。';
      actionsEl.innerHTML = '<a href="topics.html" class="btn btn-primary">返回列表</a>';
      commentFormWrap.style.display = 'none';
    });
  }

  commentForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var contentEl = document.getElementById('comment-content');
    var content = contentEl && contentEl.value ? contentEl.value.trim() : '';
    if (!content) return;
    addComment(content);
  });

  renderDetail();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
