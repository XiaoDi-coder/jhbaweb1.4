(function () {
  function run() {
    var listEl = document.getElementById('file-list');
    var emptyEl = document.getElementById('file-empty');
    var zone = document.getElementById('upload-zone');
    var input = document.getElementById('file-input');
    var searchInput = document.getElementById('file-search');
    var searchCard = document.getElementById('file-search-card');
    var currentSearchQuery = '';
    var allItems = [];

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // 根据文件后缀名动态返回高级 SVG 图标
  function getFileIcon(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return '<i class="ph-duotone ph-file-pdf" style="color: #e53e3e; font-size: 36px;"></i>';
    if (['doc', 'docx'].includes(ext)) return '<i class="ph-duotone ph-file-doc" style="color: #3182ce; font-size: 36px;"></i>';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '<i class="ph-duotone ph-file-xls" style="color: #38a169; font-size: 36px;"></i>';
    if (['ppt', 'pptx'].includes(ext)) return '<i class="ph-duotone ph-presentation-chart" style="color: #dd6b20; font-size: 36px;"></i>';
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) return '<i class="ph-duotone ph-file-archive" style="color: #d69e2e; font-size: 36px;"></i>';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return '<i class="ph-duotone ph-file-image" style="color: #805ad5; font-size: 36px;"></i>';
    if (['mp4', 'avi', 'mov'].includes(ext)) return '<i class="ph-duotone ph-file-video" style="color: #e53e3e; font-size: 36px;"></i>';
    return '<i class="ph-duotone ph-file-text" style="color: #a0aec0; font-size: 36px;"></i>';
  }

  function render(items) {
    items = items || [];
    if (!items.length) {
      emptyEl.style.display = 'block';
      emptyEl.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="ph-duotone ph-folder-dashed" style="font-size: 48px; color: var(--color-text-muted); margin-bottom: 8px;"></i><br>暂无文件，请上传。</div>';
      listEl.innerHTML = '';
      return;
    }
    emptyEl.style.display = 'none';

    listEl.innerHTML = items.map(function (f) {
      var sizeStr = typeof f.file_size === 'number' ? formatSize(f.file_size) : (f.file_size || '-');
      var timeStr = f.uploaded_at ? new Date(f.uploaded_at).toLocaleString('zh-CN') : '';
      var canDelete = window.__authUser && (String(window.__authUser.id) === String(f.uploaded_by) || (window.__authUser.role === 'admin' || window.__authUser.role === 'super_admin'));
      
      return '<li class="file-item">' +
        '<div class="flex" style="align-items: center; gap: 16px;">' +
        '<div style="flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: rgba(0,0,0,0.03); border-radius: 12px;">' + getFileIcon(f.filename) + '</div>' +
        '<div><span class="file-name">' + escapeHtml(f.filename) + '</span><div class="file-meta"><i class="ph ph-hard-drives"></i> ' + sizeStr + ' &nbsp;·&nbsp; <i class="ph ph-clock"></i> ' + timeStr + ' &nbsp;·&nbsp; <i class="ph ph-download-simple"></i> 下载 ' + (f.download_count || 0) + '</div></div></div>' +
        '<div class="flex gap-2">' +
        '<a class="btn btn-primary btn-sm download-file" href="' + escapeHtml(window.__api.files.downloadUrl(f.id)) + '" target="_blank" rel="noopener"><i class="ph-bold ph-download"></i> 下载</a>' +
        (canDelete ? '<button type="button" class="btn btn-outline btn-sm delete-file" style="color: var(--color-danger); border-color: var(--color-danger);" data-id="' + escapeHtml(String(f.id)) + '"><i class="ph-bold ph-trash"></i> 删除</button>' : '') +
        '</div></li>';
    }).join('');

    listEl.querySelectorAll('.delete-file').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('确定删除该文件？')) return;
        var id = btn.getAttribute('data-id');
        window.__api.files.remove(id).then(function () { refresh(); }).catch(function (err) { alert(err && err.message ? err.message : '删除失败'); });
      });
    });
  }

  function filterFiles(items, query) {
    if (!query || query.trim() === '') return items;
    var q = query.trim().toLowerCase();
    return items.filter(function (f) { return (f.filename || '').toLowerCase().indexOf(q) !== -1; });
  }

  function refresh() {
    listEl.innerHTML = '<li class="text-muted"><i class="ph ph-spinner ph-spin"></i> 加载中...</li>';
    window.__api.files.list().then(function (ret) {
      allItems = ret.items || [];
      var toShow = filterFiles(allItems, currentSearchQuery);
      render(toShow);
    }).catch(function (err) {
      listEl.innerHTML = '<li class="text-muted"><i class="ph ph-warning"></i> ' + escapeHtml(err && err.message ? err.message : '加载失败') + '</li>';
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  zone.addEventListener('click', function () {
    if (!window.__authUser) { alert('请先登录后再上传文件。'); window.location.href = 'login.html?from=files'; return; }
    input.click();
  });
  zone.innerHTML = '<i class="ph-duotone ph-upload-simple" style="font-size: 48px; color: var(--color-primary); margin-bottom: 12px; display: inline-block;"></i><p class="mb-0"><strong>点击或拖拽文件到此处上传</strong></p><p class="text-muted mt-1 mb-0">支持多选，含压缩包（.zip / .rar 等）</p>';

  zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', function () { zone.classList.remove('dragover'); });
  zone.addEventListener('drop', function (e) {
    e.preventDefault(); zone.classList.remove('dragover');
    if (!window.__authUser) { alert('请先登录后再上传文件。'); return; }
    uploadFiles(e.dataTransfer.files);
  });

  input.addEventListener('change', function () { uploadFiles(input.files); input.value = ''; });

  function uploadFiles(files) {
    if (!files || !files.length) return;
    var i = 0;
    function next() {
      if (i >= files.length) { refresh(); return; }
      window.__api.files.upload(files[i]).then(function () { i++; next(); }).catch(function (err) { alert((err && err.message ? err.message : '上传失败') + '：' + (files[i] && files[i].name ? files[i].name : '')); i++; next(); });
    }
    next();
  }

  function applySearch() { currentSearchQuery = (searchInput && searchInput.value) ? searchInput.value.trim() : ''; render(filterFiles(allItems, currentSearchQuery)); }
  function onClear() { if (searchInput) searchInput.value = ''; currentSearchQuery = ''; render(allItems); }

  if (searchCard) {
    searchCard.addEventListener('click', function (e) {
      var btn = e.target && (e.target.id ? e.target : (e.target.closest && e.target.closest('button')));
      var id = btn && (btn.id || (btn.getAttribute && btn.getAttribute('id')));
      if (id === 'btn-search-file') { e.preventDefault(); e.stopPropagation(); applySearch(); return; }
      if (id === 'btn-clear-file-search') { e.preventDefault(); e.stopPropagation(); onClear(); return; }
    });
  }
  if (searchInput) { searchInput.addEventListener('keypress', function (e) { if (e.key === 'Enter') { e.preventDefault(); applySearch(); } }); }

  refresh();
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', run); } 
  else { run(); }
})();
