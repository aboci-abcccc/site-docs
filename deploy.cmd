@echo off
setlocal
set "REMOTE=root@abcccc.top"
set "REMOTE_ROOT=/var/www/main"

call pnpm docs:build || exit /b 1
ssh %REMOTE% "rm -rf %REMOTE_ROOT%/dist-next && install -d -m 755 %REMOTE_ROOT%/dist-next" || exit /b 1
scp -r docs/.vitepress/dist/. %REMOTE%:%REMOTE_ROOT%/dist-next/ || exit /b 1
ssh %REMOTE% "set -eu; find %REMOTE_ROOT%/dist-next -type d -exec chmod 755 {} +; find %REMOTE_ROOT%/dist-next -type f -exec chmod 644 {} +; test -s %REMOTE_ROOT%/dist-next/index.html; find %REMOTE_ROOT%/dist-next/assets -maxdepth 1 -type f -name 'style.*.css' -size +0c | grep -q ." || exit /b 1
ssh %REMOTE% "set -eu; rm -rf %REMOTE_ROOT%/dist-previous; mv %REMOTE_ROOT%/dist %REMOTE_ROOT%/dist-previous; if ! mv %REMOTE_ROOT%/dist-next %REMOTE_ROOT%/dist; then mv %REMOTE_ROOT%/dist-previous %REMOTE_ROOT%/dist; exit 1; fi" || exit /b 1

echo Website deployed successfully. Previous version: %REMOTE_ROOT%/dist-previous
