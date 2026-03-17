/**
 * API客户端模块
 * 提供与后端服务的统一接口，处理认证、数据请求和会话管理
 */
(function (global) {
  // ==================== 配置 ====================
  // 后端基础地址（公网 IP + 端口），所有接口都会在此前缀基础上请求
  // 如需更换服务器，只要改这里即可
  const BASE_URL = 'http://122.51.185.155:3001';

  // 本地存储键名
  const TOKEN_KEY = 'authToken';
  const USER_KEY = 'authUser';

  // ==================== 会话管理 ====================
  /**
   * 获取存储的认证令牌
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
   * 设置认证令牌
   * @param {string} token - 要存储的令牌
   */
  function setToken(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token || '');
    } catch (e) {
      console.warn('设置令牌失败:', e);
    }
  }

  /**
   * 清除认证令牌
   */
  function clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.warn('清除令牌失败:', e);
    }
  }

  /**
   * 获取存储的用户信息
   * @returns {Object|null} 用户信息对象，如果没有则返回null
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
   * 设置用户信息
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
   * 清除用户信息
   */
  function clearSavedUser() {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      console.warn('清除用户信息失败:', e);
    }
  }

  // ==================== 请求处理 ====================
  /**
   * 发送HTTP请求到后端API
   * @param {string} method - HTTP方法（GET, POST, PUT, DELETE等）
   * @param {string} url - API端点路径
   * @param {Object|FormData} body - 请求体数据
   * @param {Object} options - 请求选项
   * @param {Object} [options.headers] - 自定义请求头
   * @param {boolean} [options.noAuth] - 是否跳过认证
   * @param {number} [options.timeout] - 请求超时时间（毫秒）
   * @returns {Promise<Object>} 响应数据
   * @throws {Error} 请求失败时抛出错误
   */
  async function request(method, url, body, options = {}) {
    // 合并默认选项
    const opts = { timeout: 10000, ...options };
    const headers = { ...opts.headers || {} };

    // 处理认证
    const token = opts.noAuth ? '' : getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 设置内容类型
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      // 创建AbortController用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, opts.timeout);

      // 发送请求
      const response = await fetch(BASE_URL + url, {
        method: method,
        headers: headers,
        body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 检查响应状态
      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          // 忽略JSON解析错误
        }

        const errorMessage = errorData && errorData.message
          ? errorData.message
          : `请求失败(${response.status})`;

        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = errorData;
        error.url = url;
        throw error;
      }

      // 解析响应数据
      let data = {};
      try {
        data = await response.json();
      } catch (e) {
        console.warn('响应数据不是有效的JSON格式:', e);
      }

      return data;
    } catch (error) {
      // 处理不同类型的错误
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请重试');
      }

      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('网络连接失败，请检查网络设置');
      }

      console.error('API请求失败:', error);
      throw error;
    }
  }

  // ==================== API接口 ====================
  global.__api = {
    // 认证相关
    auth: {
      /**
       * 用户登录
       * @param {string} account - 用户账号
       * @param {string} password - 用户密码
       * @returns {Promise<Object>} 登录响应数据
       */
      login: function (account, password) {
        return request('POST', '/api/auth/login', { account, password }, { noAuth: true });
      },

      /**
       * 修改密码
       * @param {string} currentPassword - 当前密码
       * @param {string} newPassword - 新密码
       * @returns {Promise<Object>} 修改密码响应
       */
      changePassword: function (currentPassword, newPassword) {
        return request('POST', '/api/auth/change-password', { currentPassword, newPassword });
      },
    },

    // 公开接口
    public: {
      /**
       * 申请账号
       * @param {string} account - 申请的账号
       * @returns {Promise<Object>} 申请响应
       */
      applyAccount: function (account) {
        return request('POST', '/api/public/applications', { account }, { noAuth: true });
      },
    },

    // 管理员接口
    admin: {
      /**
       * 列出所有申请
       * @param {string} [status] - 筛选状态
       * @returns {Promise<Object>} 申请列表
       */
      listApplications: function (status) {
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        return request('GET', `/api/admin/applications${query}`);
      },

      /**
       * 批准申请
       * @param {string} id - 申请ID
       * @returns {Promise<Object>} 批准响应
       */
      approveApplication: function (id) {
        return request('POST', `/api/admin/applications/${encodeURIComponent(id)}/approve`, {});
      },

      /**
       * 拒绝申请
       * @param {string} id - 申请ID
       * @param {string} [remark] - 拒绝原因
       * @returns {Promise<Object>} 拒绝响应
       */
      rejectApplication: function (id, remark) {
        return request('POST', `/api/admin/applications/${encodeURIComponent(id)}/reject`, { remark: remark || '' });
      },

      /**
       * 列出所有用户
       * @returns {Promise<Object>} 用户列表
       */
      listUsers: function () {
        return request('GET', '/api/admin/users');
      },

      /**
       * 创建用户
       * @param {string} account - 用户账号
       * @returns {Promise<Object>} 创建响应
       */
      createUser: function (account) {
        return request('POST', '/api/admin/users', { account });
      },
    },

    // 文件管理
    files: {
      /**
       * 获取文件列表
       * @returns {Promise<Object>} 文件列表
       */
      list: function () {
        return request('GET', '/api/files');
      },

      /**
       * 上传文件
       * @param {File} file - 要上传的文件
       * @returns {Promise<Object>} 上传响应
       */
      upload: function (file) {
        const formData = new FormData();
        formData.append('file', file);
        return request('POST', '/api/files/upload', formData);
      },

      /**
       * 删除文件
       * @param {string} id - 文件ID
       * @returns {Promise<Object>} 删除响应
       */
      remove: function (id) {
        return request('DELETE', `/api/files/${encodeURIComponent(id)}`);
      },

      /**
       * 获取文件下载URL
       * @param {string} id - 文件ID
       * @returns {string} 下载URL
       */
      downloadUrl: function (id) {
        return `${BASE_URL}/api/files/${encodeURIComponent(id)}/download`;
      },
    },

    // 话题管理
    topics: {
      /**
       * 获取话题列表
       * @returns {Promise<Object>} 话题列表
       */
      list: function () {
        return request('GET', '/api/topics');
      },

      /**
       * 创建话题
       * @param {string} title - 话题标题
       * @param {string} [content] - 话题内容
       * @returns {Promise<Object>} 创建响应
       */
      create: function (title, content) {
        return request('POST', '/api/topics', { title, content: content || '' });
      },

      /**
       * 获取话题详情
       * @param {string} id - 话题ID
       * @returns {Promise<Object>} 话题详情
       */
      get: function (id) {
        return request('GET', `/api/topics/${encodeURIComponent(id)}`);
      },

      /**
       * 删除话题
       * @param {string} id - 话题ID
       * @returns {Promise<Object>} 删除响应
       */
      remove: function (id) {
        return request('DELETE', `/api/topics/${encodeURIComponent(id)}`);
      },

      /**
       * 获取话题评论列表
       * @param {string} id - 话题ID
       * @returns {Promise<Object>} 评论列表
       */
      listComments: function (id) {
        return request('GET', `/api/topics/${encodeURIComponent(id)}/comments`);
      },

      /**
       * 添加评论
       * @param {string} id - 话题ID
       * @param {string} content - 评论内容
       * @returns {Promise<Object>} 添加评论响应
       */
      addComment: function (id, content) {
        return request('POST', `/api/topics/${encodeURIComponent(id)}/comments`, { content });
      },
    },

    // 公告管理
    notices: {
      /**
       * 获取公告列表
       * @returns {Promise<Object>} 公告列表
       */
      list: function () {
        return request('GET', '/api/notices');
      },

      /**
       * 获取公告详情
       * @param {string} id - 公告ID
       * @returns {Promise<Object>} 公告详情
       */
      get: function (id) {
        return request('GET', `/api/notices/${encodeURIComponent(id)}`);
      },

      /**
       * 创建公告
       * @param {string} title - 公告标题
       * @param {string} content - 公告内容
       * @returns {Promise<Object>} 创建响应
       */
      create: function (title, content) {
        return request('POST', '/api/notices', { title, content });
      },

      /**
       * 更新公告
       * @param {string} id - 公告ID
       * @param {string} title - 新标题
       * @param {string} content - 新内容
       * @returns {Promise<Object>} 更新响应
       */
      update: function (id, title, content) {
        return request('PUT', `/api/notices/${encodeURIComponent(id)}`, { title, content });
      },

      /**
       * 删除公告
       * @param {string} id - 公告ID
       * @returns {Promise<Object>} 删除响应
       */
      remove: function (id) {
        return request('DELETE', `/api/notices/${encodeURIComponent(id)}`);
      },
    },

    // 会话管理接口
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

