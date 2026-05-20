# GitHub 发布步骤

当前环境未安装 GitHub CLI，且沙箱阻止了在当前目录创建 `.git`。如果在本机终端操作，可以按下面步骤发布：

```bash
cd "/Users/Shared/Previously Relocated Items/Security/lihao app/app/9527"
git init
git add .
git commit -m "feat: scaffold 9527 script platform mvp"
git branch -M main
git remote add origin <你的GitHub仓库地址>
git push -u origin main
```

如果你希望我继续推送，请提供 GitHub 空仓库地址，例如：

```text
https://github.com/<owner>/9527-script-platform.git
```

然后允许我执行 `git init`、`git remote add` 和 `git push`。
