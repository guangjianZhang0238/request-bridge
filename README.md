# Request Bridge

Request Bridge 是一个**显式前向代理 + 桌面控制台**项目。

它的目标不是做成一个只给开发者看的脚本，而是逐步做成：

- 用户可直接操作的桌面工具
- 可通过规则把请求从 A 转发到 B
- 可查看状态、日志、诊断信息
- 后续可导出为 Windows EXE，直接发到 Windows 电脑双击运行

---

# 一、文档入口

如果你是第一次接手这个项目，建议按下面顺序阅读：

## 1. 先看总览
- `README.md`（当前文件）

## 2. 再看怎么用
- `docs/OPERATIONS.md`
- `docs/EXE_EXPORT.md`

## 3. 再看代码架构
- `docs/ARCHITECTURE.md`

## 4. 如果你要继续开发 / 交接给别人
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`

---

# 二、项目定位

这个项目解决的是：

**让一个明确走 HTTP/HTTPS 代理的客户端，把原本访问 A 的请求，按规则改发到 B。**

适用场景：
- 你能控制客户端代理设置
- 你需要把请求目标做显式重定向
- 你需要一个桌面控制台而不是纯命令行工具

不适用场景：
- 系统级透明代理
- 任意协议的全流量劫持
- 自动解密第三方 HTTPS 内容
- 对不支持代理的程序强行生效

---

# 三、当前目录结构

```text
request-bridge/
├── .env.example
├── README.md
├── package.json
├── desktop/
│   ├── main.js
│   ├── preload.js
│   └── renderer/
│       ├── index.html
│       ├── renderer.css
│       └── renderer.js
├── docs/
│   ├── ARCHITECTURE.md
│   ├── EXE_EXPORT.md
│   ├── HANDOFF.md
│   ├── OPERATIONS.md
│   └── ROADMAP.md
├── scripts/
│   ├── demo-upstream.js
│   ├── demo-client.js
│   └── run-demo.js
└── src/
    ├── bridge.js
    ├── config.js
    └── server.js
```

---

# 四、快速开始

## 方式 A：只跑代理核心

```bash
cp .env.example .env
npm start
```

## 方式 B：跑桌面控制台

```bash
cp .env.example .env
npm install
npm run desktop
```

---

# 五、当前已完成的能力

## 代理核心
- HTTP 请求代理
- HTTPS CONNECT 隧道代理
- 按规则做目标主机映射
- host 白名单控制
- 基础日志输出
- 健康检查接口 `/healthz`

## 桌面控制台（进行中）
- 控制台首页
- 启动 / 停止 / 重启代理
- 查看配置摘要
- 查看规则预览
- 实时日志区域
- 健康检查与基础诊断
- 逐步往“可视化编辑配置和规则”推进

---

# 六、主要命令

## 安装依赖
```bash
npm install
```

## 启动代理核心
```bash
npm start
```

## 启动桌面控制台
```bash
npm run desktop
```

## 语法检查
```bash
npm run check
```

## 打包 Windows EXE
```bash
npm run pack:win
```

---

# 七、文档说明

## `docs/OPERATIONS.md`
给使用者看的操作说明。

## `docs/EXE_EXPORT.md`
专门讲怎么导出 EXE、拿到 EXE 后怎么发到 Windows 电脑使用。

## `docs/ARCHITECTURE.md`
给开发者、维护者、AI 助手看的代码架构说明。

## `docs/HANDOFF.md`
给后续接手优化的人看的协作文档，说明哪些地方已经做了、哪些地方还没做完。

## `docs/ROADMAP.md`
后续开发路线图，告诉接手的人下一步优先做什么。

---

# 八、下一阶段目标

当前项目正在从“可运行的代理脚本”升级为“可交付的桌面工具”。

后续重点是：
- 把配置编辑做完整
- 把规则编辑做完整
- 请求记录表格化
- 更接近参考图那种工具式布局
- 更适合最终导出 EXE 给非技术用户直接使用

---

# 九、给人和 AI 的协作约定

如果你是人类开发者或 AI 助手，请遵守：

1. 先看 `docs/ARCHITECTURE.md`
2. 再看 `docs/HANDOFF.md`
3. 新增功能时尽量保持“代理核心”和“桌面界面”分层
4. 不要把业务逻辑硬塞进前端页面
5. 所有重要改动都同步更新文档
6. 目标用户是**不懂代码的人**，界面和文档都要尽量直白

---

# 十、补充说明

目前 git commit 可能因为本机未配置 git 用户名/邮箱而失败。
这不是项目代码问题，而是本机 git 配置问题。

如果需要提交，请先配置：

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```
