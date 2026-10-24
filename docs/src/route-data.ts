import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { getCollection } from 'astro:content';

let idsPromise: Promise<Set<string>> | undefined;

function loadIds(): Promise<Set<string>> {
	idsPromise ??= getCollection('docs').then(
		(entries) => new Set(entries.map((entry) => normalizeId(entry.id))),
	);
	return idsPromise;
}

function normalizeId(id: string): string {
	if (id === 'index') return '';
	if (id.endsWith('/index')) return id.slice(0, -'/index'.length);
	return id;
}

function unlocalized(id: string): string {
	const normalized = normalizeId(id);
	if (normalized === 'en' || normalized === 'zh-tw') return '';
	if (normalized.startsWith('en/')) return normalized.slice('en/'.length);
	if (normalized.startsWith('zh-tw/')) return normalized.slice('zh-tw/'.length);
	return normalized;
}

function localeId(locale: 'ja' | 'en' | 'zh-tw', slug: string): string {
	if (locale === 'ja') return slug;
	return slug ? `${locale}/${slug}` : locale;
}

export const onRequest = defineRouteMiddleware(async (context) => {
	const route = context.locals.starlightRoute;
	const ids = await loadIds();
	const slug = unlocalized(route.id);
	const present = {
		ja: ids.has(localeId('ja', slug)),
		en: ids.has(localeId('en', slug)),
		'zh-TW': ids.has(localeId('zh-tw', slug)),
	};

	const canonical = route.head.find((tag) => tag.tag === 'link' && tag.attrs?.rel === 'canonical')?.attrs
		?.href;
	const japanese = route.head.find((tag) => tag.tag === 'link' && tag.attrs?.hreflang === 'ja')?.attrs?.href;

	route.head = route.head.filter((tag) => {
		if (tag.tag !== 'link' || tag.attrs?.rel !== 'alternate') return true;
		const lang = tag.attrs.hreflang;
		if (lang === 'x-default' || lang == null) return true;
		if (lang === 'ja') return present.ja;
		if (lang === 'en') return present.en;
		if (lang === 'zh-TW') return present['zh-TW'];
		return true;
	});

	for (const tag of route.head) {
		if (tag.tag === 'link' && tag.attrs?.hreflang === 'x-default' && tag.attrs) {
			tag.attrs.href = present.ja && japanese ? japanese : canonical;
		}
	}

	if (route.isFallback) {
		route.head.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex' } });
	}
});
