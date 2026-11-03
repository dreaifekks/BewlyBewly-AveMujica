#!/usr/bin/env bash
# 把 extension-safari 打包成 macOS App 的 dmg，需要 macOS 和 Xcode，先运行 `bun run build-safari`。
# 用法：scripts/package-safari.sh <输出的 dmg 路径>
#
# 没有 Apple 开发者证书，App 只做 ad-hoc 签名：Apple 芯片要求至少有这个签名才能运行，
# 但 Safari 不认它，需要在 Safari 里开启“允许未签名的扩展”才能启用。
set -euo pipefail

OUTPUT_DMG="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
APP_NAME="BewlyBewly AveMujica"
BUNDLE_ID="com.dreaifekks.BewlyBewly-AveMujica"
# Xcode 默认用当前 SDK 的版本作最低系统版本，不固定的话旧系统打不开
MACOS_DEPLOYMENT_TARGET="14.0"
# App 的版本号跟随扩展清单，转换器默认写成 1.0
VERSION="$(node -p "require('./extension-safari/manifest.json').version")"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

xcrun safari-web-extension-converter ./extension-safari \
  --project-location "$WORK_DIR/project" \
  --app-name "$APP_NAME" \
  --bundle-identifier "$BUNDLE_ID" \
  --macos-only \
  --copy-resources \
  --swift \
  --no-open \
  --no-prompt \
  --force

xcodebuild \
  -project "$WORK_DIR/project/$APP_NAME/$APP_NAME.xcodeproj" \
  -scheme "$APP_NAME" \
  -configuration Release \
  -derivedDataPath "$WORK_DIR/build" \
  ARCHS="arm64 x86_64" \
  ONLY_ACTIVE_ARCH=NO \
  MACOSX_DEPLOYMENT_TARGET="$MACOS_DEPLOYMENT_TARGET" \
  MARKETING_VERSION="$VERSION" \
  CURRENT_PROJECT_VERSION="$VERSION" \
  CODE_SIGN_IDENTITY="-" \
  CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM="" \
  PROVISIONING_PROFILE_SPECIFIER="" \
  -quiet \
  build

APP_PATH="$WORK_DIR/build/Build/Products/Release/$APP_NAME.app"
codesign --verify --deep --strict "$APP_PATH"

mkdir "$WORK_DIR/dmg"
cp -R "$APP_PATH" "$WORK_DIR/dmg/"
ln -s /Applications "$WORK_DIR/dmg/Applications"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$WORK_DIR/dmg" \
  -fs HFS+ \
  -format UDZO \
  -ov \
  "$OUTPUT_DMG"
