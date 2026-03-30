# 操作文档

## 一、安装要求

- Node.js 18+
- Linux / macOS / Windows 都可运行（只要 Node 可用）
- 桌面控制台需要安装 Electron 相关依赖

---

## 二、启动步骤

### 1. 进入目录

```bash
cd /home/node/clawd/project/request-bridge
```

### 2. 创建配置文件

```bash
cp .env.example .env
```

### 3. 编辑规则

#### 场景：把 A 的 HTTP 请求转给 B

```env
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=info
ALLOWED_HOSTS=a.example.com
REMAP_RULES=[{"match":{"host":"a.example.com","port":80,"protocol":"http:"},"target":{"host":"b.example.com","port":80,"protocol":"http:"}}]
```

#### 场景：把 A 的 HTTPS CONNECT 转给 B

```env
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=info
ALLOWED_HOSTS=a.example.com
REMAP_RULES=[{"match":{"host":"a.example.com","port":443,"protocol":"https:"},"target":{"host":"b.example.com","port":443,"protocol":"https:"}}]
```

### 4. 启动纯代理服务

```bash
npm start
```

### 5. 启动桌面控制台

```bash
npm install
npm run desktop
```

启动后你会看到一个控制窗口，里面包含：

- 代理状态
- 启动 / 停止 / 重启
- 规则和配置摘要
- 日志窗口
- 健康检查
- 基础诊断

---

## 三、验证方法

### 1. 健康检查

```bash
curl http://127.0.0.1:8080/healthz
```

期望返回 JSON：

```json
{
  "ok": true
}
```

### 2. 运行内置 demo

```bash
npm run demo
```

期望现象：

- 终端显示代理启动
- 客户端通过代理请求 `a.example.test`
- 返回内容里显示 `upstream: "demo-b"`

### 3. 手工测试 HTTP 转发

```bash
curl -x http://127.0.0.1:8080 http://a.example.com/anything
```

### 4. 手工测试 HTTPS CONNECT

```bash
curl -x http://127.0.0.1:8080 https://a.example.com/
```

---

## 四、日志说明

代理会打印：

- `forward_http`：普通 HTTP 请求被转发
- `forward_connect`：HTTPS CONNECT 被转发
- `forward_http_failed`：普通 HTTP 转发失败
- `forward_connect_failed`：CONNECT 失败
- `request_bridge_started`：代理启动

你可以据此确认：

- 客户端是否真的走了代理
- 代理是否命中了重写规则
- 上游 B 是否可达

在桌面控制台中，这些日志会实时展示。

---

## 五、桌面控制台说明

### 控制台首页

- 看代理是否已启动
- 看健康状态
- 快速操作启动 / 停止 / 重启
- 查看最近事件

### 规则与配置

- 查看当前配置摘要
- 查看 remap 规则列表
- 打开 `.env`
- 重新读取配置

### 日志中心

- 实时日志输出
- 只看 error / warn
- 清空当前显示

### 诊断工具

- 健康检查
- 基础诊断
- 输出诊断结果

---

## 六、如何让真实应用使用

### 浏览器

在系统代理或浏览器代理里设置 HTTP 代理：

- 地址：代理所在主机 IP
- 端口：8080

### 命令行

#### Linux / macOS

```bash
export HTTP_PROXY=http://127.0.0.1:8080
export HTTPS_PROXY=http://127.0.0.1:8080
```

#### Windows PowerShell

```powershell
$env:HTTP_PROXY='http://127.0.0.1:8080'
$env:HTTPS_PROXY='http://127.0.0.1:8080'
```

### 某些 SDK / 程序

如果程序支持自定义代理，填入 `http://代理IP:8080` 即可。

---

## 七、限制与边界

### 1. 不是系统级透明代理

这个程序默认不是 TUN/TAP、不是内核防火墙重定向、不是网关旁路由。它是**显式代理**。

### 2. HTTPS 默认不会解密业务内容

对 HTTPS，默认是 CONNECT 隧道。代理可以修改连接目标，但不读取 TLS 明文。

### 3. 并非所有协议都适用

适合：

- HTTP
- HTTPS（隧道）

不保证适合：

- QUIC / HTTP3
- 自定义 TCP 二进制协议
- 不支持代理的客户端
- 证书锁定严格的应用

---

## 八、打包成 EXE

### 安装依赖

```bash
npm install
```

### 打包命令

```bash
npm run pack:win
```

### 输出位置

```text
dist/
```

### 当前打包说明

已预置：

- portable 便携版
- nsis 安装版

后续若要提升交付质量，建议继续补：

- 应用图标
- 版本信息
- 安装器文案
- 自动更新
- 崩溃日志导出

---

## 九、排障清单

### 问题：请求没有进入代理

检查：

- 客户端是否设置了代理
- 环境变量是否生效
- 应用是否支持 HTTP 代理

### 问题：返回 403 Forbidden

检查：

- `ALLOWED_HOSTS` 是否包含目标 A 主机

### 问题：返回 502 Bad Gateway

检查：

- B 主机是否可达
- 端口是否正确
- B 是否接受该协议

### 问题：桌面控制台打不开

检查：

- 是否已执行 `npm install`
- Electron 是否安装成功
- 当前系统是否支持桌面图形环境

### 问题：健康检查失败

检查：

- 服务是否已启动
- 端口是否被占用
- `.env` 配置是否有误

---

## 十、后续可扩展方向

建议下一步继续做这些能力：

- 规则热加载
- 表单式配置编辑
- 规则增删改 UI
- 日志落盘与导出
- SOCKS5 支持
- 认证鉴权
- 托盘最小化
- 开机自启动
- Docker 化部署
- 管理后台
