# v0.2.2 缓存与凭据兼容修复

该补丁修复“密码凭据格式不正确”。根因是浏览器仍在使用 v0.2.0 的初始化页面，而 Worker 已升级为新凭据协议。

## 上传方法

将本补丁目录中的全部内容，通过 GitHub `Add file → Upload files` 上传到仓库根目录并覆盖同名文件。

不要修改或覆盖现有 `wrangler.jsonc`，不要更换 D1 Database ID，也不要删除 `PASSWORD_PEPPER` 和 `SETUP_TOKEN`。

Cloudflare 自动部署成功后，关闭所有芋炮小账本页面，再重新打开。若仍显示旧页面，在浏览器的网站设置中清除该站点的数据后重新访问。
