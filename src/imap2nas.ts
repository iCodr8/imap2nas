import { black, white, yellow } from 'colors';
import { format } from 'date-fns';
import { config } from 'dotenv';
import fs from 'fs';
import pdf, { CreateOptions } from 'html-pdf';
import Connection from 'imap';
import { Attachment, simpleParser } from 'mailparser';
import mkdirp from 'mkdirp';
import path from 'path';
import process from 'process';
import { Stream } from 'stream';

class Imap2Nas {
    private configuration = {
        host: '',
        user: '',
        password: '',
        port: 993,
        tls: true,
        userId: process.getuid(),
        groupId: process.getgid(),
        path: './data',
        // phantomjs: './node_modules/phantomjs-prebuilt/lib/phantom/bin/phantomjs',
        phantomjs: '/usr/local/bin/phantomjs',
        generateAsHtml: true,
        generateAsPdf: true,
        saveAttachments: true,
        emailFromRegex: '.*',
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
        this.configuration.userId = process.env.USER_ID
            ? +process.env.USER_ID
            : this.configuration.userId;
        this.configuration.groupId = process.env.GROUP_ID
            ? +process.env.GROUP_ID
            : this.configuration.groupId;
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
        this.configuration.saveAttachments = process.env.SAVE_ATTACHMENTS
            ? process.env.SAVE_ATTACHMENTS !== 'false'
            : this.configuration.saveAttachments;
        this.configuration.emailFromRegex = process.env.EMAIL_FROM_REGEX
            ? process.env.EMAIL_FROM_REGEX
            : this.configuration.emailFromRegex;
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

                    if (box.messages.total === 0) {
                        this.log('INBOX is empty!', 'warning');
                        return;
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
            const formattedDate = format(mail.date, 'dd_HH-mm-ss');
            // const optimizedSubject = (mail.subject + '').replace(/[^a-zA-Z ']/g, '').trim();
            const html = mail.html ? mail.html : mail.textAsHtml;
            const pathToFile = this.configuration.path
                + '/' + format(mail.date, 'yyyy')
                + '/' + format(mail.date, 'MM')
                + '/' + formattedDate + '_ID-' + id;

            const emailFromRegex = new RegExp(this.configuration.emailFromRegex, 'g');

            if (!mail.from.text.match(emailFromRegex)) {
                this.log(`Invalid email sender "${mail.from.text}"! Only allowed regex: "${emailFromRegex}"`, 'warning');
                return;
            }

            mkdirp.sync(pathToFile);

            fs.chmodSync(pathToFile, 0o660);
            fs.chownSync(pathToFile, this.configuration.userId, this.configuration.groupId);

            const pathToFileSub1 = path.dirname(pathToFile);
            fs.chmodSync(pathToFileSub1, 0o660);
            fs.chownSync(pathToFileSub1, this.configuration.userId, this.configuration.groupId);

            const pathToFileSub2 = path.dirname(pathToFileSub1);
            fs.chmodSync(pathToFileSub2, 0o660);
            fs.chownSync(pathToFileSub2, this.configuration.userId, this.configuration.groupId);

            if (this.configuration.generateAsHtml) {
                this.createHtml(pathToFile, 'content', id, html);
            }

            if (this.configuration.generateAsPdf) {
                this.createPdf(pathToFile, 'content', id, html);
            }

            if (this.configuration.saveAttachments) {
                this.saveAttachments(pathToFile, id, mail.attachments);
            }
        });
    }

    private createHtml(pathToFile: string, fileName: string, id: string, html: string) {
        const filePath = pathToFile + '/' + fileName + '.html';

        if (fs.existsSync(filePath)) {
            this.log('HTML #' + id + ' already exists', 'warning');
            return;
        }

        fs.writeFileSync(filePath, html);
        fs.chmodSync(filePath, 0o770);
        fs.chownSync(filePath, this.configuration.userId, this.configuration.groupId);
        this.log('Created HTML #' + id + ' successful', 'success');
    }

    private createPdf(pathToFile: string, fileName: string, id: string, html: string) {
        const filePath = pathToFile + '/' + fileName + '.pdf';

        if (fs.existsSync(filePath)) {
            this.log('PDF #' + id + ' already exists', 'warning');
            return;
        }

        const pdfOptions: CreateOptions = {
            phantomPath: this.configuration.phantomjs,
            format: 'A4',
        };

        pdf.create(html, pdfOptions).toFile(filePath, (pdfError: any, pdfResult: any) => {
            if (pdfError) {
                this.log(pdfError, 'error');
            } else {
                fs.chmodSync(filePath, 0o770);
                fs.chownSync(filePath, this.configuration.userId, this.configuration.groupId);
                this.log('Created PDF #' + id + ' successful', 'success');
            }

            return;
        });
    }

    private saveAttachments(pathToFile: string, id: string, attachments: Attachment[]) {
        this.log('Attachments: ' + attachments.length);

        attachments.forEach((attachment) => {
            const filePath = pathToFile + '/' + attachment.filename;

            if (fs.existsSync(filePath)) {
                this.log('Attachment ' + attachment.filename + ' of #' + id + ' already exists', 'warning');
                return;
            }

            fs.writeFileSync(filePath, attachment.content, 'binary');
            fs.chmodSync(filePath, 0o770);
            fs.chownSync(filePath, this.configuration.userId, this.configuration.groupId);
            this.log('Created attachment ' + attachment.filename + ' of #' + id + ' successful', 'success');
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
