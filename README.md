# AI014 网站维护说明

AI014 是使用 Astro、TypeScript 和原生 CSS 制作的静态品牌网站。内容集中保存在 JSON 文件中，修改后重新构建、部署即可更新。网站没有管理后台、数据库或服务端接口。

当前公开内容包括「趋势观察」数据工具。Products 暂无公开产品，导航和首页不展示空产品入口。Projects 暂无公开项目，导航和首页不会展示空项目入口。未提供的功能、状态、版本、下载和截图均留空；Lab 与 Releases 也保持为空。请在获得真实资料后补充，不要把本文示例当作真实发布信息。

## 1. 在电脑上运行

安装 Node.js 24 LTS 或更新版本（自带 npm），解压源码，在含有 `package.json` 的项目目录打开终端：

```bash
npm install
npm run dev
```

打开终端显示的本地网址。修改文件后，开发预览通常会自动更新。需要停止开发服务器时，运行 npm run dev:stop。

交付或发布前运行：

```bash
npm run check
npm test
npm run build
npm run preview
```

- `check`：检查内容数据和 TypeScript / Astro。
- `test`：运行维护规则和数据行为测试。
- `build`：验证数据、生成本地图片的优化格式、生成静态网站，并检查生成文件中的链接。
- `preview`：在本机预览刚生成的 `dist/`；它不会重新构建内容。

首次安装使用 `npm install`；已有依赖锁文件时，自动化部署使用 `npm ci`，以保证依赖版本一致。不要手动修改 `package-lock.json`。

## 2. 修改产品和图片

日常编辑主要发生在 `src/data/`：

| 文件            | 保存什么                               |
| --------------- | -------------------------------------- |
| `products.json` | 产品名称、介绍、图片、链接与排序       |
| `releases.json` | 产品版本、发布日期、更新日志和下载文件 |
| `projects.json` | 项目介绍和外部入口                     |
| `labs.json`     | 真实实验记录                           |
| `taxonomy.json` | 可用类型、平台和状态                   |

JSON 必须使用英文双引号，不支持注释，最后一项后不要添加逗号。修改后运行 `npm run check`，按提示修正数据。

### 更新已有产品

在 `products.json` 新增经确认的真实产品对象，补充 `subtitle`（一句话简介）、`description`（完整介绍）、图片和真实外部链接。发布后保留该产品的 `id` 与 `slug`，避免发布记录失去关联或已有页面地址改变。

空值规则：文字和链接未知时使用 `""`，列表使用 `[]`，`status`、`updatedAt` 未知时使用 `null`。不要手动填入显示用的「—」；页面会处理空值。`status` 有真实依据时才填写登记表中的键，例如 `"Beta"`。`updatedAt` 是本次内容维护日期，格式为 `YYYY-MM-DD`，不是产品发布日期。

产品页的版本、发布日期、更新日志、文件大小和系统要求来自 `releases.json`，不要在产品简介里重复维护这些字段。`downloadUrl` 是可选通用下载入口；具体版本安装包放入发布记录的 `files`。详情页优先展示最新发布的文件；最新发布无文件时才使用产品的 `downloadUrl`。最新发布的 `visitUrl` 优先于产品的 `visitUrl`。无真实下载、隐私或反馈地址时保持空字符串，页面不会生成对应的可点击入口。

### 添加产品

在 `products.json` 数组末尾增加一个完整对象。`id` 和 `slug` 必须唯一；`slug` 使用小写英文、数字和短横线，并成为 `/products/slug/` 的地址。`type`、`platforms`、`status` 使用登记表中的键，`platforms` 可以有多个值。`featured` 控制首页精选展示，`order` 越小越靠前。

下面仅是字段示范。请替换名称与标识，并填写真实资料后再保存到数据文件：

```json
{
  "id": "your-product",
  "slug": "your-product",
  "name": "YOUR_PRODUCT_NAME",
  "subtitle": "",
  "type": "MOBILE_APP",
  "platforms": ["Android"],
  "status": null,
  "icon": "",
  "cover": "",
  "description": "",
  "updatedAt": null,
  "downloadUrl": "",
  "visitUrl": "",
  "repositoryUrl": "",
  "privacyUrl": "",
  "privacyText": "",
  "feedbackUrl": "",
  "screenshots": [],
  "tags": [],
  "featured": false,
  "order": 3
}
```

`visitUrl` 为使用产品的网站入口，`repositoryUrl` 为源码入口。`privacyText` 可填写真实隐私说明，`privacyUrl` 可填写独立隐私页面地址；`feedbackUrl` 填写真实反馈入口。

### 添加图标、封面和截图

将图片放在 `public/images/产品-slug/`。例如文件 `public/images/interesting-weather/cover.webp` 在数据中写成 `/images/interesting-weather/cover.webp`，不要加入 `public`，也不要自行加入 GitHub 仓库基础路径。

`icon` 和 `cover` 填写图片路径；截图填写对象数组，必须提供实际像素尺寸和有意义的图片说明：

可选的 `socialImage` 用于该产品的独立分享图。现有两款产品已配置 1200×630 PNG；新增产品可填写自己的图片，留空时使用产品封面，封面也为空时不输出分享图片。不要把其他产品的分享图复制为新产品的分享图。

```json
"screenshots": [
  {
    "src": "/images/your-product/screenshot-01.png",
    "alt": "YOUR_SCREENSHOT_DESCRIPTION",
    "width": 1080,
    "height": 2400
  }
]
```

示例尺寸不能替代测量，请改成真实图片的宽高。无截图时保持 `[]`，无封面时保持 `""`，页面会显示静态品牌占位。

`npm run images` 可单独生成适合网页的 WebP / AVIF 图片；`npm run build` 也会自动执行图片优化。截图可使用真实 HTTPS 外部地址，但只有本地图片会被优化。构建时找不到数据中指定的本地图片会报错，请先添加文件，再填写路径。

## 3. 发布版本和下载文件

每次实际发布，在 `releases.json` 添加一条记录。通过 `productId` 与产品的 `id` 精确关联；`id` 是该发布记录的唯一标识。产品页和 Releases 页面自动读取记录，按实际日期排列，并按年月展示发布历史。同一天的记录保持 JSON 中的先后顺序。

以下仅为文档示范，`YOUR_VERSION`、`YOUR_DATE`、文件名和说明都必须替换为真实值；`YOUR_DATE` 必须改成 `YYYY-MM-DD` 才能通过检查：

```json
{
  "id": "your-product-release-id",
  "productId": "your-product",
  "version": "YOUR_VERSION",
  "date": "YOUR_DATE",
  "platforms": ["Android"],
  "changelog": ["YOUR_REAL_CHANGELOG"],
  "visitUrl": "",
  "files": [
    {
      "label": "Android 安装包",
      "platform": "Android",
      "format": "APK",
      "url": "/downloads/your-product/YOUR_VERSION/YOUR_FILE.apk",
      "size": "",
      "minimumSystem": ""
    }
  ]
}
```

站内安装包放在 `public/downloads/产品-slug/版本/文件名`，数据中的 `url` 去掉 `public`。例如上述示例对应 `public/downloads/your-product/YOUR_VERSION/YOUR_FILE.apk`。每次发布使用新的版本目录，保留旧目录即可继续提供历史版本。

也可以将 `url` 填成真实 HTTPS 外部下载地址，例如 GitHub Releases 文件地址。大型文件适合存放在外部文件源。`files` 可同时包含多个文件，兼容 APK、EXE、DMG、ZIP、TAR.GZ 等格式；每个文件单独填写平台、格式、大小和最低系统要求。大小或系统要求未知时留空，不猜测。本地下载地址必须存在对应真实文件，否则构建会报错。

Web 产品可填写发布记录的 `visitUrl`，没有文件时使用 `"files": []`；没有版本号的真实 Web 发布可使用 `"version": ""`，仍需提供实际日期和唯一 `id`。

新增发布记录时，`productId` 必须匹配当前真实产品的 `id`。不要为了填满页面而创建尚未发布的版本。

## 4. 扩展分类、Projects 和 Lab

`taxonomy.json` 的 `types`、`platforms`、`statuses` 是「稳定键：页面显示文字」的登记表。产品类型例如 `"MOBILE_APP": "Mobile App"`，数据使用 `MOBILE_APP`。需要新类别时先加入登记项，再在内容中引用对应键；不要删除仍被内容使用的键。

添加真实项目时，按下述字段在 `projects.json` 中增加完整对象，再填写 `id`、`slug`、名称与真实内容。字段包括 `type`、可选 `category`、`status`、`year`、`description`、`cover`、`images`、`visitUrl`、`repositoryUrl`、`technicalNotes`、`developmentNotes`、`tags`、`featured` 和 `order`。`images` 与产品截图使用相同结构；`developmentNotes` 是字符串数组。未知 `year` 使用 `null`，其他空值遵循前述规则。

`labs.json` 中每条实验采用项目结构，并增加 `number` 字段。只有真实实验才创建对象并分配编号，不添加示范实验。实验类型可使用登记的 `EXPERIMENT`。添加后运行检查和构建，确认对应页面与导航符合预期。项目自动生成详情页；Lab 的完整实验内容直接展示在 Lab 页面，地址可使用 /lab/#实验-slug。

## 5. 部署、域名与交付文件

### 源码与静态文件

- **源码**包含 `src/`、`public/`、`package.json`、锁文件和部署工作流，用于日后修改、构建。
- **`dist/`** 是 `npm run build` 生成的可部署静态 HTML、CSS、JavaScript 和资源。不要直接修改它；下一次构建会重新生成。

`node_modules/`、缓存和临时测试内容不需要上传至网站，也不包含在交付 ZIP 中。本次交付不执行线上发布、不修改 DNS。

### GitHub Pages

将源码上传至 GitHub 仓库的 `main` 分支。在仓库的 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。项目提供 `.github/workflows/deploy.yml`，用于安装依赖、检查构建并部署静态产物。以后推送修改至 `main` 后，查看仓库 Actions 中该工作流是否完成，再检查线上页面。

网站通过 `SITE_URL` 和 `BASE_PATH` 配置域名与子路径。两者在构建时生效；更改后必须重新构建。`SITE_URL` 写完整来源地址，不包含仓库路径；`BASE_PATH` 写 `/` 或 `/仓库名/`。

| 使用方式            | `SITE_URL`                    | `BASE_PATH`         |
| ------------------- | ----------------------------- | ------------------- |
| 正式自定义域名      | `https://ai014.com`           | `/`                 |
| GitHub 用户主页仓库 | `https://YOUR_USER.github.io` | `/`                 |
| GitHub 普通项目仓库 | `https://YOUR_USER.github.io` | `/YOUR_REPOSITORY/` |

Windows PowerShell 构建示例：

```powershell
$env:SITE_URL = "https://YOUR_USER.github.io"
$env:BASE_PATH = "/YOUR_REPOSITORY/"
npm run build
npm run preview
```

macOS / Linux：

```bash
SITE_URL=https://YOUR_USER.github.io BASE_PATH=/YOUR_REPOSITORY/ npm run build
npm run preview
```

自动化部署使用仓库变量：打开 **Settings → Secrets and variables → Actions → Variables**，添加名为 `SITE_URL` 和 `BASE_PATH` 的 Repository variables，按上表填写。它们是公开站点配置，无需设置为 Secret。工作流未读取到变量时，分别使用 `https://ai014.com` 和 `/`。如果先用 GitHub 默认网址预览，务必先设置成对应 GitHub 网址及仓库路径；启用正式自定义域名后，再改回正式域名与 `/` 并重新部署。

默认正式地址为 `https://ai014.com`。使用实际自定义域名时，在 GitHub Pages 设置该域名，并按域名服务商与 GitHub Pages 的要求配置 DNS。如果需要 CNAME 文件，在 `public/CNAME` 中仅写实际启用的域名（例如 `ai014.com`），构建后会复制到 `dist/CNAME`；未启用自定义域名时不要保留错误的 CNAME。

`ai014.cn` 目前只作为备用域名展示；网站未实现双站部署、地区识别或自动跳转。若未来启用，需另外配置实际托管和域名解析。

### 每次更新的简短检查

1. 修改数据、添加真实图片或下载文件，检查 JSON 格式。
2. 运行 `npm run check`、`npm test`、`npm run build`。
3. 使用 `npm run preview` 检查桌面和手机宽度，打开修改过的详情页并检查真实下载链接。
4. 推送源码或上传 `dist/`，确认部署成功后再访问线上页面。

项目交付时附带实际页面截图和测试记录。当前仍需补充两款产品的简介、完整介绍、图标、封面、截图、状态、真实发布版本与文件，以及隐私和反馈资料；未取得的信息保持为空即可。
