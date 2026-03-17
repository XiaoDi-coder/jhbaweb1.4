/**
 * 轮播图组件
 * 管理轮播图的自动播放、手动控制和状态切换
 */
(function () {
  // ==================== 配置 ====================
  const AUTO_PLAY_INTERVAL = 5000; // 自动播放间隔（毫秒）
  const TRANSITION_DURATION = 500; // 过渡动画持续时间（毫秒）

  // ==================== DOM元素 ====================
  const carousel = document.querySelector('.carousel');
  const items = document.querySelectorAll('.carousel .carousel-item');
  const dotsContainer = document.getElementById('carousel-dots');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');

  // 验证DOM元素是否存在
  if (!carousel || !items.length || !dotsContainer) {
    console.warn('轮播图组件初始化失败：缺少必要的DOM元素');
    return;
  }

  // ==================== 状态管理 ====================
  let currentIndex = 0;
  const totalItems = items.length;
  let autoPlayTimer = null;
  let eventListeners = [];

  // ==================== 核心功能 ====================
  /**
   * 显示指定索引的轮播项
   * @param {number} index - 要显示的索引
   */
  function showItem(index) {
    // 计算正确的索引（循环）
    currentIndex = (index + totalItems) % totalItems;

    // 更新轮播项状态
    items.forEach((item, i) => {
      item.classList.toggle('active', i === currentIndex);
    });

    // 更新指示器状态
    const dots = dotsContainer.querySelectorAll('span');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentIndex);
    });
  }

  /**
   * 重置自动播放定时器
   */
  function resetAutoPlay() {
    // 清除现有定时器
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }

    // 设置新的定时器
    autoPlayTimer = setInterval(() => {
      showItem(currentIndex + 1);
    }, AUTO_PLAY_INTERVAL);
  }

  /**
   * 绑定事件监听器并记录，便于后续清理
   * @param {HTMLElement} element - 目标元素
   * @param {string} event - 事件类型
   * @param {Function} handler - 事件处理函数
   */
  function bindEvent(element, event, handler) {
    element.addEventListener(event, handler);
    eventListeners.push({ element, event, handler });
  }

  /**
   * 清理所有事件监听器
   */
  function cleanupEvents() {
    eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    eventListeners = [];
  }

  /**
   * 销毁组件，清理资源
   */
  function destroy() {
    cleanupEvents();
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
  }

  // ==================== 初始化 ====================
  // 创建指示器
  for (let i = 0; i < totalItems; i++) {
    const dot = document.createElement('span');
    dot.classList.toggle('active', i === 0);

    // 绑定点击事件
    bindEvent(dot, 'click', () => {
      showItem(i);
      resetAutoPlay();
    });

    dotsContainer.appendChild(dot);
  }

  // 绑定导航按钮事件
  if (prevBtn) {
    bindEvent(prevBtn, 'click', () => {
      showItem(currentIndex - 1);
      resetAutoPlay();
    });
  }

  if (nextBtn) {
    bindEvent(nextBtn, 'click', () => {
      showItem(currentIndex + 1);
      resetAutoPlay();
    });
  }

  // 绑定用户交互事件（暂停自动播放）
  bindEvent(carousel, 'mouseenter', () => {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
  });

  bindEvent(carousel, 'mouseleave', () => {
    resetAutoPlay();
  });

  // 启动自动播放
  resetAutoPlay();

  // ==================== 暴露销毁方法 ====================
  // 将销毁方法添加到轮播图元素上，便于外部调用
  carousel.destroy = destroy;

  // ==================== 清理机制 ====================
  // 页面卸载时自动清理
  window.addEventListener('beforeunload', destroy);

  // 组件卸载时自动清理
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (!document.body.contains(carousel)) {
        destroy();
        observer.disconnect();
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
