#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
測試運行腳本
"""
import sys
import os
import unittest
import argparse
from datetime import datetime

# 添加src目錄到Python路徑
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def run_tests(test_module=None, verbose=True):
    """
    運行測試
    
    Args:
        test_module: 指定測試模塊，如果為None則運行所有測試
        verbose: 是否顯示詳細輸出
    
    Returns:
        測試結果
    """
    # 發現測試
    loader = unittest.TestLoader()
    start_dir = os.path.join(os.path.dirname(__file__), 'tests')
    
    if test_module:
        # 運行指定模塊的測試
        suite = loader.loadTestsFromName(f"tests.{test_module}")
    else:
        # 運行所有測試
        suite = loader.discover(start_dir, pattern='test_*.py')
    
    # 運行測試
    runner = unittest.TextTestRunner(verbosity=2 if verbose else 1)
    result = runner.run(suite)
    
    return result

def generate_test_report(test_results, output_file=None):
    """
    生成測試報告
    
    Args:
        test_results: 測試結果
        output_file: 輸出文件路徑，如果為None則使用默認路徑
    """
    if output_file is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(os.path.dirname(__file__), 'test_report', f'test_report_{timestamp}.html')
    
    # 確保輸出目錄存在
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    # 生成HTML報告
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>小孩照片篩選工具 - 測試報告</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 1000px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #2196F3;
            border-bottom: 2px solid #2196F3;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #1976D2;
            margin-top: 30px;
        }}
        .summary {{
            background-color: #e3f2fd;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }}
        .test-case {{
            margin-bottom: 15px;
            padding: 10px;
            border-left: 4px solid #ccc;
        }}
        .success {{
            border-left-color: #4CAF50;
            background-color: #f1f8e9;
        }}
        .failure {{
            border-left-color: #F44336;
            background-color: #ffebee;
        }}
        .error {{
            border-left-color: #FF9800;
            background-color: #fff3e0;
        }}
        .stats {{
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
        }}
        .stat-item {{
            text-align: center;
            padding: 15px;
            border-radius: 5px;
            min-width: 120px;
        }}
        .total {{
            background-color: #E3F2FD;
            color: #1976D2;
        }}
        .success-count {{
            background-color: #E8F5E9;
            color: #388E3C;
        }}
        .failure-count {{
            background-color: #FFEBEE;
            color: #D32F2F;
        }}
        .error-count {{
            background-color: #FFF3E0;
            color: #F57C00;
        }}
        .timestamp {{
            color: #757575;
            font-size: 14px;
            text-align: right;
            margin-top: 20px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>小孩照片篩選工具 - 測試報告</h1>
        
        <div class="summary">
            <h2>測試摘要</h2>
            <div class="stats">
                <div class="stat-item total">
                    <h3>{test_results.testsRun}</h3>
                    <p>總測試數</p>
                </div>
                <div class="stat-item success-count">
                    <h3>{test_results.testsRun - len(test_results.failures) - len(test_results.errors)}</h3>
                    <p>通過</p>
                </div>
                <div class="stat-item failure-count">
                    <h3>{len(test_results.failures)}</h3>
                    <p>失敗</p>
                </div>
                <div class="stat-item error-count">
                    <h3>{len(test_results.errors)}</h3>
                    <p>錯誤</p>
                </div>
            </div>
        </div>
        
        <h2>測試詳情</h2>
""")

        # 添加失敗的測試
        if test_results.failures:
            f.write("<h3>失敗的測試</h3>")
            for test, traceback in test_results.failures:
                f.write(f"""
        <div class="test-case failure">
            <h4>{test._testMethodName}</h4>
            <p><strong>測試類:</strong> {test.__class__.__name__}</p>
            <pre>{traceback}</pre>
        </div>
""")

        # 添加錯誤的測試
        if test_results.errors:
            f.write("<h3>錯誤的測試</h3>")
            for test, traceback in test_results.errors:
                f.write(f"""
        <div class="test-case error">
            <h4>{test._testMethodName}</h4>
            <p><strong>測試類:</strong> {test.__class__.__name__}</p>
            <pre>{traceback}</pre>
        </div>
""")

        # 添加時間戳
        f.write(f"""
        <div class="timestamp">
            報告生成時間: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
        </div>
    </div>
</body>
</html>
""")

    print(f"測試報告已生成: {output_file}")
    return output_file

def main():
    """主函數"""
    parser = argparse.ArgumentParser(description='運行小孩照片篩選工具的測試')
    parser.add_argument('--module', '-m', type=str, 
                       help='指定要運行的測試模塊 (例如: test_face_recognition_service)')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='顯示詳細輸出')
    parser.add_argument('--report', '-r', action='store_true',
                       help='生成HTML測試報告')
    parser.add_argument('--output', '-o', type=str,
                       help='指定測試報告輸出文件路徑')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("小孩照片篩選工具 - 測試運行器")
    print("=" * 60)
    
    # 運行測試
    result = run_tests(args.module, args.verbose)
    
    # 生成報告
    if args.report:
        report_file = generate_test_report(result, args.output)
        print(f"測試報告已生成: {report_file}")
    
    # 返回適當的退出代碼
    if result.failures or result.errors:
        print("\n測試失敗!")
        sys.exit(1)
    else:
        print("\n所有測試通過!")
        sys.exit(0)

if __name__ == '__main__':
    main()
