import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { SitemapItem } from '@astrojs/sitemap';

const docsDir = fileURLToPath(new URL('./content/docs/', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function walk(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	const files: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) files.push(...walk(full));
		else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) files.push(full);
	}
	return files;
}

function routeSlug(file: string): string {
	const rel = path.relative(docsDir, file).split(path.sep).join('/');
	let slug = rel.replace(/\.mdx?$/, '');
	if (slug === 'index') return '';
	if (slug.endsWith('/index')) slug = slug.slice(0, -'/index'.length);
	return slug
		.split('/')
		.map((segment) => segment.toLowerCase())
		.join('/');
}

function publishedPaths(): Set<string> {
	const paths = new Set<string>(['/']);
	for (const file of walk(docsDir)) {
		const slug = routeSlug(file);
		const pathname = slug ? `/${slug}/` : '/';
		paths.add(pathname);
		paths.add(pathname === '/' ? '/' : pathname.slice(0, -1));
	}
	return paths;
}

export function sitemapFilter(page: string): boolean {
	const pathname = new URL(page).pathname;
	if (pathname.includes('/404')) return false;
	return publishedPaths().has(pathname);
}

type SitemapLink = { url: string; lang?: string };

const lastmodCache = new Map<string, string | undefined>();

function gitLastmod(target: string): string | undefined {
	try {
		const stamp = execFileSync('git', ['log', '-1', '--format=%cI', '--', target], {
			cwd: repoRoot,
			encoding: 'utf8',
		}).trim();
		return stamp || undefined;
	} catch {
		return undefined;
	}
}

function contentFile(pathname: string): string | undefined {
	const slug = pathname.replace(/^\/|\/$/g, '');
	const base = slug ? path.join(docsDir, slug) : path.join(docsDir, 'index');
	for (const ext of ['.md', '.mdx']) {
		if (fs.existsSync(base + ext)) return base + ext;
		if (fs.existsSync(path.join(base, 'index' + ext))) return path.join(base, 'index' + ext);
	}
	return undefined;
}

function lastmodFor(url: string): string | undefined {
	const pathname = new URL(url).pathname;
	if (lastmodCache.has(pathname)) return lastmodCache.get(pathname);
	const file = contentFile(pathname);
	let stamp = file ? gitLastmod(path.relative(repoRoot, file)) : undefined;
	if (!stamp && pathname.startsWith('/en/api/')) {
		const pkg = pathname.split('/')[3];
		if (pkg) stamp = gitLastmod(path.join('nodejs/packages', pkg));
	}
	lastmodCache.set(pathname, stamp);
	return stamp;
}

export function sitemapSerialize(item: SitemapItem): SitemapItem {
	const links: SitemapLink[] = item.links ?? [];
	let next = links;
	const japanese = links.find((link) => link.lang === 'ja');
	if (japanese && !links.some((link) => link.lang === 'x-default')) {
		next = [...links, { url: japanese.url, lang: 'x-default' }];
	} else if (links.length === 0 && item.url.includes('/en/api/')) {
		next = [
			{ url: item.url, lang: 'en' },
			{ url: item.url, lang: 'x-default' },
		];
	}
	const lastmod = lastmodFor(item.url);
	return { ...item, links: next.length > 0 ? next : item.links, ...(lastmod ? { lastmod } : {}) };
}

export function sitemapApiChunk(item: SitemapItem): SitemapItem | undefined {
	return item.url.includes('/en/api/') ? item : undefined;
}

function yamlString(value: string): string {
	return JSON.stringify(value.replace(/\s+/g, ' ').trim());
}

function summary(body: string, title: string): string {
	const lines = body.split('\n');
	const paragraph: string[] = [];
	let started = false;
	for (const line of lines) {
		const trimmed = line.trim();
		if (!started) {
			if (!trimmed || trimmed.startsWith('>') || trimmed.startsWith('#') || trimmed.startsWith('```')) continue;
			if (trimmed.startsWith('Defined in:')) continue;
			if (/^\*\*.+\*\*\(/.test(trimmed)) continue;
			started = true;
		}
		if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```')) break;
		paragraph.push(trimmed);
	}
	const text = paragraph
		.join(' ')
		.replace(/`/g, '')
		.replace(/\[(.*?)\]\([^)]*\)/g, '$1')
		.replace(/\s+/g, ' ')
		.trim();
	if (text.length >= 12) return text.length > 180 ? `${text.slice(0, 177).replace(/\s+\S*$/, '')}…` : text;
	return `${title} — MDI JavaScript API.`;
}

function stampApiDescriptions(): void {
	const apiDir = path.join(docsDir, 'en/api');
	for (const file of walk(apiDir)) {
		if (!file.endsWith('.md')) continue;
		const text = fs.readFileSync(file, 'utf8');
		if (!text.startsWith('---\n')) continue;
		const end = text.indexOf('\n---', 4);
		if (end < 0) continue;
		const frontmatter = text.slice(4, end);
		if (/^description:/m.test(frontmatter)) continue;
		const title = frontmatter.match(/^title:\s*"?([^"\n]+)"?/m)?.[1] ?? path.basename(file, '.md');
		const description = summary(text.slice(end + 4), title);
		const next = `---\n${frontmatter}\ndescription: ${yamlString(description)}\n---${text.slice(end + 4)}`;
		fs.writeFileSync(file, next);
	}
}

function redirects(): Record<string, string> {
	const map: Record<string, string> = {
		'/ja': '/',
		'/api': '/en/api/mdi/readme/',
	};
	for (const file of walk(docsDir)) {
		const slug = routeSlug(file);
		if (!slug || slug.startsWith('en/') || slug.startsWith('zh-tw/')) continue;
		map[`/ja/${slug}`] = `/${slug}/`;
	}
	const apiDir = path.join(docsDir, 'en/api');
	for (const file of walk(apiDir)) {
		const slug = routeSlug(file);
		const rest = slug.slice('en/'.length);
		const target = `/${slug}/`;
		map[`/${rest}`] = target;
		map[`/ja/${rest}`] = target;
		map[`/zh-tw/${rest}`] = target;
	}
	return map;
}

export function seoLocale(): AstroIntegration {
	return {
		name: 'mdi-seo-locale',
		hooks: {
			'astro:config:setup': ({ updateConfig }) => {
				stampApiDescriptions();
				updateConfig({ redirects: redirects() });
			},
		},
	};
}
