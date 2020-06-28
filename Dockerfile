FROM node:12

USER root

ENV IMAP_HOST=''
ENV IMAP_USER=''
ENV IMAP_PASSWORD=''
ENV IMAP_PORT=993
ENV IMAP_TLS=true
ENV MAIL_STORAGE_PATH='/imap2nas/data'

RUN apt-get update -yqq

RUN mkdir -p /imap2nas/
WORKDIR /imap2nas

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p /imap2nas/data/
RUN chmod +rwx /imap2nas/data/

RUN apt-get install -yqq --no-install-recommends \
    ca-certificates \
    bzip2 \
    curl \
    libfontconfig
RUN mkdir -p /tmp/phantomjs \
    && curl -L https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-2.1.1-linux-x86_64.tar.bz2 \
    | tar -xj --strip-components=1 -C /tmp/phantomjs \
    && mv /tmp/phantomjs/bin/phantomjs /usr/local/bin

RUN apt-get install -yqq cron
RUN touch /var/log/cron.log
COPY docker/crontab /etc/cron/crontab
RUN chmod +x /etc/cron/crontab
RUN crontab /etc/cron/crontab

RUN printenv | sed 's/^\(.*\)$/export \1/g' > /imap2nas/container_env.sh
RUN chmod +x /imap2nas/container_env.sh

ENTRYPOINT ["/imap2nas/docker/entrypoint.sh"]

CMD cron && tail -f /var/log/cron.log
