#!/usr/bin/env python3
"""Read-only comparison. No production environment variables, credentials or application data."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
parser = argparse.ArgumentParser()
parser.add_argument('output')
parser.add_argument('--compare')
args = parser.parse_args()
files = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/etc/nginx').rglob('*') if p.is_file()}
ids = subprocess.check_output(['docker', 'ps', '-q'], text=True).split()
containers = []
if ids:
    for item in json.loads(subprocess.check_output(['docker', 'inspect', *ids], text=True)):
        if item['Name'].lstrip('/').startswith(('aibeego-platform-qa', 'aibeego-domain-qa')):
            continue
        containers.append({'name': item['Name'], 'id': item['Id'], 'started_at': item['State']['StartedAt']})
containers.sort(key=lambda x: x['name'])
nginx_pid_file = Path('/var/run/nginx.pid')
result = {'nginx_files': files, 'nginx_master_pid': nginx_pid_file.read_text().strip() if nginx_pid_file.exists() else None, 'containers': containers}
Path(args.output).write_text(json.dumps(result, indent=2, sort_keys=True))
if args.compare:
    if result != json.loads(Path(args.compare).read_text()):
        raise SystemExit('FAIL: production configuration or container identities changed; inspect the diff.')
    print(f'PASS: {len(files)} nginx file hashes, nginx master PID and {len(containers)} production containers unchanged.')
else:
    print(f'Recorded {len(files)} nginx file hashes and {len(containers)} existing containers.')
