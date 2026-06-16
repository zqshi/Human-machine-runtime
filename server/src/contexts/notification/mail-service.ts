/**
 * MailService —— 邮件发送能力
 *
 * - IMailSender 接口：便于单测 mock 与未来替换实现（如对接外部 cm-reporter）。
 * - NodemailerMailSender：基于 nodemailer + SMTP，未配置 SMTP 时 isConfigured=false（noop，不抛错），
 *   供 dev/未配邮件环境使用；调用方按 isConfigured 决定是否发。
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from '../../app/logger.js';

export interface MailMessage {
  to: string[];
  cc?: string[];
  subject: string;
  /** 纯文本正文 */
  text?: string;
  /** HTML 正文（可选，优先于 text） */
  html?: string;
}

export interface IMailSender {
  isConfigured: boolean;
  send(msg: MailMessage): Promise<{ messageId?: string }>;
}

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  /** 发件人地址 */
  from: string;
  /** SMTP 认证（可选，内部中继可匿名） */
  user?: string;
  pass?: string;
}

export class NodemailerMailSender implements IMailSender {
  private transporter: Transporter | null = null;

  constructor(private cfg: MailConfig | null) {
    if (cfg && cfg.host) {
      this.transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        ...(cfg.user ? { auth: { user: cfg.user, pass: cfg.pass } } : {}),
      });
    }
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(msg: MailMessage): Promise<{ messageId?: string }> {
    if (!this.transporter || !this.cfg) {
      logger.warn({ to: msg.to, subject: msg.subject }, 'mail: not configured, skip');
      return {};
    }
    const info = await this.transporter.sendMail({
      from: this.cfg.from,
      to: msg.to.join(', '),
      ...(msg.cc && msg.cc.length ? { cc: msg.cc.join(', ') } : {}),
      subject: msg.subject,
      ...(msg.text ? { text: msg.text } : {}),
      ...(msg.html ? { html: msg.html } : {}),
    });
    logger.info({ to: msg.to, subject: msg.subject, messageId: info.messageId }, 'mail: sent');
    return { messageId: info.messageId };
  }
}
