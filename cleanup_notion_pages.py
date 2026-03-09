import os
from notion_client import Client

PARENT_PAGE_ID = os.environ.get('NOTION_PARENT_PAGE_ID')
TOKEN = os.environ.get('NOTION_ACCESS_TOKEN')

if not PARENT_PAGE_ID or not TOKEN:
    raise SystemExit('Missing NOTION_PARENT_PAGE_ID or NOTION_ACCESS_TOKEN')

client = Client(auth=TOKEN)

cursor = None
removed = []
kept = []

while True:
    resp = client.blocks.children.list(block_id=PARENT_PAGE_ID, start_cursor=cursor) if cursor else client.blocks.children.list(block_id=PARENT_PAGE_ID)
    for b in resp.get('results', []):
        if b.get('object') != 'block' or b.get('type') != 'child_page':
            continue
        page_id = b.get('id')
        title = b.get('child_page', {}).get('title', '')
        if title.startswith('OpenClaw') or title.startswith('WeChat Sync Test'):
            client.pages.update(page_id=page_id, archived=True)
            removed.append((title, page_id))
        else:
            kept.append((title, page_id))
    if not resp.get('has_more'):
        break
    cursor = resp.get('next_cursor')

print('Removed pages:')
for t, pid in removed:
    print(f'- {t} ({pid})')
print(f'Total removed: {len(removed)}')
