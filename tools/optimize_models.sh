#!/bin/zsh
# 把 art/golf_<id>.glb 的貼圖縮到 2048 並轉 WebP，輸出到 public/models/characters/<id>.glb（原檔不動）
# 用法：zsh tools/optimize_models.sh [id ...]　不帶參數＝art/ 裡全部
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
trap 'rm -f "$TMP"/*.glb; rmdir "$TMP"' EXIT
ids=("$@")
if [ ${#ids[@]} -eq 0 ]; then for f in art/golf_*.glb; do ids+=("${${f:t:r}#golf_}"); done; fi
for id in $ids; do
  src="art/golf_$id.glb"
  [ -f "$src" ] || { echo "✗ 找不到 $src"; continue; }
  npx -y @gltf-transform/cli@4 resize "$src" "$TMP/$id.glb" --width 2048 --height 2048 >/dev/null 2>&1 \
    && npx -y @gltf-transform/cli@4 webp "$TMP/$id.glb" "public/models/characters/$id.glb" --quality 85 >/dev/null 2>&1 \
    && echo "✓ $id $(du -h "$src" | cut -f1) → $(du -h "public/models/characters/$id.glb" | cut -f1)" || echo "✗ $id 壓縮失敗"
done
