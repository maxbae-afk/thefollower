"""PUT local files to Higgsfield presigned upload URLs.

usage: python hf_put.py uploads.json   ([{"file": "...", "url": "..."}, ...])
Cloudflare in front of the bucket rejects urllib's default User-Agent.
"""
import json
import mimetypes
import sys
import urllib.request

for job in json.load(open(sys.argv[1], encoding="utf-8")):
    data = open(job["file"], "rb").read()
    ctype = mimetypes.guess_type(job["file"])[0] or "application/octet-stream"
    req = urllib.request.Request(job["url"], data=data, method="PUT",
                                 headers={"Content-Type": ctype, "User-Agent": "curl/8.9.1"})
    with urllib.request.urlopen(req) as res:
        print(res.status, job["file"], len(data))
