import { black, white, yellow } from 'colors';
import { format } from 'date-fns';
import { config } from 'dotenv';
import fs from 'fs';
import pdf, { CreateOptions } from 'html-pdf';
import Connection from 'imap';
import { simpleParser } from 'mailparser';
import process from 'process';
import { Stream } from 'stream';

class Imap2Nas {
    private configuration = {
        host: '',
        user: '',
        password: '',
        port: 993,
        tls: true,
        path: './data',
        // phantomjs: './node_modules/phantomjs-prebuilt/lib/phantom/bin/phantomjs',
        phantomjs: '/usr/local/bin/phantomjs',
        generateAsHtml: true,
        generateAsPdf: true,
    };

    constructor() {
        // Load dotenv configuration
        config();

        this.configuration.host = process.env.IMAP_HOST
            ? process.env.IMAP_HOST
            : this.configuration.host;
        this.configuration.user = process.env.IMAP_USER
            ? process.env.IMAP_USER
            : this.configuration.user;
        this.configuration.password = process.env.IMAP_PASSWORD
            ? process.env.IMAP_PASSWORD
            : this.configuration.password;
        this.configuration.port = process.env.IMAP_PORT
            ? +process.env.IMAP_PORT
            : this.configuration.port;
        this.configuration.tls = process.env.IMAP_TLS
            ? process.env.IMAP_TLS === 'true'
            : this.configuration.tls;
        this.configuration.path = process.env.MAIL_STORAGE_PATH
            ? process.env.MAIL_STORAGE_PATH
            : this.configuration.path;
        this.configuration.phantomjs = process.env.PHANTOMJS_PATH
            ? process.env.PHANTOMJS_PATH
            : this.configuration.phantomjs;
        this.configuration.generateAsHtml = process.env.GENERATE_HTML
            ? process.env.GENERATE_HTML !== 'false'
            : this.configuration.generateAsHtml;
        this.configuration.generateAsPdf = process.env.GENERATE_PDF
            ? process.env.GENERATE_PDF !== 'false'
            : this.configuration.generateAsPdf;
    }

    async init() {
        const imap = new Connection({
            host: this.configuration.host,
            user: this.configuration.user,
            password: this.configuration.password,
            port: this.configuration.port,
            tls: this.configuration.tls,
        });

        imap.once('ready', () => {
            imap.openBox(
                'INBOX',
                true,
                (err1: any, box: any) => {
                    if (err1) {
                        throw err1;
                    }

                    const startAtMessageNumber = box.messages.total > 5 ? (box.messages.total - 5) : 1;
                    const f = imap.seq.fetch(startAtMessageNumber + ':*', {
                        bodies: [''],
                        struct: true,
                    });

                    f.on('message', (msg: Connection.ImapMessage, seqno: any) => {
                        msg.on('body', (stream: any, info: any) => {
                            this.parseMailAndSaveAsPdf(stream, seqno);
                        });
                    });

                    f.once('error', (err: any) => {
                        this.log(err, 'error');
                    });

                    f.once('end', () => {
                        imap.end();
                    });
                },
            );
        });

        imap.once('error', (err: any) => {
            this.log(err, 'error');
        });

        this.log('Open IMAP connection', 'success');
        imap.connect();
    }

    async parseMailAndSaveAsPdf(stream: Stream, id: string) {
        simpleParser(stream, (err, mail) => {
            const formattedDate = format(mail.date, 'yyyy-MM-dd_HH-mm-ss');
            const optimizedSubject = (mail.subject + '').replace(/[^a-zA-Z ']/g, '').trim();
            const fileName = formattedDate + '_ID-' + id + '_' + optimizedSubject;
            const html = mail.html ? mail.html : mail.textAsHtml;

            if (this.configuration.generateAsHtml) {
                this.createHtml(fileName, id, html);
            }

            if (this.configuration.generateAsPdf) {
                this.createPdf(fileName, id, html);
            }
        });
    }

    private createHtml(fileName: string, id: string, html: string) {
        const filePathHtml = this.configuration.path + '/' + fileName + '.html';

        if (fs.existsSync(filePathHtml)) {
            this.log('HTML #' + id + ' already exists', 'warning');
            return;
        }

        fs.writeFileSync(filePathHtml, html);
        fs.chmodSync(filePathHtml, '+r');
        this.log('Created HTML #' + id + ' successful', 'success');
    }

    private createPdf(fileName: string, id: string, html: string) {
        const filePathPdf = this.configuration.path + '/' + fileName + '.pdf';

        if (fs.existsSync(filePathPdf)) {
            this.log('PDF #' + id + ' already exists', 'warning');
            return;
        }

        const pdfOptions: CreateOptions = {
            phantomPath: this.configuration.phantomjs,
            format: 'A4',
        };

        pdf.create(html, pdfOptions).toFile(filePathPdf, (pdfError: any, pdfResult: any) => {
            if (pdfError) {
                this.log(pdfError, 'error');
            } else {
                this.log('Created PDF #' + id + ' successful', 'success');
            }

            return;
        });
    }

    log(text: string, type?: 'success' | 'warning' | 'error'): void {
        let log;

        switch (type) {
            case 'success':
                log = black.bgGreen(text);
                break;

            case 'warning':
                log = yellow(text);
                break;

            case 'error':
                log = white.bgRed(text);
                break;

            default:
                log = black.bgBlue(text);
                break;
        }

        console.log(log);
    }
}

const imap2Nas = new Imap2Nas();
imap2Nas.init();
