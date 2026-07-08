/** Service Worker 可用的 EH 错误页解析（不依赖 document） */

const decodeBasicEntities = (text: string) =>
  text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const stripHtml = (html: string) =>
  decodeBasicEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (text: string, max = 200) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

const extractDivDText = (html: string): string | null => {
  const match = html.match(/<div[^>]*\bclass="d"[^>]*>([\s\S]*?)<\/div>/i);
  return match ? stripHtml(match[1]) : null;
};

const extractH1Text = (html: string): string | null => {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripHtml(match[1]) : null;
};

type KnownPattern = {
  test: RegExp;
  message: string | ((html: string) => string | null);
};

const KNOWN_PATTERNS: KnownPattern[] = [
  {
    test: /\b509\b|bandwidth limit exceeded|viewed too many images|image limits? exceeded/i,
    message: 'Image quota exceeded (509)',
  },
  {
    test: /your ip address has been temporarily banned/i,
    message: (html) => {
      const text = stripHtml(html);
      const match = text.match(/your ip address has been temporarily banned[^.]*(?:\.[^.]*)?/i);
      return match ? truncate(match[0]) : 'IP temporarily banned for excessive requests';
    },
  },
  {
    test: /opening pages too fast|pageloads too quickly/i,
    message: 'Opening pages too fast — slow down or increase download interval',
  },
  {
    test: /ipb_member_id|requires you to log on|must be logged in|you are not logged in/i,
    message: 'Login required',
  },
  {
    test: /sad_panda|sadpanda|content is unavailable in your country/i,
    message: 'Content unavailable (sad panda)',
  },
  {
    test: /page load has been aborted due to a fatal error/i,
    message: 'EH fatal error — try again later',
  },
  {
    test: /read only|failover mode/i,
    message: 'EH site is in read-only / failover mode',
  },
  {
    test: /gallery (?:has been )?removed|gallery not found|this gallery is unavailable/i,
    message: 'Gallery unavailable or removed',
  },
  {
    test: /could not get dispatch for image|h@h.*(?:error|failed)|\[err\]/i,
    message: (html) => {
      const text = stripHtml(html);
      const match = text.match(/(?:could not get dispatch for image|\[err\][^.]{0,120})/i);
      return match ? truncate(match[0]) : 'Image server (H@H) error';
    },
  },
  {
    test: /cloudflare|attention required|cf-browser-verification/i,
    message: 'Blocked by Cloudflare — verify in browser first',
  },
  {
    test: /\b503\b|service unavailable/i,
    message: 'Service unavailable (503)',
  },
  {
    test: /\b403\b|forbidden/i,
    message: 'Access forbidden (403)',
  },
];

const matchKnownPattern = (html: string): string | null => {
  for (const pattern of KNOWN_PATTERNS) {
    if (!pattern.test.test(html)) continue;
    if (typeof pattern.message === 'function') {
      const msg = pattern.message(html);
      if (msg) return msg;
    } else {
      return pattern.message;
    }
  }
  return null;
};

const isGenericEhTitle = (title: string) =>
  /^(e-?hentai|exhentai)\b/i.test(title) && title.length < 40;

/** 从 HTML 错误页提取可读错误信息；无法识别时返回 null */
export const extractHtmlErrorMessage = (html: string): string | null => {
  const known = matchKnownPattern(html);
  if (known) return known;

  const divD = extractDivDText(html);
  if (divD && divD.length >= 4) return truncate(divD);

  const h1 = extractH1Text(html);
  if (h1 && !isGenericEhTitle(h1)) return truncate(h1);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    const title = stripHtml(titleMatch[1]);
    if (title && !isGenericEhTitle(title)) return truncate(title);
  }

  const bodyText = stripHtml(html);
  if (bodyText.length >= 8 && bodyText.length <= 500) return truncate(bodyText);

  return null;
};
