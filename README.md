# LCF 生日网站（静态站维护说明）

仓库根目录就是 GitHub Pages 站点，直接发布根目录下的静态文件，不做构建、不换框架。

## 目录与路径

- 入口为根目录 `index.html`。
- 资源统一使用 `./` 相对路径，需同时兼容站点根目录与 `/lcf-birthday/` 子目录两种访问方式。
- 公开网址：<https://wdfccblcf.github.io/lcf-birthday/>

## 缓存哈希链

JS 入口内容变化后，必须同步刷新引用方 URL 的 `v=` 参数，取被引用文件 sha256 的前 12 位十六进制：

1. `index.html` 引用 `app.js`：`./app.js?v=<app.js sha256 前12位>`
2. `app.js` 引用 `white-gift.js`：`./white-gift.js?v=<white-gift.js sha256 前12位>`
3. `white-gift.js` 引用 `figurine.js`：`./figurine.js?v=<figurine.js sha256 前12位>`

## release.json

- 发布清单为根目录 `release.json`，当前版本命名 `lcf-github-20261011-r1`。
- 只刷新本次修改文件的 sha256，其他既有条目保留。

## 角色分工

- DeepSeek：代码修改
- 豆包：发布
- Codex：复核

## 发布纪律

- 发布前必须基于豆包最新提交合并。
- 禁止用旧整包覆盖仓库，禁止 force push。
- 发布后核对 `release.json` 与缓存哈希链是否一致。

## 状态说明

本文档不构成发布或验收结论：未声称大陆网络环境无需 VPN 可用，也未声称已完成真机验收。
