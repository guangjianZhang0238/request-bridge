# ARCHITECTURE.md

本文件描述 Request Bridge 当前的代码架构，目标读者包括：

- 人类开发者
- 后续接手优化的人
- AI 编码助手

要求：读完后，应能快速理解“项目分几层、每层干什么、功能从哪里进、往哪里走”。

---

# 一、系统总览

当前项目由两大部分组成：

1. **代理核心（Core Proxy Engine）**
2. **桌面控制台（Desktop Console）**

可以把它理解成：

```text
用户操作界面
   ↓
renderer.js
   ↓
preload.js
   ↓
desktop/main.js
   ↓
src/config.js + src/bridge.js
   ↓
实际代理服务
```

---

# 二、目录职责

## 1. `src/`
这是代理核心层。

### `src/server.js`
职责：
- 作为命令行启动入口
- 读取配置
- 启动代理服务

特点：
- 尽量保持薄
- 不应承载复杂业务逻辑

### `src/bridge.js`
职责：
- 启动 HTTP 服务
- 处理普通 HTTP 请求转发
- 处理 HTTPS CONNECT 隧道
- 执行目标地址 remap
- 写运行日志
- 返回 stop 能力给调用方

它是当前系统的核心业务模块。

### `src/config.js`
职责：
- 读取 `.env`
- 解析配置
- 校验配置格式
- 序列化配置
- 将 UI 修改保存回 `.env`

原则：
- 配置逻辑集中在这里
- 不要把配置读写逻辑分散到 UI 层

---

## 2. `desktop/`
这是桌面程序层，使用 Electron。

### `desktop/main.js`
职责：
- 创建 Electron 主窗口
- 维护运行时状态（logs / events / config / health）
- 响应前端请求
- 调用 `src/bridge.js` 启停代理
- 调用 `src/config.js` 读写配置
- 提供健康检查 / 诊断 / 打开目录等能力

这是桌面应用的主控层。

### `desktop/preload.js`
职责：
- 作为主进程与渲染层之间的安全桥接
- 暴露有限 API 给前端

暴露的能力包括：
- 获取状态
- 启动 / 停止 / 重启
- 健康检查
- 基础诊断
- 保存配置
- 打开配置目录 / `.env`
- 清空日志

### `desktop/renderer/index.html`
职责：
- 定义页面结构
- 定义视图区域和按钮位置

### `desktop/renderer/renderer.css`
职责：
- 定义桌面控制台样式
- 当前偏工具型界面，不追求花哨

### `desktop/renderer/renderer.js`
职责：
- 页面状态管理
- 绑定按钮事件
- 渲染状态、日志、规则
- 处理配置表单与规则编辑
- 调用 preload 暴露的 API

原则：
- 只做界面交互和展示
- 不要在这里直接放代理核心逻辑

---

## 3. `scripts/`
职责：
- 本地演示
- 快速验证代理行为
- 辅助开发调试

当前包括：
- demo upstream
- demo client
- 一键 demo 脚本

这些脚本不是最终交付物，而是辅助验证工具。

---

## 4. `docs/`
职责：
- 给使用者、开发者、AI 助手提供统一说明
- 降低交接成本
- 降低未来返工和误解

---

# 三、配置模型

当前配置主要来自 `.env`：

- `PORT`
- `HOST`
- `LOG_LEVEL`
- `CONNECT_TIMEOUT_MS`
- `REQUEST_TIMEOUT_MS`
- `ALLOWED_HOSTS`
- `REMAP_RULES`

其中：
- `ALLOWED_HOSTS` 是逗号分隔白名单
- `REMAP_RULES` 是 JSON 数组

建议后续方向：
- 逐步保留 `.env` 作为底层存储
- 但 UI 层尽量不要让最终用户直接编辑 JSON
- 应通过图形化表单增删改规则

---

# 四、运行模式

## 模式 A：命令行模式

入口：
```bash
npm start
```

流程：
1. `src/server.js`
2. `src/config.js`
3. `src/bridge.js`
4. 启动监听端口

## 模式 B：桌面控制台模式

入口：
```bash
npm run desktop
```

流程：
1. Electron 主进程启动
2. 加载桌面界面
3. 前端通过 preload 调主进程
4. 主进程调用 bridge / config
5. 更新 UI 状态

---

# 五、当前状态管理方式

在 `desktop/main.js` 中维护一个 runtime 对象，主要包括：

- `logs`
- `events`
- `config`
- `processStatus`
- `serviceHealth`
- `lastError`

这是一个轻量状态容器。

当前优点：
- 简单
- 易读
- 适合第一版

当前缺点：
- 没做持久化
- 没区分更细的模块边界
- 随着功能增多可能需要拆分

后续可考虑：
- 把 runtime 状态拆分成独立 service manager
- 增加日志落盘
- 增加请求记录缓存层

---

# 六、目前的设计原则

1. **核心逻辑和界面分离**
2. **配置读写集中管理**
3. **先可用，再优化 UI**
4. **目标用户不是开发者，是普通用户**
5. **后续必须能朝 EXE 交付方向发展**

---

# 七、推荐的后续重构方向

## 优先级高
1. 请求记录独立模块化
2. 配置编辑 UI 完整化
3. 规则编辑器完整化
4. 错误提示标准化
5. 日志持久化与导出

## 优先级中
1. 托盘功能
2. 开机启动
3. 自动更新
4. 安装器定制

## 优先级低
1. 视觉美化
2. 主题切换
3. 多语言

---

# 八、协作约束

无论是人还是 AI，修改时都尽量遵守：

- 不要把代理逻辑写进 renderer
- 不要让 main.js 膨胀成巨型文件而不拆分
- 新增配置项时同步更新：
  - `src/config.js`
  - `.env.example`
  - `docs/OPERATIONS.md`
- 新增面向用户的能力时同步更新 README 和交接文档

---

# 九、一句话总结

当前架构本质上是：

**一个可复用的代理内核 + 一个正在成型的 Electron 桌面控制台。**

这个结构适合继续往“可打包 EXE 的实用桌面工具”方向推进。
