// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import astroExpressiveCode from 'astro-expressive-code';
import mdx from '@astrojs/mdx';
import starlight from '@astrojs/starlight';
import { seoLocale, sitemapFilter, sitemapSerialize } from './src/seo-locale.ts';
import { createStarlightTypeDocPlugin } from 'starlight-typedoc';
import remarkMdi from '@illusions-lab/mdi-remark';
import { mdiHandlers } from '@illusions-lab/mdi-to-hast';

/**
 * Rust-backed parser adapter for Astro's remark pipeline. It replaces the
 * historical JavaScript micromark parser, then feeds the resulting mdast
 * through Astro's ordinary rehype phase.
 */

const packages = [
	'mdi',
	'mdast-util-mdi',
	'remark',
	'to-hast',
	'to-html',
	'to-pdf',
	'to-epub',
	'to-docx',
	'cli',
];

const siteUrl = 'https://mdi.illusions.app';
const gaMeasurementId = 'G-DENP46LBX6';

const apiPlugins = [];
const apiSidebar = [];
for (const dir of packages) {
	const [plugin, sidebarGroup] = createStarlightTypeDocPlugin();
	apiPlugins.push(
		plugin({
			entryPoints: [`../nodejs/packages/${dir}/src/index.ts`],
			tsconfig: `../nodejs/packages/${dir}/tsconfig.json`,
			output: `en/api/${dir}`,
			sidebar: { label: dir },
			// Package READMEs are one-line npm stubs; the docs site itself
			// is the long-form documentation, so skip the readme page.
			typeDoc: { readme: 'none' },
		}),
	);
	apiSidebar.push(sidebarGroup);
}

// https://astro.build/config
export default defineConfig({
	site: siteUrl,
	markdown: {
		remarkPlugins: [remarkMdi],
		remarkRehype: { handlers: mdiHandlers },
	},
	integrations: [
		sitemap({
			filter: sitemapFilter,
			serialize: sitemapSerialize,
			i18n: {
				defaultLocale: 'root',
				locales: { root: 'ja', en: 'en', 'zh-tw': 'zh-TW' },
			},
		}),
		// The site is deliberately dark-only. Supplying just one theme prevents
		// syntax-highlighted code from following the operating system preference.
		astroExpressiveCode({ themes: ['github-dark'] }),
		// `remarkMdi` owns the Markdown parser for .md files. MDX needs its
		// standard parser so imports and JSX components remain executable.
		mdx({ extendMarkdownConfig: false }),
		starlight({
			title: 'MDI',
			titleDelimiter: '|',
			favicon: '/illusions-kanji.svg',
			description: '幻想 Markdown（MDI）のための Rust-powered tooling。',
			head: [
				{ tag: 'meta', attrs: { name: 'theme-color', content: '#111827' } },
				{
					tag: 'script',
					attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}` },
				},
				{
					tag: 'script',
					content: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaMeasurementId}');`,
				},
				{
					tag: 'script',
					attrs: { type: 'application/ld+json' },
					content: JSON.stringify({
						'@context': 'https://schema.org',
						'@type': 'WebSite',
						name: 'MDI',
						url: siteUrl,
						description: '幻想 Markdown（MDI）のための Rust-powered tooling。',
						inLanguage: 'ja',
					}),
				},
				{ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
				{ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true } },
			{
				tag: 'link',
				attrs: {
					rel: 'stylesheet',
					href: 'https://fonts.googleapis.com/css2?family=Zen+Old+Mincho&display=swap',
				},
			},
		],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/illusions-lab/MDI' },
				{ icon: 'x.com', label: 'X', href: 'https://x.com/illusionsapp' },
			],
			defaultLocale: 'root',
			locales: {
				root: { label: '日本語', lang: 'ja' },
				en: { label: 'English', lang: 'en' },
				'zh-tw': { label: '正體中文', lang: 'zh-TW' },
			},
			customCss: ['@illusions-lab/mdi-to-hast/mdi.css', './src/styles/docs.css'],
			routeMiddleware: './src/route-data.ts',
			components: {
				Header: './src/components/Header.astro',
				Footer: './src/components/Footer.astro',
				ThemeProvider: './src/components/ForcedDarkTheme.astro',
				ThemeSelect: './src/components/Empty.astro',
			},
			plugins: apiPlugins,
			sidebar: [
				{
					label: '学ぶ',
					translations: { en: 'Learn', 'zh-TW': '學習' },
					items: [
						{ label: 'MDI とは？', translations: { en: 'What is MDI?', 'zh-TW': '什麼是 MDI？' }, slug: 'learn/what-is-mdi' },
						{
							label: '記法の対照',
							translations: { en: 'Notation comparison', 'zh-TW': 'Notation comparison' },
							slug: 'learn/notation-comparison',
						},
						{ label: 'コア概念', translations: { en: 'Core concepts', 'zh-TW': '核心概念' }, slug: 'learn/core-concepts' },
						{
							label: 'はじめに',
							translations: { en: 'Getting Started', 'zh-TW': '快速上手' },
							slug: 'guides/getting-started',
						},
						{ label: '完全構文リファレンス', translations: { en: 'Full syntax reference', 'zh-TW': '完整語法參考' }, slug: 'syntax/reference' },
						{
							label: '編集コメント',
							translations: { en: 'Editorial comments', 'zh-TW': 'Editorial comments' },
							slug: 'syntax/comments',
						},
					],
				},
				{
					label: 'コア',
					translations: { en: 'Core', 'zh-TW': '核心' },
					items: [
						{ label: 'Rust 主導アーキテクチャ', translations: { en: 'Rust-authoritative architecture', 'zh-TW': 'Rust 權威架構' }, slug: 'core/architecture' },
						{ label: 'ドキュメント IR', translations: { en: 'Document IR', 'zh-TW': '文件 IR' }, slug: 'core/document-ir' },
						{ label: '診断と UTF-8 ソーススパン', translations: { en: 'Diagnostics and UTF-8 source spans', 'zh-TW': '診斷與 UTF-8 原始碼 span' }, slug: 'core/diagnostics' },
						{ label: 'レンダリングと Chromium/PDF 境界', translations: { en: 'Rendering model and Chromium/PDF boundary', 'zh-TW': '渲染模型與 Chromium/PDF 邊界' }, slug: 'core/rendering' },
						{ label: 'Rust Core API の状態', translations: { en: 'Rust Core API status', 'zh-TW': 'Rust Core API 狀態' }, slug: 'core/rust-api' },
					],
				},
				{
					label: 'バインディング',
					translations: { en: 'Bindings', 'zh-TW': 'Bindings' },
					items: [
						{ label: 'JavaScript / TypeScript', slug: 'bindings/javascript' },
						{ label: 'Android / Kotlin', slug: 'bindings/android' },
						{ label: 'Rust', slug: 'bindings/rust' },
						{ label: 'Python', slug: 'bindings/python' },
						{ label: 'Swift', slug: 'bindings/swift' },
						{ label: 'CLI', slug: 'bindings/cli' },
					],
				},
				{
					label: 'エコシステム',
					translations: { en: 'Ecosystem', 'zh-TW': '生態系' },
					items: [
						{ label: 'Remark / mdast アダプター', translations: { en: 'Remark / mdast adapter', 'zh-TW': 'Remark / mdast adapter' }, slug: 'ecosystem/remark' },
						{ label: 'エクスポート・プロファイル', translations: { en: 'Export profiles', 'zh-TW': '匯出設定檔' }, slug: 'ecosystem/export-profiles' },
						{ label: 'note 書き出し', translations: { en: 'note export', 'zh-TW': 'note 匯出' }, slug: 'ecosystem/note' },
						{ label: 'HTML / TXT / EPUB / DOCX / PDF 出力', translations: { en: 'HTML / TXT / EPUB / DOCX / PDF outputs', 'zh-TW': 'HTML / TXT / EPUB / DOCX / PDF 出力' }, slug: 'ecosystem/outputs' },
						{ label: '移行と互換性', translations: { en: 'Migration and compatibility', 'zh-TW': '遷移與相容性' }, slug: 'ecosystem/compatibility' },
					],
				},
				{
					label: '構文',
					translations: { en: 'Syntax', 'zh-TW': '語法' },
					items: [
						{
							label: 'ライブ・ショーケース',
							translations: { en: 'Live Showcase', 'zh-TW': '即時渲染展示' },
							slug: 'syntax/showcase',
						},
					],
				},
				{
					label: 'API リファレンス',
					translations: { en: 'API Reference', 'zh-TW': 'API 參考' },
					items: apiSidebar,
				},
			],
		}),
		seoLocale(),
	],
});
