# GTNH Calculator · 托管包

本包已准备好直接静态托管，无须额外构建步骤。

## 包含内容

- 已构建的网页文件（`index.html`、`*.js`、`assets/`）
- `resource.config.js`（默认 CDN 模式）
- 空 `data/` 文件夹（不含 `data.bin` / `atlas.webp`）

## 默认行为

默认情况下，本包会从以下 CDN 地址加载数据：

`https://cdn.jsdelivr.net/gh/KZdavid/gtnh-calc-data-zh-CN@GTNH-2.8.4/`

你可以在 `resource.config.js` 中修改 `resourceBaseUrl` 来切换资源加载地址。

## 切换到本地数据模式

1. 编辑 `resource.config.js`：
   - 将 `resourceBaseUrl` 设置为 `""`
2. 将数据文件放入 `data/`：
   - `data.bin`
   - `atlas.webp`

参考配置已保存在 `resource.config.local.example.js`。

## 部署说明

1. 将本包内的所有文件上传到静态服务器的根目录。
2. 确保服务器可以直接访问上传后的 `index.html`。
3. 如果使用 Node.js 服务器，可以运行下面的示例命令：

```bash
npx serve .
```

或者使用本地开发服务器：

```bash
npx http-server .
```

如果你需要让静态文件可通过 HTTPS 访问，请将文件部署到支持静态托管的服务，例如 GitHub Pages、Vercel、Netlify、or jsDelivr 静态文件托管。

> 注意：如果你希望使用本地 `data/` 文件，请先将 `resourceBaseUrl` 设为空字符串，然后确保 `data/` 中包含 `data.bin` 和 `atlas.webp`。