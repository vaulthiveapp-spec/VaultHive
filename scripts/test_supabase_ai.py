import urllib.request
import json

url = 'https://afzpyhlimuhjrunyhnms.supabase.co/functions/v1/vaulthive-ai'
body = {
    'uid': 'test',
    'message': 'hi',
    'history': [],
    'context': {},
}
req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), headers={ 'Content-Type': 'application/json' })
try:
    with urllib.request.urlopen(req, timeout=10) as res:
        print(res.status)
        print(res.read().decode('utf-8'))
except Exception as e:
    import traceback
    traceback.print_exc()
