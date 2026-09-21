# Readium 脚注拦截 saga — 实证经验(2025-07 记录)

> 背景:`07-30-rn-expo-web-master-migration` 的 P0 readium spike 中,脚注点击拦截前后
> 折腾 6+ 轮(iOS 3.11 + Android 3.1.0)。本文是**实证结论**,不是推测。所有结论
> 均来自设备实测(Web Inspector / Xcode logcat / 探针 print)。

## 最终结论

- **iOS(swift-toolkit 3.11)**:官方 note 检测可用且最稳 ——
  `epub:type="noteref"` 链接 + 完整路径 href + `<base href="/">` 注入 →
  `didTapOnInternalLink` → `getNoteData` → `navigator(_:shouldNavigateToNoteAt:link:content:referrer:)`
  (4 参签名,返回 false 不跳转)。
- **Android(kotlin-toolkit 3.1.0)**:官方路径 `shouldFollowInternalLink(link, context)`,
  脚注时 `context is FootnoteContext`(携带 `noteContent`)→ 返回 false。
- 但因 iOS WebView 内交互反复踩坑 + Android 官方路径在 paged 模式未验证成功,
  最终用户决定:**脚注改由注入脚本在 WebView 内部渲染浮层**(不再走原生 sheet)。

## iOS 3.11 实证事实(全部设备验证)

1. **`window.webkit.messageHandlers` 的 `Object.keys()` 返回 `[]` 不代表通道断!**
   WKWebView 的 handler 名是**不可枚举的 getter**。实测
   `window.webkit.messageHandlers.tap.postMessage({...})` 正常返回
   (`TAP_OK`),readium 的 tap/log/spreadLoaded 消息其实**全部注册且在跑**。
   这是本 saga 最大的误判来源 —— 前 5 轮方案全基于"通道断了"的错误前提。
2. **`evaluateJavaScript` 会挂起**:readium 的 `evaluateJavaScript` 先
   `await spreadLoaded()`,而 `isSpreadLoaded` 依赖 JS 消息 `spreadLoaded`
   置位。若该消息路径失效(或时序问题),调用**永不返回**(不是失败,
   是挂起 —— 表现为只打印一次 `spreadNotLoaded` 后静默)。
3. **链接导航链路**:点击 `<a>` → readium JS(qe)→ `decidePolicyFor`
   (要求 `navigationType == .linkActivated`)→ `relativize(url)` 成功 →
   `didTapOnInternalLink(href, clickEvent)`。readium 的 JS 不 preventDefault
   链接导航(`er()` 只用于 keydown/keyup)。
4. **`clickEvent.interactiveElement`**:readium JS 的 `Ue(target)` 向上找
   `a/button/input/...`(含 SVG 内部),返回最外层 interactive 元素的 outerHTML。
5. **`getNoteData(anchor, href)` 的完整条件链**(任一步失败 → 静默 nil):
   - `Jsoup.parse(anchor).select("a[epub:type=noteref]")` 命中(所以注入脚本必须设 `epub:type="noteref"`)
   - `href.hasSuffix(anchorHref)` —— **锚点 href 字符串必须与 relativize 后的导航 href 后缀一致**
   - `AnyURL(href).fragment` 非空
   - `publication.get(url.removingFragment())` 命中资源(单资源容器按文件名匹配)
   - 资源里 `select("#id")` 命中注释节点 → `aside.html()` 即注释内容
6. **`<base href="/">` 是必须的**:页面 URL 是 `readium://<UUID>/chapters/x.xhtml`,
   相对链接 `chapters/x.xhtml#note1` 会被 WebKit 解析为
   `chapters/chapters/x.xhtml`(相对当前目录)→ `linkWithHREF` 匹配 readingOrder
   失败 → 静默 return。注入 `<base href="/">` 后解析到根,且锚点 href 字符串
   保持 `chapters/x.xhtml#note1`,hasSuffix 才匹配。**注意 `<base>` 会改变
   `document.baseURI`,注入脚本里算章节路径必须用 `location.href` 而不是 baseURI。**
7. **Expo Modules 事件必须注册**:View 的 `EventDispatcher` 只有加进
   `View(...) { Events("onReady", "onLocatorChange", "onError", "onFootnoteTap") }`
   才会转发到 JS。漏掉 `onFootnoteTap` 时原生侧完全正常、JS 侧静默无事件。
8. **`link.href.string` 是 internal**:`Link` 的 href 在自定义模块里直接
   `\(link.href)`(CustomStringConvertible)或 `link.href.string` 需要 public 接口。

## Android 3.1.0 实证事实

1. JS→native 桥:`window.Android` = `addJavascriptInterface(R2WebView, "Android")`,
   JS 里 `Android.onTap(JSON.stringify(tapEvent))` / `onSelectionStart` 等。
   `tapEvent.interactiveElement` 由 JS `Ju(target)` 生成(与 iOS 的 `Ue` 等价)。
2. **`onTap` → `handleFootnote(interactiveElement)`**:`Jsoup.parse(...)
   .select("a[epub:type=noteref]")` → href fragment → 读资源 → 提取 `#id` →
   `onFootnoteLinkActivated(url, FootnoteContext(noteContent))` →
   `navigateToUrl` → `shouldFollowInternalLink(link, context)`。
   签名是 `shouldFollowInternalLink(link: Link, context: LinkContext?)`(context 可空)。
3. **轮询 null 判断陷阱**:`evaluateJavascript("JSON.stringify(window.__novellaNote||null)")`
   返回的是 **JSON 编码的字符串**(`"null"` 6 字符),Kotlin 里 `!= "null"` 恒真
   → 把 `"null"` 当内容疯狂触发。修法:用 `JSONObject("{\"v\":$result}")` 解析后
   再判空,或直接 `"\"null\"" == result`。
4. readium-navigator 3.1.0 的 reflowable JS 里没有
   `postMessage/messageHandlers` 字样,桥全是 `Android.xxx`。
5. `R2EpubPageFragment` 在 paged 模式下 `addJavascriptInterface(webView, "Android")`
   (对象是 webView 自身)。注入脚本执行(标记显示)但点击无任何回调的排查:
   JS 桥、事件监听、`handleFootnote` 各步都需 logcat 探针(WebView console
   不会自动进 logcat,R2BasicWebView 无 WebChromeClient 转发)。

## 踩坑清单(教训)

1. **不要用 `Object.keys(messageHandlers)` 判断通道** —— 不可枚举 getter 误导。
   用 `postMessage` 实测。
2. **readium 链接 href 必须与 manifest readingOrder 精确匹配**;相对路径在
   WebKit 里按当前目录解析,`<base>` 或绝对路径二选一,并保证 getNoteData 的
   hasSuffix 一致。
3. **Expo Modules 事件注册**:忘了 `Events(...)` 就是"原生对、JS 静默"的典型。
4. **模板字符串里写正则字面量要双重转义**(`\` 在 TS 模板里会被吞,编译出
   非法正则导致整个注入脚本 SyntaxError)。
5. **WKWebView 的 SVG 链接内容点击**在 readium 下行为未证实,标准 epub 脚注
   用纯文本 `<sup>[n]</sup>` 更稳(readium 官方格式)。
6. **改 Pods 源码加探针**可行(诊断),`pod install` 会还原 —— 探针类修改
   记录在案,验证后必须还原。
7. 单资源容器:manifest 只有一章,资源按 `lastPathSegment`(iOS)/`filename`
   (Android)匹配,避免 scheme/host 差异。

## 备选方案(全部实测失败或放弃)

| 方案 | 失败原因 |
|------|---------|
| JS bridge `postMessage`(自定义 handler) | iOS:注入脚本可执行但事件转发当时未验证(后被 Events 注册坑掩盖) |
| WebView 内浮层(position:fixed) | readium paged 布局用 transform 容器,`fixed` 锚定到 transform 祖先 → 需 `absolute` + JS 视口测量;用户当时拒绝样式 |
| readium note 检测(noteref) | 条件链长(见上),任一步错就静默;纯 `#id` href 时 `removingFragment` 为空 |
| custom scheme `novella-footnote://` | 内容进 URL 会超长;链接导航链路当时未确认 |
| `evaluateJavaScript` 轮询 | `spreadLoaded` 消息依赖 → 挂起;Android 还有 null 判断 bug |

## 当前状态(2025-07 待办)

- iOS 官方 note 检测**已验证弹出原生 sheet**(含 `Events("onFootnoteTap")` 修复)。
- Android 官方路径代码已就位(未在设备验证成功,点击无 `[FN]` 日志)。
- 用户决定:**WebView 内浮层**(注入脚本渲染,样式走 buildChapterXhtml 注入的主题色)。
- Pods 探针待还原(`pod install` 或手动改回 `EPUBSpreadView.swift` /
  `EPUBNavigatorViewController.swift` 的 `[PROBE]` print)。
