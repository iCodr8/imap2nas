IMAP 2 NAS
==========

Store emails of an IMAP account on a specified path as html or pdf.
This can be used to store them on a NAS.

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
      - USER_ID=0
      - GROUP_ID=0
      - MAIL_STORAGE_PATH=/imap2nas/data
      - PHANTOMJS_PATH=/usr/local/bin/phantomjs
      - GENERATE_HTML=true
      - GENERATE_PDF=true
      - SAVE_ATTACHMENTS=true
    volumes:
      - ./data:/imap2nas/data:rw
```

After that you can run the container with `docker-compose up -d` command.
