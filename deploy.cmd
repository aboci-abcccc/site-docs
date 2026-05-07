#!/bin/bash

echo "📦 开始构建 VitePress..."
pnpm vitepress build docs

echo "🚀 上传到服务器..."
scp -r docs/.vitepress/dist/* root@abcccc.top:/var/www/main/dist/

echo "✅ 部署完成！"
echo "🌍 网站地址：https://abcccc.top"