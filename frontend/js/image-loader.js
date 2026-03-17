/**
 * 图片加载管理器
 * 提供懒加载、格式优化和错误处理功能
 */
(function () {
  // 配置
  const CONFIG = {
    lazyLoadThreshold: 200, // 懒加载阈值（像素）
    webpQuality: 80, // WebP质量
    placeholderTimeout: 3000, // 占位符显示超时
  };

  // 状态管理
  const loadedImages = new WeakSet();
  const imageLoaders = new Map();

  // ==================== 懒加载 ====================
  /**
   * 初始化懒加载
   */
  function initLazyLoad() {
    const lazyImages = document.querySelectorAll('img.lazy-load');

    if ('IntersectionObserver' in window) {
      // 使用IntersectionObserver实现懒加载
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            loadImage(img);
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: `0px 0px ${CONFIG.lazyLoadThreshold}px 0px`,
      });

      lazyImages.forEach(img => imageObserver.observe(img));
    } else {
      // 回退方案：滚动事件监听
      window.addEventListener('scroll', handleScroll);
      handleScroll(); // 立即检查
    }
  }

  /**
   * 处理滚动事件
   */
  function handleScroll() {
    const lazyImages = document.querySelectorAll('img.lazy-load:not(.loaded)');
    lazyImages.forEach(img => {
      if (isInViewport(img, CONFIG.lazyLoadThreshold)) {
        loadImage(img);
      }
    });
  }

  /**
   * 检查元素是否在视口中
   * @param {HTMLElement} element - 要检查的元素
   * @param {number} threshold - 阈值
   * @returns {boolean} 是否在视口中
   */
  function isInViewport(element, threshold = 0) {
    const rect = element.getBoundingClientRect();
    return (
      rect.bottom >= -threshold &&
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) + threshold
    );
  }

  // ==================== 图片加载 ====================
  /**
   * 加载图片
   * @param {HTMLImageElement} img - 图片元素
   */
  async function loadImage(img) {
    if (loadedImages.has(img)) return;

    try {
      // 显示加载状态
      showLoadingState(img);

      // 获取最佳图片URL
      const imageUrl = await getOptimizedImageUrl(img);

      // 加载图片
      await loadActualImage(img, imageUrl);

      // 标记为已加载
      loadedImages.add(img);
      img.classList.add('loaded');
      img.classList.remove('lazy-load');

      // 隐藏加载状态
      hideLoadingState(img);
    } catch (error) {
      console.error('图片加载失败:', error);
      handleImageError(img, error);
    }
  }

  /**
   * 获取优化的图片URL
   * @param {HTMLImageElement} img - 图片元素
   * @returns {string} 优化后的图片URL
   */
  async function getOptimizedImageUrl(img) {
    const src = img.getAttribute('data-src') || img.src;
    const alt = img.getAttribute('alt') || '';

    // 检查是否支持WebP
    if (supportsWebP() && img.getAttribute('data-webp') !== 'false') {
      return await convertToWebP(src, alt);
    }

    return src;
  }

  /**
   * 加载实际图片
   * @param {HTMLImageElement} img - 图片元素
   * @param {string} url - 图片URL
   */
  function loadActualImage(img, url) {
    return new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = url;
    });
  }

  /**
   * 显示加载状态
   * @param {HTMLImageElement} img - 图片元素
   */
  function showLoadingState(img) {
    // 创建加载状态容器
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'image-loading';
    loadingContainer.innerHTML = '<div class="spinner"></div>';

    img.parentNode.insertBefore(loadingContainer, img);
    img.style.display = 'none';
  }

  /**
   * 隐藏加载状态
   * @param {HTMLImageElement} img - 图片元素
   */
  function hideLoadingState(img) {
    const loadingContainer = img.previousElementSibling;
    if (loadingContainer && loadingContainer.classList.contains('image-loading')) {
      loadingContainer.remove();
      img.style.display = '';
    }
  }

  /**
   * 处理图片错误
   * @param {HTMLImageElement} img - 图片元素
   * @param {Error} error - 错误对象
   */
  function handleImageError(img, error) {
    // 显示错误状态
    const errorContainer = document.createElement('div');
    errorContainer.className = 'image-error';
    errorContainer.textContent = '×';
    errorContainer.title = error.message;

    img.parentNode.insertBefore(errorContainer, img);
    img.style.display = 'none';

    // 记录错误
    console.error('图片加载错误:', {
      src: img.src,
      alt: img.alt,
      error: error.message,
    });
  }

  // ==================== WebP转换 ====================
  /**
   * 检查是否支持WebP格式
   * @returns {boolean} 是否支持WebP
   */
  function supportsWebP() {
    if (!window.createImageBitmap) return false;

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  }

  /**
   * 转换图片为WebP格式
   * @param {string} imageUrl - 原始图片URL
   * @param {string} alt - 图片描述
   * @returns {Promise<string>} WebP图片URL
   */
  async function convertToWebP(imageUrl, alt) {
    try {
      // 创建Canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // 加载图片
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // 设置Canvas尺寸
      canvas.width = img.width;
      canvas.height = img.height;

      // 绘制图片
      ctx.drawImage(img, 0, 0);

      // 转换为WebP
      const webpUrl = canvas.toDataURL('image/webp', CONFIG.webpQuality / 100);

      return webpUrl;
    } catch (error) {
      console.warn('WebP转换失败，使用原始图片:', error);
      return imageUrl;
    }
  }

  // ==================== 公共API ====================
  /**
   * 手动加载图片
   * @param {HTMLImageElement|string} target - 图片元素或选择器
   */
  function load(target) {
    const img = typeof target === 'string'
      ? document.querySelector(target)
      : target;

    if (img && img.tagName === 'IMG') {
      loadImage(img);
    }
  }

  /**
   * 初始化图片加载器
   */
  function init() {
    initLazyLoad();
  }

  // ==================== 暴露API ====================
  window.ImageLoader = {
    init,
    load,
    supportsWebP,
  };

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();