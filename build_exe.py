"""
小孩照片篩選工具 - 打包腳本
"""
import os
import sys
import subprocess
import shutil
import json
import zipfile
from pathlib import Path
from datetime import datetime

def check_pyinstaller():
    """檢查PyInstaller是否已安裝"""
    try:
        import PyInstaller
        print(f"[OK] PyInstaller 已安裝，版本: {PyInstaller.__version__}")
        return True
    except ImportError:
        print("[ERR] PyInstaller 未安裝")
        return False

def install_pyinstaller():
    """安裝PyInstaller"""
    print("正在安裝 PyInstaller...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        print("[OK] PyInstaller 安裝成功")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[ERR] PyInstaller 安裝失敗: {e}")
        return False

def install_dependencies():
    """安裝所有依賴套件"""
    print("正在安裝依賴套件...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("[OK] 依賴套件安裝成功")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[ERR] 依賴套件安裝失敗: {e}")
        return False

def get_version_info():
    """獲取版本信息"""
    # 嘗試從版本文件獲取版本信息
    version_file = Path("version.json")
    if version_file.exists():
        try:
            with open(version_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    
    # 如果版本文件不存在，使用默認版本
    return {
        "version": "2.0.0",
        "build": datetime.now().strftime("%Y%m%d"),
        "release_type": "stable"
    }

def build_exe():
    """建構exe檔案"""
    print("正在建構exe檔案...")
    
    # 獲取版本信息
    version_info = get_version_info()
    version = version_info["version"]
    build = version_info["build"]
    
    # 清理之前的建構檔案
    for dir_name in ["build", "dist"]:
        if os.path.exists(dir_name):
            shutil.rmtree(dir_name)
            print(f"[CLEAN] 已清理舊的 {dir_name} 目錄")
    
    try:
        # 使用spec檔案建構
        cmd = [sys.executable, "-m", "PyInstaller", "--clean", "child_photo_filter.spec"]
        subprocess.check_call(cmd)
        print("[OK] exe檔案建構成功")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[ERR] exe檔案建構失敗: {e}")
        return False

def check_exe():
    """檢查exe檔案是否生成"""
    exe_path = Path("dist") / "小孩照片篩選工具_臉部識別版.exe"
    if exe_path.exists():
        size_mb = exe_path.stat().st_size / (1024 * 1024)
        print(f"[OK] exe檔案生成成功: {exe_path}")
        print(f"[SIZE] 檔案大小: {size_mb:.1f} MB")
        return True
    else:
        print("[ERR] exe檔案未生成")
        return False

def create_release_package():
    """建立發布套件"""
    print("正在建立發布套件...")
    
    # 獲取版本信息
    version_info = get_version_info()
    version = version_info["version"]
    build = version_info["build"]
    release_type = version_info["release_type"]
    
    # 創建發布目錄
    release_dir = Path("releases") / f"小孩照片篩選工具_v{version}_build{build}"
    release_dir.mkdir(parents=True, exist_ok=True)
    
    # 複製exe檔案
    exe_path = Path("dist") / "小孩照片篩選工具_臉部識別版.exe"
    if exe_path.exists():
        shutil.copy2(exe_path, release_dir)
        print(f"[OK] 複製exe檔案到: {release_dir}")
    
    # 複製使用說明
    if Path("使用說明_臉部識別版.md").exists():
        shutil.copy2("使用說明_臉部識別版.md", release_dir)
        print("[OK] 複製使用說明")
    
    # 複製文檔
    docs_dir = release_dir / "文檔"
    docs_dir.mkdir(exist_ok=True)
    
    if Path("docs").exists():
        for file in Path("docs").glob("*"):
            if file.is_file():
                shutil.copy2(file, docs_dir)
        print("[OK] 複製文檔")
    
    # 創建README
    readme_content = f"""# 小孩照片篩選工具 v{version}

## 發布信息
- 版本: {version}
- 構建: {build}
- 發布類型: {release_type}
- 發布日期: {datetime.now().strftime('%Y-%m-%d')}

## 文件說明
- 小孩照片篩選工具_臉部識別版.exe: 主程式
- 使用說明_臉部識別版.md: 基本使用說明
- 文檔/: 詳細文檔目錄

## 系統需求
- Windows 10/11
- 至少4GB RAM
- 約2GB硬碟空間（包含模型檔案）

## 快速開始
1. 雙擊"小孩照片篩選工具_臉部識別版.exe"啟動程式
2. 準備5-15張您小孩的清晰照片作為參考照
3. 選擇參考照資料夾並建立參考照庫
4. 選擇班級照片資料夾和輸出資料夾
5. 調整相似度閾值（建議0.65）
6. 點擊"開始篩選"按鈕

## 支援的圖片格式
JPG, JPEG, PNG, BMP, TIFF, WEBP, HEIC, HEIF

## 技術支持
如遇問題，請參考"文檔"目錄中的詳細說明。
"""
    
    with open(release_dir / "README.txt", "w", encoding="utf-8") as f:
        f.write(readme_content)
    
    # 創建版本信息文件
    with open(release_dir / "version.json", "w", encoding="utf-8") as f:
        json.dump(version_info, f, ensure_ascii=False, indent=2)
    
    print(f"[OK] 發布套件建立完成: {release_dir}")
    return release_dir

def create_portable_package():
    """創建便攜版套件"""
    print("正在創建便攜版套件...")
    
    # 獲取版本信息
    version_info = get_version_info()
    version = version_info["version"]
    build = version_info["build"]
    
    # 創建便攜版目錄
    portable_dir = Path("releases") / f"小孩照片篩選工具_v{version}_build{build}_便攜版"
    portable_dir.mkdir(parents=True, exist_ok=True)
    
    # 複製exe檔案
    exe_path = Path("dist") / "小孩照片篩選工具_臉部識別版.exe"
    if exe_path.exists():
        shutil.copy2(exe_path, portable_dir)
        print(f"[OK] 複製exe檔案到: {portable_dir}")
    
    # 複製使用說明
    if Path("使用說明_臉部識別版.md").exists():
        shutil.copy2("使用說明_臉部識別版.md", portable_dir)
        print("[OK] 複製使用說明")
    
    # 複製文檔
    docs_dir = portable_dir / "文檔"
    docs_dir.mkdir(exist_ok=True)
    
    if Path("docs").exists():
        for file in Path("docs").glob("*"):
            if file.is_file():
                shutil.copy2(file, docs_dir)
        print("[OK] 複製文檔")
    
    # 創建便攜版README
    readme_content = f"""# 小孩照片篩選工具 v{version} 便攜版

## 發布信息
- 版本: {version}
- 構建: {build}
- 發布日期: {datetime.now().strftime('%Y-%m-%d')}

## 使用說明
這是一個便攜版，無需安裝，直接運行即可。

## 快速開始
1. 雙擊"小孩照片篩選工具_臉部識別版.exe"啟動程式
2. 程式會在當前目錄創建配置和緩存文件
3. 如需完全卸載，只需刪除整個資料夾

## 注意事項
- 首次運行需要下載模型，請保持網路連接
- 建議將整個資料夾放在常用位置，方便後續使用
- 程式設置和緩存文件存儲在用戶目錄

## 技術支持
如遇問題，請參考"文檔"目錄中的詳細說明。
"""
    
    with open(portable_dir / "便攜版說明.txt", "w", encoding="utf-8") as f:
        f.write(readme_content)
    
    print(f"[OK] 便攜版套件建立完成: {portable_dir}")
    return portable_dir

def create_installer_package():
    """創建安裝版套件"""
    print("正在創建安裝版套件...")
    
    # 獲取版本信息
    version_info = get_version_info()
    version = version_info["version"]
    build = version_info["build"]
    
    # 創建安裝版目錄
    installer_dir = Path("releases") / f"小孩照片篩選工具_v{version}_build{build}_安裝版"
    installer_dir.mkdir(parents=True, exist_ok=True)
    
    # 複製便攜版內容
    portable_dir = create_portable_package()
    if portable_dir:
        for item in portable_dir.glob("*"):
            if item.is_file():
                shutil.copy2(item, installer_dir)
            elif item.is_dir() and item.name != "文檔":
                shutil.copytree(item, installer_dir / item.name, dirs_exist_ok=True)
        
        # 複製文檔到安裝版目錄
        docs_dir = installer_dir / "文檔"
        if not docs_dir.exists():
            docs_dir.mkdir(exist_ok=True)
        
        portable_docs = portable_dir / "文檔"
        if portable_docs.exists():
            for file in portable_docs.glob("*"):
                if file.is_file():
                    shutil.copy2(file, docs_dir)
    
    # 創建安裝腳本
    install_script = f"""@echo off
title 小孩照片篩選工具 v{version} 安裝程式
echo 正在安裝小孩照片篩選工具 v{version}...
echo.

set "INSTALL_DIR=%PROGRAMFILES%\\小孩照片篩選工具"
if exist "%PROGRAMFILES(X86)%" set "INSTALL_DIR=%PROGRAMFILES(X86)%\\小孩照片篩選工具"

echo 安裝目錄: %INSTALL_DIR%
echo.

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo 正在複製文件...
xcopy ".\\*" "%INSTALL_DIR%\\" /E /Y /Q

echo 正在創建桌面快捷方式...
set "SHORTCUT=%USERPROFILE%\\Desktop\\小孩照片篩選工具.lnk"
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%TEMP%\\CreateShortcut.vbs"
echo sLinkFile = "%SHORTCUT%" >> "%TEMP%\\CreateShortcut.vbs"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%TEMP%\\CreateShortcut.vbs"
echo oLink.TargetPath = "%INSTALL_DIR%\\小孩照片篩選工具_臉部識別版.exe" >> "%TEMP%\\CreateShortcut.vbs"
echo oLink.WorkingDirectory = "%INSTALL_DIR%" >> "%TEMP%\\CreateShortcut.vbs"
echo oLink.Description = "小孩照片篩選工具 v{version}" >> "%TEMP%\\CreateShortcut.vbs"
echo oLink.Save >> "%TEMP%\\CreateShortcut.vbs"
cscript "%TEMP%\\CreateShortcut.vbs"
del "%TEMP%\\CreateShortcut.vbs"

echo.
echo 安裝完成！
echo.
echo 程式已安裝到: %INSTALL_DIR%
echo 桌面快捷方式已創建
echo.
pause
"""
    
    with open(installer_dir / "安裝.bat", "w", encoding="utf-8") as f:
        f.write(install_script)
    
    # 創建卸載腳本
    uninstall_script = f"""@echo off
title 小孩照片篩選工具 v{version} 卸載程式
echo 正在卸載小孩照片篩選工具 v{version}...
echo.

set "INSTALL_DIR=%PROGRAMFILES%\\小孩照片篩選工具"
if exist "%PROGRAMFILES(X86)%" set "INSTALL_DIR=%PROGRAMFILES(X86)%\\小孩照片篩選工具"

echo 卸載目錄: %INSTALL_DIR%
echo.

echo 正在刪除桌面快捷方式...
if exist "%USERPROFILE%\\Desktop\\小孩照片篩選工具.lnk" del "%USERPROFILE%\\Desktop\\小孩照片篩選工具.lnk"

echo 正在刪除程序文件...
rmdir /S /Q "%INSTALL_DIR%"

echo.
echo 卸載完成！
echo.
pause
"""
    
    with open(installer_dir / "卸載.bat", "w", encoding="utf-8") as f:
        f.write(uninstall_script)
    
    print(f"[OK] 安裝版套件建立完成: {installer_dir}")
    return installer_dir

def create_zip_package(source_dir, zip_name):
    """創建ZIP壓縮包"""
    print(f"正在創建ZIP包: {zip_name}")
    
    zip_path = Path("releases") / f"{zip_name}.zip"
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file_path in source_dir.rglob('*'):
            if file_path.is_file():
                arcname = file_path.relative_to(source_dir.parent)
                zipf.write(file_path, arcname)
    
    print(f"[OK] ZIP包創建完成: {zip_path}")
    return zip_path

def update_version_info(version=None, release_type=None):
    """更新版本信息"""
    version_file = Path("version.json")
    
    # 讀取現有版本信息
    if version_file.exists():
        try:
            with open(version_file, 'r', encoding='utf-8') as f:
                version_info = json.load(f)
        except Exception:
            version_info = {}
    else:
        version_info = {}
    
    # 更新版本信息
    if version:
        version_info["version"] = version
    if release_type:
        version_info["release_type"] = release_type
    
    # 更新構建號
    version_info["build"] = datetime.now().strftime("%Y%m%d")
    
    # 保存版本信息
    with open(version_file, 'w', encoding='utf-8') as f:
        json.dump(version_info, f, ensure_ascii=False, indent=2)
    
    print(f"[OK] 版本信息已更新: {version_info}")
    return version_info

def main():
    """主函數"""
    import argparse
    
    parser = argparse.ArgumentParser(description='小孩照片篩選工具打包腳本')
    parser.add_argument('--version', '-v', type=str, help='指定版本號')
    parser.add_argument('--release-type', '-r', type=str, 
                       choices=['stable', 'beta', 'alpha'], default='stable',
                       help='指定發布類型')
    parser.add_argument('--package-type', '-p', type=str, 
                       choices=['all', 'release', 'portable', 'installer'], default='all',
                       help='指定打包類型')
    parser.add_argument('--skip-tests', '-s', action='store_true',
                       help='跳過測試')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("小孩照片篩選工具 - 打包腳本")
    print("=" * 60)
    
    # 更新版本信息
    update_version_info(args.version, args.release_type)
    
    # 運行測試
    if not args.skip_tests:
        print("\n正在運行測試...")
        try:
            subprocess.check_call([sys.executable, "run_tests.py"])
            print("[OK] 所有測試通過")
        except subprocess.CalledProcessError:
            print("[ERR] 測試失敗，停止打包")
            sys.exit(1)
    
    # 檢查PyInstaller
    if not check_pyinstaller():
        if not install_pyinstaller():
            print("[ERR] 無法安裝PyInstaller，打包失敗")
            sys.exit(1)
    
    # 安裝依賴套件
    if not install_dependencies():
        print("[ERR] 無法安裝依賴套件，打包失敗")
        sys.exit(1)
    
    # 建構exe檔案
    if not build_exe():
        print("[ERR] exe檔案建構失敗，打包失敗")
        sys.exit(1)
    
    # 檢查exe檔案
    if not check_exe():
        print("[ERR] exe檔案檢查失敗，打包失敗")
        sys.exit(1)
    
    # 創建發布套件
    version_info = get_version_info()
    version = version_info["version"]
    build = version_info["build"]
    
    if args.package_type in ['all', 'release']:
        release_dir = create_release_package()
        if release_dir:
            zip_name = f"小孩照片篩選工具_v{version}_build{build}"
            create_zip_package(release_dir, zip_name)
    
    if args.package_type in ['all', 'portable']:
        portable_dir = create_portable_package()
        if portable_dir:
            zip_name = f"小孩照片篩選工具_v{version}_build{build}_便攜版"
            create_zip_package(portable_dir, zip_name)
    
    if args.package_type in ['all', 'installer']:
        installer_dir = create_installer_package()
        if installer_dir:
            zip_name = f"小孩照片篩選工具_v{version}_build{build}_安裝版"
            create_zip_package(installer_dir, zip_name)
    
    print("\n" + "=" * 60)
    print("打包完成！")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)


