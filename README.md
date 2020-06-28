IMAP 2 NAS
==========

Copies the last 5 emails as html and pdf to a directory.
I am using that to store them on my Synology NAS.

Usage
-----

Create a docker-compose.yml file and replace the parameters inside.
At the volumes section you can define where your files should be stored.

```
version: '3'

services:
  imap2nas:
    image: icodr8/imap2nas:latest
    environment:
      - IMAP_HOST=YOUR_EMAIL_HOST
      - IMAP_USER=YOUR_EMAIL_USER_ACCOUNT
      - IMAP_PASSWORD=XXXXXXXXXXXXXXXX
      - IMAP_PORT=993
      - IMAP_TLS=true
      - MAIL_STORAGE_PATH=/imap2nas/data
      - PHANTOMJS_PATH=/usr/local/bin/phantomjs
      - GENERATE_HTML=true
      - GENERATE_PDF=true
    volumes:
      - ./data:/imap2nas/data:rw
```

After that you can run the container with `docker-compose up -d` command.
