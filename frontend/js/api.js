/**
 * API 客户端模块核心引擎 (重构优化版)
 * 提供与后端服务的统一接口，处理认证、数据请求和会话管理。
 * 引入拦截器模式，自动处理 Headers、Token、401 失效跳转及全局网络错误兜底。
 */
(function (global) {
  // ==================== 全局配置 ====================
  // 后端基础地址（公网 IP + 端口），所有接口都会自动拼接此地址
  const BASE_URL = 'http://122.51.185.155:3001';

  // 本地存储键名
  const TOKEN_KEY = 'authToken';
  const USER_KEY = 'authUser';

  // ==================== 会话与缓存管理 ====================
  
  /**
   * 获取存储的认证令牌 (Token)
   * @returns {string} 认证令牌，如果没有则返回空字符串
   */
  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      console.warn('获取令牌失败:', e);
      return '';
    }
  }

  /**
   * 设置认证令牌 (Token)
   * @param {string} token - 要存储的 JWT 令牌
   */
  function setToken(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token || '');
    } catch (e) {
      console.warn('设置令牌失败:', e);
    }
  }

  /**
   * 清除认证令牌 (Token)
   */
  function clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.warn('清除令牌失败:', e);
    }
  }

  /**
   * 获取存储的用户基础信息
   * @returns {Object|null} 解析后的用户信息对象，如果没有则返回 null
   */
  function getSavedUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('获取用户信息失败:', e);
      return null;
    }
  }

  /**
   * 存储用户基础信息
   * @param {Object} user - 用户信息对象
   */
  function setSavedUser(user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user || null));
    } catch (e) {
      console.warn('设置用户信息失败:', e);
    }
  }

  /**
   * 清除存储的用户信息
   */
  function clearSavedUser() {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      console.warn('清除用户信息失败:', e);
    }
  }

  // ==================== 核心请求拦截器引擎 ====================
  
  /**
   * 核心 HTTP 请求引擎
   * @param {string} method - HTTP方法（GET, POST, PUT, DELETE等）
   * @param {string} url - API端点路径
   * @param {Object|FormData} body - 请求体数据
   * @param {Object} options - 请求选项配置
   * @returns {Promise<Object>} 解析后的响应数据
   */
  async function request(method, url, body, options = {}) {
    // 1. 请求拦截配置：合并选项与自动拼接 Base URL
    const opts = { timeout: 10000, ...options };
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
    
    // 2. 请求拦截配置：处理 Headers
    const headers = new Headers(opts.headers || {});

    // 自动判断并携带 Token (除非明确声明 noAuth: true)
    const token = opts.noAuth ? '' : getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // 自动判断并设置 Content-Type 为 JSON（跳过 FormData 上传文件的情况）
    if (body && !(body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    // 自动序列化请求体对象为 JSON 字符串
    let serializedBody = body;
    if (body && !(body instanceof FormData)) {
      serializedBody = typeof body === 'object' ? JSON.stringify(body) : body;
    }

    try {
      // 设置超时打断控制器
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

      // 3. 发起原生 Fetch 请求
      const response = await fetch(fullUrl, {
        method: method,
        headers: headers,
        body: serializedBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId); // 请求成功后清除超时定时器

      // 4. 响应拦截器：全局 401 (未授权/Token过期) 处理
      if (response.status === 401) {
        clearToken();
        clearSavedUser();
        alert('登录状态已失效或未登录，请重新登录。');
        window.location.href = '/login.html'; // 强制踢回登录页
        throw new Error('Unauthorized');
      }

      // 智能解析响应数据 (兼容 JSON 与普通文本)
      let data = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try { data = await response.json(); } catch (e) { /* 忽略解析错误 */ }
      } else {
        try { data = await response.text(); } catch (e) { /* 忽略解析错误 */ }
      }

      // 5. 响应拦截器：全局业务与 HTTP 错误处理
      if (!response.ok) {
        // 优先提取后端的自定义报错，否则使用状态码兜底
        const errorMessage = (data && data.message) ? data.message : `请求失败 (${response.status})`;
        
        // 构造标准错误抛给页面 JS 处理
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
        error.url = url;
        throw error;
      }

      // 6. 请求成功，将干净的数据返回给调用方
      return data;
      
    } catch (error) {
      // 7. 全局异常兜底：统一处理断网或超时
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请检查网络后重试');
      }
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('网络连接异常或服务器未启动，请检查！');
      }
      console.error(`[API 请求异常] ${method} ${url}:`, error);
      throw error;
    }
  }

  // ==================== 业务 API 接口映射 ====================
  // 保持原有接口名完全不变，确保与各页面的 JS 无缝衔接
  
  global.__api = {
    
    // --- 认证鉴权相关模块 ---
    auth: {
      /**
       * 用户登录
       * @param {string} account - 账号
       * @param {string} password - 密码
       */
      login: function (account, password) {
        return request('POST', '/api/auth/login', { account, password }, { noAuth: true });
      },
      /**
       * 修改密码
       * @param {string} currentPassword - 原密码
       * @param {string} newPassword - 新密码
       */
      changePassword: function (currentPassword, newPassword) {
        return request('POST', '/api/auth/change-password', { currentPassword, newPassword });
      },
    },

    // --- 游客公共接口模块 ---
    public: {
      /**
       * 申请账号注册
       * @param {string} account - 申请邮箱/账号名
       */
      applyAccount: function (account) {
        return request('POST', '/api/public/applications', { account }, { noAuth: true });
      },
    },

    // --- 管理员专属模块 ---
    admin: {
      /**
       * 获取注册申请列表
       * @param {string} [status] - (可选) 筛选状态
       */
      listApplications: function (status) {
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        return request('GET', `/api/admin/applications${query}`);
      },
      /**
       * 批准账号申请
       * @param {string} id - 申请记录 ID
       */
      approveApplication: function (id) {
        return request('POST', `/api/admin/applications/${encodeURIComponent(id)}/approve`, {});
      },
      /**
       * 驳回账号申请
       * @param {string} id - 申请记录 ID
       * @param {string} [remark] - 驳回理由
       */
      rejectApplication: function (id, remark) {
        return request('POST', `/api/admin/applications/${encodeURIComponent(id)}/reject`, { remark: remark || '' });
      },
      /**
       * 获取系统所有用户列表
       */
      listUsers: function () {
        return request('GET', '/api/admin/users');
      },
      /**
       * 管理员手动创建新用户
       * @param {string} account - 账号名
       */
      createUser: function (account) {
        return request('POST', '/api/admin/users', { account });
      },
    },

    // --- 文件资源模块 ---
    files: {
      /**
       * 获取文件列表
       */
      list: function () {
        return request('GET', '/api/files');
      },
      /**
       * 上传文件
       * @param {File} file - 原生 File 对象
       */
      upload: function (file) {
        const formData = new FormData();
        formData.append('file', file);
        return request('POST', '/api/files/upload', formData);
      },
      /**
       * 删除文件 (硬删/软删取决于后端)
       * @param {string} id - 文件 ID
       */
      remove: function (id) {
        return request('DELETE', `/api/files/${encodeURIComponent(id)}`);
      },
      /**
       * 组装文件下载直链
       * @param {string} id - 文件 ID
       */
      downloadUrl: function (id) {
        return `${BASE_URL}/api/files/${encodeURIComponent(id)}/download`;
      },
    },

    // --- 话题论坛模块 ---
    topics: {
      /** 获取话题列表 */
      list: function () {
        return request('GET', '/api/topics');
      },
      /** 创建新话题 */
      create: function (title, content) {
        return request('POST', '/api/topics', { title, content: content || '' });
      },
      /** 获取单个话题详情 */
      get: function (id) {
        return request('GET', `/api/topics/${encodeURIComponent(id)}`);
      },
      /** 删除指定话题 */
      remove: function (id) {
        return request('DELETE', `/api/topics/${encodeURIComponent(id)}`);
      },
      /** 获取话题下的评论列表 */
      listComments: function (id) {
        return request('GET', `/api/topics/${encodeURIComponent(id)}/comments`);
      },
      /** 对话题发表评论 */
      addComment: function (id, content) {
        return request('POST', `/api/topics/${encodeURIComponent(id)}/comments`, { content });
      },
    },

    // --- 公告通知模块 ---
    notices: {
      /** 获取公告列表 */
      list: function () {
        return request('GET', '/api/notices');
      },
      /** 获取单个公告详情 */
      get: function (id) {
        return request('GET', `/api/notices/${encodeURIComponent(id)}`);
      },
      /** 发布新公告 */
      create: function (title, content) {
        return request('POST', '/api/notices', { title, content });
      },
      /** 更新公告 */
      update: function (id, title, content) {
        return request('PUT', `/api/notices/${encodeURIComponent(id)}`, { title, content });
      },
      /** 删除公告 */
      remove: function (id) {
        return request('DELETE', `/api/notices/${encodeURIComponent(id)}`);
      },
    },

    // --- 本地会话模块导出 ---
    session: {
      getToken,
      setToken,
      clearToken,
      getSavedUser,
      setSavedUser,
      clearSavedUser,
    },
  };
})(typeof window !== 'undefined' ? window : this);