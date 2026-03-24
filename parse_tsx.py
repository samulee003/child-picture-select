import subprocess

def run_tsc():
    result = subprocess.run(['npm', 'run', 'typecheck'], capture_output=True, text=True)
    print(result.stdout)
    print(result.stderr)

run_tsc()
